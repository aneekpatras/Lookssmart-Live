<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('manual_message_logs')) {
            return;
        }

        Schema::create('manual_message_logs', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20)->index(); // reminder or birthday
            $table->unsignedBigInteger('booking_id')->nullable()->index();
            $table->unsignedBigInteger('customer_id')->nullable()->index();
            $table->string('phone', 20);
            $table->text('message');
            $table->unsignedBigInteger('sent_by')->nullable();
            $table->timestamp('sent_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manual_message_logs');
    }
};
