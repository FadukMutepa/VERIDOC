<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Document extends Model
{
    use HasFactory;

    protected $table = 'documents';

    protected $fillable = [
        'institution_id',
        'holder_name',
        'document_type',
        'course',
        'area',
        'issue_date',
        'expiry_date',
        'description',
        'observations',
        'verification_code',
        'hash',
        'qr_code',
        'status',
    ];

    protected $casts = [
        'issue_date' => 'date',
        'expiry_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relacionamento: Todo documento pertence a uma instituição emissora.
     */
    public function institution(): BelongsTo
    {
        return $this->belongsTo(Institution::class, 'institution_id');
    }

    /**
     * Relacionamento: Um documento possui múltiplas consultas/verificações realizadas.
     * Document → Verifications
     */
    public function verifications(): HasMany
    {
        return $this->hasMany(Verification::class, 'document_id');
    }

    /**
     * Relacionamento: Um documento possui um histórico de ciclo de vida (emissão, edição, revogação).
     * Document → History
     */
    public function histories(): HasMany
    {
        return $this->hasMany(DocumentHistory::class, 'document_id');
    }

    /**
     * Determina se o documento está efetivamente válido perante data de expiração e status.
     */
    public function isValid(): bool
    {
        if ($this->status !== 'valid') {
            return false;
        }

        if ($this->expiry_date && $this->expiry_date->isPast()) {
            return false;
        }

        return true;
    }
}
