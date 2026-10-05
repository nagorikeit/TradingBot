export function formatPrice(price: number, decimals: number = 5): string {
  if (price === undefined || price === null || isNaN(price)) return '0.00000';
  return price.toFixed(decimals);
}

export function formatTime(timestamp: number): string {
  if (!timestamp) return '--:--:--';
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return '--/--/----';
  const d = new Date(timestamp);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatPercent(val: number): string {
  if (val === undefined || val === null || isNaN(val)) return '0.0%';
  return `${val.toFixed(1)}%`;
}

export function getPriceChangePip(entry: number, current: number, decimals: number): { diff: number; isPositive: boolean; pipText: string } {
  const diff = current - entry;
  const isPositive = diff >= 0;
  const multiplier = Math.pow(10, decimals === 5 ? 4 : decimals === 3 ? 2 : 2);
  const pips = (diff * multiplier).toFixed(1);
  return {
    diff,
    isPositive,
    pipText: `${isPositive ? '+' : ''}${pips} pips`,
  };
}
