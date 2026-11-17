<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Email sign-in challenges for admin accounts (6-digit code + approve link). Only hashes are stored. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('admin_login_challenges')) {
            return;
        }

        Schema::create('admin_login_challenges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->char('code_hash', 64);
            $table->char('token_hash', 64);
            $table->char('session_hash', 64);
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->unsignedTinyInteger('sent_count')->default(1);
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 250)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_login_challenges');
    }
};
