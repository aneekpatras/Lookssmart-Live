<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('security_events')) {
            return;
        }

        Schema::create('security_events', function (Blueprint $table) {
            $table->id();
            $table->string('type', 40)->index();
            $table->string('ip', 45)->nullable()->index();
            $table->string('user_agent', 255)->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('subject', 120)->nullable(); // masked email only, never a full email or password
            $table->timestamp('created_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('security_events');
    }
};
