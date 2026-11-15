<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('visitor_sessions')) {
            return;
        }

        Schema::create('visitor_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('session_id', 64)->unique();
            $table->timestamp('first_seen_at')->nullable();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->string('device_type', 10)->nullable();
            $table->string('browser', 30)->nullable();
            $table->string('os', 30)->nullable();
            $table->string('screen', 15)->nullable();
            $table->string('language', 12)->nullable();
            $table->string('timezone', 40)->nullable();
            $table->string('source', 60)->nullable();
            $table->string('landing_path', 255)->nullable();
            $table->string('country', 2)->nullable();
            $table->string('region', 80)->nullable();
            $table->string('city', 80)->nullable();
            $table->boolean('is_bot')->default(false)->index();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('name', 100)->nullable();
            $table->string('phone', 20)->nullable()->index();
            $table->json('cart')->nullable();
            $table->decimal('cart_total', 12, 2)->nullable();
            $table->timestamp('cart_updated_at')->nullable()->index();
            $table->string('status', 20)->default('new'); // new, contacted, booked, not_interested
            $table->text('note')->nullable();
            $table->unsignedInteger('pages_count')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visitor_sessions');
    }
};
