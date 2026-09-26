<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Verification extends Model
{
    use HasFactory;

    protected $table = 'verifications';

    public $timestamps = false; // Tabela utiliza apenas verified_at

    protected $fillable = [
        'document_id',
        'verification_code',
        'result',
        'ip_address',
        'user_agent',
        'verified_at',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
    ];

    /**
     * Relacionamento: Uma verificação pode apontar para um documento existente (ou null se não encontrado).
     */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'document_id');
    }
}
