<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureInstitutionTenancy
{
    /**
     * Garante o isolamento multi-tenant:
     * Impede que um operador de uma instituição visualize ou manipule dados de outra instituição.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Administrador geral pode inspecionar entidades
        if ($user && $user->role === 'admin') {
            return $next($request);
        }

        // Recupera o ID da instituição do parâmetro da rota (se houver)
        $routeInstitutionId = $request->route('institution') 
            ?? $request->route('institution_id') 
            ?? $request->input('institution_id');

        if ($routeInstitutionId && (int)$routeInstitutionId !== (int)$user->institution_id) {
            if ($request->expectsJson()) {
                return response()->json([
                    'error' => 'Violação de segurança: Não tem permissão para aceder a dados de outra instituição.'
                ], 403);
            }
            abort(403, 'Isolamento de dados violado: Tentativa de acesso a outra instituição.');
        }

        return $next($request);
    }
}
