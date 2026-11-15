import { Link, router, usePage } from '@inertiajs/react';
import { CalendarCheck, LogOut, Settings, UserRound } from 'lucide-react';

import { displayPhone } from '@/lib/phone';
import { Avatar, AvatarFallback } from '@/Components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';

interface HeaderUserMenuProps {
  user: { name: string; email: string | null; phone?: string | null } | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

/**
 * The header's user account icon — logged out, it opens `HeaderAuthModal`; logged in, it opens a
 * real dropdown (Radix, same primitive `AdminLayout`'s own user menu already uses) with the
 * account's name/email, a link to `/my-bookings`, `/my-account` for profile settings, and a real
 * `POST /logout`.
 */
export function HeaderUserMenu({ user }: HeaderUserMenuProps) {
  const { url } = usePage();

  if (!user) {
    // Logged out: a plain link to the login page (no overlay). `from` lets the server send the visitor
    // back to the page they were on after signing in.
    const from = url.startsWith('/') && !url.startsWith('//') ? url : '/';

    return (
      <Link
        href={`/login?from=${encodeURIComponent(from)}`}
        aria-label="Log in or create an account"
        className="border-border-soft text-ink hover:border-accent-500 flex size-9 items-center justify-center rounded-full border"
      >
        <UserRound className="size-4" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Your account" className="rounded-full">
          <Avatar>
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="text-ink text-sm font-medium">{user.name}</span>
          <span className="text-ink-muted text-xs">{user.email ?? displayPhone(user.phone)}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/my-bookings">
            <CalendarCheck className="size-4" aria-hidden="true" /> My Bookings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/my-account">
            <Settings className="size-4" aria-hidden="true" /> Profile Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.post('/logout')}>
          <LogOut className="size-4" aria-hidden="true" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
