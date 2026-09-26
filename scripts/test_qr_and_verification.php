<?php
/**
 * Teste Automatizado do Sistema de QR Code e Verificação Pública do VeriDoc
 */

$baseUrl = 'http://127.0.0.1:3000';

function fetchUrl($url) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [
        'code' => $httpCode,
        'data' => json_decode($response, true),
        'raw' => $response
    ];
}

echo "=== TESTE COMPLETO DO SISTEMA DE QR CODE E VERIFICAÇÃO PÚBLICA ===\n\n";

// Conectar ao MySQL para obter documentos de teste
$pdo = new PDO("mysql:host=127.0.0.1;dbname=veridoc;charset=utf8mb4", 'veridoc', 'veridoc_secret');

// 1. Obter documento válido
$stmtValid = $pdo->query("SELECT * FROM documents WHERE status = 'valid' ORDER BY id DESC LIMIT 1");
$docValid = $stmtValid->fetch(PDO::FETCH_ASSOC);

// 2. Obter documento revogado
$stmtRevoked = $pdo->query("SELECT * FROM documents WHERE status = 'revoked' ORDER BY id DESC LIMIT 1");
$docRevoked = $stmtRevoked->fetch(PDO::FETCH_ASSOC);

// 3. Obter documento expirado
$stmtExpired = $pdo->query("SELECT * FROM documents WHERE status = 'expired' OR (status = 'valid' AND expiry_date < CURDATE()) ORDER BY id DESC LIMIT 1");
$docExpired = $stmtExpired->fetch(PDO::FETCH_ASSOC);

echo "--- DOCUMENTOS SELECIONADOS NO BANCO MYSQL ---\n";
echo "1. Válido:    {$docValid['verification_code']} ({$docValid['holder_name']})\n";
echo "2. Revogado:  {$docRevoked['verification_code']} ({$docRevoked['holder_name']})\n";
echo "3. Expirado:  {$docExpired['verification_code']} ({$docExpired['holder_name']})\n";
echo "4. Inexistente: VD-2026-NAOEXISTE99\n\n";

// TESTE 1: DOCUMENTO VÁLIDO
echo "[TESTE 1] Consultando Documento Válido sem autenticação (Público)...\n";
$res1 = fetchUrl("{$baseUrl}/api/public/verify/{$docValid['verification_code']}");

if ($res1['code'] === 200 && $res1['data']['found'] === true && $res1['data']['result'] === 'valid') {
    echo "✓ Título retornado: {$res1['data']['title']} (Esperado: DOCUMENTO VÁLIDO)\n";
    $d = $res1['data']['document'];
    echo "  - Titular:         {$d['titular']}\n";
    echo "  - Tipo:            {$d['tipo']}\n";
    echo "  - Curso:           {$d['curso']}\n";
    echo "  - Instituição:     {$d['instituicao']}\n";
    echo "  - Data de emissão: {$d['data_emissao']}\n";
    echo "  - Estado:          {$d['estado']}\n";
    echo "  - Código:          {$d['codigo']}\n";
    
    // Validar presença de todos os 7 campos obrigatórios
    $camposObrigatorios = ['titular', 'tipo', 'curso', 'instituicao', 'data_emissao', 'estado', 'codigo'];
    foreach ($camposObrigatorios as $campo) {
        if (!isset($d[$campo]) || empty($d[$campo])) {
            echo "✗ Campo obrigatório ausente: {$campo}\n";
            exit(1);
        }
    }
    echo "✓ Todos os 7 campos obrigatórios estão preenchidos com sucesso!\n";
} else {
    echo "✗ Falha no teste de documento válido: {$res1['raw']}\n";
    exit(1);
}

// TESTE 2: DOCUMENTO NÃO ENCONTRADO
echo "\n[TESTE 2] Consultando Código Inexistente...\n";
$res2 = fetchUrl("{$baseUrl}/api/public/verify/VD-2026-NAOEXISTE99");

if ($res2['code'] === 404 && $res2['data']['found'] === false && $res2['data']['result'] === 'not_found') {
    echo "✓ Título retornado: {$res2['data']['title']} (Esperado: DOCUMENTO NÃO ENCONTRADO)\n";
    echo "✓ Mensagem: {$res2['data']['message']}\n";
} else {
    echo "✗ Falha no teste de documento não encontrado: {$res2['raw']}\n";
    exit(1);
}

// TESTE 3: DOCUMENTO REVOGADO
echo "\n[TESTE 3] Consultando Documento Revogado...\n";
$res3 = fetchUrl("{$baseUrl}/api/public/verify/{$docRevoked['verification_code']}");

if ($res3['code'] === 200 && $res3['data']['result'] === 'revoked') {
    echo "✓ Título retornado: {$res3['data']['title']} (Esperado: DOCUMENTO REVOGADO)\n";
    echo "  - Titular: {$res3['data']['document']['titular']}\n";
    echo "  - Estado:  {$res3['data']['document']['estado']}\n";
} else {
    echo "✗ Falha no teste de documento revogado: {$res3['raw']}\n";
    exit(1);
}

// TESTE 4: DOCUMENTO EXPIRADO
echo "\n[TESTE 4] Consultando Documento Expirado...\n";
$res4 = fetchUrl("{$baseUrl}/api/public/verify/{$docExpired['verification_code']}");

if ($res4['code'] === 200 && $res4['data']['result'] === 'expired') {
    echo "✓ Título retornado: {$res4['data']['title']} (Esperado: DOCUMENTO EXPIRADO)\n";
    echo "  - Titular:       {$res4['data']['document']['titular']}\n";
    echo "  - Data Validade: {$res4['data']['document']['data_validade']}\n";
    echo "  - Estado:        {$res4['data']['document']['estado']}\n";
} else {
    echo "✗ Falha no teste de documento expirado: {$res4['raw']}\n";
    exit(1);
}

// TESTE 5: VERIFICAÇÃO DE REGISTRO NA TABELA 'verifications'
echo "\n[TESTE 5] Verificando logs de auditoria na tabela 'verifications'...\n";
$countVerif = $pdo->query("SELECT COUNT(*) FROM verifications")->fetchColumn();
echo "✓ Total de verificações registradas no MySQL: {$countVerif}\n";

$lastVerifs = $pdo->query("SELECT verification_code, result, verified_at FROM verifications ORDER BY id DESC LIMIT 4")->fetchAll(PDO::FETCH_ASSOC);
foreach ($lastVerifs as $v) {
    echo "  - Código: {$v['verification_code']} | Resultado: {$v['result']} | Data: {$v['verified_at']}\n";
}

echo "\n=======================================================\n";
echo "TODOS OS TESTES DO SISTEMA DE QR CODE E VERIFICAÇÃO PÚBLICA\nPASSARAM COM 100% DE SUCESSO!\n";
echo "=======================================================\n";
