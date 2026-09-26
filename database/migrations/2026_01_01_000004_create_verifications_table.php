<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')
                  ->nullable()
                  ->constrained('documents')
                  ->onDelete('set null');
            $table->string('verification_code', 50); // Mantém o código pesquisado mesmo se não encontrado
            $table->enum('result', ['valid', 'revoked', 'expired', 'not_found']);
            $table->string('ip_address', 45)->nullable(); // IPv4 ou IPv6
            $table->text('user_agent')->nullable();
            $table->timestamp('verified_at')->useCurrent();

            // Índices analíticos e métricas de auditoria
            $table->index('verification_code');
            $table->index('result');
            $table->index('verified_at');
            $table->index(['document_id', 'result']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('verifications');
    }
};
