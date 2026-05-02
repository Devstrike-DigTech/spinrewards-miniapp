/** Format a decimal string as ₦1,234.00 */
export function formatNaira(amount: string | null | undefined): string {
  if (!amount) return '₦0.00'
  const [whole, decimal] = amount.split('.')
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `₦${withCommas}.${decimal ?? '00'}`
}

/** Format a decimal string as 1,234 (coins — no symbol, no decimals) */
export function formatCoins(amount: string | null | undefined): string {
  if (!amount) return '0'
  const [whole] = amount.split('.')
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Format an ISO date string as "April 21, 2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
