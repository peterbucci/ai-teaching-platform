export const DEFAULT_TIME_ZONE = "America/New_York";

/** Use Eastern time until the browser supplies a supported IANA time zone. */
export function resolveTimeZone(timeZone?: string | null) {
  const zone = timeZone?.trim();
  if (!zone || /^[+-]/.test(zone)) return DEFAULT_TIME_ZONE;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
    }).resolvedOptions().timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function formatLocalDate(
  value: string,
  timeZone = DEFAULT_TIME_ZONE,
  includeTime = false,
) {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: resolveTimeZone(timeZone),
  };
  if (includeTime) {
    options.hour = "numeric";
    options.minute = "2-digit";
    options.timeZoneName = "short";
  }
  return new Intl.DateTimeFormat("en-US", options).format(new Date(value));
}
