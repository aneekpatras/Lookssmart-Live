<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\BaseFormRequest;

/** Create/update of one FAQ question. Plain text only; links must be a site path or an https URL. */
class FaqRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('cms.manage');
    }

    public function rules(): array
    {
        return [
            'faq_category_id' => ['nullable', 'integer', 'exists:faq_categories,id'],
            'question' => ['required', 'string', 'max:255'],
            'answer' => ['required', 'string', 'max:2000'],
            'links' => ['nullable', 'array', 'max:2'],
            'links.*.label' => ['required', 'string', 'max:80'],
            'links.*.href' => ['required', 'string', 'max:500', 'regex:#^(/(?!/)\S*|https://\S+)$#i'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'is_active' => ['boolean'],
            'show_in_preview' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return ['links.*.href.regex' => 'A link must be a page on this site (starting with /) or an https:// address.'];
    }

    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();

        $links = collect($this->input('links', []))
            ->map(fn ($link) => [
                'label' => trim(strip_tags((string) ($link['label'] ?? ''))),
                'href' => trim((string) ($link['href'] ?? '')),
            ])
            ->filter(fn ($link) => $link['label'] !== '' || $link['href'] !== '')
            ->values()
            ->all();

        $this->merge([
            'question' => trim(strip_tags((string) $this->input('question'))),
            'answer' => trim(strip_tags((string) $this->input('answer'))),
            'links' => $links,
        ]);
    }
}
