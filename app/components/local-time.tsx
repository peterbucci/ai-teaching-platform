"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_TIME_ZONE,
  formatLocalDate,
  resolveTimeZone,
} from "../../lib/date-time.ts";

function subscribeToTimeZone() {
  return () => {};
}

function browserTimeZone() {
  try {
    return resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function serverTimeZone() {
  return DEFAULT_TIME_ZONE;
}

export function useUserTimeZone() {
  // Use Eastern for server rendering and hydration, then the browser's zone.
  return useSyncExternalStore(
    subscribeToTimeZone,
    browserTimeZone,
    serverTimeZone,
  );
}

export function LocalTime({
  value,
  includeTime = false,
  prefix = "",
}: {
  value: string;
  includeTime?: boolean;
  prefix?: string;
}) {
  const timeZone = useUserTimeZone();
  return (
    <time
      dateTime={value}
      title={`${prefix}${formatLocalDate(value, timeZone, true)}`}
    >
      {prefix}
      {formatLocalDate(value, timeZone, includeTime)}
    </time>
  );
}
