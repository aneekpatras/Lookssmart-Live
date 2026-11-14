<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('site_events')) {
            return;
        }

        Schema::create('site_events', function (Blueprint $table) {
            $table->id();
            $table->string('session_id', 64)->index();
            $table->string('event', 40)->index();
            $table->string('path', 255)->nullable();
            $table->json('meta')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamp('created_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_events');
    }
};
