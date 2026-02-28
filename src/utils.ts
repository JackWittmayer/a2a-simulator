/**
 * Format a Date into a human-readable timestamp for use in batch/run IDs.
 * Example: "2026-02-26_13h45m12s"
 */
export function formatTimestamp(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d}_${h}h${mi}m${s}s`;
}
