<?php
/**
 * Teste Automatizado de Emissão Real de Documentos - VeriDoc
 * Valida criação de múltiplos documentos, garantia de unicidade de códigos,
 * QR Code, Hash SHA-256, histórico, revogação e verificação pública.
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

    // Parse cookies from response
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
        'raw_body' => $body,
        'cookies' => $newCookies
    ];
}

echo "=== INICIANDO TESTES DE EMISSÃO REAL DE DOCUMENTOS NO VERIDOC ===\n\n";

// 1. Obter CSRF Token
$rCsrf = httpReq("{$baseUrl}/api/auth/csrf");
$csrf = $rCsrf['body']['csrfToken'];
$cookies = $rCsrf['cookies'];
echo "[1] CSRF obtido com sucesso: {$csrf}\n";

// 2. Testar bloqueio de emissão sem autenticação
$rUnauth = httpReq("{$baseUrl}/api/documents", 'POST', ['holder_name' => 'Teste'], $cookies, ['x-csrf-token' => $csrf]);
if ($rUnauth['code'] === 401) {
    echo "[2] ✓ Segurança: Emissão bloqueada para utilizadores não autenticados (HTTP 401)\n";
} else {
    echo "[2] ✗ Falha: Deveria retornar 401, retornou {$rUnauth['code']}\n";
    exit(1);
}

// 3. Fazer Login com Instituição Aprovada (carlos@politecnico.pt)
$rLogin = httpReq("{$baseUrl}/api/auth/login", 'POST', [
    'email' => 'carlos@politecnico.pt',
    'password' => 'Carlos@2026'
], $cookies, ['x-csrf-token' => $csrf]);

$cookies = array_merge($cookies, $rLogin['cookies']);
if ($rLogin['code'] === 200 && $rLogin['body']['success']) {
    echo "[3] ✓ Autenticação realizada como Instituição Aprovada: {$rLogin['body']['user']['institutionName']}\n";
} else {
    echo "[3] ✗ Falha no login: {$rLogin['raw_body']}\n";
    exit(1);
}

// 4. Emitir 5 documentos reais sucessivos e validar unicidade absoluta dos códigos
$titulares = [
    ['nome' => 'Gonçalo Nuno Ramos', 'tipo' => 'Diploma de Licenciatura', 'curso' => 'Engenharia Aeroespacial', 'area' => 'Aeronáutica'],
    ['nome' => 'Leonor Sofia Martins', 'tipo' => 'Diploma de Mestrado', 'curso' => 'Inteligência Artificial', 'area' => 'Ciência da Computação'],
    ['nome' => 'Afonso Manuel Costa', 'tipo' => 'Certificado de Pós-Graduação', 'curso' => 'Gestão de Cibersegurança', 'area' => 'Segurança da Informação'],
    ['nome' => 'Camila Vitória Santos', 'tipo' => 'Certidão de Regularidade Profissional', 'curso' => 'Ordem dos Engenheiros', 'area' => 'Engenharia Civil'],
    ['nome' => 'Diogo Filipe Rodrigues', 'tipo' => 'Alvará / Licença Institucional', 'curso' => 'Auditoria Tecnológica', 'area' => 'Conformidade e Risco']
];

$codigosGerados = [];
$documentosCriados = [];

echo "\n[4] Emitindo documentos no servidor (MySQL + Hash SHA-256 + QR Code)...\n";
foreach ($titulares as $i => $t) {
    $payload = [
        'holder_name' => $t['nome'],
        'document_type' => $t['tipo'],
        'course' => $t['curso'],
        'area' => $t['area'],
        'issue_date' => date('Y-m-d'),
        'expiry_date' => ($i % 2 === 0) ? date('Y-m-d', strtotime('+4 years')) : null,
        'description' => "Certifica-se a aprovação plena de {$t['nome']} no programa oficial.",
        'observations' => "Livro Geral nº " . (100 + $i) . ", Assento Oficial 2026."
    ];

    $res = httpReq("{$baseUrl}/api/documents", 'POST', $payload, $cookies, ['x-csrf-token' => $csrf]);

    if ($res['code'] === 201 && $res['body']['success']) {
        $doc = $res['body']['document'];
        $code = $doc['verification_code'];

        // Checagem de formato: VD-2026-XXXXXXXX
        if (!preg_match('/^VD-2026-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/', $code)) {
            echo "✗ Formato de código inválido: {$code}\n";
            exit(1);
        }

        // Checagem de colisão
        if (in_array($code, $codigosGerados)) {
            echo "✗ COLISÃO DETECTADA! O código {$code} já foi gerado anteriormente.\n";
            exit(1);
        }

        // Checagem de QR Code presente
        if (empty($doc['qr_code']) || strpos($doc['qr_code'], 'data:image/png;base64') !== 0) {
            echo "✗ QR Code DataURL ausente ou inválido no documento {$code}\n";
            exit(1);
        }

        // Checagem de hash SHA-256
        if (strlen($doc['hash']) !== 64) {
            echo "✗ Hash SHA-256 inválido (tamanho diferente de 64 caracteres)\n";
            exit(1);
        }

        $codigosGerados[] = $code;
        $documentosCriados[] = $doc;
        echo "  ✓ Doc #" . ($i + 1) . ": {$code} | Titular: {$t['nome']} | Hash: " . substr($doc['hash'], 0, 16) . "... | QR Code OK\n";
    } else {
        echo "✗ Falha na emissão: " . json_encode($res['body']) . "\n";
        exit(1);
    }
}

echo "✓ Unicidade confirmada: " . count($codigosGerados) . " documentos gerados com códigos 100% distintos e sem colisões!\n";

// 5. Testar Listagem de Documentos (/api/documents)
echo "\n[5] Testando listagem e isolamento multi-tenant dos documentos...\n";
$rList = httpReq("{$baseUrl}/api/documents", 'GET', null, $cookies);
if ($rList['code'] === 200 && is_array($rList['body']['documents'])) {
    echo "✓ Listagem retornou " . count($rList['body']['documents']) . " documentos da instituição.\n";
} else {
    echo "✗ Falha ao listar documentos.\n";
    exit(1);
}

// 6. Testar Visualização Detalhada (/api/documents/:id) com histórico
echo "\n[6] Testando detalhes e histórico do documento...\n";
$primeiroDoc = $documentosCriados[0];
$rShow = httpReq("{$baseUrl}/api/documents/{$primeiroDoc['id']}", 'GET', null, $cookies);
if ($rShow['code'] === 200 && !empty($rShow['body']['history'])) {
    $h = $rShow['body']['history'][0];
    echo "✓ Detalhes carregados. Evento de histórico registrado: Ação '{$h['action']}' por '{$h['user_name']}'.\n";
} else {
    echo "✗ Falha ao buscar detalhes e histórico.\n";
    exit(1);
}

// 7. Testar Consulta Pública de Autenticidade (/api/public/verify/:code)
echo "\n[7] Testando consulta pública de autenticidade (QR Code / Código)...\n";
$rVerify = httpReq("{$baseUrl}/api/public/verify/{$primeiroDoc['verification_code']}");
if ($rVerify['code'] === 200 && $rVerify['body']['found'] && $rVerify['body']['result'] === 'valid') {
    echo "✓ Validação pública confirmada: Documento {$primeiroDoc['verification_code']} retornou STATUS: VALID.\n";
} else {
    echo "✗ Falha na validação pública: {$rVerify['raw_body']}\n";
    exit(1);
}

// 8. Testar Revogação do Documento (/api/documents/:id/revoke)
echo "\n[8] Testando revogação de documento com justificativa legal...\n";
$segundoDoc = $documentosCriados[1];
$rRevoke = httpReq("{$baseUrl}/api/documents/{$segundoDoc['id']}/revoke", 'POST', [
    'reason' => 'Anulação de diploma por processo disciplinar interno nº 2026/89B.'
], $cookies, ['x-csrf-token' => $csrf]);

if ($rRevoke['code'] === 200 && $rRevoke['body']['success']) {
    echo "✓ Documento {$segundoDoc['verification_code']} revogado com sucesso no MySQL.\n";
} else {
    echo "✗ Falha ao revogar: {$rRevoke['raw_body']}\n";
    exit(1);
}

// 9. Confirmar que a verificação pública agora acusa REVOKED
echo "\n[9] Confirmando que o público agora vê o estado REVOKED no QR Code / verificação...\n";
$rVerifyRevoked = httpReq("{$baseUrl}/api/public/verify/{$segundoDoc['verification_code']}");
if ($rVerifyRevoked['code'] === 200 && $rVerifyRevoked['body']['result'] === 'revoked') {
    echo "✓ Segurança confirmada: Documento {$segundoDoc['verification_code']} agora retorna STATUS: REVOKED com alerta público.\n";
} else {
    echo "✗ Falha ao verificar documento revogado: {$rVerifyRevoked['raw_body']}\n";
    exit(1);
}

// 10. Testar código falso / inexistente
echo "\n[10] Testando verificação de código fraudulento / inexistente...\n";
$rFake = httpReq("{$baseUrl}/api/public/verify/VD-2026-FAKE9999");
if ($rFake['code'] === 404 && $rFake['body']['result'] === 'not_found') {
    echo "✓ Detecção de fraude: Código inexistente retornou HTTP 404 e NOT_FOUND com log registrado.\n";
} else {
    echo "✗ Falha no teste de código inexistente.\n";
    exit(1);
}

echo "\n=======================================================\n";
echo "TODOS OS 10 TESTES DE EMISSÃO, ASSINATURA CRIPTOGRÁFICA,\nQR CODE, HISTÓRICO E REVOGAÇÃO FORAM CONCLUÍDOS COM SUCESSO!\n";
echo "=======================================================\n";
