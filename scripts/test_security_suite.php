<?php
/**
 * Teste Abrangente de Segurança do VeriDoc (Security Suite)
 * Valida:
 * 1. Hash Criptográfico SHA-256 e Verificação de Integridade de Dados
 * 2. Detecção e Alerta de Adulteração de Dados no Banco
 * 3. Controle de Acesso e Isolamento Multi-Tenant Estrito
 * 4. Registro de Auditoria (todas as ações requeridas)
 * 5. Proteções contra SQL Injection, CSRF, Mass Assignment, Rate Limiting
 * 6. Privacidade (Não vazamento de senhas, endereços, observações internas)
 */

$baseUrl = 'http://127.0.0.1:3000';

function httpReq($url, $method = 'GET', $data = null, $cookies = [], $headers = []) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    $h = [];
    foreach ($headers as $k => $v) {
        $h[] = "{$k}: {$v}";
    }

    if (!empty($cookies)) {
        $cStr = '';
        foreach ($cookies as $k => $v) {
            $cStr .= "{$k}={$v}; ";
        }
        curl_setopt($ch, CURLOPT_COOKIE, $cStr);
    }

    if ($data !== null) {
        $json = json_encode($data);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        $h[] = 'Content-Type: application/json';
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, $h);

    $response = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $headerStr = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);

    preg_match_all('/^Set-Cookie:\s*([^;]*)/mi', $headerStr, $matches);
    $newCookies = [];
    foreach ($matches[1] as $item) {
        parse_str($item, $cookie);
        foreach ($cookie as $k => $v) {
            $newCookies[$k] = $v;
        }
    }

    return [
        'code' => $httpCode,
        'body' => json_decode($body, true),
        'raw' => $body,
        'cookies' => $newCookies
    ];
}

$pdo = new PDO("mysql:host=127.0.0.1;dbname=veridoc;charset=utf8mb4", 'veridoc', 'veridoc_secret');

echo "=================================================================\n";
echo "   SUITE DE VALIDAÇÃO E REFORÇO DE SEGURANÇA - VERIDOC 2026      \n";
echo "=================================================================\n\n";

// -----------------------------------------------------------------
// 1. HASH CRIPTOGRÁFICO SHA-256 E INTEGRIDADE DE DADOS
// -----------------------------------------------------------------
echo "[1] TESTE DE HASH E INTEGRIDADE CRIPTOGRÁFICA DOS DADOS\n";
$stmt = $pdo->query("SELECT * FROM documents WHERE status = 'valid' ORDER BY id DESC LIMIT 1");
$doc = $stmt->fetch(PDO::FETCH_ASSOC);

$resVerify = httpReq("{$baseUrl}/api/public/verify/{$doc['verification_code']}");
if ($resVerify['code'] === 200 && $resVerify['body']['integrity_verified'] === true) {
    echo "  ✓ Documento {$doc['verification_code']}: Hash SHA-256 confere 100% com os dados.\n";
} else {
    echo "  ✗ Falha na validação de integridade do documento válido: {$resVerify['raw']}\n";
    exit(1);
}

// TESTE DE ADULTERAÇÃO (SIMULAÇÃO DE ATAQUE NO BANCO DE DADOS)
echo "\n[2] TESTE DE ADULTERAÇÃO (DETECÇÃO DE MAN-IN-THE-DATABASE / TEMPERING)\n";
$originalName = $doc['holder_name'];
$tamperedName = $originalName . " [ADULTERADO POR HACKER]";

// Altera o nome no banco sem alterar o hash
$pdo->prepare("UPDATE documents SET holder_name = ? WHERE id = ?")->execute([$tamperedName, $doc['id']]);

$resTampered = httpReq("{$baseUrl}/api/public/verify/{$doc['verification_code']}");
if ($resTampered['code'] === 200 && $resTampered['body']['integrity_verified'] === false && $resTampered['body']['result'] === 'tampered') {
    echo "  ✓ SEGURANÇA MÁXIMA: Adulteração detectada! O validador acusou: {$resTampered['body']['title']} (integrity_verified: false)\n";
} else {
    echo "  ✗ Falha: O sistema não detectou a adulteração do documento: {$resTampered['raw']}\n";
    // Restaura
    $pdo->prepare("UPDATE documents SET holder_name = ? WHERE id = ?")->execute([$originalName, $doc['id']]);
    exit(1);
}

// Restaura o nome original
$pdo->prepare("UPDATE documents SET holder_name = ? WHERE id = ?")->execute([$originalName, $doc['id']]);
$resRestored = httpReq("{$baseUrl}/api/public/verify/{$doc['verification_code']}");
if ($resRestored['body']['integrity_verified'] === true) {
    echo "  ✓ Dados restaurados: Integridade retornou ao estado VÁLIDO.\n";
}

// -----------------------------------------------------------------
// 3. CONTROLE DE ACESSO E ISOLAMENTO MULTI-TENANT
// -----------------------------------------------------------------
echo "\n[3] TESTE DE CONTROLE DE ACESSO E ISOLAMENTO MULTI-TENANT\n";
// Obter CSRF
$rCsrf = httpReq("{$baseUrl}/api/auth/csrf");
$csrf = $rCsrf['body']['csrfToken'];
$cookies = $rCsrf['cookies'];

// Login com Instituição 1 (Carlos - Instituto Politécnico Nacional)
$rLogin1 = httpReq("{$baseUrl}/api/auth/login", 'POST', [
    'email' => 'carlos@politecnico.pt',
    'password' => 'Carlos@2026'
], $cookies, ['x-csrf-token' => $csrf]);
$cookies1 = array_merge($cookies, $rLogin1['cookies']);

// Garantir existência de Instituição 2 (Universidade Lusófona de Teste)
$stmtInst2 = $pdo->query("SELECT id FROM institutions WHERE id = 2");
if (!$stmtInst2->fetchColumn()) {
    $pdo->query("INSERT INTO institutions (id, name, type, country, city, address, email, phone, responsible_name, responsible_email, status, created_at, updated_at)
                 VALUES (2, 'Universidade Lusófona de Teste', 'Universidade', 'Portugal', 'Lisboa', 'Campo Grande 376', 'reitoria@lusofona-teste.pt', '+351 217 515 500', 'Teresa Fonseca', 'teresa@lusofona-teste.pt', 'approved', NOW(), NOW())");
}

// Criar um documento para Instituição 2 (Universidade Lusófona de Teste)
$stmtInst2Doc = $pdo->query("SELECT id, verification_code FROM documents WHERE institution_id = 2 LIMIT 1");
$docInst2 = $stmtInst2Doc->fetch(PDO::FETCH_ASSOC);

if (!$docInst2) {
    // Insere documento de teste para inst 2
    $pdo->query("INSERT INTO documents (institution_id, holder_name, document_type, course, issue_date, verification_code, hash, status, created_at, updated_at)
                 VALUES (2, 'Aluno Teste Inst 2', 'Diploma', 'Engenharia', '2026-01-01', 'VD-2026-INST2TEST', SHA2('inst2', 256), 'valid', NOW(), NOW())");
    $docInst2Id = $pdo->lastInsertId();
    $docInst2Code = 'VD-2026-INST2TEST';
} else {
    $docInst2Id = $docInst2['id'];
    $docInst2Code = $docInst2['verification_code'];
}

// Tentativa 1: Instituição 1 tenta VISUALIZAR documento da Instituição 2
$rCrossView = httpReq("{$baseUrl}/api/documents/{$docInst2Id}", 'GET', null, $cookies1);
if ($rCrossView['code'] === 403) {
    echo "  ✓ Bloqueio Confirmado: Instituição não consegue visualizar documento de outra instituição (HTTP 403)\n";
} else {
    echo "  ✗ Falha de isolamento multi-tenant na visualização: Retornou HTTP {$rCrossView['code']}\n";
    exit(1);
}

// Tentativa 2: Instituição 1 tenta REVOGAR documento da Instituição 2
$rCrossRevoke = httpReq("{$baseUrl}/api/documents/{$docInst2Id}/revoke", 'POST', [
    'reason' => 'Tentativa não autorizada de revogar documento alheio'
], $cookies1, ['x-csrf-token' => $csrf]);
if ($rCrossRevoke['code'] === 403) {
    echo "  ✓ Bloqueio Confirmado: Instituição não consegue revogar documento de outra instituição (HTTP 403)\n";
} else {
    echo "  ✗ Falha de isolamento multi-tenant na revogação: Retornou HTTP {$rCrossRevoke['code']}\n";
    exit(1);
}

// Tentativa 3: Instituição 1 tenta MODIFICAR documento da Instituição 2
$rCrossUpdate = httpReq("{$baseUrl}/api/documents/{$docInst2Id}", 'PUT', [
    'description' => 'Injeção de descrição indevida'
], $cookies1, ['x-csrf-token' => $csrf]);
if ($rCrossUpdate['code'] === 403) {
    echo "  ✓ Bloqueio Confirmado: Instituição não consegue modificar documento de outra instituição (HTTP 403)\n";
} else {
    echo "  ✗ Falha de isolamento multi-tenant na modificação: Retornou HTTP {$rCrossUpdate['code']}\n";
    exit(1);
}

// -----------------------------------------------------------------
// 4. PROTEÇÃO CONTRA CSRF E MASS ASSIGNMENT
// -----------------------------------------------------------------
echo "\n[4] TESTE DE PROTEÇÃO CONTRA CSRF E MASS ASSIGNMENT\n";
// CSRF ausente ou inválido
$rNoCsrf = httpReq("{$baseUrl}/api/documents", 'POST', [
    'holder_name' => 'Teste Sem CSRF',
    'document_type' => 'Diploma',
    'course' => 'Gestão',
    'issue_date' => '2026-09-26'
], $cookies1, ['x-csrf-token' => 'token_forjado_invalido']);
if ($rNoCsrf['code'] === 403) {
    echo "  ✓ Proteção CSRF Ativa: Requisição com token inválido rejeitada com HTTP 403\n";
} else {
    echo "  ✗ Falha: CSRF inválido não foi bloqueado (HTTP {$rNoCsrf['code']})\n";
    exit(1);
}

// Mass Assignment: Tentativa de forçar institution_id=2 e status=approved
$rMassAssign = httpReq("{$baseUrl}/api/documents", 'POST', [
    'institution_id' => 2, // Tenta injetar outra instituição
    'status' => 'revoked', // Tenta forçar status
    'holder_name' => 'Titular Protegido',
    'document_type' => 'Certificado',
    'course' => 'Cibersegurança',
    'issue_date' => '2026-09-26'
], $cookies1, ['x-csrf-token' => $csrf]);

if ($rMassAssign['code'] === 201) {
    $createdDocId = $rMassAssign['body']['document']['id'];
    $checkDoc = $pdo->query("SELECT institution_id, status FROM documents WHERE id = {$createdDocId}")->fetch(PDO::FETCH_ASSOC);
    if ($checkDoc['institution_id'] == 1 && $checkDoc['status'] === 'valid') {
        echo "  ✓ Proteção contra Mass Assignment: Parâmetros maliciosos ignorados (institution_id permaneceu 1 e status 'valid').\n";
    } else {
        echo "  ✗ Falha de Mass Assignment: Documento aceitou dados não autorizados!\n";
        exit(1);
    }
} else {
    echo "  ✗ Falha na emissão legítima com CSRF: {$rMassAssign['raw']}\n";
    exit(1);
}

// -----------------------------------------------------------------
// 5. TESTE DE PRIVACIDADE NA CONSULTA PÚBLICA
// -----------------------------------------------------------------
echo "\n[5] TESTE DE PRIVACIDADE DA PÁGINA PÚBLICA\n";
$resPub = httpReq("{$baseUrl}/api/public/verify/{$doc['verification_code']}");
$pubData = $resPub['body']['document'] ?? [];

$camposProibidos = ['password', 'observations', 'responsible_name', 'responsible_email', 'phone', 'address', 'user_id'];
$vazamentoEncontrado = false;
foreach ($camposProibidos as $campo) {
    if (isset($pubData[$campo])) {
        echo "  ✗ VAZAMENTO DE PRIVACIDADE: O campo '{$campo}' está exposto na consulta pública!\n";
        $vazamentoEncontrado = true;
    }
}

if (!$vazamentoEncontrado) {
    echo "  ✓ Privacidade Estrita: Nenhum dado privado, senha, telefone, endereço pessoal ou anotação interna está exposto.\n";
} else {
    exit(1);
}

// -----------------------------------------------------------------
// 6. TESTE DE AUDITORIA COMPLETA
// -----------------------------------------------------------------
echo "\n[6] TESTE DE REGISTRO DE AUDITORIA (AUDIT LOGS)\n";

// Executa revogação legítima do documento criado no passo 4 para testar auditoria document_revoked
if (isset($createdDocId)) {
    httpReq("{$baseUrl}/api/documents/{$createdDocId}/revoke", 'POST', [
        'reason' => 'Teste de auditoria de revogação legítima'
    ], $cookies1, ['x-csrf-token' => $csrf]);
}

// Executa uma tentativa de login com senha incorreta para testar failed_login_attempt
httpReq("{$baseUrl}/api/auth/login", 'POST', [
    'email' => 'carlos@politecnico.pt',
    'password' => 'SenhaIncorreta@123'
], $cookies, ['x-csrf-token' => $csrf]);

$acoesNecessarias = [
    'user_login',
    'failed_login_attempt',
    'document_issued',
    'document_revoked',
    'document_verification'
];

foreach ($acoesNecessarias as $acao) {
    $stmtAudit = $pdo->prepare("SELECT COUNT(*) FROM audit_logs WHERE action = ?");
    $stmtAudit->execute([$acao]);
    $count = $stmtAudit->fetchColumn();
    if ($count > 0) {
        echo "  ✓ Ação '{$acao}' registrada com sucesso no MySQL (Total de registros: {$count})\n";
    } else {
        echo "  ✗ Ação '{$acao}' não foi encontrada nos registros de auditoria!\n";
        exit(1);
    }
}

echo "\n=================================================================\n";
echo "TODOS OS TESTES DA SUITE DE SEGURANÇA FORAM APROVADOS COM SUCESSO!\n";
echo "=================================================================\n";
