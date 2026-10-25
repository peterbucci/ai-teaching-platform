/** Stable in server HTML and the first browser render, regardless of host locale/TZ. */
export function interventionTimestamp(value: string): string {
  const iso = new Date(value).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
}
