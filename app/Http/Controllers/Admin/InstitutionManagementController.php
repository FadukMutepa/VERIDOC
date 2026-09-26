<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Institution;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class InstitutionManagementController extends Controller
{
    /**
     * Lista instituições com filtro por estado (pending, approved, suspended).
     */
    public function index(Request $request)
    {
        $status = $request->query('status');

        $query = Institution::withCount('documents', 'users');

        if ($status && in_array($status, ['pending', 'approved', 'suspended', 'rejected'])) {
            $query->where('status', $status);
        }

        $institutions = $query->orderBy('id', 'desc')->get();

        $stats = [
            'total' => Institution::count(),
            'pending' => Institution::where('status', 'pending')->count(),
            'approved' => Institution::where('status', 'approved')->count(),
            'suspended' => Institution::where('status', 'suspended')->count(),
        ];

        if ($request->expectsJson()) {
            return response()->json([
                'institutions' => $institutions,
                'stats' => $stats,
            ]);
        }

        return view('admin.institutions.index', compact('institutions', 'stats'));
    }

    /**
     * Atualiza o estado da instituição: apenas Administrador pode alterar para APPROVED ou SUSPENDED.
     */
    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => ['required', 'in:approved,suspended,rejected,pending'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $institution = Institution::findOrFail($id);
        $oldStatus = $institution->status;
        $institution->status = $request->status;
        $institution->save();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'institution_status_updated',
            'ip_address' => $request->ip(),
            'details' => "Instituição '{$institution->name}' alterada de '{$oldStatus}' para '{$institution->status}'. Motivo: " . ($request->reason ?? 'Decisão administrativa'),
        ]);

        if ($request->expectsJson()) {
            return response()->json([
                'message' => "Estado da instituição atualizado com sucesso para '{$institution->status}'.",
                'institution' => $institution,
            ]);
        }

        return back()->with('success', "Instituição atualizada para '{$institution->status}' com sucesso.");
    }
}
