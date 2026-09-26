<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Verification;
use Illuminate\Http\Request;

class PublicVerificationController extends Controller
{
    /**
     * Página Pública de Verificação do QR Code / Código Único.
     * Rota: /verificar/{codigo}
     * Não exige login (100% público).
     */
    public function verify(Request $request, string $codigo)
    {
        $code = strtoupper(trim($codigo));

        // 1. Consultar documento na base de dados com a instituição emissora
        $document = Document::with('institution')
            ->whereRaw('UPPER(verification_code) = ?', [$code])
            ->first();

        $ip = $request->ip() ?? '127.0.0.1';
        $userAgent = $request->userAgent() ?? 'VeriDoc Scanner';

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

            if ($request->expectsJson()) {
                return response()->json([
                    'found' => false,
                    'result' => 'not_found',
                    'title' => 'DOCUMENTO NÃO ENCONTRADO',
                    'message' => "O código {$code} não foi localizado no registro oficial do VeriDoc.",
                ], 404);
            }

            return view('public.verify', [
                'found' => false,
                'status' => 'not_found',
                'code' => $code,
                'title' => 'DOCUMENTO NÃO ENCONTRADO',
            ]);
        }

        // 3. Determinar o estado real do documento (VALID, REVOKED, EXPIRED)
        $status = $document->status;

        // Se estiver como 'valid', verificar se a data de validade já expirou
        if ($status === 'valid' && $document->expiry_date && $document->expiry_date->isPast()) {
            $status = 'expired';
        }

        // 4. Registrar a verificação no banco de dados
        Verification::create([
            'document_id' => $document->id,
            'verification_code' => $document->verification_code,
            'result' => $status,
            'ip_address' => $ip,
            'user_agent' => $userAgent,
            'verified_at' => now(),
        ]);

        $title = match ($status) {
            'valid' => 'DOCUMENTO VÁLIDO',
            'revoked' => 'DOCUMENTO REVOGADO',
            'expired' => 'DOCUMENTO EXPIRADO',
            default => 'DOCUMENTO NÃO ENCONTRADO',
        };

        $documentData = [
            'titular' => $document->holder_name,
            'tipo' => $document->document_type,
            'curso' => $document->course,
            'instituicao' => $document->institution->name ?? 'Instituição Homologada',
            'data_emissao' => $document->issue_date ? $document->issue_date->format('d/m/Y') : null,
            'data_validade' => $document->expiry_date ? $document->expiry_date->format('d/m/Y') : 'Vitalício',
            'estado' => strtoupper($status),
            'codigo' => $document->verification_code,
            'hash' => $document->hash,
            'qr_code' => $document->qr_code,
            'area' => $document->area,
            'descricao' => $document->description,
        ];

        if ($request->expectsJson()) {
            return response()->json([
                'found' => true,
                'result' => $status,
                'title' => $title,
                'document' => $documentData,
            ]);
        }

        return view('public.verify', [
            'found' => true,
            'status' => $status,
            'title' => $title,
            'document' => $documentData,
        ]);
    }
}
