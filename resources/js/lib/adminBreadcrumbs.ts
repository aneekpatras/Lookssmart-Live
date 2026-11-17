/**
 * Central breadcrumb map for the admin panel. One entry per admin page URL (nav pages and their nested
 * create / edit / detail pages). Section names match the sidebar groups in config/adminNav.ts; a section
 * has no landing page, so it is plain text in the trail.
 *
 * `href` on an entry is the sidebar item's URL (a test checks every sidebar item appears here).
 * An entry with `current` is a nested page: its trail ends with that label and a "Back to <page>" link
 * appears. Unknown URLs fall back to "Dashboard > <title>".
 */

export interface Crumb {
  label: string;
  /** Missing = plain text (a section, or the current page). */
  href?: string;
}

export interface BreadcrumbTrail {
  crumbs: Crumb[];
  /** The page one level up (drives the "Back to ..." link); null on the dashboard. */
  parent: Crumb | null;
  /** True for nested pages (create / edit / detail), which get the visible "Back to" link. */
  nested: boolean;
}

interface Entry {
  /** Matches the URL path (no query or hash). */
  match: RegExp;
  section: string;
  page: string;
  /** The page's own listing URL (the sidebar href). */
  href: string;
  /** Present on nested pages: the label of the last crumb. */
  current?: string;
}

const ID = '[^/]+';

/** Most specific patterns first within each page. */
export const ADMIN_BREADCRUMB_MAP: Entry[] = [
  // Bookings
  {
    match: new RegExp(`^/admin/bookings/${ID}$`),
    section: 'Bookings',
    page: 'Bookings',
    href: '/admin/bookings',
    current: 'Booking details',
  },
  { match: /^\/admin\/bookings$/, section: 'Bookings', page: 'Bookings', href: '/admin/bookings' },
  {
    match: /^\/admin\/funnel$/,
    section: 'Bookings',
    page: 'Visitor funnel',
    href: '/admin/funnel',
  },
  {
    match: /^\/admin\/follow-ups\/journey$/,
    section: 'Bookings',
    page: 'Follow-ups',
    href: '/admin/follow-ups',
    current: 'Visitor journey',
  },
  {
    match: /^\/admin\/follow-ups$/,
    section: 'Bookings',
    page: 'Follow-ups',
    href: '/admin/follow-ups',
  },
  {
    match: /^\/admin\/availability$/,
    section: 'Bookings',
    page: 'Availability',
    href: '/admin/availability',
  },

  // Sales
  { match: /^\/admin\/pos$/, section: 'Sales', page: 'POS', href: '/admin/pos' },
  {
    match: /^\/admin\/pos\/terminal$/,
    section: 'Sales',
    page: 'New Sale',
    href: '/admin/pos/terminal',
  },
  {
    match: /^\/admin\/pos\/held-sales$/,
    section: 'Sales',
    page: 'Held Sales',
    href: '/admin/pos/held-sales',
  },
  {
    match: /^\/admin\/pos\/sales-history$/,
    section: 'Sales',
    page: 'Sales History',
    href: '/admin/pos/sales-history',
  },
  {
    match: new RegExp(`^/admin/pos/sales/${ID}/(receipt|invoice-pdf)$`),
    section: 'Sales',
    page: 'Sales History',
    href: '/admin/pos/sales-history',
    current: 'Receipt',
  },
  {
    match: new RegExp(`^/admin/pos/sales/${ID}$`),
    section: 'Sales',
    page: 'Sales History',
    href: '/admin/pos/sales-history',
    current: 'Sale details',
  },
  {
    match: new RegExp(`^/admin/pos/register/${ID}/z-report$`),
    section: 'Sales',
    page: 'POS',
    href: '/admin/pos',
    current: 'Z-report',
  },
  { match: /^\/admin\/reports$/, section: 'Sales', page: 'Reports', href: '/admin/reports' },

  // Catalog
  {
    match: /^\/admin\/service-categories$/,
    section: 'Catalog',
    page: 'Categories',
    href: '/admin/service-categories',
  },
  {
    match: /^\/admin\/services\/create$/,
    section: 'Catalog',
    page: 'Services',
    href: '/admin/services',
    current: 'New service',
  },
  {
    match: new RegExp(`^/admin/services/${ID}/edit$`),
    section: 'Catalog',
    page: 'Services',
    href: '/admin/services',
    current: 'Edit service',
  },
  { match: /^\/admin\/services$/, section: 'Catalog', page: 'Services', href: '/admin/services' },
  {
    match: /^\/admin\/deals\/create$/,
    section: 'Catalog',
    page: 'Deals',
    href: '/admin/deals',
    current: 'New deal',
  },
  {
    match: new RegExp(`^/admin/deals/${ID}/edit$`),
    section: 'Catalog',
    page: 'Deals',
    href: '/admin/deals',
    current: 'Edit deal',
  },
  { match: /^\/admin\/deals$/, section: 'Catalog', page: 'Deals', href: '/admin/deals' },
  { match: /^\/admin\/pricing$/, section: 'Catalog', page: 'Pricing', href: '/admin/pricing' },
  {
    match: new RegExp(`^/admin/services-import/${ID}$`),
    section: 'Catalog',
    page: 'Import Services',
    href: '/admin/services-import',
    current: 'Import details',
  },
  {
    match: /^\/admin\/services-import$/,
    section: 'Catalog',
    page: 'Import Services',
    href: '/admin/services-import',
  },

  // CRM
  {
    match: new RegExp(`^/admin/leads/${ID}$`),
    section: 'CRM',
    page: 'Leads',
    href: '/admin/leads',
    current: 'Lead details',
  },
  { match: /^\/admin\/leads$/, section: 'CRM', page: 'Leads', href: '/admin/leads' },
  {
    match: new RegExp(`^/admin/messages/${ID}$`),
    section: 'CRM',
    page: 'Messages',
    href: '/admin/messages',
    current: 'Message',
  },
  { match: /^\/admin\/messages$/, section: 'CRM', page: 'Messages', href: '/admin/messages' },
  { match: /^\/admin\/reviews$/, section: 'CRM', page: 'Reviews', href: '/admin/reviews' },
  {
    match: new RegExp(`^/admin/customers/${ID}$`),
    section: 'CRM',
    page: 'Customers',
    href: '/admin/customers',
    current: 'Customer profile',
  },
  { match: /^\/admin\/customers$/, section: 'CRM', page: 'Customers', href: '/admin/customers' },

  // Content
  {
    match: /^\/admin\/blog\/create$/,
    section: 'Content',
    page: 'Blog',
    href: '/admin/blog',
    current: 'New post',
  },
  {
    match: new RegExp(`^/admin/blog/${ID}/edit$`),
    section: 'Content',
    page: 'Blog',
    href: '/admin/blog',
    current: 'Edit post',
  },
  { match: /^\/admin\/blog$/, section: 'Content', page: 'Blog', href: '/admin/blog' },
  {
    match: /^\/admin\/faqs\/create$/,
    section: 'Content',
    page: 'FAQs',
    href: '/admin/faqs',
    current: 'New FAQ',
  },
  {
    match: new RegExp(`^/admin/faqs/${ID}/edit$`),
    section: 'Content',
    page: 'FAQs',
    href: '/admin/faqs',
    current: 'Edit FAQ',
  },
  { match: /^\/admin\/faqs$/, section: 'Content', page: 'FAQs', href: '/admin/faqs' },
  {
    match: /^\/admin\/gallery\/create$/,
    section: 'Content',
    page: 'Gallery',
    href: '/admin/gallery',
    current: 'New gallery',
  },
  {
    match: new RegExp(`^/admin/gallery/${ID}/edit$`),
    section: 'Content',
    page: 'Gallery',
    href: '/admin/gallery',
    current: 'Edit gallery',
  },
  { match: /^\/admin\/gallery$/, section: 'Content', page: 'Gallery', href: '/admin/gallery' },
  {
    match: /^\/admin\/showcase$/,
    section: 'Content',
    page: 'Home showcase',
    href: '/admin/showcase',
  },
  {
    match: /^\/admin\/slider\/create$/,
    section: 'Content',
    page: 'Hero Slider',
    href: '/admin/slider',
    current: 'New slide',
  },
  {
    match: new RegExp(`^/admin/slider/${ID}/edit$`),
    section: 'Content',
    page: 'Hero Slider',
    href: '/admin/slider',
    current: 'Edit slide',
  },
  { match: /^\/admin\/slider$/, section: 'Content', page: 'Hero Slider', href: '/admin/slider' },
  { match: /^\/admin\/media$/, section: 'Content', page: 'Media Library', href: '/admin/media' },

  // System
  { match: /^\/admin\/reminders$/, section: 'System', page: 'Reminders', href: '/admin/reminders' },
  { match: /^\/admin\/users$/, section: 'System', page: 'Users & Roles', href: '/admin/users' },
  { match: /^\/admin\/settings$/, section: 'System', page: 'Settings', href: '/admin/settings' },
  {
    match: /^\/admin\/security-log$/,
    section: 'System',
    page: 'Security log',
    href: '/admin/security-log',
  },
  { match: /^\/admin\/audit-log$/, section: 'System', page: 'Audit Log', href: '/admin/audit-log' },
  {
    match: /^\/admin\/notification-logs$/,
    section: 'System',
    page: 'Notification Logs',
    href: '/admin/notification-logs',
  },
];

/** Sidebar URLs served by another entry's page (the Gift Offers tab sits on the Deals page). */
export const SHARED_PAGE_HREFS: Record<string, string> = { '/admin/deals#offers': '/admin/deals' };

const DASHBOARD: Crumb = { label: 'Dashboard', href: '/admin' };

function titleFromPath(path: string): string {
  const last = path.split('/').filter(Boolean).pop() ?? 'Page';

  return last.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/**
 * The trail for an admin URL. `override` (set by a page through useAdminBreadcrumb) replaces the label of
 * a nested page's last crumb, or appends a final crumb to a page that is not nested on its own (the active
 * Settings tab).
 */
export function breadcrumbsFor(
  url: string,
  override?: string | null,
  fallbackTitle?: string,
): BreadcrumbTrail {
  const path = (url.split('#')[0] ?? '').split('?')[0]?.replace(/\/+$/, '') || '/admin';

  if (path === '/admin') {
    return { crumbs: [{ label: 'Dashboard' }], parent: null, nested: false };
  }

  const entry = ADMIN_BREADCRUMB_MAP.find((candidate) => candidate.match.test(path));

  if (!entry) {
    return {
      crumbs: [DASHBOARD, { label: fallbackTitle || titleFromPath(path) }],
      parent: DASHBOARD,
      nested: false,
    };
  }

  const section: Crumb = { label: entry.section };
  const page: Crumb = { label: entry.page, href: entry.href };

  if (entry.current) {
    return {
      crumbs: [DASHBOARD, section, page, { label: override || entry.current }],
      parent: page,
      nested: true,
    };
  }

  if (override) {
    return { crumbs: [DASHBOARD, section, page, { label: override }], parent: page, nested: true };
  }

  return {
    crumbs: [DASHBOARD, section, { label: entry.page }],
    parent: DASHBOARD,
    nested: false,
  };
}
