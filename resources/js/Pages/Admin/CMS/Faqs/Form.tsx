import { Head, Link, useForm } from '@inertiajs/react';
import * as React from 'react';

import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import { Textarea } from '@/Components/ui/textarea';
import AdminLayout from '@/Layouts/AdminLayout';

interface FaqDetail {
  id: number;
  faq_category_id: number | null;
  question: string;
  answer: string;
  links: { label: string; href: string }[];
  sort_order: number;
  is_active: boolean;
  show_in_preview: boolean;
}

interface FaqFormProps {
  faq?: FaqDetail;
  categories: { id: number; name: string }[];
}

export default function FaqForm({ faq, categories }: FaqFormProps) {
  const isEdit = !!faq;
  const startLinks = [0, 1].map((i) => faq?.links?.[i] ?? { label: '', href: '' });
  const { data, setData, post, put, processing, errors } = useForm({
    faq_category_id: faq?.faq_category_id ? String(faq.faq_category_id) : '',
    question: faq?.question ?? '',
    answer: faq?.answer ?? '',
    links: startLinks,
    sort_order: faq ? String(faq.sort_order) : '',
    is_active: faq?.is_active ?? true,
    show_in_preview: faq?.show_in_preview ?? false,
  });

  const errorFor = (key: string) => (errors as Record<string, string | undefined>)[key];

  function setLink(index: number, field: 'label' | 'href', value: string) {
    setData(
      'links',
      data.links.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isEdit) put(`/admin/faqs/${faq.id}`);
    else post('/admin/faqs');
  }

  return (
    <>
      <Head title={isEdit ? 'Edit question' : 'New question'} />
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="font-display text-ink text-2xl font-medium">
          {isEdit ? 'Edit question' : 'New question'}
        </h1>
        <Card>
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="faq_category_id">Category</Label>
                <select
                  id="faq_category_id"
                  value={data.faq_category_id}
                  onChange={(event) => setData('faq_category_id', event.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {errorFor('faq_category_id') && (
                  <p className="text-sm text-red-600">{errorFor('faq_category_id')}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="question">Question</Label>
                <Input
                  id="question"
                  value={data.question}
                  maxLength={255}
                  onChange={(event) => setData('question', event.target.value)}
                  aria-invalid={!!errors.question}
                  required
                />
                {errors.question && <p className="text-sm text-red-600">{errors.question}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="answer">Answer</Label>
                <Textarea
                  id="answer"
                  value={data.answer}
                  maxLength={2000}
                  rows={6}
                  onChange={(event) => setData('answer', event.target.value)}
                  aria-invalid={!!errors.answer}
                  required
                />
                <p className="text-ink-muted text-xs">
                  You can use {'{phone}'}, {'{address}'} and {'{hours}'}; they are filled in
                  automatically. Plain text only.
                </p>
                {errors.answer && <p className="text-sm text-red-600">{errors.answer}</p>}
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">
                  Links under the answer (optional, up to 2)
                </legend>
                {data.links.map((link, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Input
                        aria-label={`Link ${index + 1} label`}
                        placeholder="Label, e.g. Book now"
                        value={link.label}
                        maxLength={80}
                        onChange={(event) => setLink(index, 'label', event.target.value)}
                      />
                      {errorFor(`links.${index}.label`) && (
                        <p className="text-sm text-red-600">{errorFor(`links.${index}.label`)}</p>
                      )}
                    </div>
                    <div>
                      <Input
                        aria-label={`Link ${index + 1} address`}
                        placeholder="/book or https://..."
                        value={link.href}
                        onChange={(event) => setLink(index, 'href', event.target.value)}
                      />
                      {errorFor(`links.${index}.href`) && (
                        <p className="text-sm text-red-600">{errorFor(`links.${index}.href`)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </fieldset>

              <div className="space-y-1.5">
                <Label htmlFor="sort_order">Sort order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  min={0}
                  value={data.sort_order}
                  onChange={(event) => setData('sort_order', event.target.value)}
                  className="max-w-[10rem]"
                />
                <p className="text-ink-muted text-xs">
                  Lower numbers show first. Leave empty to add at the end.
                </p>
              </div>

              <label htmlFor="is_active" className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={data.is_active}
                  onCheckedChange={(checked) => setData('is_active', checked === true)}
                />
                <span className="text-sm">Active</span>
              </label>
              <label htmlFor="show_in_preview" className="flex items-center gap-2">
                <Switch
                  id="show_in_preview"
                  checked={data.show_in_preview}
                  onCheckedChange={(checked) => setData('show_in_preview', checked === true)}
                />
                <span className="text-sm">Show in the short FAQ block on Home and Contact</span>
              </label>

              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" disabled={processing}>
                  {isEdit ? 'Save changes' : 'Add question'}
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/faqs">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

FaqForm.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
