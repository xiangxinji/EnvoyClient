/** Format a numeric badge count — caps at 99+ */
export function formatBadge(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}
