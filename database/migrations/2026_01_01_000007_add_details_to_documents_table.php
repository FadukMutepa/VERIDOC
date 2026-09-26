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
        Schema::table('documents', function (Blueprint $table) {
            $table->string('area', 150)->nullable()->after('course');
            $table->text('description')->nullable()->after('expiry_date');
            $table->text('observations')->nullable()->after('description');
            $table->mediumText('qr_code')->nullable()->after('hash'); // Guarda SVG ou DataURL do QR Code
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn(['area', 'description', 'observations', 'qr_code']);
        });
    }
};
