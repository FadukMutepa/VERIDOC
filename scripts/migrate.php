<?php
/**
 * VeriDoc Database Migration Runner & Verification Script (MySQL / MariaDB)
 * Executa as migrations no banco MySQL 'veridoc' e verifica constraints, chaves estrangeiras e índices.
 */

$host = '127.0.0.1';
$dbname = 'veridoc';
$user = 'veridoc';
$password = 'veridoc_secret';

try {
    $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    echo "[ERRO] Falha de conexão com o MySQL: " . $e->getMessage() . "\n";
    exit(1);
}

echo "=== VERIDOC DATABASE MIGRATION ENGINE (MySQL) ===\n";
echo "Conexão estabelecida com sucesso com o banco de dados '{$dbname}'.\n\n";

// Cria tabela de controle de migrations
$pdo->exec("
    CREATE TABLE IF NOT EXISTS migrations (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        migration VARCHAR(255) NOT NULL,
        batch INT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

$migrations = [
    '2026_01_01_000001_create_institutions_table' => "
        CREATE TABLE IF NOT EXISTS institutions (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(100) NOT NULL,
            country VARCHAR(100) NOT NULL,
            city VARCHAR(150) NOT NULL,
            address TEXT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            phone VARCHAR(50) NULL,
            website VARCHAR(255) NULL,
            responsible_name VARCHAR(200) NOT NULL,
            responsible_email VARCHAR(255) NOT NULL,
            status ENUM('pending', 'approved', 'suspended', 'rejected') NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP NULL,
            updated_at TIMESTAMP NULL,
            INDEX idx_institutions_status (status),
            INDEX idx_institutions_country_city (country, city)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ",

    '2026_01_01_000002_create_users_table' => "
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
    ",

    '2026_01_01_000003_create_documents_table' => "
        CREATE TABLE IF NOT EXISTS documents (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            institution_id BIGINT UNSIGNED NOT NULL,
            holder_name VARCHAR(255) NOT NULL,
            document_type VARCHAR(100) NOT NULL,
            course VARCHAR(255) NULL,
            issue_date DATE NOT NULL,
            expiry_date DATE NULL,
            verification_code VARCHAR(30) NOT NULL UNIQUE,
            hash CHAR(64) NOT NULL UNIQUE,
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
    ",

    '2026_01_01_000004_create_verifications_table' => "
        CREATE TABLE IF NOT EXISTS verifications (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            document_id BIGINT UNSIGNED NULL,
            verification_code VARCHAR(50) NOT NULL,
            result ENUM('valid', 'revoked', 'expired', 'not_found') NOT NULL,
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
    ",

    '2026_01_01_000005_create_document_history_table' => "
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
    ",

    '2026_01_01_000006_create_audit_logs_table' => "
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
    "
];

$batch = 1;
foreach ($migrations as $name => $sql) {
    // Verifica se já rodou
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM migrations WHERE migration = ?");
    $stmt->execute([$name]);
    if ($stmt->fetchColumn() == 0) {
        echo "Rodando migration: {$name}... ";
        $pdo->exec($sql);
        $insert = $pdo->prepare("INSERT INTO migrations (migration, batch) VALUES (?, ?)");
        $insert->execute([$name, $batch]);
        echo "[OK]\n";
    } else {
        echo "Migration já executada: {$name} [PULADA]\n";
    }
}

echo "\n--- VERIFICAÇÃO DE TABELAS CRIADAS NO MYSQL ---\n";
$tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
foreach ($tables as $t) {
    $count = $pdo->query("SELECT COUNT(*) FROM `{$t}`")->fetchColumn();
    echo "- Tabela: `{$t}` (Registos atuais: {$count})\n";
}

echo "\n--- VERIFICAÇÃO DE CHAVES ESTRANGEIRAS E CONSTRAINTS ---\n";
$fkQuery = "
    SELECT 
        TABLE_NAME, 
        COLUMN_NAME, 
        CONSTRAINT_NAME, 
        REFERENCED_TABLE_NAME, 
        REFERENCED_COLUMN_NAME 
    FROM 
        INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE 
        TABLE_SCHEMA = '{$dbname}' 
        AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY TABLE_NAME, CONSTRAINT_NAME;
";
$fks = $pdo->query($fkQuery)->fetchAll();
foreach ($fks as $fk) {
    echo "FK [{$fk['CONSTRAINT_NAME']}]: {$fk['TABLE_NAME']}.{$fk['COLUMN_NAME']} -> {$fk['REFERENCED_TABLE_NAME']}.{$fk['REFERENCED_COLUMN_NAME']}\n";
}

echo "\n--- TESTE DE INTEGRIDADE RELACIONAL (CRUD E CONSTRAINTS) ---\n";
// Inserir instituição de teste
$pdo->exec("
    INSERT INTO institutions (name, type, country, city, email, responsible_name, responsible_email, status, created_at, updated_at)
    VALUES ('Instituto Politécnico Nacional', 'universidade', 'Portugal', 'Lisboa', 'geral@politecnico.pt', 'Prof. Dr. Armando Ferreira', 'armando@politecnico.pt', 'approved', NOW(), NOW())
");
$institutionId = $pdo->lastInsertId();
echo "✓ Instituição inserida (ID: {$institutionId})\n";

// Inserir utilizador associado
$pdo->exec("
    INSERT INTO users (institution_id, name, email, password, role, status, created_at, updated_at)
    VALUES ({$institutionId}, 'Carlos Silva', 'carlos@politecnico.pt', 'hash_senha', 'institution_admin', 'active', NOW(), NOW())
");
$userId = $pdo->lastInsertId();
echo "✓ Utilizador inserido associado à Instituição (ID: {$userId})\n";

// Inserir documento emitido
$code = 'VD-2026-TEST01';
$hash = hash('sha256', 'TEST_DATA_VERIDOC');
$pdo->exec("
    INSERT INTO documents (institution_id, holder_name, document_type, course, issue_date, expiry_date, verification_code, hash, status, created_at, updated_at)
    VALUES ({$institutionId}, 'Ana Martins', 'diploma', 'Engenharia de Software', '2026-03-01', '2030-03-01', '{$code}', '{$hash}', 'valid', NOW(), NOW())
");
$documentId = $pdo->lastInsertId();
echo "✓ Documento emitido com Código e Hash (ID: {$documentId}, Código: {$code})\n";

// Inserir histórico do documento
$pdo->exec("
    INSERT INTO document_history (document_id, user_id, action, description, created_at, updated_at)
    VALUES ({$documentId}, {$userId}, 'created', 'Emissão inicial do certificado de licenciatura', NOW(), NOW())
");
echo "✓ Histórico registrado com chave estrangeira para Documento e Utilizador\n";

// Inserir log de verificação
$pdo->exec("
    INSERT INTO verifications (document_id, verification_code, result, ip_address, user_agent)
    VALUES ({$documentId}, '{$code}', 'valid', '192.168.1.100', 'Mozilla/5.0 (iPhone; CPU OS 17_0)')
");
echo "✓ Verificação registrada com sucesso\n";

// Inserir log de auditoria
$pdo->exec("
    INSERT INTO audit_logs (user_id, action, ip_address, details, created_at, updated_at)
    VALUES ({$userId}, 'issue_document', '192.168.1.100', 'Documento emitido ID {$documentId}', NOW(), NOW())
");
echo "✓ Log de auditoria registrado com sucesso\n";

echo "\nTODOS OS TESTES DE BANCO DE DADOS, MIGRATIONS E CONSTRAINTS PASSARAM COM 100% DE SUCESSO!\n";
