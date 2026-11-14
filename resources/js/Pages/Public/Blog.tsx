import { Link, router } from '@inertiajs/react';
import { ArrowRight, Calendar, Clock3, MessageCircle, Search } from 'lucide-react';
import * as React from 'react';

import { SeoHead } from '@/Components/SeoHead';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import PublicLayout from '@/Layouts/PublicLayout';
import { scrollToSection, useScrollSpy } from '@/lib/useScrollSpy';
import { useHeaderHandoff } from '@/lib/useHeaderHandoff';

interface PostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_path: string | null;
  published_at: string;
  author: { id: number | null; name: string };
  category: { id: number; name: string; slug: string } | null;
  readingTimeMinutes: number;
}

interface TrendingPost {
  id: number;
  title: string;
  slug: string;
}

interface QuickServiceLink {
  name: string;
  href: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Pagination {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
  path: string;
}

interface BlogPageProps {
  featuredPost: PostSummary | null;
  posts: PostSummary[];
  pagination: Pagination;
  categories: Category[];
  filters: { search: string | null; category: number | null };
  trendingPosts: TrendingPost[];
  quickServiceLinks: QuickServiceLink[];
  whatsapp: { display_phone: string; chat_url: string };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function PostImage({ post }: { post: PostSummary }) {
  return post.cover_image_path ? (
    <img
      src={post.cover_image_path}
      alt={post.title}
      loading="lazy"
      decoding="async"
      className="size-full object-cover"
    />
  ) : (
    <div className="bg-accent-50 size-full" aria-hidden="true" />
  );
}

function PostCard({ post }: { post: PostSummary }) {
  return (
    <Card className="border-border-soft bg-surface shadow-soft flex flex-col overflow-hidden">
      <div className="bg-accent-50 h-[190px] shrink-0">
        <PostImage post={post} />
      </div>
      <CardContent className="flex flex-1 flex-col p-5">
        {post.category && (
          <span className="text-accent-700 text-xs font-semibold tracking-wider uppercase">
            {post.category.name}
          </span>
        )}
        <h3 className="font-display text-ink mt-2 text-lg leading-snug font-medium">
          <Link href={`/blog/${post.slug}`} className="hover:text-accent-700">
            {post.title}
          </Link>
        </h3>
        {post.excerpt && (
          <p className="text-ink-muted mt-2 line-clamp-3 text-sm leading-6">{post.excerpt}</p>
        )}
        <div className="text-ink-muted mt-auto flex items-center justify-between pt-4 text-xs">
          <span>{formatDate(post.published_at)}</span>
          <Link
            href={`/blog/${post.slug}`}
            className="text-accent-700 hover:text-accent-600 inline-flex items-center gap-1 font-semibold"
          >
            Read more <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Blog({
  featuredPost,
  posts,
  pagination,
  categories,
  filters,
  trendingPosts,
  quickServiceLinks,
  whatsapp,
}: BlogPageProps) {
  const [search, setSearch] = React.useState(filters.search ?? '');
  const [tagsRef, tagsStyle] = useHeaderHandoff();
  const searching = !!filters.search;

  // One section per category, in tag order; a post sits in its primary category only. Empty ones
  // (and their tags) are dropped. Posts without a category land in a trailing "More articles".
  const sections = React.useMemo(() => {
    const list = categories
      .map((category) => ({
        id: `blog-category-${category.id}`,
        categoryId: category.id as number | null,
        name: category.name,
        posts: posts.filter((post) => post.category?.id === category.id),
      }))
      .filter((section) => section.posts.length > 0);
    const uncategorized = posts.filter(
      (post) => !post.category || !categories.some((category) => category.id === post.category!.id),
    );
    if (uncategorized.length > 0) {
      list.push({
        id: 'blog-category-other',
        categoryId: null,
        name: 'More articles',
        posts: uncategorized,
      });
    }
    return list;
  }, [categories, posts]);

  const sectionIds = React.useMemo(() => sections.map((section) => section.id), [sections]);
  const spyId = useScrollSpy(searching ? [] : sectionIds, 150);
  const [pastTop, setPastTop] = React.useState(false);

  // "All" is the highlighted tag until the first section has been reached.
  React.useEffect(() => {
    if (searching || sectionIds.length === 0) return;
    function onScroll() {
      const first = document.getElementById(sectionIds[0]!);
      setPastTop(!!first && first.getBoundingClientRect().top <= 170);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [searching, sectionIds]);

  const activeId = searching ? null : pastTop ? spyId : null;

  // ?category=<id>: scroll to that section on load.
  React.useEffect(() => {
    if (searching || !filters.category) return;
    const id = `blog-category-${filters.category}`;
    const timer = window.setTimeout(() => scrollToSection(id), 150);
    return () => window.clearTimeout(timer);
  }, [filters.category, searching]);

  function apply(next: { search?: string; category?: number | null }) {
    router.get(
      '/blog',
      {
        search: (next.search ?? search) || undefined,
        category: next.category ?? undefined,
      },
      { preserveState: true, replace: true, preserveScroll: true },
    );
  }

  function goToPage(page: number) {
    router.get(
      pagination.path,
      { page, search: filters.search || undefined, category: filters.category || undefined },
      { preserveState: true, preserveScroll: false },
    );
  }

  return (
    <>
      <SeoHead
        title="Beauty, Skin & Confidence"
        description="Expert advice from Lahore's leading beauty salon and skin clinic."
      />

      {/* Hero */}
      <section className="bg-ivory border-border-soft border-b px-6 py-14 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-accent-700 text-xs font-semibold tracking-[0.22em] uppercase">
            The journal
          </p>
          <h1 className="font-display text-ink mt-4 text-4xl font-medium sm:text-5xl">
            Beauty, Skin &amp; Confidence
          </h1>
          <p className="text-ink-muted mt-4 max-w-xl">
            Expert advice from Lahore&rsquo;s leading beauty salon and skin clinic.
          </p>
        </div>
      </section>

      <section className="px-6 py-12 lg:px-10">
        <div className="mx-auto max-w-6xl">
          {/* Featured hero post — split card, left image / right summary */}
          {featuredPost && (
            <Card className="border-border-soft bg-surface shadow-soft mb-12 overflow-hidden">
              <div className="grid gap-0 md:grid-cols-2">
                <div className="bg-accent-50 aspect-[4/3] md:aspect-auto">
                  <PostImage post={featuredPost} />
                </div>
                <CardContent className="flex flex-col justify-center p-6 sm:p-10">
                  {featuredPost.category && (
                    <span className="bg-accent-50 text-accent-700 inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase">
                      {featuredPost.category.name}
                    </span>
                  )}
                  <h2 className="font-display text-ink mt-4 text-2xl leading-snug font-medium sm:text-3xl">
                    <Link href={`/blog/${featuredPost.slug}`} className="hover:text-accent-700">
                      {featuredPost.title}
                    </Link>
                  </h2>
                  {featuredPost.excerpt && (
                    <p className="text-ink-muted mt-3 leading-7">{featuredPost.excerpt}</p>
                  )}
                  <div className="text-ink-muted mt-4 flex items-center gap-4 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="size-3.5" aria-hidden="true" />
                      {formatDate(featuredPost.published_at)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      {featuredPost.readingTimeMinutes} min read
                    </span>
                  </div>
                  <Link
                    href={`/blog/${featuredPost.slug}`}
                    className="text-accent-700 hover:text-accent-600 mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-semibold"
                  >
                    Read story <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </CardContent>
              </div>
            </Card>
          )}

          {/* Category filter tabs + search */}
          <div
            ref={tagsRef}
            className="sticky z-30 transition-[top] duration-300"
            style={tagsStyle}
          >
            <div className="border-border-soft bg-ivory -mx-1 flex min-w-0 flex-col gap-3 border-b px-1 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
              <div
                className="no-scrollbar -mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
                role="group"
                aria-label="Filter articles by category"
              >
                <button
                  type="button"
                  aria-pressed={!searching && activeId === null}
                  onClick={() => {
                    if (searching) apply({ search: '', category: null });
                    else window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm whitespace-nowrap ${
                    !searching && activeId === null
                      ? 'border-ink bg-ink text-ivory'
                      : 'border-border-soft text-ink-muted hover:border-accent-500'
                  }`}
                >
                  All
                </button>
                {categories
                  .filter(
                    (category) =>
                      searching || sections.some((section) => section.categoryId === category.id),
                  )
                  .map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      data-pill-id={`blog-category-${category.id}`}
                      aria-pressed={activeId === `blog-category-${category.id}`}
                      onClick={() => {
                        if (searching) apply({ search: '', category: category.id });
                        else scrollToSection(`blog-category-${category.id}`);
                      }}
                      className={`shrink-0 rounded-full border px-4 py-2 text-sm whitespace-nowrap ${
                        activeId === `blog-category-${category.id}`
                          ? 'border-ink bg-ink text-ivory'
                          : 'border-border-soft text-ink-muted hover:border-accent-500'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
              </div>

              <div className="relative w-full max-w-xs shrink-0">
                <Search className="text-ink-muted absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  aria-label="Search articles"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    if (event.target.value === '' && filters.search)
                      apply({ search: '', category: null });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') apply({ search });
                  }}
                  placeholder="Search articles"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Main grid + sidebar */}
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="grid gap-5 sm:grid-cols-2">
                {searching ? (
                  <>
                    <div className="grid gap-5 sm:grid-cols-2">
                      {posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="space-y-12">
                    {sections.map((section) => (
                      <div key={section.id} id={section.id} className="scroll-mt-40">
                        <h2 className="font-display text-ink text-xl font-medium sm:text-2xl">
                          {section.name}
                        </h2>
                        <div className="mt-4 grid gap-5 sm:grid-cols-2">
                          {section.posts.map((post) => (
                            <PostCard key={post.id} post={post} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {posts.length === 0 && (
                <p className="text-ink-muted py-16 text-center">No articles match that search.</p>
              )}

              {pagination.last_page > 1 && (
                <nav
                  className="mt-10 flex items-center justify-center gap-2"
                  aria-label="Blog pagination"
                >
                  {Array.from({ length: pagination.last_page }, (_, index) => index + 1).map(
                    (page) => (
                      <button
                        key={page}
                        type="button"
                        aria-current={page === pagination.current_page ? 'page' : undefined}
                        onClick={() => goToPage(page)}
                        className={`size-9 rounded-full border text-sm ${
                          page === pagination.current_page
                            ? 'border-ink bg-ink text-ivory'
                            : 'border-border-soft text-ink-muted hover:border-accent-500'
                        }`}
                      >
                        {page}
                      </button>
                    ),
                  )}
                </nav>
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
              {trendingPosts.length > 0 && (
                <Card className="border-border-soft bg-surface">
                  <CardContent className="p-5">
                    <h2 className="font-display text-ink text-sm font-semibold tracking-wider uppercase">
                      Trending this week
                    </h2>
                    <ol className="mt-4 space-y-3">
                      {trendingPosts.map((post, index) => (
                        <li key={post.id} className="flex gap-3">
                          <span className="text-accent-300 font-display text-lg font-medium">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <Link
                            href={`/blog/${post.slug}`}
                            className="text-ink hover:text-accent-700 text-sm leading-5"
                          >
                            {post.title}
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}

              <Card className="border-accent-300 bg-accent-50">
                <CardContent className="p-5">
                  <h2 className="font-display text-ink text-lg font-medium">Book a treatment</h2>
                  <p className="text-ink-muted mt-2 text-sm leading-6">
                    Ready to experience it for yourself? Reserve your appointment in seconds.
                  </p>
                  <Button asChild variant="accent" className="mt-4 w-full">
                    <Link href="/book">Book Now</Link>
                  </Button>
                </CardContent>
              </Card>

              {quickServiceLinks.length > 0 && (
                <Card className="border-border-soft bg-surface">
                  <CardContent className="p-5">
                    <h2 className="font-display text-ink text-sm font-semibold tracking-wider uppercase">
                      Our services
                    </h2>
                    <ul className="mt-4 space-y-2.5">
                      {quickServiceLinks.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className="text-ink-muted hover:text-accent-700 inline-flex items-center gap-1.5 text-sm"
                          >
                            <ArrowRight className="size-3.5" aria-hidden="true" /> {link.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <a
                href={whatsapp.chat_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1DA851]"
              >
                <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp Us
              </a>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}

Blog.layout = (page: React.ReactNode) => <PublicLayout solidHeader>{page}</PublicLayout>;
