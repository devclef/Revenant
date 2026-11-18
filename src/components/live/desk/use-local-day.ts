import { useEffect, useState } from "react";

import { browserTimeZone } from "@/components/ui/letter-date";

import { formatSheetDate, localCalendarDay } from "./sheet-date";

/**
 * The sealing day the Write step uses on /demo/live (spec 14, W4.2, W12.2): the
 * visitor's local calendar day, and the sheet date text for it.
 *
 * Before the first effect runs (on the server and on the first client render)
 * `day` is the UTC day and `sheetDate` is "", so the server HTML holds an empty
 * date slot and hydration sees the same markup (W4.3).
 */
export interface LocalDay {
  day: string;
  sheetDate: string;
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The visitor's local day after mount, the UTC day before it. */
export function useLocalDay(): LocalDay {
  const [value, setValue] = useState<LocalDay>(() => ({
    day: utcDay(new Date()),
    sheetDate: "",
  }));

  useEffect(() => {
    const now = new Date();
    const zone = browserTimeZone();
    setValue({
      day: localCalendarDay(now, zone),
      sheetDate: formatSheetDate(now, zone),
    });
  }, []);

  return value;
}
