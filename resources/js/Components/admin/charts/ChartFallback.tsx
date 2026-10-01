import { Skeleton } from '@/Components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Suspense fallback for the lazy chart chunks. Takes the chart's own height class (no layout shift;
 * a class rather than an inline style, which the CSP would block) and stays invisible for the first
 * 300ms (`.skeleton-delay`), so a cached or fast chunk load never flashes a skeleton.
 */
export function ChartFallback({ className }: { className: string }) {
  return (
    <div className={cn('skeleton-delay w-full', className)}>
      <Skeleton className="size-full" />
    </div>
  );
}
