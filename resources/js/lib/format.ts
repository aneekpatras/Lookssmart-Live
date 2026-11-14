/** "3 hours" reads better than "180 min" — shared by the service cards and the gallery lightbox. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** "Valid till 30 Nov" (year added only when it is not this year), in the salon's own time zone. */
export function validTill(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) return null;
  const sameYear = end.getFullYear() === new Date().getFullYear();
  const text = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'Asia/Karachi',
  }).format(end);
  return `Valid till ${text}`;
}

/** The deal card's timing line: "Valid till …", else "N services included", else null. */
export function dealTiming(endsAt: string | null, includedCount: number): string | null {
  return (
    validTill(endsAt) ??
    (includedCount > 0 ? `${includedCount} ${includedCount === 1 ? 'service' : 'services'} included` : null)
  );
}
