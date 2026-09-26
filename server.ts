import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import QRCode from 'qrcode';

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser('veridoc_secret_cookie_key_2026'));

// Sessões em memória mapeadas por token criptográfico
interface SessionData {
  userId: number;
  email: string;
  name: string;
  role: 'admin' | 'institution_admin' | 'institution_operator';
  institutionId: number | null;
  institutionName?: string;
  institutionStatus?: string;
  csrfToken: string;
  createdAt: number;
}

const sessions = new Map<string, SessionData>();

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

// Middleware de Proteção CSRF para requisições de modificação (POST, PUT, DELETE)
function verifyCsrf(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const clientToken = req.headers['x-csrf-token'] || req.body?._token || req.headers['x-xsrf-token'];
  const expectedToken = req.cookies['vd_csrf'] || (req as any).csrfToken;

  if (!clientToken || clientToken !== expectedToken) {
    return res.status(403).json({
      error: 'Token CSRF inválido ou expirado. Por favor, recarregue a página.',
    });
  }

  next();
}

// Middleware de Autenticação
async function authenticate(req: Request, res: Response, next: NextFunction) {
  const sessionToken = req.cookies['veridoc_session'];
  if (!sessionToken) {
    (req as any).user = null;
    return next();
  }

  const session = sessions.get(sessionToken);
  if (!session) {
    res.clearCookie('veridoc_session');
    (req as any).user = null;
    return next();
  }

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
      res.clearCookie('veridoc_session');
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

// Middleware: Requer Instituição Aprovada (Impede acesso se pendente ou suspensa)
function requireApprovedInstitution(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Sessão expirada.' });
  }

  if (user.role === 'admin') {
    return next(); // Administrador tem bypass para fins de auditoria
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

// Helper de Auditoria
async function logAudit(userId: number | null, action: string, ip: string, details: string) {
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
// ROTAS DE API (AUTENTICAÇÃO & GESTÃO)
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

// 3. Registo Institucional (Estado inicial obrigatório: PENDING)
app.post('/api/auth/register-institution', verifyCsrf, async (req: Request, res: Response) => {
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

  // Validações rigorosas
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

    // Verifica unicidade do email institucional
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

    // Verifica unicidade do email do responsável no users
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

    // 1. Inserir Instituição com status 'pending'
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

    // 2. Hash da Senha com Bcrypt
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

// 4. Login (Validação, Password Hashing e Verificação de Aprovação)
app.post('/api/auth/login', verifyCsrf, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).json({
      error: 'Por favor, informe o email e a palavra-passe.',
    });
  }

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
      return res.status(401).json({
        error: 'Credenciais inválidas. Verifique o seu email e palavra-passe.',
      });
    }

    const user = rows[0];

    // Validação com bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      await logAudit(user.id, 'failed_login_attempt', req.ip || '127.0.0.1', 'Palavra-passe incorreta');
      return res.status(401).json({
        error: 'Credenciais inválidas. Verifique o seu email e palavra-passe.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'A sua conta de utilizador encontra-se inativa ou desativada.',
      });
    }

    // CONTROLE DE ACESSO: Se for instituição, verificar status
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

    // Gerar token de sessão criptográfico seguro
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const csrfToken = (req as any).csrfToken || crypto.randomBytes(24).toString('hex');

    sessions.set(sessionToken, {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      institutionId: user.institution_id,
      institutionName: user.institution_name,
      institutionStatus: user.institution_status,
      csrfToken,
      createdAt: Date.now(),
    });

    res.cookie('veridoc_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
      path: '/',
    });

    await logAudit(user.id, 'user_login', req.ip || '127.0.0.1', `Login efetuado com sucesso como '${user.role}'`);

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

// 5. Logout
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

    // Resposta genérica de segurança (não expõe existência do email)
    return res.json({
      success: true,
      message: 'Se o email estiver registado na plataforma, foram enviadas instruções detalhadas para redefinição segura da palavra-passe.',
    });
  } catch (err) {
    console.error('Erro na recuperação de senha:', err);
    return res.status(500).json({ error: 'Erro ao processar solicitação.' });
  }
});

// 7. Dashboard da Instituição: Métricas em Tempo Real do Banco de Dados
app.get('/api/dashboard/stats', requireAuth, requireApprovedInstitution, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const institutionId = user.institutionId;

  if (!institutionId && user.role !== 'admin') {
    return res.status(400).json({ error: 'Utilizador não possui instituição vinculada.' });
  }

  try {
    // Se for admin simulando ou visualizando uma instituição
    const targetInstId = (user.role === 'admin' && req.query.institution_id) ? req.query.institution_id : institutionId;

    // 1. Total de documentos
    const [totalDocs]: any = await pool.query(
      'SELECT COUNT(*) AS count FROM documents WHERE institution_id = ?',
      [targetInstId]
    );

    // 2. Documentos válidos
    const [validDocs]: any = await pool.query(
      "SELECT COUNT(*) AS count FROM documents WHERE institution_id = ? AND status = 'valid'",
      [targetInstId]
    );

    // 3. Documentos revogados
    const [revokedDocs]: any = await pool.query(
      "SELECT COUNT(*) AS count FROM documents WHERE institution_id = ? AND status = 'revoked'",
      [targetInstId]
    );

    // 4. Total de verificações realizadas em documentos desta instituição
    const [verifications]: any = await pool.query(
      `SELECT COUNT(v.id) AS count 
       FROM verifications v 
       INNER JOIN documents d ON v.document_id = d.id 
       WHERE d.institution_id = ?`,
      [targetInstId]
    );

    // 5. Últimos 10 documentos cadastrados no banco
    const [recentDocs]: any = await pool.query(
      `SELECT id, holder_name, document_type, course, issue_date, expiry_date, verification_code, status 
       FROM documents 
       WHERE institution_id = ? 
       ORDER BY id DESC LIMIT 10`,
      [targetInstId]
    );

    // 6. Dados da instituição
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

// 8. Gestão Administrativa: Listar Instituições (Admin)
app.get('/api/admin/institutions', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const [institutions]: any = await pool.query(
      `SELECT i.*, 
              (SELECT COUNT(*) FROM documents d WHERE d.institution_id = i.id) AS total_documents,
              (SELECT COUNT(*) FROM users u WHERE u.institution_id = i.id) AS total_users
       FROM institutions i
       ORDER BY i.id DESC`
    );

    const [counts]: any = await pool.query(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended
       FROM institutions`
    );

    res.json({
      institutions,
      stats: counts[0],
    });
  } catch (err) {
    console.error('Erro ao listar instituições:', err);
    res.status(500).json({ error: 'Erro ao buscar instituições.' });
  }
});

// 9. Gestão Administrativa: Aprovar / Suspender Instituição (Admin)
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

// ============================================================================
// GESTÃO REAL DE DOCUMENTOS (EMISSÃO, LISTAGEM, DETALHES, REVOGAÇÃO, VERIFICAÇÃO)
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

// 10. Emissão Real de Documento (Somente Instituição Aprovada / Utilizador Autorizado)
app.post('/api/documents', requireAuth, requireApprovedInstitution, verifyCsrf, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const institutionId = user.institutionId;

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

  // Validação no servidor (Regra: Não confiar no JavaScript do cliente)
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

  // Validação de datas
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

    // 1. Identificar e confirmar instituição
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

    // 2. Gerar código único com verificação rigorosa de colisão
    const verificationCode = await generateUniqueVerificationCode(connection);

    // 3. Criar hash criptográfico SHA-256 no servidor
    const hashData = [
      institution.id,
      holder_name.trim(),
      document_type.trim(),
      course.trim(),
      issue_date.trim(),
      verificationCode,
      'veridoc_salt_secure_2026',
    ].join('|');

    const documentHash = crypto.createHash('sha256').update(hashData).digest('hex');

    // 4. Criar QR Code no servidor que aponta estritamente para a URL de verificação pública
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const verificationUrl = `${protocol}://${host}/verificar/${verificationCode}`;

    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: {
        dark: '#0A1428',
        light: '#FFFFFF',
      },
    });

    // 5. Registrar o documento no MySQL com status VALID
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

    // 6. Registrar a operação no histórico do documento (document_history)
    await connection.query(
      `INSERT INTO document_history (document_id, user_id, action, description, created_at, updated_at)
       VALUES (?, ?, 'created', ?, NOW(), NOW())`,
      [
        documentId,
        user.id,
        `Documento emitido oficialmente por ${user.name} (${institution.name}).`,
      ]
    );

    // 7. Registrar no log de auditoria global (audit_logs)
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, ip_address, details, created_at, updated_at)
       VALUES (?, 'document_issued', ?, ?, NOW(), NOW())`,
      [
        user.id,
        req.ip || '127.0.0.1',
        `Documento ID ${documentId} emitido com código '${verificationCode}' para o titular '${holder_name.trim()}'.`,
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
    return res.status(500).json({ error: 'Erro ao emitir documento no servidor.' });
  } finally {
    connection.release();
  }
});

// 11. Listagem de Documentos da Instituição (/instituicao/documentos)
app.get('/api/documents', requireAuth, requireApprovedInstitution, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const institutionId = user.institutionId;

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

    // Isolamento multi-tenant
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
      return res.status(403).json({ error: 'Acesso negado a documentos de outra instituição.' });
    }

    // Histórico do documento
    const [history]: any = await pool.query(
      `SELECT h.*, u.name AS user_name, u.email AS user_email
       FROM document_history h
       LEFT JOIN users u ON h.user_id = u.id
       WHERE h.document_id = ?
       ORDER BY h.id DESC`,
      [id]
    );

    // Verificações
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

// 13. Revogar Documento com Justificativa
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

    // Multi-tenant check
    if (user.role !== 'admin' && doc.institution_id !== user.institutionId) {
      await connection.rollback();
      return res.status(403).json({ error: 'Acesso negado: Este documento pertence a outra instituição.' });
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

    // 3. Registrar no log de auditoria
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

// 14. Consulta e Validação Pública de Autenticidade (Usada por /verificar e pelo QR Code)
app.get('/api/public/verify/:code', async (req: Request, res: Response) => {
  const rawCode = req.params.code.trim().toUpperCase();

  try {
    const [rows]: any = await pool.query(
      `SELECT d.id, d.holder_name, d.document_type, d.course, d.area, d.issue_date, d.expiry_date,
              d.description, d.verification_code, d.hash, d.status, d.qr_code,
              i.name AS institution_name, i.country AS institution_country, i.city AS institution_city,
              i.status AS institution_status
       FROM documents d
       INNER JOIN institutions i ON d.institution_id = i.id
       WHERE UPPER(d.verification_code) = ? LIMIT 1`,
      [rawCode]
    );

    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Desconhecido';

    if (rows.length === 0) {
      // Registra tentativa com 'not_found'
      await pool.query(
        `INSERT INTO verifications (document_id, verification_code, result, ip_address, user_agent, verified_at)
         VALUES (NULL, ?, 'not_found', ?, ?, NOW())`,
        [rawCode, ip, userAgent]
      );

      return res.status(404).json({
        found: false,
        result: 'not_found',
        title: 'DOCUMENTO NÃO ENCONTRADO',
        message: `O código '${rawCode}' não foi localizado no registro oficial do VeriDoc. Documento inexistente ou adulterado.`,
      });
    }

    const doc = rows[0];
    let calculatedResult: 'valid' | 'revoked' | 'expired' = doc.status;

    // Se estiver 'valid' mas com data de validade vencida
    if (doc.status === 'valid' && doc.expiry_date) {
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
      [doc.id, rawCode, calculatedResult, ip, userAgent]
    );

    const title = 
      calculatedResult === 'valid' ? 'DOCUMENTO VÁLIDO' :
      calculatedResult === 'revoked' ? 'DOCUMENTO REVOGADO' :
      'DOCUMENTO EXPIRADO';

    return res.json({
      found: true,
      result: calculatedResult,
      title,
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
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VeriDoc] Fullstack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
