/**
 * Utilities for formatting timestamps in Indian Standard Time (IST, UTC+5:30)
 * with standard 12-hour AM/PM notation.
 */

/**
 * Formats a timestamp into full IST date and 12-hour time:
 * Example: "17 Aug 2026, 05:30:15 PM"
 */
export function formatISTDateTime(
  dateInput: string | Date | null | undefined,
  includeSeconds = true
): string {
  if (!dateInput) return 'N/A'
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    if (isNaN(d.getTime())) return 'N/A'

    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true,
    })
  } catch {
    return 'N/A'
  }
}

/**
 * Formats a timestamp into IST 12-hour time only:
 * Example: "05:30:15 PM" or "05:30 PM"
 */
export function formatISTTime(
  dateInput: string | Date | null | undefined,
  includeSeconds = true
): string {
  if (!dateInput) return 'N/A'
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    if (isNaN(d.getTime())) return 'N/A'

    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true,
    })
  } catch {
    return 'N/A'
  }
}

/**
 * Formats a timestamp into IST date only:
 * Example: "17 Aug 2026"
 */
export function formatISTDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'N/A'
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    if (isNaN(d.getTime())) return 'N/A'

    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return 'N/A'
  }
}
