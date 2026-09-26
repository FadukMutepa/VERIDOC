<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckApprovedInstitution
{
    /**
     * Impede que instituições pendentes ou suspensas acessem o dashboard ou emitam documentos.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return redirect()->route('login')->withErrors(['auth' => 'Sessão expirada. Por favor, autentique-se novamente.']);
        }

        // Se for administrador geral, tem acesso total
        if ($user->role === 'admin') {
            return $next($request);
        }

        // Se o usuário não tiver instituição associada
        if (!$user->institution_id || !$user->institution) {
            abort(403, 'Acesso não autorizado: Utilizador sem instituição vinculada.');
        }

        $status = $user->institution->status;

        if ($status === 'pending') {
            return response()->view('errors.institution_pending', [
                'institution' => $user->institution
            ], 403);
        }

        if ($status === 'suspended') {
            return response()->view('errors.institution_suspended', [
                'institution' => $user->institution
            ], 403);
        }

        if ($status === 'rejected') {
            return response()->view('errors.institution_rejected', [
                'institution' => $user->institution
            ], 403);
        }

        return $next($request);
    }
}
