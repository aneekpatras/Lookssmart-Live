<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('contact_drafts')) {
            return;
        }

        Schema::create('contact_drafts', function (Blueprint $table) {
            $table->id();
            $table->string('session_id', 64)->unique();
            $table->string('name', 100)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('subject', 150)->nullable();
            $table->text('message')->nullable();
            $table->string('status', 20)->default('new')->index(); // new, contacted, sent, not_interested
            $table->text('note')->nullable();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_drafts');
    }
};
