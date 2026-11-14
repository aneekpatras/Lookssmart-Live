<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('incomplete_bookings')) {
            return;
        }

        Schema::create('incomplete_bookings', function (Blueprint $table) {
            $table->id();
            $table->string('session_id', 64)->unique();
            $table->string('name', 100);
            $table->string('phone', 20);
            $table->json('items')->nullable();
            $table->decimal('total', 12, 2)->nullable();
            $table->string('status', 20)->default('new'); // new, contacted, converted
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incomplete_bookings');
    }
};
