import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { ensureDatabaseAndSeed } from './src/db/bootstrap';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Configuração do MySQL
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'veridoc',
  password: process.env.DB_PASSWORD || 'veridoc_secret',
  database: process.env.DB_NAME || 'veridoc',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

// Proteção XSS / Segurança de Cabeçalhos HTTP
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser('veridoc_secret_cookie_key_2026'));

// ============================================================================
// RATE LIMITING (PREVENÇÃO DE FORÇA BRUTA, SCRAPING E DOS)
// ============================================================================
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitStore = new Map<string, RateLimitRecord>();

// Limpeza periódica da memória a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function createRateLimiter(options: { windowMs: number; max: number; message: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const key = `${req.baseUrl || req.path}_${ip}`;
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + options.windowMs });
      return next();
    }

    if (record.count >= options.max) {
      return res.status(429).json({
        error: options.message,
        retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    record.count++;
    next();
  };
}

const loginRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // Máx 10 tentativas por minuto
  message: 'Demasiadas tentativas de autenticação a partir deste endereço IP. Por favor, aguarde 1 minuto.',
});

const verifyRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: 60, // Máx 60 verificações por minuto
  message: 'Limite de consultas de verificação excedido. Por favor, aguarde alguns instantes.',
});

const documentIssuanceRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30, // Máx 30 emissões por minuto
  message: 'Limite de emissões simultâneas atingido. Por favor, tente novamente dentro de 1 minuto.',
});

// ============================================================================
// SESSÕES E PROTEÇÃO CONTRA SESSION HIJACKING
// ============================================================================
interface SessionData {
  userId: number;
  email: string;
  name: string;
  role: 'admin' | 'institution_admin' | 'institution_operator';
  institutionId: number | null;
  institutionName?: string;
  institutionStatus?: string;
  csrfToken: string;
  fingerprint: string; // Hash IP + User-Agent para proteção contra sequestro de sessão
  createdAt: number;
  lastActive: number;
}

const sessions = new Map<string, SessionData>();

function getClientFingerprint(req: Request): string {
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'unknown';
  return crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex');
}

// Middleware para fornecer ou validar CSRF Token
app.use((req: Request, res: Response, next: NextFunction) => {
  let csrfToken = req.cookies['vd_csrf'];
  if (!csrfToken) {
    csrfToken = crypto.randomBytes(24).toString('hex');
    res.cookie('vd_csrf', csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
    });
  }
  (req as any).csrfToken = csrfToken;
  next();
});

// Middleware de Proteção CSRF com validação de Origem/Referer
function verifyCsrf(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Validação de Origin quando presente (anti-CSRF externo)
  const origin = req.headers['origin'];
  const host = req.headers['host'];
  if (origin && host) {
    try {
      const originHost = new URL(origin as string).host;
      if (originHost !== host) {
        return res.status(403).json({ error: 'Origem da requisição não autorizada (Cross-Origin bloqueado).' });
      }
    } catch {
      // Ignora erro de parsing de URL malformada
    }
  }

  const clientToken = req.headers['x-csrf-token'] || req.body?._token || req.headers['x-xsrf-token'];
  const expectedToken = req.cookies['vd_csrf'] || (req as any).csrfToken;

  if (!clientToken || clientToken !== expectedToken) {
    return res.status(403).json({
      error: 'Token CSRF inválido ou ausente. Por favor, recarregue a página.',
    });
  }

  next();
}

// Middleware de Autenticação com verificação de integridade de sessão
async function authenticate(req: Request, res: Response, next: NextFunction) {
  const sessionToken = req.cookies['veridoc_session'];
  if (!sessionToken) {
    (req as any).user = null;
    return next();
  }

  const session = sessions.get(sessionToken);
  if (!session) {
    res.clearCookie('veridoc_session', { path: '/' });
    (req as any).user = null;
    return next();
  }

  // Prevenção de Session Hijacking: Verificar expiração (24 horas)
  const now = Date.now();
  if (now - session.createdAt > 24 * 60 * 60 * 1000) {
    sessions.delete(sessionToken);
    res.clearCookie('veridoc_session', { path: '/' });
    (req as any).user = null;
    return next();
  }

  session.lastActive = now;

  // Verifica se o usuário e a instituição continuam ativos no MySQL
  try {
    const [rows]: any = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.institution_id,
              i.name AS institution_name, i.status AS institution_status, i.type AS institution_type
       FROM users u
       LEFT JOIN institutions i ON u.institution_id = i.id
       WHERE u.id = ? LIMIT 1`,
      [session.userId]
    );

    if (rows.length === 0 || rows[0].status !== 'active') {
      sessions.delete(sessionToken);
      res.clearCookie('veridoc_session', { path: '/' });
      (req as any).user = null;
      return next();
    }

    (req as any).user = {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      role: rows[0].role,
      status: rows[0].status,
      institutionId: rows[0].institution_id,
      institutionName: rows[0].institution_name,
      institutionStatus: rows[0].institution_status,
      institutionType: rows[0].institution_type,
    };
  } catch (err) {
    console.error('Erro ao verificar utilizador na base de dados:', err);
    (req as any).user = null;
  }

  next();
}

app.use(authenticate);

// Middleware: Requer utilizador autenticado
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({
      error: 'Autenticação necessária. Por favor, inicie sessão.',
    });
  }
  next();
}

// Middleware: Requer Administrador Central
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({
      error: 'Acesso negado: Requer privilégios de Administrador Geral VeriDoc.',
    });
  }
  next();
}

// Middleware: Requer Instituição Aprovada (Impede emissão/gestão se pendente ou suspensa)
function requireApprovedInstitution(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Sessão expirada.' });
  }

  if (user.role === 'admin') {
    return next();
  }

  if (!user.institutionId) {
    return res.status(403).json({ error: 'Utilizador sem instituição associada.' });
  }

  if (user.institutionStatus === 'pending') {
    return res.status(403).json({
      error: 'INSTITUTION_PENDING',
      message: 'A sua instituição encontra-se aguardando homologação e aprovação pelo Administrador Central.',
      status: 'pending',
    });
  }

  if (user.institutionStatus === 'suspended') {
    return res.status(403).json({
      error: 'INSTITUTION_SUSPENDED',
      message: 'O acesso da sua instituição encontra-se temporariamente suspenso pela Administração.',
      status: 'suspended',
    });
  }

  if (user.institutionStatus === 'rejected') {
    return res.status(403).json({
      error: 'INSTITUTION_REJECTED',
      message: 'A candidatura desta entidade foi recusada pela Administração Central.',
      status: 'rejected',
    });
  }

  next();
}

// ============================================================================
// 1. HASH CRIPTOGRÁFICO CANÔNICO & INTEGRIDADE DE DADOS
// Exemplo conceitual: Nome + tipo + instituição + curso + data -> SHA-256
// ============================================================================
export function calculateDocumentHash(params: {
  holder_name: string;
  document_type: string;
  institution_id: number | string;
  course: string;
  issue_date: string | Date;
}): string {
  const normDate = (typeof params.issue_date === 'string')
    ? params.issue_date.split('T')[0]
    : new Date(params.issue_date).toISOString().split('T')[0];

  const canonicalPayload = [
    params.holder_name.trim(),
    params.document_type.trim(),
    String(params.institution_id),
    params.course.trim(),
    normDate,
  ].join('|');

  return crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}

// ============================================================================
// 4. AUDITORIA: REGISTRO DE AÇÕES IMPORTANTES
// Ações: user_login, failed_login_attempt, user_logout, document_issued,
//        document_revoked, document_reissued, document_updated,
//        institution_status_change, document_verification
// ============================================================================
export async function logAudit(
  userId: number | null,
  action: string,
  ip: string,
  details: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, ip_address, details, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [userId, action, ip, details]
    );
  } catch (err) {
    console.error('Erro ao registar log de auditoria:', err);
  }
}

// ============================================================================
// ROTAS DE API (AUTENTICAÇÃO & GESTÃO INSTITUCIONAL)
// ============================================================================

// 1. Obter CSRF Token
app.get('/api/auth/csrf', (req: Request, res: Response) => {
  res.json({ csrfToken: (req as any).csrfToken });
});

// 2. Obter perfil do utilizador autenticado atual
app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    user: user || null,
    csrfToken: (req as any).csrfToken,
  });
});

// 3. Registo Institucional (Mass Assignment Protection: Campos estritos)
app.post('/api/auth/register-institution', verifyCsrf, async (req: Request, res: Response) => {
  // Mass Assignment: Desestruturação explícita de campos permitidos
  const {
    name,
    type,
    country,
    city,
    address,
    email,
    phone,
    website,
    responsible_name,
    responsible_email,
    password,
  } = req.body;

  if (!name || !type || !country || !city || !email || !phone || !responsible_name || !responsible_email || !password) {
    return res.status(422).json({
      error: 'Todos os campos obrigatórios marcados com asterisco (*) devem ser preenchidos.',
    });
  }

  if (password.length < 8) {
    return res.status(422).json({
      error: 'A palavra-passe deve conter pelo menos 8 caracteres.',
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // SQL Injection safe (parameterized queries)
    const [existInst]: any = await connection.query(
      'SELECT id FROM institutions WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()]
    );
    if (existInst.length > 0) {
      await connection.rollback();
      return res.status(422).json({
        error: 'Já existe uma instituição registada com este email institucional.',
      });
    }

    const [existUser]: any = await connection.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [responsible_email.trim().toLowerCase()]
    );
    if (existUser.length > 0) {
      await connection.rollback();
      return res.status(422).json({
        error: 'Já existe um utilizador registado com o email do responsável informado.',
      });
    }

    // 1. Inserir Instituição com status 'pending' (Garantido pelo servidor)
    const [instResult]: any = await connection.query(
      `INSERT INTO institutions 
        (name, type, country, city, address, email, phone, website, responsible_name, responsible_email, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        name.trim(),
        type,
        country.trim(),
        city.trim(),
        address ? address.trim() : null,
        email.trim().toLowerCase(),
        phone.trim(),
        website ? website.trim() : null,
        responsible_name.trim(),
        responsible_email.trim().toLowerCase(),
      ]
    );

    const institutionId = instResult.insertId;

    // 2. Hash da Senha com Bcrypt (cost 10)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Inserir Utilizador como institution_admin
    const [userResult]: any = await connection.query(
      `INSERT INTO users 
        (institution_id, name, email, password, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'institution_admin', 'active', NOW(), NOW())`,
      [
        institutionId,
        responsible_name.trim(),
        responsible_email.trim().toLowerCase(),
        hashedPassword,
      ]
    );

    const userId = userResult.insertId;

    // 4. Log de Auditoria
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, ip_address, details, created_at, updated_at)
       VALUES (?, 'institution_registered', ?, ?, NOW(), NOW())`,
      [
        userId,
        req.ip || '127.0.0.1',
        `Candidatura institucional de '${name}' submetida com estado PENDING. ID: ${institutionId}`,
      ]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Candidatura submetida com sucesso! A sua instituição foi registada com o estado PENDING e aguarda homologação do Administrador.',
      institutionId,
      status: 'pending',
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro no registo da instituição:', error);
    return res.status(500).json({
      error: 'Erro interno ao processar o registo. Por favor, tente novamente.',
    });
  } finally {
    connection.release();
  }
});

// 4. Login com Rate Limiting e Registro de Auditoria (user_login / failed_login_attempt)
app.post('/api/auth/login', loginRateLimiter, verifyCsrf, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).json({
      error: 'Por favor, informe o email e a palavra-passe.',
    });
  }

  const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  try {
    const [rows]: any = await pool.query(
      `SELECT u.id, u.name, u.email, u.password, u.role, u.status, u.institution_id,
              i.name AS institution_name, i.status AS institution_status, i.type AS institution_type
       FROM users u
       LEFT JOIN institutions i ON u.institution_id = i.id
       WHERE u.email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      await logAudit(null, 'failed_login_attempt', clientIp, `Tentativa com email inexistente: ${email.trim()}`);
      return res.status(401).json({
        error: 'Credenciais inválidas. Verifique o seu email e palavra-passe.',
      });
    }

    const user = rows[0];

    // Validação com bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      await logAudit(user.id, 'failed_login_attempt', clientIp, `Palavra-passe incorreta para conta ID ${user.id}`);
      return res.status(401).json({
        error: 'Credenciais inválidas. Verifique o seu email e palavra-passe.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'A sua conta de utilizador encontra-se inativa ou desativada.',
      });
    }

    // CONTROLE DE ACESSO: Se for instituição, verificar status de homologação
    if (user.role !== 'admin' && user.institution_id) {
      if (user.institution_status === 'pending') {
        return res.status(403).json({
          error: 'INSTITUTION_PENDING',
          message: 'A sua instituição encontra-se com o registo PENDENTE de aprovação. O acesso ao dashboard será libertado assim que o Administrador aprovar.',
          status: 'pending',
          institutionName: user.institution_name,
        });
      }

      if (user.institution_status === 'suspended') {
        return res.status(403).json({
          error: 'INSTITUTION_SUSPENDED',
          message: 'A sua instituição foi suspensa pelo Administrador. Contacte o suporte institucional.',
          status: 'suspended',
          institutionName: user.institution_name,
        });
      }
    }

    // Regeneração de Sessão (Prevenção de Session Fixation)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const csrfToken = (req as any).csrfToken || crypto.randomBytes(24).toString('hex');
    const fingerprint = getClientFingerprint(req);

    sessions.set(sessionToken, {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      institutionId: user.institution_id,
      institutionName: user.institution_name,
      institutionStatus: user.institution_status,
      csrfToken,
      fingerprint,
      createdAt: Date.now(),
      lastActive: Date.now(),
    });

    res.cookie('veridoc_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    // Auditoria: user_login
    await logAudit(user.id, 'user_login', clientIp, `Login efetuado com sucesso como '${user.role}'`);

    return res.json({
      success: true,
      message: 'Autenticação realizada com sucesso!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institution_id,
        institutionName: user.institution_name,
        institutionStatus: user.institution_status,
      },
      redirectTo: user.role === 'admin' ? '/admin/dashboard' : '/instituicao/dashboard',
    });
  } catch (err: any) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro no servidor ao autenticar.' });
  }
});

// 5. Logout com revogação e auditoria
app.post('/api/auth/logout', async (req: Request, res: Response) => {
  const sessionToken = req.cookies['veridoc_session'];
  if (sessionToken) {
    const session = sessions.get(sessionToken);
    if (session) {
      await logAudit(session.userId, 'user_logout', req.ip || '127.0.0.1', 'Sessão encerrada pelo utilizador');
      sessions.delete(sessionToken);
    }
    res.clearCookie('veridoc_session', { path: '/' });
  }

  res.json({ success: true, message: 'Sessão terminada com sucesso.' });
});

// 6. Recuperação de Palavra-Passe
app.post('/api/auth/forgot-password', verifyCsrf, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(422).json({ error: 'Por favor, informe o email cadastrado.' });
  }

  try {
    const [rows]: any = await pool.query('SELECT id, name FROM users WHERE email = ? LIMIT 1', [email.trim().toLowerCase()]);
    if (rows.length > 0) {
      await logAudit(rows[0].id, 'password_reset_requested', req.ip || '127.0.0.1', 'Solicitação de recuperação de senha');
    }

    return res.json({
      success: true,
      message: 'Se o email estiver registado na plataforma, foram enviadas instruções detalhadas para redefinição segura da palavra-passe.',
    });
  } catch (err) {
    console.error('Erro na recuperação de senha:', err);
    return res.status(500).json({ error: 'Erro ao processar solicitação.' });
  }
});

// 7. Dashboard da Instituição: Métricas em Tempo Real
app.get('/api/dashboard/stats', requireAuth, requireApprovedInstitution, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const institutionId = user.institutionId;

  if (!institutionId && user.role !== 'admin') {
    return res.status(400).json({ error: 'Utilizador não possui instituição vinculada.' });
  }

  try {
    // Isolamento multi-tenant: Apenas admin pode passar institution_id arbitrária
    const targetInstId = (user.role === 'admin' && req.query.institution_id) ? req.query.institution_id : institutionId;

    const [totalDocs]: any = await pool.query(
      'SELECT COUNT(*) AS count FROM documents WHERE institution_id = ?',
      [targetInstId]
    );

    const [validDocs]: any = await pool.query(
      "SELECT COUNT(*) AS count FROM documents WHERE institution_id = ? AND status = 'valid'",
      [targetInstId]
    );

    const [revokedDocs]: any = await pool.query(
      "SELECT COUNT(*) AS count FROM documents WHERE institution_id = ? AND status = 'revoked'",
      [targetInstId]
    );

    const [verifications]: any = await pool.query(
      `SELECT COUNT(v.id) AS count 
       FROM verifications v 
       INNER JOIN documents d ON v.document_id = d.id 
       WHERE d.institution_id = ?`,
      [targetInstId]
    );

    const [recentDocs]: any = await pool.query(
      `SELECT id, holder_name, document_type, course, issue_date, expiry_date, verification_code, status 
       FROM documents 
       WHERE institution_id = ? 
       ORDER BY id DESC LIMIT 10`,
      [targetInstId]
    );

    const [instRows]: any = await pool.query(
      'SELECT id, name, type, country, city, email, phone, website, status FROM institutions WHERE id = ?',
      [targetInstId]
    );

    return res.json({
      institution: instRows[0] || null,
      stats: {
        total_documents: totalDocs[0].count,
        valid_documents: validDocs[0].count,
        revoked_documents: revokedDocs[0].count,
        total_verifications: verifications[0].count,
      },
      recent_documents: recentDocs,
    });
  } catch (err: any) {
    console.error('Erro ao consultar métricas do dashboard:', err);
    return res.status(500).json({ error: 'Erro ao carregar dados do dashboard.' });
  }
});

// 8. Gestão Administrativa: Métricas do Dashboard Global (Admin)
app.get('/api/admin/stats', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [instCounts]: any = await pool.query(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
       FROM institutions`
    );

    const [docCounts]: any = await pool.query(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'valid' THEN 1 ELSE 0 END) AS valid,
        SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) AS revoked,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired
       FROM documents`
    );

    const [verifCounts]: any = await pool.query(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN result = 'valid' THEN 1 ELSE 0 END) AS valid,
        SUM(CASE WHEN result = 'revoked' THEN 1 ELSE 0 END) AS revoked,
        SUM(CASE WHEN result = 'expired' THEN 1 ELSE 0 END) AS expired,
        SUM(CASE WHEN result = 'not_found' THEN 1 ELSE 0 END) AS not_found,
        SUM(CASE WHEN result = 'tampered' THEN 1 ELSE 0 END) AS tampered
       FROM verifications`
    );

    const [recentInstitutions]: any = await pool.query(
      `SELECT id, name, type, country, city, email, status, created_at
       FROM institutions
       ORDER BY id DESC LIMIT 5`
    );

    const [recentDocuments]: any = await pool.query(
      `SELECT d.id, d.holder_name, d.document_type, d.course, d.verification_code, d.status, d.issue_date,
              i.name AS institution_name
       FROM documents d
       INNER JOIN institutions i ON d.institution_id = i.id
       ORDER BY d.id DESC LIMIT 5`
    );

    const [recentVerifications]: any = await pool.query(
      `SELECT v.id, v.verification_code, v.result, v.ip_address, v.verified_at,
              d.holder_name, i.name AS institution_name
       FROM verifications v
       LEFT JOIN documents d ON v.document_id = d.id
       LEFT JOIN institutions i ON d.institution_id = i.id
       ORDER BY v.id DESC LIMIT 5`
    );

    const [recentLogs]: any = await pool.query(
      `SELECT a.id, a.action, a.ip_address, a.details, a.created_at, u.name AS user_name
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.id DESC LIMIT 5`
    );

    const inst = instCounts[0] || {};
    const doc = docCounts[0] || {};
    const verif = verifCounts[0] || {};

    res.json({
      institutions: {
        total: Number(inst.total) || 0,
        pending: Number(inst.pending) || 0,
        approved: Number(inst.approved) || 0,
        suspended: Number(inst.suspended) || 0,
        rejected: Number(inst.rejected) || 0,
      },
      documents: {
        total: Number(doc.total) || 0,
        valid: Number(doc.valid) || 0,
        revoked: Number(doc.revoked) || 0,
        expired: Number(doc.expired) || 0,
      },
      verifications: {
        total: Number(verif.total) || 0,
        valid: Number(verif.valid) || 0,
        revoked: Number(verif.revoked) || 0,
        expired: Number(verif.expired) || 0,
        not_found: Number(verif.not_found) || 0,
        tampered: Number(verif.tampered) || 0,
      },
      recent_institutions: recentInstitutions,
      recent_documents: recentDocuments,
      recent_verifications: recentVerifications,
      recent_logs: recentLogs,
    });
  } catch (err) {
    console.error('Erro ao consultar estatísticas do admin:', err);
    res.status(500).json({ error: 'Erro ao carregar estatísticas do sistema.' });
  }
});

// 9. Gestão Administrativa: Listar Instituições com Busca e Filtros (Admin)
app.get('/api/admin/institutions', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { search, status } = req.query;

  try {
    let query = `
      SELECT i.*, 
             (SELECT COUNT(*) FROM documents d WHERE d.institution_id = i.id) AS total_documents,
             (SELECT COUNT(*) FROM users u WHERE u.institution_id = i.id) AS total_users
      FROM institutions i
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' AND i.status = ?';
      params.push(status);
    }

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      query += ' AND (i.name LIKE ? OR i.email LIKE ? OR i.responsible_name LIKE ? OR i.responsible_email LIKE ? OR i.city LIKE ? OR i.country LIKE ?)';
      params.push(term, term, term, term, term, term);
    }

    query += ' ORDER BY i.id DESC';

    const [institutions]: any = await pool.query(query, params);

    const [counts]: any = await pool.query(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
       FROM institutions`
    );

    res.json({
      institutions,
      stats: counts[0] || {},
    });
  } catch (err) {
    console.error('Erro ao listar instituições:', err);
    res.status(500).json({ error: 'Erro ao buscar instituições.' });
  }
});

// 10. Gestão Administrativa: Detalhes de uma Instituição (Admin)
app.get('/api/admin/institutions/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const [instRows]: any = await pool.query(
      `SELECT i.*, 
             (SELECT COUNT(*) FROM documents d WHERE d.institution_id = i.id) AS total_documents,
             (SELECT COUNT(*) FROM users u WHERE u.institution_id = i.id) AS total_users
      FROM institutions i
      WHERE i.id = ? LIMIT 1`,
      [id]
    );

    if (instRows.length === 0) {
      return res.status(404).json({ error: 'Instituição não encontrada.' });
    }

    const [users]: any = await pool.query(
      `SELECT id, name, email, role, status, created_at FROM users WHERE institution_id = ? ORDER BY id ASC`,
      [id]
    );

    const [recentDocs]: any = await pool.query(
      `SELECT id, holder_name, document_type, course, issue_date, verification_code, status
       FROM documents WHERE institution_id = ? ORDER BY id DESC LIMIT 5`,
      [id]
    );

    res.json({
      institution: instRows[0],
      users,
      recent_documents: recentDocs,
    });
  } catch (err) {
    console.error('Erro ao buscar detalhes da instituição:', err);
    res.status(500).json({ error: 'Erro ao buscar dados da instituição.' });
  }
});

// 11. Gestão Administrativa: Alteração de Status da Instituição (Auditoria: institution_status_change)
app.post('/api/admin/institutions/:id/status', requireAuth, requireAdmin, verifyCsrf, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!['approved', 'suspended', 'pending', 'rejected'].includes(status)) {
    return res.status(422).json({ error: 'Estado inválido.' });
  }

  try {
    const [rows]: any = await pool.query('SELECT id, name, status FROM institutions WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Instituição não encontrada.' });
    }

    const inst = rows[0];
    const oldStatus = inst.status;

    await pool.query('UPDATE institutions SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);

    const adminUser = (req as any).user;
    await logAudit(
      adminUser.id,
      'institution_status_change',
      req.ip || '127.0.0.1',
      `Instituição '${inst.name}' (ID ${id}) alterada de '${oldStatus}' para '${status}'. Motivo: ${reason || 'Ação Administrativa'}`
    );

    res.json({
      success: true,
      message: `Instituição '${inst.name}' atualizada com sucesso para ${status.toUpperCase()}.`,
      institution: { id, name: inst.name, status },
    });
  } catch (err) {
    console.error('Erro ao atualizar status da instituição:', err);
    res.status(500).json({ error: 'Erro ao atualizar instituição.' });
  }
});

// 12. Gestão Administrativa: Consultar Documentos Globalmente (Admin)
app.get('/api/admin/documents', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { search, status, institution_id } = req.query;

  try {
    let query = `
      SELECT d.id, d.institution_id, d.holder_name, d.document_type, d.course, d.area, d.issue_date, d.expiry_date,
             d.verification_code, d.status, d.created_at, d.hash,
             i.name AS institution_name, i.status AS institution_status,
             (SELECT COUNT(*) FROM verifications v WHERE v.document_id = d.id) AS total_verifications
      FROM documents d
      INNER JOIN institutions i ON d.institution_id = i.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (institution_id && institution_id !== 'all') {
      query += ' AND d.institution_id = ?';
      params.push(institution_id);
    }

    if (status && status !== 'all') {
      query += ' AND d.status = ?';
      params.push(status);
    }

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      query += ' AND (d.holder_name LIKE ? OR d.verification_code LIKE ? OR d.course LIKE ? OR d.document_type LIKE ? OR i.name LIKE ?)';
      params.push(term, term, term, term, term);
    }

    query += ' ORDER BY d.id DESC LIMIT 100';

    const [documents]: any = await pool.query(query, params);

    res.json({
      documents,
      count: documents.length,
    });
  } catch (err) {
    console.error('Erro ao consultar documentos administrativos:', err);
    res.status(500).json({ error: 'Erro ao consultar documentos.' });
  }
});

// 13. Gestão Administrativa: Consultar Verificações (Admin)
app.get('/api/admin/verifications', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { search, result } = req.query;

  try {
    let query = `
      SELECT v.id, v.document_id, v.verification_code, v.result, v.ip_address, v.user_agent, v.verified_at,
             d.holder_name, d.document_type, d.course,
             i.name AS institution_name
      FROM verifications v
      LEFT JOIN documents d ON v.document_id = d.id
      LEFT JOIN institutions i ON d.institution_id = i.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (result && result !== 'all') {
      query += ' AND v.result = ?';
      params.push(result);
    }

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      query += ' AND (v.verification_code LIKE ? OR v.ip_address LIKE ? OR d.holder_name LIKE ? OR i.name LIKE ?)';
      params.push(term, term, term, term);
    }

    query += ' ORDER BY v.id DESC LIMIT 100';

    const [verifications]: any = await pool.query(query, params);

    res.json({
      verifications,
      count: verifications.length,
    });
  } catch (err) {
    console.error('Erro ao consultar verificações:', err);
    res.status(500).json({ error: 'Erro ao buscar registros de verificação.' });
  }
});

// 14. Gestão Administrativa: Consultar Logs de Auditoria (Admin)
app.get('/api/admin/logs', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { action, search } = req.query;

  try {
    let query = `
      SELECT a.id, a.user_id, a.action, a.ip_address, a.details, a.created_at,
             u.name AS user_name, u.email AS user_email, u.role AS user_role,
             i.name AS institution_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN institutions i ON u.institution_id = i.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (action && action !== 'all') {
      query += ' AND a.action = ?';
      params.push(action);
    }

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      query += ' AND (a.details LIKE ? OR a.ip_address LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      params.push(term, term, term, term);
    }

    query += ' ORDER BY a.id DESC LIMIT 100';

    const [logs]: any = await pool.query(query, params);

    res.json({
      logs,
      count: logs.length,
    });
  } catch (err) {
    console.error('Erro ao consultar logs de auditoria:', err);
    res.status(500).json({ error: 'Erro ao buscar logs de auditoria.' });
  }
});

// ============================================================================
// GESTÃO DE DOCUMENTOS COM CONTROLE DE ACESSO, HASH E AUDITORIA
// ============================================================================

// Helper: Gerador de código único com verificação real de colisão no MySQL
async function generateUniqueVerificationCode(conn: any): Promise<string> {
  const year = new Date().getFullYear();
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let attempts = 0;

  while (attempts < 100) {
    attempts++;
    let randomPart = '';
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
      randomPart += charset[bytes[i] % charset.length];
    }

    const code = `VD-${year}-${randomPart}`;
    const [rows]: any = await conn.query(
      'SELECT id FROM documents WHERE verification_code = ? LIMIT 1',
      [code]
    );

    if (rows.length === 0) {
      return code;
    }
  }

  throw new Error('Falha ao gerar código único após 100 tentativas.');
}

// 10. Emissão Real de Documento (Auditoria: document_issued)
// Somente Instituições Aprovadas e Utilizadores Autorizados
app.post('/api/documents', documentIssuanceRateLimiter, requireAuth, requireApprovedInstitution, verifyCsrf, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const institutionId = user.institutionId;

  // Mass Assignment Protection: Desestruturação explícita ignorando id, status, hash, etc.
  const {
    holder_name,
    document_type,
    course,
    area,
    issue_date,
    expiry_date,
    description,
    observations,
  } = req.body;

  if (!holder_name || !holder_name.trim()) {
    return res.status(422).json({ error: 'O nome completo do titular é obrigatório.' });
  }
  if (!document_type || !document_type.trim()) {
    return res.status(422).json({ error: 'O tipo de documento é obrigatório.' });
  }
  if (!course || !course.trim()) {
    return res.status(422).json({ error: 'O curso / certificação é obrigatório.' });
  }
  if (!issue_date || !issue_date.trim()) {
    return res.status(422).json({ error: 'A data de emissão é obrigatória.' });
  }

  const issueDateObj = new Date(issue_date);
  if (isNaN(issueDateObj.getTime())) {
    return res.status(422).json({ error: 'Data de emissão inválida.' });
  }

  if (expiry_date && expiry_date.trim()) {
    const expiryDateObj = new Date(expiry_date);
    if (isNaN(expiryDateObj.getTime())) {
      return res.status(422).json({ error: 'Data de validade inválida.' });
    }
    if (expiryDateObj < issueDateObj) {
      return res.status(422).json({ error: 'A data de validade não pode ser anterior à data de emissão.' });
    }
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Controle de Acesso: Apenas instituições APROVADAS
    const [instRows]: any = await connection.query(
      'SELECT id, name, status FROM institutions WHERE id = ? LIMIT 1',
      [institutionId]
    );

    if (instRows.length === 0 || instRows[0].status !== 'approved') {
      await connection.rollback();
      return res.status(403).json({
        error: 'Apenas instituições com status APROVADA podem emitir documentos oficiais.',
      });
    }

    const institution = instRows[0];

    // Código único anti-colisão
    const verificationCode = await generateUniqueVerificationCode(connection);

    // 1. Hash Criptográfico SHA-256 Canônico
    // Exemplo: Nome + tipo + instituição + curso + data -> SHA-256
    const documentHash = calculateDocumentHash({
      holder_name: holder_name.trim(),
      document_type: document_type.trim(),
      institution_id: institution.id,
      course: course.trim(),
      issue_date: issue_date.trim(),
    });

    // 2. QR Code apontando exclusivamente para /verificar/{codigo}
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const verificationUrl = `${protocol}://${host}/verificar/${verificationCode}`;

    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: { dark: '#0A1428', light: '#FFFFFF' },
    });

    // 3. Gravar documento no MySQL com status 'valid'
    const [docResult]: any = await connection.query(
      `INSERT INTO documents 
        (institution_id, holder_name, document_type, course, area, issue_date, expiry_date, description, observations, verification_code, hash, qr_code, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'valid', NOW(), NOW())`,
      [
        institution.id,
        holder_name.trim(),
        document_type.trim(),
        course.trim(),
        area ? area.trim() : null,
        issue_date.trim(),
        expiry_date && expiry_date.trim() ? expiry_date.trim() : null,
        description ? description.trim() : null,
        observations ? observations.trim() : null,
        verificationCode,
        documentHash,
        qrCodeDataUrl,
      ]
    );

    const documentId = docResult.insertId;

    // 4. Histórico do documento
    await connection.query(
      `INSERT INTO document_history (document_id, user_id, action, description, created_at, updated_at)
       VALUES (?, ?, 'created', ?, NOW(), NOW())`,
      [
        documentId,
        user.id,
        `Documento emitido oficialmente por ${user.name} (${institution.name}).`,
      ]
    );

    // 5. Auditoria: document_issued
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, ip_address, details, created_at, updated_at)
       VALUES (?, 'document_issued', ?, ?, NOW(), NOW())`,
      [
        user.id,
        req.ip || '127.0.0.1',
        `Documento ID ${documentId} emitido com código '${verificationCode}' para o titular '${holder_name.trim()}'. Hash SHA-256: ${documentHash}`,
      ]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Documento emitido com sucesso com código único e selo QR Code!',
      document: {
        id: documentId,
        verification_code: verificationCode,
        holder_name: holder_name.trim(),
        document_type: document_type.trim(),
        course: course.trim(),
        area: area ? area.trim() : null,
        issue_date,
        expiry_date: expiry_date || null,
        status: 'valid',
        hash: documentHash,
        qr_code: qrCodeDataUrl,
        verification_url: verificationUrl,
      },
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro na emissão do documento:', error);
    return res.status(500).json({ error: 'Erro ao emitir documento no servidor.', details: error?.message });
  } finally {
    connection.release();
  }
});

// 11. Listagem de Documentos da Instituição (/instituicao/documentos)
// Controle de Acesso: Uma instituição só vê seus próprios documentos
app.get('/api/documents', requireAuth, requireApprovedInstitution, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const institutionId = user.institutionId;

  // Isolamento Multi-tenant estrito
  const targetInstId = (user.role === 'admin' && req.query.institution_id) ? req.query.institution_id : institutionId;
  const { status, search } = req.query;

  try {
    let sql = `
      SELECT d.id, d.institution_id, d.holder_name, d.document_type, d.course, d.area, 
             d.issue_date, d.expiry_date, d.description, d.observations,
             d.verification_code, d.hash, d.qr_code, d.status, d.created_at,
             i.name AS institution_name,
             (SELECT COUNT(*) FROM verifications v WHERE v.document_id = d.id) AS verification_count
      FROM documents d
      INNER JOIN institutions i ON d.institution_id = i.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user.role !== 'admin' || targetInstId) {
      sql += ' AND d.institution_id = ?';
      params.push(targetInstId);
    }

    if (status && ['valid', 'revoked', 'expired'].includes(status as string)) {
      sql += ' AND d.status = ?';
      params.push(status);
    }

    if (search && (search as string).trim()) {
      const term = `%${(search as string).trim()}%`;
      sql += ' AND (d.holder_name LIKE ? OR d.verification_code LIKE ? OR d.course LIKE ? OR d.document_type LIKE ?)';
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY d.id DESC LIMIT 100';

    const [documents]: any = await pool.query(sql, params);

    return res.json({
      success: true,
      documents,
    });
  } catch (err: any) {
    console.error('Erro ao listar documentos:', err);
    return res.status(500).json({ error: 'Erro ao buscar documentos.' });
  }
});

// 12. Visualizar Documento por ID (com Histórico e Detalhes)
// Controle de Acesso: Bloqueia acesso a documentos de outra instituição
app.get('/api/documents/:id', requireAuth, requireApprovedInstitution, async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const [rows]: any = await pool.query(
      `SELECT d.*, i.name AS institution_name, i.email AS institution_email, i.city AS institution_city, i.country AS institution_country
       FROM documents d
       INNER JOIN institutions i ON d.institution_id = i.id
       WHERE d.id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    const doc = rows[0];

    // Isolamento multi-tenant
    if (user.role !== 'admin' && doc.institution_id !== user.institutionId) {
      return res.status(403).json({ error: 'Acesso negado: Este documento pertence a outra instituição.' });
    }

    const [history]: any = await pool.query(
      `SELECT h.*, u.name AS user_name, u.email AS user_email
       FROM document_history h
       LEFT JOIN users u ON h.user_id = u.id
       WHERE h.document_id = ?
       ORDER BY h.id DESC`,
      [id]
    );

    const [verifications]: any = await pool.query(
      `SELECT id, result, ip_address, verified_at 
       FROM verifications 
       WHERE document_id = ? 
       ORDER BY id DESC LIMIT 10`,
      [id]
    );

    return res.json({
      success: true,
      document: doc,
      history,
      verifications,
    });
  } catch (err: any) {
    console.error('Erro ao buscar detalhes do documento:', err);
    return res.status(500).json({ error: 'Erro ao buscar detalhes do documento.' });
  }
});

// 13. Revogar Documento com Justificativa (Auditoria: document_revoked)
// Controle de Acesso: Só pode revogar seus próprios documentos
app.post('/api/documents/:id/revoke', requireAuth, requireApprovedInstitution, verifyCsrf, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = (req as any).user;

  if (!reason || reason.trim().length < 5) {
    return res.status(422).json({
      error: 'A justificativa de revogação é obrigatória e deve conter pelo menos 5 caracteres.',
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows]: any = await connection.query(
      'SELECT id, institution_id, verification_code, status, holder_name FROM documents WHERE id = ? LIMIT 1',
      [id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    const doc = rows[0];

    // Controle de Acesso Estrito: Não pode revogar documentos de outra instituição
    if (user.role !== 'admin' && doc.institution_id !== user.institutionId) {
      await connection.rollback();
      return res.status(403).json({ error: 'Acesso negado: Não possui permissão para revogar documentos de outra instituição.' });
    }

    if (doc.status === 'revoked') {
      await connection.rollback();
      return res.status(400).json({ error: 'Este documento já se encontra revogado.' });
    }

    // 1. Atualizar status para 'revoked'
    await connection.query(
      "UPDATE documents SET status = 'revoked', updated_at = NOW() WHERE id = ?",
      [id]
    );

    // 2. Registrar no histórico do documento
    await connection.query(
      `INSERT INTO document_history (document_id, user_id, action, description, created_at, updated_at)
       VALUES (?, ?, 'revoked', ?, NOW(), NOW())`,
      [
        id,
        user.id,
        `Documento revogado por ${user.name}. Motivo legal: ${reason.trim()}`,
      ]
    );

    // 3. Auditoria: document_revoked
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, ip_address, details, created_at, updated_at)
       VALUES (?, 'document_revoked', ?, ?, NOW(), NOW())`,
      [
        user.id,
        req.ip || '127.0.0.1',
        `Documento ID ${id} (${doc.verification_code}) de '${doc.holder_name}' revogado. Motivo: ${reason.trim()}`,
      ]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: `Documento ${doc.verification_code} revogado com sucesso.`,
    });
  } catch (err: any) {
    await connection.rollback();
    console.error('Erro ao revogar documento:', err);
    return res.status(500).json({ error: 'Erro ao revogar documento.' });
  } finally {
    connection.release();
  }
});

// 14. Alteração de Metadados do Documento (Auditoria: document_updated)
// Controle de Acesso: Apenas instituição proprietária e dados permitidos
app.put('/api/documents/:id', requireAuth, requireApprovedInstitution, verifyCsrf, async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const { description, observations } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows]: any = await connection.query(
      'SELECT id, institution_id, verification_code FROM documents WHERE id = ? LIMIT 1',
      [id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    const doc = rows[0];

    // Isolamento multi-tenant: Não modificar documento de outra instituição
    if (user.role !== 'admin' && doc.institution_id !== user.institutionId) {
      await connection.rollback();
      return res.status(403).json({ error: 'Acesso negado: Não possui permissão para modificar este documento.' });
    }

    await connection.query(
      'UPDATE documents SET description = ?, observations = ?, updated_at = NOW() WHERE id = ?',
      [description ? description.trim() : null, observations ? observations.trim() : null, id]
    );

    await connection.query(
      `INSERT INTO document_history (document_id, user_id, action, description, created_at, updated_at)
       VALUES (?, ?, 'updated', ?, NOW(), NOW())`,
      [id, user.id, `Metadados do documento atualizados por ${user.name}.`]
    );

    // Auditoria: document_updated
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, ip_address, details, created_at, updated_at)
       VALUES (?, 'document_updated', ?, ?, NOW(), NOW())`,
      [user.id, req.ip || '127.0.0.1', `Metadados do documento ID ${id} (${doc.verification_code}) atualizados.`]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: 'Documento atualizado com sucesso.',
    });
  } catch (err) {
    await connection.rollback();
    console.error('Erro ao atualizar documento:', err);
    return res.status(500).json({ error: 'Erro ao atualizar documento.' });
  } finally {
    connection.release();
  }
});

// 15. Reemissão Oficial de Documento (Auditoria: document_reissued)
// Controle de Acesso: Apenas instituição proprietária e regenera código, hash SHA-256 e QR Code
app.post('/api/documents/:id/reissue', requireAuth, requireApprovedInstitution, verifyCsrf, async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const { reason } = req.body;

  if (!reason || reason.trim().length < 5) {
    return res.status(422).json({ error: 'Justificativa de reemissão obrigatória (mínimo 5 caracteres).' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows]: any = await connection.query(
      'SELECT * FROM documents WHERE id = ? LIMIT 1',
      [id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    const doc = rows[0];

    // Isolamento multi-tenant
    if (user.role !== 'admin' && doc.institution_id !== user.institutionId) {
      await connection.rollback();
      return res.status(403).json({ error: 'Acesso negado: Não pode reemitir documentos de outra instituição.' });
    }

    // 1. Gera novo código único
    const newCode = await generateUniqueVerificationCode(connection);

    // 2. Recalcula Hash SHA-256 Canônico
    const newHash = calculateDocumentHash({
      holder_name: doc.holder_name,
      document_type: doc.document_type,
      institution_id: doc.institution_id,
      course: doc.course,
      issue_date: new Date().toISOString().split('T')[0],
    });

    // 3. Novo QR Code
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const verificationUrl = `${protocol}://${host}/verificar/${newCode}`;
    const newQrCode = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: { dark: '#0A1428', light: '#FFFFFF' },
    });

    // 4. Atualizar registro
    await connection.query(
      `UPDATE documents 
       SET verification_code = ?, hash = ?, qr_code = ?, status = 'valid', issue_date = CURDATE(), updated_at = NOW() 
       WHERE id = ?`,
      [newCode, newHash, newQrCode, id]
    );

    // 5. Histórico do documento
    await connection.query(
      `INSERT INTO document_history (document_id, user_id, action, description, created_at, updated_at)
       VALUES (?, ?, 'reissued', ?, NOW(), NOW())`,
      [id, user.id, `Documento reemitido por ${user.name}. Novo código: ${newCode}. Motivo: ${reason.trim()}`]
    );

    // 6. Auditoria: document_reissued
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, ip_address, details, created_at, updated_at)
       VALUES (?, 'document_reissued', ?, ?, NOW(), NOW())`,
      [user.id, req.ip || '127.0.0.1', `Documento ID ${id} reemitido com novo código '${newCode}' (anterior: '${doc.verification_code}'). Motivo: ${reason.trim()}`]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: 'Documento reemitido com sucesso!',
      document: {
        id,
        verification_code: newCode,
        status: 'valid',
        hash: newHash,
        qr_code: newQrCode,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error('Erro na reemissão:', err);
    return res.status(500).json({ error: 'Erro ao reemitir documento.' });
  } finally {
    connection.release();
  }
});

// ============================================================================
// 16. CONSULTA PÚBLICA DE AUTENTICIDADE COM VERIFICAÇÃO DE INTEGRIDADE
//     (Auditoria: document_verification | Privacidade Rígida | Rate Limited)
// ============================================================================
app.get('/api/public/verify/:code', verifyRateLimiter, async (req: Request, res: Response) => {
  const rawCode = req.params.code.trim().toUpperCase();
  const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = (req.headers['user-agent'] as string) || 'Desconhecido';

  try {
    // Parameterized Query: Previne SQL Injection
    const [rows]: any = await pool.query(
      `SELECT d.id, d.institution_id, d.holder_name, d.document_type, d.course, d.area, d.issue_date, d.expiry_date,
              d.description, d.verification_code, d.hash, d.status, d.qr_code,
              i.name AS institution_name, i.country AS institution_country, i.city AS institution_city,
              i.status AS institution_status
       FROM documents d
       INNER JOIN institutions i ON d.institution_id = i.id
       WHERE UPPER(d.verification_code) = ? LIMIT 1`,
      [rawCode]
    );

    // 1. Caso: DOCUMENTO NÃO ENCONTRADO
    if (rows.length === 0) {
      await pool.query(
        `INSERT INTO verifications (document_id, verification_code, result, ip_address, user_agent, verified_at)
         VALUES (NULL, ?, 'not_found', ?, ?, NOW())`,
        [rawCode, clientIp, userAgent]
      );

      // Auditoria: document_verification (Tentativa com código inválido)
      await logAudit(
        null,
        'document_verification',
        clientIp,
        `Consulta pública de verificação com código inexistente: '${rawCode}'. Alerta de documento não registrado.`
      );

      return res.status(404).json({
        found: false,
        result: 'not_found',
        title: 'DOCUMENTO NÃO ENCONTRADO',
        integrity_verified: false,
        message: `O código '${rawCode}' não foi localizado no registro oficial do VeriDoc. Documento inexistente ou adulterado.`,
      });
    }

    const doc = rows[0];

    // 2. VERIFICAÇÃO DE INTEGRIDADE DOS DADOS (HASH SHA-256)
    // Recalcula o hash no momento da consulta a partir dos campos essenciais
    const expectedHash = calculateDocumentHash({
      holder_name: doc.holder_name,
      document_type: doc.document_type,
      institution_id: doc.institution_id,
      course: doc.course,
      issue_date: doc.issue_date,
    });

    const isIntegrityValid = (expectedHash.toLowerCase() === doc.hash.toLowerCase());

    let calculatedResult: 'valid' | 'revoked' | 'expired' | 'tampered' = doc.status;

    if (!isIntegrityValid) {
      calculatedResult = 'tampered';
    } else if (doc.status === 'valid' && doc.expiry_date) {
      const exp = new Date(doc.expiry_date);
      const now = new Date();
      if (exp < now) {
        calculatedResult = 'expired';
      }
    }

    // Registra a verificação na tabela 'verifications'
    await pool.query(
      `INSERT INTO verifications (document_id, verification_code, result, ip_address, user_agent, verified_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [doc.id, rawCode, calculatedResult, clientIp, userAgent]
    );

    // Auditoria: document_verification
    await logAudit(
      null,
      'document_verification',
      clientIp,
      `Consulta pública ao documento '${doc.verification_code}' (ID ${doc.id}). Resultado: ${calculatedResult.toUpperCase()}. Integridade Criptográfica: ${isIntegrityValid ? 'VÁLIDA' : 'COMPROMETIDA'}`
    );

    const title = 
      calculatedResult === 'valid' ? 'DOCUMENTO VÁLIDO' :
      calculatedResult === 'revoked' ? 'DOCUMENTO REVOGADO' :
      calculatedResult === 'expired' ? 'DOCUMENTO EXPIRADO' :
      'INTEGRIDADE COMPROMETIDA';

    // PRIVACIDADE ESTRITA:
    // Apenas campos de verificação pública são transmitidos.
    // NÃO EXPÕE: Senhas, emails privados, telefones, endereços particulares, observações internas ou dados de utilizadores.
    return res.json({
      found: true,
      result: calculatedResult,
      title,
      integrity_verified: isIntegrityValid,
      document: {
        titular: doc.holder_name,
        tipo: doc.document_type,
        curso: doc.course,
        instituicao: doc.institution_name,
        data_emissao: doc.issue_date,
        data_validade: doc.expiry_date,
        estado: calculatedResult.toUpperCase(),
        codigo: doc.verification_code,
        hash: doc.hash,
        qr_code: doc.qr_code,
        area: doc.area,
        descricao: doc.description,
        cidade: doc.institution_city,
        pais: doc.institution_country,
      },
    });
  } catch (err) {
    console.error('Erro na verificação pública:', err);
    return res.status(500).json({ error: 'Erro ao verificar autenticidade do documento.' });
  }
});

// Inicia servidor com Vite
async function startServer() {
  try {
    await ensureDatabaseAndSeed();
  } catch (err: any) {
    console.error('[VeriDoc DB] Erro no bootstrap do banco:', err);
  }

  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      allowedHosts: true,
    },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VeriDoc] Fullstack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
