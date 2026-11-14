import { Link } from '@inertiajs/react';
import { CircleHelp } from 'lucide-react';
import type * as React from 'react';

/** Small, quiet "read our FAQs" link used in a few places around the site. */
export function FaqHelpLink({
  href = '/faqs',
  children,
  className = '',
  onClick,
}: {
  href?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`text-accent-700 hover:text-accent-600 focus-visible:ring-accent-500 inline-flex items-center gap-1.5 rounded-sm text-sm underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none ${className}`}
    >
      <CircleHelp className="size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </Link>
  );
}
