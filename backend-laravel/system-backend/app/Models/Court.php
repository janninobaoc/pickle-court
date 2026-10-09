<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Court extends Model
{
    use HasFactory;
    protected $fillable = [
        'name',
        'type',
        'description',
        'hourly_rate',
        'status',
        'location',
        'amenities',
        'opening_time',
        'closing_time',
        'operating_days',
        'image',
    ];


    protected function casts(): array
    {
        return [
            'amenities' => 'array',
            'operating_days' => 'array',
        ];
    }


    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }
}
