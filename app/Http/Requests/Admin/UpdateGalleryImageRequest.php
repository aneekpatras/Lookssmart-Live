<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\BaseFormRequest;

class UpdateGalleryImageRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('image'));
    }

    public function rules(): array
    {
        return [
            'caption' => ['nullable', 'string', 'max:255'],
            'specialty' => ['nullable', 'string', 'max:160'],
            // Optional link to a service or a deal; both null clears it.
            'linked_type' => ['nullable', 'in:service,deal'],
            'linked_id' => [
                'nullable', 'integer', 'required_with:linked_type',
                function (string $attribute, mixed $value, \Closure $fail) {
                    $type = $this->input('linked_type');
                    if ($value === null || $type === null) {
                        return;
                    }
                    $exists = $type === 'service'
                        ? \App\Models\Service::query()->whereKey($value)->exists()
                        : \App\Models\Deal::query()->whereKey($value)->exists();
                    if (! $exists) {
                        $fail('The linked item does not exist.');
                    }
                },
            ],
            'is_before_after' => ['boolean'],
            // Whether this image appears in the homepage bridal slider. Absent keys are not in
            // validated() and so are never written, which is what lets the caption, before/after
            // and homepage toggles each PUT only their own field without clobbering the others.
            'show_on_homepage' => ['boolean'],
            'pair_image' => ['nullable', 'image', 'mimes:jpeg,png,webp,gif', 'max:5120'],
        ];
    }
}
