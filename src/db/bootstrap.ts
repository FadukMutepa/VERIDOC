import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { execSync } from 'child_process';

export function calculateCanonicalHash(params: {
  holder_name: string;
  document_type: string;
  institution_id: number | string;
  course: string;
  issue_date: string | Date;
}): string {
  const normDate = typeof params.issue_date === 'string'
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

export async function ensureDatabaseAndSeed(): Promise<void> {
  console.log('[VeriDoc DB] Verificando integridade e conectividade do banco de dados MySQL...');

  // 1. Tentar garantir que o serviço mariadb/mysql esteja ativo no sistema Linux
  try {
    execSync('/etc/init.d/mariadb start || service mariadb start || true', { stdio: 'ignore' });
  } catch (err) {
    // Ignora se não puder rodar init.d
  }

  // 2. Conectar com root para garantir banco e utilizador
  try {
    const rootConn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS veridoc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConn.query(`CREATE USER IF NOT EXISTS 'veridoc'@'localhost' IDENTIFIED BY 'veridoc_secret';`);
    await rootConn.query(`CREATE USER IF NOT EXISTS 'veridoc'@'127.0.0.1' IDENTIFIED BY 'veridoc_secret';`);
    await rootConn.query(`GRANT ALL PRIVILEGES ON veridoc.* TO 'veridoc'@'localhost';`);
    await rootConn.query(`GRANT ALL PRIVILEGES ON veridoc.* TO 'veridoc'@'127.0.0.1';`);
    await rootConn.query(`FLUSH PRIVILEGES;`);
    await rootConn.end();
  } catch (err: any) {
    console.log('[VeriDoc DB] Nota: Conexão direta como root dispensada ou já configurada:', err.message);
  }

  // 3. Conectar como utilizador da aplicação 'veridoc'
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'veridoc',
    password: process.env.DB_PASSWORD || 'veridoc_secret',
    database: process.env.DB_NAME || 'veridoc',
    waitForConnections: true,
    connectionLimit: 5,
  });

  // 4. Criar Tabelas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS institutions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(100) NOT NULL,
      country VARCHAR(100) NOT NULL,
      city VARCHAR(100) NOT NULL,
      address VARCHAR(255) NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(50) NOT NULL,
      website VARCHAR(255) NULL,
      responsible_name VARCHAR(200) NOT NULL,
      responsible_email VARCHAR(255) NOT NULL,
      status ENUM('pending', 'approved', 'suspended', 'rejected') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NULL,
      updated_at TIMESTAMP NULL,
      INDEX idx_institutions_status (status),
      INDEX idx_institutions_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      institution_id BIGINT UNSIGNED NULL,
      name VARCHAR(200) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin', 'institution_admin', 'institution_operator') NOT NULL DEFAULT 'institution_operator',
      status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NULL,
      updated_at TIMESTAMP NULL,
      INDEX idx_users_role (role),
      INDEX idx_users_status (status),
      CONSTRAINT fk_users_institution FOREIGN KEY (institution_id)
        REFERENCES institutions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      institution_id BIGINT UNSIGNED NOT NULL,
      holder_name VARCHAR(255) NOT NULL,
      document_type VARCHAR(100) NOT NULL,
      course VARCHAR(255) NULL,
      area VARCHAR(150) NULL,
      issue_date DATE NOT NULL,
      expiry_date DATE NULL,
      description TEXT NULL,
      observations TEXT NULL,
      verification_code VARCHAR(30) NOT NULL UNIQUE,
      hash CHAR(64) NOT NULL,
      qr_code MEDIUMTEXT NULL,
      status ENUM('valid', 'revoked', 'expired') NOT NULL DEFAULT 'valid',
      created_at TIMESTAMP NULL,
      updated_at TIMESTAMP NULL,
      INDEX idx_documents_verification_code (verification_code),
      INDEX idx_documents_hash (hash),
      INDEX idx_documents_status (status),
      INDEX idx_documents_issue_date (issue_date),
      INDEX idx_documents_inst_status (institution_id, status),
      CONSTRAINT fk_documents_institution FOREIGN KEY (institution_id)
        REFERENCES institutions(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS verifications (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      document_id BIGINT UNSIGNED NULL,
      verification_code VARCHAR(50) NOT NULL,
      result ENUM('valid', 'revoked', 'expired', 'not_found', 'tampered') NOT NULL,
      ip_address VARCHAR(45) NULL,
      user_agent TEXT NULL,
      verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_verifications_code (verification_code),
      INDEX idx_verifications_result (result),
      INDEX idx_verifications_verified_at (verified_at),
      INDEX idx_verifications_doc_result (document_id, result),
      CONSTRAINT fk_verifications_document FOREIGN KEY (document_id)
        REFERENCES documents(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_history (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      document_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      action VARCHAR(100) NOT NULL,
      description TEXT NULL,
      created_at TIMESTAMP NULL,
      updated_at TIMESTAMP NULL,
      INDEX idx_doc_history_action (action),
      INDEX idx_doc_history_created_at (created_at),
      CONSTRAINT fk_history_document FOREIGN KEY (document_id)
        REFERENCES documents(id) ON DELETE CASCADE,
      CONSTRAINT fk_history_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NULL,
      action VARCHAR(150) NOT NULL,
      ip_address VARCHAR(45) NULL,
      details TEXT NULL,
      created_at TIMESTAMP NULL,
      updated_at TIMESTAMP NULL,
      INDEX idx_audit_action (action),
      INDEX idx_audit_created_at (created_at),
      CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 5. Garantir Instituição 1 (Instituto Politécnico Nacional - Approved)
  const [instRows]: any = await pool.query(`SELECT id FROM institutions WHERE id = 1`);
  if (instRows.length === 0) {
    await pool.query(`
      INSERT INTO institutions 
        (id, name, type, country, city, address, email, phone, website, responsible_name, responsible_email, status, created_at, updated_at)
      VALUES 
        (1, 'Instituto Politécnico Nacional', 'Ensino Superior Politécnico', 'Portugal', 'Lisboa', 'Av. 5 de Outubro 120', 'geral@politecnico.pt', '+351 210 000 000', 'https://politecnico.pt', 'Carlos Silva', 'carlos@politecnico.pt', 'approved', NOW(), NOW())
    `);
  }

  // Garantir Instituição 2 (Universidade Lusófona de Teste)
  const [inst2Rows]: any = await pool.query(`SELECT id FROM institutions WHERE id = 2`);
  if (inst2Rows.length === 0) {
    await pool.query(`
      INSERT INTO institutions 
        (id, name, type, country, city, address, email, phone, website, responsible_name, responsible_email, status, created_at, updated_at)
      VALUES 
        (2, 'Universidade Lusófona de Teste', 'Universidade', 'Portugal', 'Lisboa', 'Campo Grande 376', 'reitoria@lusofona-teste.pt', '+351 217 515 500', 'https://ulusofona.pt', 'Teresa Fonseca', 'teresa@lusofona-teste.pt', 'approved', NOW(), NOW())
    `);
  }

  // 6. Inserir ou atualizar Admin Central (admin@veridoc.app / Admin@2026)
  const adminPass = await bcrypt.hash('Admin@2026', 10);
  const [adminRows]: any = await pool.query(`SELECT id FROM users WHERE email = 'admin@veridoc.app'`);
  if (adminRows.length === 0) {
    await pool.query(`
      INSERT INTO users (institution_id, name, email, password, role, status, created_at, updated_at)
      VALUES (NULL, 'Administrador Central VeriDoc', 'admin@veridoc.app', ?, 'admin', 'active', NOW(), NOW())
    `, [adminPass]);
    console.log('✓ Admin Geral VeriDoc configurado: admin@veridoc.app');
  } else {
    await pool.query(`UPDATE users SET password = ?, status = 'active' WHERE email = 'admin@veridoc.app'`, [adminPass]);
  }

  // 7. Inserir ou atualizar Carlos Silva (carlos@politecnico.pt / Carlos@2026)
  const carlosPass = await bcrypt.hash('Carlos@2026', 10);
  const [carlosRows]: any = await pool.query(`SELECT id FROM users WHERE email = 'carlos@politecnico.pt'`);
  if (carlosRows.length === 0) {
    await pool.query(`
      INSERT INTO users (institution_id, name, email, password, role, status, created_at, updated_at)
      VALUES (1, 'Carlos Silva (Diretor Académico)', 'carlos@politecnico.pt', ?, 'institution_admin', 'active', NOW(), NOW())
    `, [carlosPass]);
    console.log('✓ Utilizador Institucional configurado: carlos@politecnico.pt');
  } else {
    await pool.query(`UPDATE users SET password = ?, status = 'active' WHERE email = 'carlos@politecnico.pt'`, [carlosPass]);
  }

  // 8. Inserir Documentos de teste com Canonical Hash e QR Code
  const initialDocs = [
    {
      code: 'VD-2026-ENG901',
      name: 'Mariana Silva Ramos',
      type: 'Diploma de Licenciatura',
      course: 'Engenharia Informática',
      status: 'valid',
      issue: '2026-02-10',
      expiry: null,
    },
    {
      code: 'VD-2026-POS442',
      name: 'Tiago Alexandre Costa',
      type: 'Certificado de Pós-Graduação',
      course: 'Cibersegurança e Redes',
      status: 'revoked',
      issue: '2025-11-20',
      expiry: '2028-11-20',
    },
    {
      code: 'VD-2026-MEST88',
      name: 'Beatriz Helena Lima',
      type: 'Diploma de Mestrado',
      course: 'Ciência de Dados',
      status: 'valid',
      issue: '2026-01-15',
      expiry: null,
    },
    {
      code: 'VD-2026-TEST01',
      name: 'João Pedro Santos',
      type: 'Certificado de Conclusão',
      course: 'Sistemas Distribuídos',
      status: 'valid',
      issue: '2026-03-01',
      expiry: null,
    },
  ];

  for (const d of initialDocs) {
    const hash = calculateCanonicalHash({
      holder_name: d.name,
      document_type: d.type,
      institution_id: 1,
      course: d.course,
      issue_date: d.issue,
    });

    const qrDataUrl = await QRCode.toDataURL(`http://localhost:3000/verificar/${d.code}`, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
    });

    const [exist]: any = await pool.query(`SELECT id FROM documents WHERE verification_code = ?`, [d.code]);
    if (exist.length === 0) {
      const [res]: any = await pool.query(`
        INSERT INTO documents 
          (institution_id, holder_name, document_type, course, issue_date, expiry_date, verification_code, hash, qr_code, status, created_at, updated_at)
        VALUES 
          (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [d.name, d.type, d.course, d.issue, d.expiry, d.code, hash, qrDataUrl, d.status]);

      const docId = res.insertId;
      await pool.query(`INSERT INTO verifications (document_id, verification_code, result, ip_address, user_agent) VALUES (?, ?, ?, '127.0.0.1', 'VeriDoc Test Scanner')`, [docId, d.code, d.status]);
      await pool.query(`INSERT INTO verifications (document_id, verification_code, result, ip_address, user_agent) VALUES (?, ?, ?, '192.168.1.50', 'Mobile Webkit')`, [docId, d.code, d.status]);
    } else {
      await pool.query(`UPDATE documents SET hash = ?, qr_code = ? WHERE verification_code = ?`, [hash, qrDataUrl, d.code]);
    }
  }

  console.log('[VeriDoc DB] Banco de dados verificado e sincronizado com sucesso.');
}
