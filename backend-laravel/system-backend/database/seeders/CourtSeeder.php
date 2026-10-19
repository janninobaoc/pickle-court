<?php

namespace Database\Seeders;

use App\Models\Court;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CourtSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $courts = [
            [
                'name' => 'Cebu Central Indoor Court',
                'type' => 'Indoor',
                'description' => 'Covered court near Cebu Business Park with bright lighting and spectator seating.',
                'hourly_rate' => 450.00,
                'status' => 'available',
                'location' => 'Cebu Business Park, Cebu City',
                'amenities' => ['Lighting', 'Seating', 'Restrooms'],
                'opening_time' => '06:00',
                'closing_time' => '22:00',
                'operating_days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                'image' => '/img/courts/cebu-central-indoor.jpg',
            ],
            [
                'name' => 'Mandaue Pickleball Arena',
                'type' => 'Indoor',
                'description' => 'Full-size indoor pickleball court with equipment rental and changing rooms.',
                'hourly_rate' => 400.00,
                'status' => 'available',
                'location' => 'Centro, Mandaue City',
                'amenities' => ['Equipment Rental', 'Changing Rooms', 'Parking'],
                'opening_time' => '07:00',
                'closing_time' => '22:00',
                'operating_days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                'image' => '/img/courts/mandaue-arena.jpg',
            ],
            [
                'name' => 'Lahug Sports Court',
                'type' => 'Outdoor',
                'description' => 'Open-air neighborhood court with evening floodlights and mountain-side breezes.',
                'hourly_rate' => 275.00,
                'status' => 'available',
                'location' => 'Lahug, Cebu City',
                'amenities' => ['Lighting', 'Water Station', 'Seating'],
                'opening_time' => '06:00',
                'closing_time' => '21:00',
                'operating_days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                'image' => '/img/courts/lahug-sports-court.jpg',
            ],
            [
                'name' => 'IT Park Pickleball Hub',
                'type' => 'Indoor',
                'description' => 'Air-conditioned court in Cebu IT Park with convenient access to dining and transit.',
                'hourly_rate' => 500.00,
                'status' => 'available',
                'location' => 'Cebu IT Park, Cebu City',
                'amenities' => ['Air Conditioning', 'Lockers', 'Restrooms'],
                'opening_time' => '06:00',
                'closing_time' => '23:00',
                'operating_days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                'image' => '/img/courts/it-park-hub.jpg',
            ],
            [
                'name' => 'Banilad Indoor Court',
                'type' => 'Indoor',
                'description' => 'Well-maintained indoor court for lessons, friendly matches, and small group play.',
                'hourly_rate' => 375.00,
                'status' => 'available',
                'location' => 'Banilad, Cebu City',
                'amenities' => ['Parking', 'Drinking Water', 'Restrooms'],
                'opening_time' => '07:00',
                'closing_time' => '21:00',
                'operating_days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                'image' => '/img/courts/banilad-indoor.jpg',
            ],
            [
                'name' => 'Talamban Outdoor Court',
                'type' => 'Outdoor',
                'description' => 'Community outdoor court with a shaded waiting area and marked pickleball lines.',
                'hourly_rate' => 250.00,
                'status' => 'available',
                'location' => 'Talamban, Cebu City',
                'amenities' => ['Shaded Seating', 'Lighting', 'Water Station'],
                'opening_time' => '06:00',
                'closing_time' => '20:00',
                'operating_days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                'image' => '/img/courts/talamban-outdoor.jpg',
            ],
            [
                'name' => 'Mabolo Pickleball Center',
                'type' => 'Indoor',
                'description' => 'Indoor court with a smooth playing surface, equipment rental, and secure parking.',
                'hourly_rate' => 425.00,
                'status' => 'unavailable',
                'location' => 'Mabolo, Cebu City',
                'amenities' => ['Equipment Rental', 'Parking', 'Lockers'],
                'opening_time' => '06:00',
                'closing_time' => '22:00',
                'operating_days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                'image' => '/img/courts/mabolo-center.jpg',
            ],
            [
                'name' => 'Lapu-Lapu Sports Court',
                'type' => 'Outdoor',
                'description' => 'Coastal outdoor court with night lighting and space for warm-ups beside the playing area.',
                'hourly_rate' => 300.00,
                'status' => 'available',
                'location' => 'Pusok, Lapu-Lapu City',
                'amenities' => ['Lighting', 'Seating', 'Restrooms'],
                'opening_time' => '06:00',
                'closing_time' => '21:00',
                'operating_days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                'image' => '/img/courts/lapu-lapu-sports.jpg',
            ],
            [
                'name' => 'Talisay Pickleball Grounds',
                'type' => 'Outdoor',
                'description' => 'Open-air court serving local players, with shaded benches and convenient water access.',
                'hourly_rate' => 225.00,
                'status' => 'unavailable',
                'location' => 'Talisay City, Cebu',
                'amenities' => ['Shaded Seating', 'Water Station', 'Parking'],
                'opening_time' => '06:00',
                'closing_time' => '20:00',
                'operating_days' => ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                'image' => '/img/courts/talisay-grounds.jpg',
            ],
            [
                'name' => 'Consolacion Pickleball Club',
                'type' => 'Outdoor',
                'description' => 'Outdoor club court with changing facilities, shaded benches, and beginner sessions.',
                'hourly_rate' => 350.00,
                'status' => 'available',
                'location' => 'Poblacion Occidental, Consolacion',
                'amenities' => ['Changing Rooms', 'Restrooms', 'Seating'],
                'opening_time' => '07:00',
                'closing_time' => '22:00',
                'operating_days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                'image' => '/img/courts/consolacion-club.jpg',
            ],
        ];

        foreach ($courts as $court) {
            $attributes = Court::factory()->state($court)->raw();

            Court::firstOrCreate(
                ['name' => $court['name']],
                $attributes,
            );
        }
    }
}
