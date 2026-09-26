<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Verification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    /**
     * Apresenta o Dashboard da Instituição calculando números diretamente do banco de dados MySQL:
     * - Total de documentos
     * - Documentos válidos
     * - Documentos revogados
     * - Total de verificações
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $institutionId = $user->institution_id;

        // Total de documentos emitidos por esta instituição
        $totalDocuments = Document::where('institution_id', $institutionId)->count();

        // Documentos válidos
        $validDocuments = Document::where('institution_id', $institutionId)
            ->where('status', 'valid')
            ->count();

        // Documentos revogados
        $revokedDocuments = Document::where('institution_id', $institutionId)
            ->where('status', 'revoked')
            ->count();

        // Total de verificações realizadas em documentos desta instituição
        $totalVerifications = Verification::whereHas('document', function ($query) use ($institutionId) {
            $query->where('institution_id', $institutionId);
        })->count();

        // Lista dos últimos documentos
        $recentDocuments = Document::where('institution_id', $institutionId)
            ->orderBy('id', 'desc')
            ->limit(10)
            ->get();

        if ($request->expectsJson()) {
            return response()->json([
                'institution' => $user->institution,
                'stats' => [
                    'total_documents' => $totalDocuments,
                    'valid_documents' => $validDocuments,
                    'revoked_documents' => $revokedDocuments,
                    'total_verifications' => $totalVerifications,
                ],
                'recent_documents' => $recentDocuments,
            ]);
        }

        return view('institution.dashboard', compact(
            'totalDocuments',
            'validDocuments',
            'revokedDocuments',
            'totalVerifications',
            'recentDocuments'
        ));
    }
}
