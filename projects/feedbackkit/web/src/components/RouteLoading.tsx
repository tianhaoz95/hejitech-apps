/** What a page shows for the moment its code is loading (usually too short to notice). */
export function RouteLoading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center">
      <span className="sr-only">Loading…</span>
      <span aria-hidden className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" />
    </div>
  );
}
