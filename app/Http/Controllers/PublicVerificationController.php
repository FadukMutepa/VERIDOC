<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Document;
use App\Models\Verification;
use Illuminate\Http\Request;

class PublicVerificationController extends Controller
{
    /**
     * Página Pública de Verificação do QR Code / Código Único.
     * Rota: /verificar/{codigo}
     * Não exige login (100% público).
     *
     * Regras de Privacidade e Segurança:
     * - Não expõe: senhas, emails privados, telefones, endereços particulares, observações internas.
     * - Executa verificação criptográfica de integridade SHA-256 dos dados.
     * - Registra a operação em verifications e audit_logs.
     */
    public function verify(Request $request, string $codigo)
    {
        $code = strtoupper(trim($codigo));
        $ip = $request->ip() ?? '127.0.0.1';
        $userAgent = $request->userAgent() ?? 'VeriDoc Scanner';

        // 1. Consultar documento na base de dados com a instituição emissora
        $document = Document::with('institution')
            ->whereRaw('UPPER(verification_code) = ?', [$code])
            ->first();

        // 2. DOCUMENTO NÃO ENCONTRADO
        if (!$document) {
            Verification::create([
                'document_id' => null,
                'verification_code' => $code,
                'result' => 'not_found',
                'ip_address' => $ip,
                'user_agent' => $userAgent,
                'verified_at' => now(),
            ]);

            AuditLog::create([
                'user_id' => null,
                'action' => 'document_verification',
                'ip_address' => $ip,
                'details' => "Consulta pública com código inexistente: {$code}",
            ]);

            if ($request->expectsJson()) {
                return response()->json([
                    'found' => false,
                    'result' => 'not_found',
                    'title' => 'DOCUMENTO NÃO ENCONTRADO',
                    'message' => "O código {$code} não foi localizado no registro oficial do VeriDoc.",
                    'integrity_verified' => false,
                ], 404);
            }

            return view('public.verify', [
                'found' => false,
                'status' => 'not_found',
                'code' => $code,
                'title' => 'DOCUMENTO NÃO ENCONTRADO',
            ]);
        }

        // 3. Verificação de Integridade Criptográfica dos dados
        $isIntegrityValid = $document->verifyIntegrity();

        // 4. Determinar o estado real do documento (VALID, REVOKED, EXPIRED, TAMPERED)
        $status = $document->status;

        if (!$isIntegrityValid) {
            $status = 'tampered';
        } elseif ($status === 'valid' && $document->expiry_date && $document->expiry_date->isPast()) {
            $status = 'expired';
        }

        // 5. Registrar a verificação no banco de dados
        Verification::create([
            'document_id' => $document->id,
            'verification_code' => $document->verification_code,
            'result' => $status,
            'ip_address' => $ip,
            'user_agent' => $userAgent,
            'verified_at' => now(),
        ]);

        // Registrar no log de auditoria global
        AuditLog::create([
            'user_id' => null,
            'action' => 'document_verification',
            'ip_address' => $ip,
            'details' => "Verificação pública de '{$document->verification_code}'. Resultado: " . strtoupper($status) . ". Integridade SHA-256: " . ($isIntegrityValid ? 'VÁLIDA' : 'FALHA'),
        ]);

        $title = match ($status) {
            'valid' => 'DOCUMENTO VÁLIDO',
            'revoked' => 'DOCUMENTO REVOGADO',
            'expired' => 'DOCUMENTO EXPIRADO',
            'tampered' => 'INTEGRIDADE COMPROMETIDA',
            default => 'DOCUMENTO NÃO ENCONTRADO',
        };

        // Filtro estrito de Privacidade: Não expor dados confidenciais ou internos
        $documentData = [
            'titular' => $document->holder_name,
            'tipo' => $document->document_type,
            'curso' => $document->course,
            'instituicao' => $document->institution->name ?? 'Instituição Homologada',
            'data_emissao' => $document->issue_date ? $document->issue_date->format('Y-m-d') : null,
            'data_validade' => $document->expiry_date ? $document->expiry_date->format('Y-m-d') : null,
            'estado' => strtoupper($status),
            'codigo' => $document->verification_code,
            'hash' => $document->hash,
            'qr_code' => $document->qr_code,
            'area' => $document->area,
            'descricao' => $document->description,
            'cidade' => $document->institution->city ?? null,
            'pais' => $document->institution->country ?? null,
            'integrity_verified' => $isIntegrityValid,
        ];

        if ($request->expectsJson()) {
            return response()->json([
                'found' => true,
                'result' => $status,
                'title' => $title,
                'integrity_verified' => $isIntegrityValid,
                'document' => $documentData,
            ]);
        }

        return view('public.verify', [
            'found' => true,
            'status' => $status,
            'title' => $title,
            'integrity_verified' => $isIntegrityValid,
            'document' => $documentData,
        ]);
    }
}
