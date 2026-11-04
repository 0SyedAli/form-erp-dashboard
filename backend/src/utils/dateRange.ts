/**
 * Asia/Karachi (UTC+5) Timezone Date Range Utility for Financial & ERP Reporting
 */

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom'
  | 'all';

export interface DateRangeResult {
  start?: Date;
  end?: Date;
  preset: DateRangePreset;
  label: string;
}

const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5

/**
 * Converts a UTC Date to Karachi local calendar parts (year, month, date)
 */
function getKarachiParts(now = new Date()): { year: number; month: number; date: number; day: number } {
  const localMs = now.getTime() + KARACHI_OFFSET_MS;
  const localDate = new Date(localMs);
  return {
    year: localDate.getUTCFullYear(),
    month: localDate.getUTCMonth(),
    date: localDate.getUTCDate(),
    day: localDate.getUTCDay(),
  };
}

/**
 * Creates a UTC Date corresponding to Karachi midnight (00:00:00) on given year, month, date
 */
function karachiMidnightToUTC(year: number, month: number, date: number): Date {
  return new Date(Date.UTC(year, month, date, 0, 0, 0, 0) - KARACHI_OFFSET_MS);
}

/**
 * Calculates start (inclusive) and end (exclusive) UTC Date objects for reporting presets in Asia/Karachi.
 */
export function resolveDateRange(
  preset: DateRangePreset = 'thisMonth',
  customStart?: string,
  customEnd?: string,
  referenceNow = new Date()
): DateRangeResult {
  if (preset === 'all') {
    return {
      preset: 'all',
      label: 'All Time',
    };
  }

  if (preset === 'custom' && customStart && customEnd) {
    // Parse custom dates (assumed in YYYY-MM-DD format or ISO)
    const startDateParts = customStart.split('-').map(Number);
    const endDateParts = customEnd.split('-').map(Number);

    const start = karachiMidnightToUTC(startDateParts[0], startDateParts[1] - 1, startDateParts[2]);
    // End date is inclusive of that entire day in Karachi -> exclusive end is next day midnight
    const end = karachiMidnightToUTC(endDateParts[0], endDateParts[1] - 1, endDateParts[2] + 1);

    return {
      start,
      end,
      preset: 'custom',
      label: `${customStart} to ${customEnd}`,
    };
  }

  const { year, month, date } = getKarachiParts(referenceNow);

  switch (preset) {
    case 'today': {
      const start = karachiMidnightToUTC(year, month, date);
      const end = karachiMidnightToUTC(year, month, date + 1);
      return { start, end, preset, label: 'Today' };
    }

    case 'yesterday': {
      const start = karachiMidnightToUTC(year, month, date - 1);
      const end = karachiMidnightToUTC(year, month, date);
      return { start, end, preset, label: 'Yesterday' };
    }

    case 'last7days': {
      const start = karachiMidnightToUTC(year, month, date - 6);
      const end = karachiMidnightToUTC(year, month, date + 1);
      return { start, end, preset, label: 'Last 7 Days' };
    }

    case 'thisMonth': {
      const start = karachiMidnightToUTC(year, month, 1);
      const end = karachiMidnightToUTC(year, month + 1, 1);
      return { start, end, preset, label: 'This Month' };
    }

    case 'lastMonth': {
      const start = karachiMidnightToUTC(year, month - 1, 1);
      const end = karachiMidnightToUTC(year, month, 1);
      return { start, end, preset, label: 'Last Month' };
    }

    default: {
      const start = karachiMidnightToUTC(year, month, 1);
      const end = karachiMidnightToUTC(year, month + 1, 1);
      return { start, end, preset: 'thisMonth', label: 'This Month' };
    }
  }
}

