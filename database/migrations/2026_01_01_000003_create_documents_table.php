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
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('institution_id')
                  ->constrained('institutions')
                  ->onDelete('restrict');
            $table->string('holder_name', 255);
            $table->string('document_type', 100); // ex: diploma, certificado, declaracao, alvara
            $table->string('course', 255)->nullable();
            $table->date('issue_date');
            $table->date('expiry_date')->nullable();
            $table->string('verification_code', 30)->unique();
            $table->char('hash', 64)->unique(); // SHA-256 dos dados essenciais
            $table->enum('status', ['valid', 'revoked', 'expired'])->default('valid');
            $table->timestamps();

            // Índices de alta performance para validação por QR Code e Código
            $table->index('verification_code');
            $table->index('hash');
            $table->index('status');
            $table->index('issue_date');
            $table->index(['institution_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
