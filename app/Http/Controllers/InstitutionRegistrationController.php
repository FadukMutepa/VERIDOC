<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Institution;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class InstitutionRegistrationController extends Controller
{
    /**
     * Regista uma nova instituição com estado inicial obrigatório 'PENDING'.
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'max:100'],
            'country' => ['required', 'string', 'max:100'],
            'city' => ['required', 'string', 'max:150'],
            'address' => ['nullable', 'string'],
            'email' => ['required', 'email', 'max:255', 'unique:institutions,email'],
            'phone' => ['required', 'string', 'max:50'],
            'website' => ['nullable', 'url', 'max:255'],
            'responsible_name' => ['required', 'string', 'max:200'],
            'responsible_email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        return DB::transaction(function () use ($validated, $request) {
            // 1. Criar a Instituição com status 'pending'
            $institution = Institution::create([
                'name' => $validated['name'],
                'type' => $validated['type'],
                'country' => $validated['country'],
                'city' => $validated['city'],
                'address' => $validated['address'] ?? null,
                'email' => $validated['email'],
                'phone' => $validated['phone'],
                'website' => $validated['website'] ?? null,
                'responsible_name' => $validated['responsible_name'],
                'responsible_email' => $validated['responsible_email'],
                'status' => 'pending', // Requisito: Estado inicial obrigatório PENDING
            ]);

            // 2. Criar o utilizador gestor inicial da instituição
            $user = User::create([
                'institution_id' => $institution->id,
                'name' => $validated['responsible_name'],
                'email' => $validated['responsible_email'],
                'password' => Hash::make($validated['password']),
                'role' => 'institution_admin',
                'status' => 'active',
            ]);

            // 3. Registar log de auditoria
            AuditLog::create([
                'user_id' => $user->id,
                'action' => 'institution_registered',
                'ip_address' => $request->ip(),
                'details' => "Instituição '{$institution->name}' registada com sucesso (ID: {$institution->id}). Aguardando aprovação administrativa.",
            ]);

            return redirect()->route('login')->with(
                'status',
                'Candidatura submetida com sucesso! A sua conta institucional encontra-se em análise (PENDING) e será notificada assim que o Administrador aprovar o acesso.'
            );
        });
    }
}
