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
        Schema::create('institutions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->string('type', 100); // universidade, instituto_tecnico, orgao_publico, conselho, empresa
            $table->string('country', 100);
            $table->string('city', 150);
            $table->text('address')->nullable();
            $table->string('email', 255)->unique();
            $table->string('phone', 50)->nullable();
            $table->string('website', 255)->nullable();
            $table->string('responsible_name', 200);
            $table->string('responsible_email', 255);
            $table->enum('status', ['pending', 'approved', 'suspended', 'rejected'])->default('pending');
            $table->timestamps();

            // Índices para otimização de consultas administrativas
            $table->index('status');
            $table->index(['country', 'city']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('institutions');
    }
};
