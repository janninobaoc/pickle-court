<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class CourtRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'type' => 'required|string|max:255',
            'description' => 'nullable|string',
            'hourly_rate' => [
                'required',
                'numeric',
                'min:0',
                'max:100000',
                'decimal:0,2',
            ],
            'status' => 'required|string|in:available,unavailable',
            'location' => ['nullable', 'string', 'max:255'],
            'amenities' => ['nullable', 'array', 'list', 'max:20'],
            'amenities.*' => ['string', 'max:100'],
            'opening_time' => ['nullable', 'date_format:H:i'],
            'closing_time' => ['nullable', 'date_format:H:i'],
            'operating_days' => ['nullable', 'array', 'list', 'max:7'],
            'operating_days.*' => [
                'string',
                'in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
                'distinct',
            ],
            'image' => ['nullable', 'string', 'max:255'],
        ];
    }
}
