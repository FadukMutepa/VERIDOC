<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $table = 'users';

    protected $fillable = [
        'institution_id',
        'name',
        'email',
        'password',
        'role',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'password' => 'hashed',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relacionamento: Um utilizador pertence a uma instituição (se for operador institucional).
     */
    public function institution(): BelongsTo
    {
        return $this->belongsTo(Institution::class, 'institution_id');
    }

    /**
     * Relacionamento: Um utilizador realiza ações registradas no histórico de documentos.
     */
    public function documentHistories(): HasMany
    {
        return $this->hasMany(DocumentHistory::class, 'user_id');
    }

    /**
     * Relacionamento: Um utilizador gera eventos de auditoria.
     * User → Audit Logs
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'user_id');
    }

    /**
     * Helper para verificar se o utilizador é Administrador do sistema.
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }
}
