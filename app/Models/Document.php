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

    // Mass Assignment Protection: Apenas campos auditados permitidos
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
     * Calcula o Hash SHA-256 canônico a partir dos dados essenciais do documento.
     * Padrão: Nome + Tipo + Instituição + Curso + Data de Emissão -> SHA-256
     */
    public static function calculateCanonicalHash(
        string $holderName,
        string $documentType,
        int|string $institutionId,
        string $course,
        string $issueDate
    ): string {
        $normDate = date('Y-m-d', strtotime($issueDate));
        $canonicalPayload = implode('|', [
            trim($holderName),
            trim($documentType),
            (string)$institutionId,
            trim($course),
            $normDate,
        ]);

        return hash('sha256', $canonicalPayload);
    }

    /**
     * Valida a integridade criptográfica dos dados armazenados comparando com o hash do banco.
     */
    public function verifyIntegrity(): bool
    {
        $expectedHash = self::calculateCanonicalHash(
            $this->holder_name,
            $this->document_type,
            $this->institution_id,
            $this->course,
            $this->issue_date->format('Y-m-d')
        );

        return hash_equals(strtolower($this->hash), strtolower($expectedHash));
    }

    /**
     * Relacionamento: Todo documento pertence a uma instituição emissora.
     */
    public function institution(): BelongsTo
    {
        return $this->belongsTo(Institution::class, 'institution_id');
    }

    /**
     * Relacionamento: Consultas realizadas no documento.
     */
    public function verifications(): HasMany
    {
        return $this->hasMany(Verification::class, 'document_id');
    }

    /**
     * Relacionamento: Histórico de ciclo de vida.
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

        return $this->verifyIntegrity();
    }
}
