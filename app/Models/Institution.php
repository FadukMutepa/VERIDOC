<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Institution extends Model
{
    use HasFactory;

    protected $table = 'institutions';

    protected $fillable = [
        'name',
        'type',
        'country',
        'city',
        'address',
        'email',
        'phone',
        'website',
        'responsible_name',
        'responsible_email',
        'status',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relacionamento: Uma instituição possui vários utilizadores/operadores.
     * Institution → Users
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'institution_id');
    }

    /**
     * Relacionamento: Uma instituição emite vários documentos.
     * Institution → Documents
     */
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'institution_id');
    }
}
