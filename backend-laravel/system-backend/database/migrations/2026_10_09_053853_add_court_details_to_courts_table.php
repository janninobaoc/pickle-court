<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('courts', function (Blueprint $table) {
            $table->string('location')->nullable()->after('status');
            $table->json('amenities')->nullable()->after('location');
            $table->time('opening_time')->nullable()->after('amenities');
            $table->time('closing_time')->nullable()->after('opening_time');
            $table->json('operating_days')->nullable()->after('closing_time');
            $table->string('image')->nullable()->after('operating_days');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courts', function (Blueprint $table) {
            $table->dropColumn([
                'location',
                'amenities',
                'opening_time',
                'closing_time',
                'operating_days',
                'image',
            ]);
        });
    }
};
