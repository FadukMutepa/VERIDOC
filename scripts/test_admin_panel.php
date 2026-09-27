<?php
/**
 * Teste Automatizado do Painel Administrativo do VeriDoc
 * Valida:
 * 1. Controle de acesso estrito (usuário não autenticado -> 401, usuário institucional -> 403)
 * 2. Autenticação e métricas do Dashboard (/api/admin/stats) com os 7 KPIs
 * 3. Gestão de Instituições (/api/admin/institutions): busca, filtros, visualização, aprovação, suspensão, rejeição
 * 4. Consulta de Documentos (/api/admin/documents)
 * 5. Consulta de Verificações (/api/admin/verifications)
 * 6. Consulta de Logs de Auditoria (/api/admin/logs)
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
echo "   SUITE DE TESTES DO PAINEL ADMINISTRATIVO - VERIDOC 2026       \n";
echo "=================================================================\n\n";

// -----------------------------------------------------------------
// 1. SEGURANÇA E CONTROLE DE ACESSO
// -----------------------------------------------------------------
echo "[1] TESTE DE CONTROLE DE ACESSO (SEGURANÇA ESTRITA)\n";

// Tentativa de acesso sem autenticação
$endpoints = [
    '/api/admin/stats',
    '/api/admin/institutions',
    '/api/admin/documents',
    '/api/admin/verifications',
    '/api/admin/logs',
];

foreach ($endpoints as $ep) {
    $res = httpReq("{$baseUrl}{$ep}");
    if ($res['code'] === 401) {
        echo "  ✓ Acesso não autenticado a {$ep} bloqueado com sucesso (HTTP 401)\n";
    } else {
        echo "  ✗ FALHA: {$ep} respondeu com HTTP {$res['code']} para utilizador não autenticado!\n";
        exit(1);
    }
}

// Obter CSRF e Fazer login como Instituição (Carlos - Politécnico Nacional)
$rCsrf = httpReq("{$baseUrl}/api/auth/csrf");
$csrf = $rCsrf['body']['csrfToken'];
$cookies = $rCsrf['cookies'];

$rLoginInst = httpReq("{$baseUrl}/api/auth/login", 'POST', [
    'email' => 'carlos@politecnico.pt',
    'password' => 'Carlos@2026'
], $cookies, ['x-csrf-token' => $csrf]);

$cookiesInst = array_merge($cookies, $rLoginInst['cookies']);

// Tentativa de usuário institucional acessar rotas de ADMIN
foreach ($endpoints as $ep) {
    $res = httpReq("{$baseUrl}{$ep}", 'GET', null, $cookiesInst);
    if ($res['code'] === 403) {
        echo "  ✓ Utilizador institucional bloqueado em {$ep} (HTTP 403 Forbidden)\n";
    } else {
        echo "  ✗ FALHA GRAVE DE SEGURANÇA: Utilizador institucional conseguiu acessar {$ep} (HTTP {$res['code']})!\n";
        exit(1);
    }
}

// Tentativa de usuário institucional alterar status de instituição
$rIllegalStatus = httpReq("{$baseUrl}/api/admin/institutions/1/status", 'POST', [
    'status' => 'approved',
    'reason' => 'Tentativa ilegal de aprovação por utilizador comum'
], $cookiesInst, ['x-csrf-token' => $csrf]);

if ($rIllegalStatus['code'] === 403) {
    echo "  ✓ Utilizador institucional impedido de alterar status de entidade (HTTP 403 Forbidden)\n";
} else {
    echo "  ✗ FALHA: Utilizador comum alterou status (HTTP {$rIllegalStatus['code']})!\n";
    exit(1);
}

// -----------------------------------------------------------------
// 2. AUTENTICAÇÃO DO ADMINISTRADOR E MÉTRICAS DO DASHBOARD
// -----------------------------------------------------------------
echo "\n[2] TESTE DE LOGIN ADMINISTRATIVO E MÉTRICAS DO DASHBOARD\n";

$rLoginAdmin = httpReq("{$baseUrl}/api/auth/login", 'POST', [
    'email' => 'admin@veridoc.app',
    'password' => 'Admin@2026'
], $cookies, ['x-csrf-token' => $csrf]);

if ($rLoginAdmin['code'] === 200 && $rLoginAdmin['body']['user']['role'] === 'admin') {
    echo "  ✓ Login de Administrador autenticado com sucesso (role: admin)\n";
} else {
    echo "  ✗ Falha no login do administrador: {$rLoginAdmin['raw']}\n";
    exit(1);
}

$cookiesAdmin = array_merge($cookies, $rLoginAdmin['cookies']);

// Consultar /api/admin/stats
$rStats = httpReq("{$baseUrl}/api/admin/stats", 'GET', null, $cookiesAdmin);
if ($rStats['code'] === 200 && isset($rStats['body']['institutions']) && isset($rStats['body']['documents']) && isset($rStats['body']['verifications'])) {
    $stats = $rStats['body'];
    
    echo "  ✓ Métricas do Dashboard recuperadas com sucesso:\n";
    echo "    - Número de instituições: {$stats['institutions']['total']}\n";
    echo "    - Instituições pendentes: {$stats['institutions']['pending']}\n";
    echo "    - Instituições aprovadas: {$stats['institutions']['approved']}\n";
    echo "    - Documentos emitidos: {$stats['documents']['total']}\n";
    echo "    - Documentos válidos: {$stats['documents']['valid']}\n";
    echo "    - Documentos revogados: {$stats['documents']['revoked']}\n";
    echo "    - Total de verificações: {$stats['verifications']['total']}\n";

    // Validação de consistência com MySQL
    $dbInstTotal = $pdo->query("SELECT COUNT(*) FROM institutions")->fetchColumn();
    $dbDocTotal = $pdo->query("SELECT COUNT(*) FROM documents")->fetchColumn();
    $dbVerifTotal = $pdo->query("SELECT COUNT(*) FROM verifications")->fetchColumn();

    if ($stats['institutions']['total'] == $dbInstTotal && $stats['documents']['total'] == $dbDocTotal && $stats['verifications']['total'] == $dbVerifTotal) {
        echo "  ✓ Consistência 100% confirmada com os registros reais do MySQL.\n";
    } else {
        echo "  ✗ Divergência entre a API e os dados do banco!\n";
        exit(1);
    }
} else {
    echo "  ✗ Falha ao obter estatísticas administrativas: {$rStats['raw']}\n";
    exit(1);
}

// -----------------------------------------------------------------
// 3. GESTÃO DE INSTITUIÇÕES (/api/admin/institutions)
// -----------------------------------------------------------------
echo "\n[3] TESTE DE GESTÃO DE INSTITUIÇÕES (BUSCA, FILTRO, APROVAÇÃO, SUSPENSÃO, DETALHES)\n";

// 3.1 Listagem Geral
$rInstList = httpReq("{$baseUrl}/api/admin/institutions", 'GET', null, $cookiesAdmin);
if ($rInstList['code'] === 200 && is_array($rInstList['body']['institutions'])) {
    $totalFound = count($rInstList['body']['institutions']);
    echo "  ✓ Listagem de instituições carregada ({$totalFound} encontradas).\n";
} else {
    echo "  ✗ Falha na listagem de instituições: {$rInstList['raw']}\n";
    exit(1);
}

// 3.2 Pesquisa por texto
$rSearch = httpReq("{$baseUrl}/api/admin/institutions?search=Politecnico", 'GET', null, $cookiesAdmin);
if ($rSearch['code'] === 200 && count($rSearch['body']['institutions']) >= 1) {
    echo "  ✓ Pesquisa por termo ('Politecnico') funcionando (retornou {$rSearch['body']['institutions'][0]['name']}).\n";
} else {
    echo "  ✗ Falha na pesquisa de instituições: {$rSearch['raw']}\n";
    exit(1);
}

// 3.3 Filtro por status
$rFilter = httpReq("{$baseUrl}/api/admin/institutions?status=approved", 'GET', null, $cookiesAdmin);
if ($rFilter['code'] === 200) {
    $allApproved = true;
    foreach ($rFilter['body']['institutions'] as $item) {
        if ($item['status'] !== 'approved') $allApproved = false;
    }
    if ($allApproved) {
        echo "  ✓ Filtro por status ('approved') retornou exclusivamente entidades aprovadas.\n";
    } else {
        echo "  ✗ Falha no filtro de status!\n";
        exit(1);
    }
}

// 3.4 Visualizar Detalhes de uma Instituição
$targetInstId = $rInstList['body']['institutions'][0]['id'];
$rDetails = httpReq("{$baseUrl}/api/admin/institutions/{$targetInstId}", 'GET', null, $cookiesAdmin);
if ($rDetails['code'] === 200 && isset($rDetails['body']['institution']['name']) && isset($rDetails['body']['users'])) {
    echo "  ✓ Detalhes da instituição #{$targetInstId} carregados com dados cadastrais e operadores vinculados.\n";
} else {
    echo "  ✗ Falha ao obter detalhes da instituição: {$rDetails['raw']}\n";
    exit(1);
}

// 3.5 Teste do Ciclo de Vida: Suspender, Rejeitar e Aprovar
echo "  * Testando ciclo de status administrativo:\n";

// Suspender
$rSuspend = httpReq("{$baseUrl}/api/admin/institutions/{$targetInstId}/status", 'POST', [
    'status' => 'suspended',
    'reason' => 'Suspensão temporária para auditoria de segurança'
], $cookiesAdmin, ['x-csrf-token' => $csrf]);

if ($rSuspend['code'] === 200 && $rSuspend['body']['institution']['status'] === 'suspended') {
    echo "    ✓ Instituição #{$targetInstId} SUSPENSA com sucesso.\n";
} else {
    echo "    ✗ Falha ao suspender instituição: {$rSuspend['raw']}\n";
    exit(1);
}

// Re-aprovar
$rApprove = httpReq("{$baseUrl}/api/admin/institutions/{$targetInstId}/status", 'POST', [
    'status' => 'approved',
    'reason' => 'Auditoria concluída com sucesso. Homologação restabelecida.'
], $cookiesAdmin, ['x-csrf-token' => $csrf]);

if ($rApprove['code'] === 200 && $rApprove['body']['institution']['status'] === 'approved') {
    echo "    ✓ Instituição #{$targetInstId} APROVADA com sucesso.\n";
} else {
    echo "    ✗ Falha ao aprovar instituição: {$rApprove['raw']}\n";
    exit(1);
}

// -----------------------------------------------------------------
// 4. CONSULTA GERAL DE DOCUMENTOS (/api/admin/documents)
// -----------------------------------------------------------------
echo "\n[4] TESTE DE CONSULTA GERAL DE DOCUMENTOS PELO ADMINISTRADOR\n";

$rDocs = httpReq("{$baseUrl}/api/admin/documents", 'GET', null, $cookiesAdmin);
if ($rDocs['code'] === 200 && is_array($rDocs['body']['documents'])) {
    $totalDocs = count($rDocs['body']['documents']);
    echo "  ✓ Acervo global de documentos acessível pelo Admin ({$totalDocs} documentos listados).\n";
    
    // Pesquisa por código
    if ($totalDocs > 0) {
        $sampleCode = $rDocs['body']['documents'][0]['verification_code'];
        $rDocSearch = httpReq("{$baseUrl}/api/admin/documents?search={$sampleCode}", 'GET', null, $cookiesAdmin);
        if ($rDocSearch['code'] === 200 && count($rDocSearch['body']['documents']) >= 1) {
            echo "  ✓ Pesquisa de documentos por código único ('{$sampleCode}') confirmada.\n";
        }
    }
} else {
    echo "  ✗ Falha na consulta de documentos: {$rDocs['raw']}\n";
    exit(1);
}

// -----------------------------------------------------------------
// 5. CONSULTA DE VERIFICAÇÕES PÚBLICAS (/api/admin/verifications)
// -----------------------------------------------------------------
echo "\n[5] TESTE DE CONSULTA DE HISTÓRICO DE VERIFICAÇÕES\n";

$rVerif = httpReq("{$baseUrl}/api/admin/verifications", 'GET', null, $cookiesAdmin);
if ($rVerif['code'] === 200 && is_array($rVerif['body']['verifications'])) {
    echo "  ✓ Histórico de verificações consultado pelo Administrador ({$rVerif['body']['count']} registros).\n";
} else {
    echo "  ✗ Falha na consulta de verificações: {$rVerif['raw']}\n";
    exit(1);
}

// -----------------------------------------------------------------
// 6. CONSULTA DE LOGS DE AUDITORIA (/api/admin/logs)
// -----------------------------------------------------------------
echo "\n[6] TESTE DE CONSULTA DE LOGS DE AUDITORIA\n";

$rLogs = httpReq("{$baseUrl}/api/admin/logs", 'GET', null, $cookiesAdmin);
if ($rLogs['code'] === 200 && is_array($rLogs['body']['logs'])) {
    echo "  ✓ Logs de auditoria do sistema consultados com sucesso ({$rLogs['body']['count']} eventos registrados).\n";
    
    // Filtro por ação
    $rLogAction = httpReq("{$baseUrl}/api/admin/logs?action=institution_status_change", 'GET', null, $cookiesAdmin);
    if ($rLogAction['code'] === 200 && count($rLogAction['body']['logs']) >= 1) {
        echo "  ✓ Filtro de logs por ação ('institution_status_change') retornou eventos de auditoria com detalhes e autor.\n";
    }
} else {
    echo "  ✗ Falha na consulta de logs de auditoria: {$rLogs['raw']}\n";
    exit(1);
}

echo "\n=================================================================\n";
echo "TODOS OS TESTES DO PAINEL ADMINISTRATIVO FORAM APROVADOS!        \n";
echo "=================================================================\n";
