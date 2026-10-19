<?php

namespace Database\Factories;

use App\Models\Court;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Court>
 */
class CourtFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        [$openingTime, $closingTime] = fake()->randomElement([
            ['06:00', '20:00'],
            ['07:00', '21:00'],
            ['08:00', '22:00'],
        ]);

        return [
            'name' => fake()->unique()->city() . ' Pickleball Court',
            'type' => fake()->randomElement(['Indoor', 'Outdoor']),
            'description' => fake()->sentence() . ' Suitable for casual games and club sessions.',
            'hourly_rate' => fake()->randomElement([225, 250, 275, 300, 350, 375, 400, 425, 450, 500]),
            'status' => fake()->randomElement(['available', 'available', 'available', 'available', 'unavailable']),
            'location' => fake()->randomElement([
                'Cebu City',
                'Mandaue City',
                'Lapu-Lapu City',
                'Talisay City, Cebu',
                'Consolacion, Cebu',
            ]),
            'amenities' => array_values(fake()->randomElements([
                'Lighting',
                'Seating',
                'Restrooms',
                'Parking',
                'Water Station',
                'Equipment Rental',
            ], 3)),
            'opening_time' => $openingTime,
            'closing_time' => $closingTime,
            'operating_days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            'image' => '/img/courts/' . fake()->slug() . '.jpg',
        ];
    }

    public function indoor(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'Indoor',
        ]);
    }

    public function outdoor(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'Outdoor',
        ]);
    }

    public function available(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'available',
        ]);
    }

    public function unavailable(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'unavailable',
        ]);
    }
}
