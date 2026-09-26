<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckAdminRole
{
    /**
     * Impede que utilizadores comuns ou operadores institucionais acessem a administração global.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || $user->role !== 'admin') {
            if ($request->expectsJson()) {
                return response()->json([
                    'error' => 'Acesso negado: Requer privilégios de Administrador Geral VeriDoc.'
                ], 403);
            }
            abort(403, 'Acesso reservado exclusivamente à Administração Central do VeriDoc.');
        }

        return $next($request);
    }
}
