import { format, parseISO } from 'date-fns';

export function formatCurrency(amount: string | number, currency: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${amount} ${currency}`;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(num);
}

export function formatRate(rate: string | number): string {
  const num = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (isNaN(num)) return String(rate);
  return num.toLocaleString('en-US', { maximumSignificantDigits: 6 });
}

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy HH:mm:ss');
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function truncateId(id: string, chars = 8): string {
  return id.slice(0, chars) + '…';
}
