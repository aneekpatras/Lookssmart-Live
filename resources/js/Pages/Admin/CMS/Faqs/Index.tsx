import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Switch } from '@/Components/ui/switch';
import AdminLayout from '@/Layouts/AdminLayout';

interface FaqRow {
  id: number;
  question: string;
  category_id: number | null;
  category: string | null;
  sort_order: number;
  is_active: boolean;
  show_in_preview: boolean;
}

interface CategoryRow {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  faqs_count: number;
}

interface FaqsIndexProps {
  ready: boolean;
  faqs: FaqRow[];
  categories: CategoryRow[];
  canLoadDefaults: boolean;
}

const keep = { preserveScroll: true } as const;

function MoveButtons({ moveUrl, first, last }: { moveUrl: string; first: boolean; last: boolean }) {
  return (
    <span className="flex gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Move up"
        disabled={first}
        onClick={() => router.post(moveUrl, { direction: 'up' }, keep)}
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Move down"
        disabled={last}
        onClick={() => router.post(moveUrl, { direction: 'down' }, keep)}
      >
        <ArrowDown className="size-4" />
      </Button>
    </span>
  );
}

function QuestionsTab({ faqs, categories }: { faqs: FaqRow[]; categories: CategoryRow[] }) {
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('');

  const filtering = search.trim() !== '' || category !== '';
  const visible = faqs.filter(
    (faq) =>
      (!category || String(faq.category_id ?? 'none') === category) &&
      (!search.trim() || faq.question.toLowerCase().includes(search.trim().toLowerCase())),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          aria-label="Search questions"
          placeholder="Search questions"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="sm:max-w-xs"
        />
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
          <option value="none">No category</option>
        </select>
        <Button asChild className="sm:ml-auto">
          <Link href="/admin/faqs/create">
            <Plus aria-hidden="true" /> Add question
          </Link>
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="text-ink-muted py-10 text-center text-sm">No questions found.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((faq, index) => (
            <Card key={faq.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-ink font-medium">{faq.question}</p>
                  <p className="text-ink-muted mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">{faq.category ?? 'No category'}</Badge>
                    {faq.show_in_preview && <Badge variant="accent">Short block</Badge>}
                    <span>Order {faq.sort_order}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!filtering && (
                    <MoveButtons
                      moveUrl={`/admin/faqs/${faq.id}/move`}
                      first={index === 0}
                      last={index === visible.length - 1}
                    />
                  )}
                  <Switch
                    checked={faq.is_active}
                    aria-label={`${faq.is_active ? 'Hide' : 'Show'} "${faq.question}"`}
                    onCheckedChange={() => router.patch(`/admin/faqs/${faq.id}/toggle`, {}, keep)}
                  />
                  <Button asChild variant="ghost" size="icon" aria-label={`Edit "${faq.question}"`}>
                    <Link href={`/admin/faqs/${faq.id}/edit`}>
                      <Pencil className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete "${faq.question}"`}
                    onClick={() => {
                      if (confirm(`Delete this question?\n\n${faq.question}`)) {
                        router.delete(`/admin/faqs/${faq.id}`, keep);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {filtering && visible.length > 0 && (
        <p className="text-ink-muted text-xs">Clear the search and filter to reorder questions.</p>
      )}
    </div>
  );
}

function CategoryRowItem({
  category,
  first,
  last,
}: {
  category: CategoryRow;
  first: boolean;
  last: boolean;
}) {
  const [name, setName] = React.useState(category.name);
  const dirty = name.trim() !== category.name;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            aria-label={`Name of ${category.name}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {dirty && (
            <Button
              type="button"
              size="sm"
              onClick={() => router.put(`/admin/faq-categories/${category.id}`, { name }, keep)}
            >
              Save
            </Button>
          )}
          <span className="text-ink-muted shrink-0 text-xs">{category.faqs_count} questions</span>
        </div>
        <div className="flex items-center gap-2">
          <MoveButtons
            moveUrl={`/admin/faq-categories/${category.id}/move`}
            first={first}
            last={last}
          />
          <Switch
            checked={category.is_active}
            aria-label={`${category.is_active ? 'Hide' : 'Show'} ${category.name}`}
            onCheckedChange={() =>
              router.patch(`/admin/faq-categories/${category.id}/toggle`, {}, keep)
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Delete ${category.name}`}
            onClick={() => {
              if (confirm(`Delete the category "${category.name}"?`)) {
                router.delete(`/admin/faq-categories/${category.id}`, keep);
              }
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoriesTab({ categories }: { categories: CategoryRow[] }) {
  const { data, setData, post, processing, errors, reset } = useForm({ name: '' });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          post('/admin/faq-categories', { ...keep, onSuccess: () => reset() });
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="flex-1">
          <Input
            aria-label="New category name"
            placeholder="New category name"
            value={data.name}
            onChange={(event) => setData('name', event.target.value)}
            aria-invalid={!!errors.name}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>
        <Button type="submit" disabled={processing || !data.name.trim()}>
          <Plus aria-hidden="true" /> Add category
        </Button>
      </form>

      <div className="space-y-2">
        {categories.map((category, index) => (
          <CategoryRowItem
            key={category.id}
            category={category}
            first={index === 0}
            last={index === categories.length - 1}
          />
        ))}
        {categories.length === 0 && (
          <p className="text-ink-muted py-10 text-center text-sm">No categories yet.</p>
        )}
      </div>
      <p className="text-ink-muted text-xs">
        A category that still has questions can&apos;t be deleted: move or delete its questions
        first.
      </p>
    </div>
  );
}

export default function FaqsIndex({ ready, faqs, categories, canLoadDefaults }: FaqsIndexProps) {
  const [tab, setTab] = React.useState<'questions' | 'categories'>('questions');

  return (
    <>
      <Head title="FAQs" />
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-ink text-2xl font-medium">FAQs</h1>
          <p className="text-ink-muted mt-1 text-sm">
            The questions shown on the public FAQs page. Hidden questions and categories are left
            out of the page, the search-engine text and the FAQ schema.
          </p>
        </div>

        {!ready ? (
          <Card>
            <CardContent className="p-6 text-sm">
              The FAQ tables have not been created yet. Run the FAQ SQL in phpMyAdmin first. Until
              then the public FAQs page shows the built-in default questions.
            </CardContent>
          </Card>
        ) : (
          <>
            {canLoadDefaults && (
              <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm">
                    No FAQs yet. Load the default categories and questions to start editing them.
                  </p>
                  <Button
                    type="button"
                    onClick={() => router.post('/admin/faqs/load-defaults', {}, keep)}
                  >
                    Load default FAQs
                  </Button>
                </CardContent>
              </Card>
            )}

            <div role="tablist" aria-label="FAQ sections" className="flex gap-2">
              {(['questions', 'categories'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    tab === key
                      ? 'border-ink bg-ink text-ivory'
                      : 'border-border-soft text-ink-muted hover:border-accent-500'
                  }`}
                >
                  {key === 'questions' ? 'Questions' : 'Categories'}
                </button>
              ))}
            </div>

            {tab === 'questions' ? (
              <QuestionsTab faqs={faqs} categories={categories} />
            ) : (
              <CategoriesTab categories={categories} />
            )}
          </>
        )}
      </div>
    </>
  );
}

FaqsIndex.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
