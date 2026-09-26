<?php
/**
 * VeriDoc Database Seeder
 * Populates initial Admin and credentials with Bcrypt hashes
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
    echo "[ERRO] " . $e->getMessage() . "\n";
    exit(1);
}

echo "=== SEEDING VERIDOC DATABASE ===\n";

// 1. Inserir ou atualizar Administrador Geral
$adminEmail = 'admin@veridoc.app';
$adminPass = password_hash('Admin@2026', PASSWORD_BCRYPT);

$stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
$stmt->execute([$adminEmail]);
$adminId = $stmt->fetchColumn();

if (!$adminId) {
    $ins = $pdo->prepare("
        INSERT INTO users (institution_id, name, email, password, role, status, created_at, updated_at)
        VALUES (NULL, 'Administrador Central VeriDoc', ?, ?, 'admin', 'active', NOW(), NOW())
    ");
    $ins->execute([$adminEmail, $adminPass]);
    echo "✓ Utilizador Administrador criado: {$adminEmail} (Senha: Admin@2026)\n";
} else {
    $upd = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
    $upd->execute([$adminPass, $adminId]);
    echo "✓ Utilizador Administrador atualizado: {$adminEmail} (Senha: Admin@2026)\n";
}

// 2. Atualizar senha do Carlos Silva (Instituição 1 - Approved)
$carlosEmail = 'carlos@politecnico.pt';
$carlosPass = password_hash('Carlos@2026', PASSWORD_BCRYPT);
$updCarlos = $pdo->prepare("UPDATE users SET password = ? WHERE email = ?");
$updCarlos->execute([$carlosPass, $carlosEmail]);
echo "✓ Utilizador da Instituição 1 atualizado: {$carlosEmail} (Senha: Carlos@2026)\n";

// 3. Inserir alguns documentos e verificações de exemplo para Instituição 1 para testar o cálculo do dashboard
$docCount = $pdo->query("SELECT COUNT(*) FROM documents WHERE institution_id = 1")->fetchColumn();
if ($docCount < 3) {
    $docs = [
        [
            'code' => 'VD-2026-ENG901',
            'hash' => hash('sha256', 'ENG901_DOC'),
            'name' => 'Mariana Silva Ramos',
            'type' => 'Diploma de Licenciatura',
            'course' => 'Engenharia Informática',
            'status' => 'valid',
            'issue' => '2026-02-10',
            'expiry' => null
        ],
        [
            'code' => 'VD-2026-POS442',
            'hash' => hash('sha256', 'POS442_DOC'),
            'name' => 'Tiago Alexandre Costa',
            'type' => 'Certificado de Pós-Graduação',
            'course' => 'Cibersegurança e Redes',
            'status' => 'revoked',
            'issue' => '2025-11-20',
            'expiry' => '2028-11-20'
        ],
        [
            'code' => 'VD-2026-MEST88',
            'hash' => hash('sha256', 'MEST88_DOC'),
            'name' => 'Beatriz Helena Lima',
            'type' => 'Diploma de Mestrado',
            'course' => 'Ciência de Dados',
            'status' => 'valid',
            'issue' => '2026-01-15',
            'expiry' => null
        ]
    ];

    foreach ($docs as $d) {
        $chk = $pdo->prepare("SELECT id FROM documents WHERE verification_code = ?");
        $chk->execute([$d['code']]);
        if (!$chk->fetchColumn()) {
            $insDoc = $pdo->prepare("
                INSERT INTO documents (institution_id, holder_name, document_type, course, issue_date, expiry_date, verification_code, hash, status, created_at, updated_at)
                VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $insDoc->execute([$d['name'], $d['type'], $d['course'], $d['issue'], $d['expiry'], $d['code'], $d['hash'], $d['status']]);
            $dId = $pdo->lastInsertId();

            // Adicionar 2 verificações
            $pdo->exec("INSERT INTO verifications (document_id, verification_code, result, ip_address, user_agent) VALUES ({$dId}, '{$d['code']}', '{$d['status']}', '127.0.0.1', 'VeriDoc Test Scanner')");
            $pdo->exec("INSERT INTO verifications (document_id, verification_code, result, ip_address, user_agent) VALUES ({$dId}, '{$d['code']}', '{$d['status']}', '192.168.1.50', 'Mobile Webkit')");
        }
    }
    echo "✓ Documentos de teste e verificações inseridos para cálculo dinâmico no MySQL.\n";
}

echo "SEED CONCLUÍDO COM SUCESSO!\n";
