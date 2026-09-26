<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Processa a autenticação com validação e hashing seguro.
     */
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Credenciais inválidas. Verifique o email e a palavra-passe.'],
            ]);
        }

        // Validação de status do utilizador
        if ($user->status !== 'active') {
            throw ValidationException::withMessages([
                'email' => ['Esta conta de utilizador encontra-se inativa ou suspensa.'],
            ]);
        }

        // Se for operador de instituição, verificar o status da instituição
        if ($user->institution_id && $user->institution) {
            $instStatus = $user->institution->status;
            if ($instStatus === 'pending') {
                throw ValidationException::withMessages([
                    'email' => ['O cadastro da sua instituição aguarda aprovação pelo Administrador.'],
                ]);
            }
            if ($instStatus === 'suspended') {
                throw ValidationException::withMessages([
                    'email' => ['A instituição encontra-se temporariamente suspensa.'],
                ]);
            }
        }

        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        // Registo de auditoria
        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'user_login',
            'ip_address' => $request->ip(),
            'details' => 'Autenticação bem-sucedida no sistema VeriDoc',
        ]);

        return redirect()->intended(
            $user->role === 'admin' ? route('admin.dashboard') : route('institution.dashboard')
        );
    }

    /**
     * Encerra a sessão com destruição segura do token.
     */
    public function logout(Request $request)
    {
        $userId = Auth::id();

        if ($userId) {
            AuditLog::create([
                'user_id' => $userId,
                'action' => 'user_logout',
                'ip_address' => $request->ip(),
                'details' => 'Encerramento de sessão efetuado com sucesso',
            ]);
        }

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login')->with('success', 'Sessão terminada com segurança.');
    }

    /**
     * Solicitação de recuperação de palavra-passe.
     */
    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => ['required', 'email']]);

        $user = User::where('email', $request->email)->first();

        if ($user) {
            AuditLog::create([
                'user_id' => $user->id,
                'action' => 'password_recovery_requested',
                'ip_address' => $request->ip(),
                'details' => 'Pedido de redefinição de palavra-passe iniciado',
            ]);
        }

        return back()->with('status', 'Se o endereço estiver registado, receberá instruções para redefinir a palavra-passe.');
    }
}
