import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';

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
