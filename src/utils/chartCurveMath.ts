/**
 * Chart Curve & Aggregation Math for Quiet Ledger Dashboard Graph
 * Provides smooth cubic Bézier spline interpolation, area bounds,
 * and time-series aggregation for 7-day, 30-day, and monthly views.
 */

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartDataPoint {
  key: string;
  label: string;
  shortLabel: string;
  fullLabel: string;
  gavePaise: number;
  gotPaise: number;
  netPaise: number; // gotPaise - gavePaise (positive = surplus/inflow)
}

/**
 * Computes a smooth cubic Bézier curve SVG path string through an array of 2D points.
 */
export function generateSmoothSplinePath(points: ChartPoint[]): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }

  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Catmull-Rom to Cubic Bézier conversion factor (1/6 = ~0.1667)
    const tension = 0.2;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  return d;
}

/**
 * Generates an enclosed area path for gradient fills beneath a spline curve.
 */
export function generateClosedAreaPath(points: ChartPoint[], baselineY: number): string {
  if (!points || points.length === 0) return '';
  const curve = generateSmoothSplinePath(points);
  const last = points[points.length - 1];
  const first = points[0];

  return `${curve} L ${last.x.toFixed(1)},${baselineY.toFixed(1)} L ${first.x.toFixed(1)},${baselineY.toFixed(1)} Z`;
}

/**
 * Normalizes values to chart Y coordinates with padding constraints.
 */
export function calculateChartScale(
  values: number[],
  chartHeight: number,
  paddingTop: number,
  paddingBottom: number
): {
  maxVal: number;
  scaleY: (val: number) => number;
} {
  const innerHeight = Math.max(10, chartHeight - paddingTop - paddingBottom);
  const rawMax = Math.max(...values, 0);
  // Guarantee a reasonable round ceiling (at least ₹1,000 / 100,000 paise)
  const maxVal = Math.max(rawMax, 100000);

  const scaleY = (val: number): number => {
    const clamped = Math.max(0, Math.min(val, maxVal));
    const ratio = clamped / maxVal;
    return paddingTop + innerHeight * (1 - ratio);
  };

  return { maxVal, scaleY };
}

/**
 * Formats a currency amount in paise/minor units into a compact Y-axis chart tick label.
 * Guarantees that lower ticks never round up to match upper ticks (prevents "1k above 1k" bugs).
 *
 * Rules:
 * - 0 -> '0'
 * - Under 1,000 units (e.g. ₹50, ₹250, ₹500) -> exact units without 'k' (e.g. '₹500', '₹250')
 * - 1,000 to 999,999 units (e.g. ₹1,000, ₹1,500, ₹25,000) -> '₹1k', '₹1.5k', '₹25k'
 * - 1,000,000+ units -> '₹1M', '₹1.5M', etc.
 */
export function formatChartAxisTick(paise: number, symbol: string = '₹'): string {
  if (!paise || paise <= 0) return '0';
  const units = Math.round(paise) / 100;

  if (units < 1) {
    return `${symbol}${units.toFixed(2)}`;
  }
  if (units < 1000) {
    // Under 1,000 units (e.g. ₹50, ₹250, ₹500): show clean units, never '1k'
    const formatted = units % 1 === 0 ? units.toFixed(0) : units.toFixed(1).replace(/\.0$/, '');
    return `${symbol}${formatted}`;
  }
  if (units < 1000000) {
    // 1k up to 999k: show up to 1 decimal place without trailing .0 (e.g. ₹1k, ₹1.5k, ₹25k)
    const kVal = units / 1000;
    const formatted = kVal >= 100 ? Math.round(kVal).toString() : kVal.toFixed(1).replace(/\.0$/, '');
    return `${symbol}${formatted}k`;
  }
  if (units < 1000000000) {
    // 1M up to 999M
    const mVal = units / 1000000;
    const formatted = mVal >= 100 ? Math.round(mVal).toString() : mVal.toFixed(1).replace(/\.0$/, '');
    return `${symbol}${formatted}M`;
  }
  // Billions
  const bVal = units / 1000000000;
  const formatted = bVal.toFixed(1).replace(/\.0$/, '');
  return `${symbol}${formatted}B`;
}

/**
 * Aggregates transactions into an N-day chronological timeseries (e.g. 7 days or 30 days).
 */
export function aggregateLastNDays(
  allTransactions: Array<{ amountPaise: number; type: 'GAVE' | 'GOT'; date: string; isVoided?: boolean }>,
  numDays: number,
  referenceDate: Date = new Date()
): ChartDataPoint[] {
  const list: ChartDataPoint[] = [];

  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    const shortLabel = numDays <= 7 
      ? (i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' }))
      : `${d.getDate()}`;
    const label = `${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'short' })}`;
    const fullLabel = d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    let gave = 0;
    let got = 0;

    for (const t of allTransactions) {
      if (t.isVoided) continue;
      const tDate = t.date ? new Date(t.date) : null;
      if (tDate && !isNaN(tDate.getTime())) {
        const ty = tDate.getFullYear();
        const tm = String(tDate.getMonth() + 1).padStart(2, '0');
        const td = String(tDate.getDate()).padStart(2, '0');
        if (`${ty}-${tm}-${td}` === dateKey) {
          if (t.type === 'GAVE') gave += t.amountPaise;
          if (t.type === 'GOT') got += t.amountPaise;
        }
      }
    }

    list.push({
      key: dateKey,
      label,
      shortLabel,
      fullLabel,
      gavePaise: gave,
      gotPaise: got,
      netPaise: got - gave,
    });
  }

  return list;
}
