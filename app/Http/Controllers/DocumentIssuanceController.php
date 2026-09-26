<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DocumentIssuanceController extends Controller
{
    /**
     * Lista os documentos emitidos pela instituição autenticada.
     * Rota: /instituicao/documentos
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $institutionId = $user->institution_id;

        $query = Document::where('institution_id', $institutionId)
            ->with(['histories', 'verifications'])
            ->orderBy('id', 'desc');

        if ($request->has('status') && in_array($request->status, ['valid', 'revoked', 'expired'])) {
            $query->where('status', $request->status);
        }

        if ($request->has('search') && !empty($request->search)) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('holder_name', 'like', "%{$s}%")
                  ->orWhere('verification_code', 'like', "%{$s}%")
                  ->orWhere('document_type', 'like', "%{$s}%")
                  ->orWhere('course', 'like', "%{$s}%");
            });
        }

        $documents = $query->paginate(15);

        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'documents' => $documents,
            ]);
        }

        return view('institution.documents.index', compact('documents'));
    }

    /**
     * Exibe o formulário de emissão de novo documento.
     * Rota: /instituicao/documentos/novo
     */
    public function create()
    {
        return view('institution.documents.create');
    }

    /**
     * Processa a emissão real de documento no servidor.
     * Valida, gera código único verificado, hash SHA-256, QR Code e histórico.
     */
    public function store(Request $request)
    {
        $user = Auth::user();
        $institution = $user->institution;

        // Regra de segurança: Somente instituições aprovadas podem emitir documentos
        if (!$institution || $institution->status !== 'approved') {
            abort(403, 'A sua instituição deve estar APROVADA para emitir documentos oficiais.');
        }

        $validated = $request->validate([
            'holder_name' => ['required', 'string', 'max:255'],
            'document_type' => ['required', 'string', 'max:100'],
            'course' => ['required', 'string', 'max:255'],
            'area' => ['nullable', 'string', 'max:150'],
            'issue_date' => ['required', 'date'],
            'expiry_date' => ['nullable', 'date', 'after_or_equal:issue_date'],
            'description' => ['nullable', 'string'],
            'observations' => ['nullable', 'string'],
        ]);

        return DB::transaction(function () use ($validated, $user, $institution, $request) {
            // 1. Gerar código único com verificação real de colisões no banco
            $verificationCode = $this->generateUniqueVerificationCode();

            // 2. Gerar hash criptográfico SHA-256 inviolável dos dados oficiais
            $hashInput = implode('|', [
                $institution->id,
                trim($validated['holder_name']),
                trim($validated['document_type']),
                trim($validated['course']),
                $validated['issue_date'],
                $verificationCode,
                config('app.key', 'veridoc_secure_key_2026')
            ]);
            $documentHash = hash('sha256', $hashInput);

            // 3. Link público de verificação associado ao QR Code
            $verificationUrl = url("/verificar?code={$verificationCode}");

            // 4. Salvar o documento com status VALID
            $document = Document::create([
                'institution_id' => $institution->id,
                'holder_name' => $validated['holder_name'],
                'document_type' => $validated['document_type'],
                'course' => $validated['course'],
                'area' => $validated['area'] ?? null,
                'issue_date' => $validated['issue_date'],
                'expiry_date' => $validated['expiry_date'] ?? null,
                'description' => $validated['description'] ?? null,
                'observations' => $validated['observations'] ?? null,
                'verification_code' => $verificationCode,
                'hash' => $documentHash,
                'status' => 'valid',
            ]);

            // 5. Registrar no histórico do documento (document_history)
            DocumentHistory::create([
                'document_id' => $document->id,
                'user_id' => $user->id,
                'action' => 'created',
                'description' => "Documento emitido oficialmente por {$user->name} ({$institution->name}).",
            ]);

            // 6. Registrar no log de auditoria global (audit_logs)
            AuditLog::create([
                'user_id' => $user->id,
                'action' => 'document_issued',
                'ip_address' => $request->ip(),
                'details' => "Documento emitido: Código {$verificationCode}, Titular: {$validated['holder_name']}, Tipo: {$validated['document_type']}.",
            ]);

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Documento emitido com sucesso e registrado na base de dados.',
                    'document' => $document,
                ], 201);
            }

            return redirect()->route('institution.documents.index')
                ->with('success', "Documento emitido com sucesso! Código: {$verificationCode}");
        });
    }

    /**
     * Visualização detalhada do documento com QR Code e histórico.
     */
    public function show($id)
    {
        $user = Auth::user();
        $document = Document::where('id', $id)
            ->where('institution_id', $user->institution_id)
            ->with(['institution', 'histories.user', 'verifications'])
            ->firstOrFail();

        return view('institution.documents.show', compact('document'));
    }

    /**
     * Revogação formal de documento com justificativa obrigatória.
     */
    public function revoke(Request $request, $id)
    {
        $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        $user = Auth::user();
        $document = Document::where('id', $id)
            ->where('institution_id', $user->institution_id)
            ->firstOrFail();

        if ($document->status === 'revoked') {
            return back()->withErrors(['status' => 'Este documento já se encontra revogado.']);
        }

        DB::transaction(function () use ($document, $user, $request) {
            $document->status = 'revoked';
            $document->save();

            DocumentHistory::create([
                'document_id' => $document->id,
                'user_id' => $user->id,
                'action' => 'revoked',
                'description' => "Documento revogado por {$user->name}. Motivo legal: {$request->reason}",
            ]);

            AuditLog::create([
                'user_id' => $user->id,
                'action' => 'document_revoked',
                'ip_address' => $request->ip(),
                'details' => "Documento ID {$document->id} ({$document->verification_code}) revogado. Motivo: {$request->reason}",
            ]);
        });

        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Documento revogado com sucesso.',
                'document' => $document,
            ]);
        }

        return redirect()->route('institution.documents.index')
            ->with('warning', "O documento {$document->verification_code} foi revogado com sucesso.");
    }

    /**
     * Gerador de código alfanumérico seguro com garantia de unicidade no banco de dados.
     * Padrão: VD-YYYY-XXXXXXXX (ex: VD-2026-8F72K91X)
     */
    private function generateUniqueVerificationCode(): string
    {
        $year = date('Y');
        $charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        $charsetLen = strlen($charset);
        $attempts = 0;

        do {
            $attempts++;
            if ($attempts > 100) {
                throw new \Exception('Não foi possível gerar um código único após 100 tentativas.');
            }

            $randomPart = '';
            $randomBytes = random_bytes(8);
            for ($i = 0; $i < 8; $i++) {
                $randomPart .= $charset[ord($randomBytes[$i]) % $charsetLen];
            }

            $code = "VD-{$year}-{$randomPart}";
            $exists = Document::where('verification_code', $code)->exists();
        } while ($exists);

        return $code;
    }
}
