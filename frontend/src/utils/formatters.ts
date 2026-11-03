/**
 * Enterprise Formatters for Molty Foam ERP
 * Formatted as Rs. currency matching user's design reference
 */

export function formatPKR(amount: number, compact: boolean = false): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Rs. 0';
  }

  if (compact) {
    if (Math.abs(amount) >= 1000000) {
      return `Rs. ${(amount / 1000000).toFixed(2).replace(/\.00$/, '')}M`;
    }
    if (Math.abs(amount) >= 1000) {
      return `Rs. ${(amount / 1000).toFixed(0)}k`;
    }
  }

  return `Rs. ${amount.toLocaleString('en-PK', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })}`;
}

export function formatPKDate(
  dateString: string | Date,
  options?: {
    includeTime?: boolean;
    short?: boolean;
  }
): string {
  try {
    const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(d.getTime())) return '-';

    const opts: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Karachi',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    };

    if (options?.includeTime) {
      opts.hour = '2-digit';
      opts.minute = '2-digit';
      opts.hour12 = true;
    }

    return new Intl.DateTimeFormat('en-PK', opts).format(d);
  } catch {
    return String(dateString);
  }
}

export function formatPercent(value: number): string {
  if (isNaN(value)) return '0%';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}
