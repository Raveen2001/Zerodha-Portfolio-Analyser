import type {
  PortfolioSnapshot,
  StockSet,
  TimelinePoint,
  StockTimelinePoint,
} from "./types";
import type { IndexClose } from "./lib/indexData";

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Compute portfolio-level timeline: total invested, total value, P&L across all snapshots.
 */
export function computePortfolioTimeline(
  snapshots: PortfolioSnapshot[]
): TimelinePoint[] {
  return snapshots.map((snap) => {
    let totalInvested = 0;
    let totalValue = 0;
    for (const holding of Object.values(snap.holdings)) {
      totalInvested += holding.invested;
      totalValue += holding.currentValue;
    }
    const pnl = totalValue - totalInvested;
    const pnlPercent =
      totalInvested > 0
        ? Number(((pnl / totalInvested) * 100).toFixed(2))
        : 0;
    return {
      date: formatDate(snap.uploadedAt),
      totalInvested: Number(totalInvested.toFixed(2)),
      totalValue: Number(totalValue.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      pnlPercent,
    };
  });
}

/**
 * Compute per-set timelines using the current set definitions applied to all snapshots.
 * Returns a map of setId → TimelinePoint[].
 */
export function computeSetTimelines(
  snapshots: PortfolioSnapshot[],
  sets: StockSet[]
): Map<string, TimelinePoint[]> {
  const result = new Map<string, TimelinePoint[]>();
  for (const set of sets) {
    const points: TimelinePoint[] = snapshots.map((snap) => {
      let totalInvested = 0;
      let totalValue = 0;
      for (const symbol of set.symbols) {
        const holding = snap.holdings[symbol];
        if (holding) {
          totalInvested += holding.invested;
          totalValue += holding.currentValue;
        }
      }
      const pnl = totalValue - totalInvested;
      const pnlPercent =
        totalInvested > 0
          ? Number(((pnl / totalInvested) * 100).toFixed(2))
          : 0;
      return {
        date: formatDate(snap.uploadedAt),
        totalInvested: Number(totalInvested.toFixed(2)),
        totalValue: Number(totalValue.toFixed(2)),
        pnl: Number(pnl.toFixed(2)),
        pnlPercent,
      };
    });
    result.set(set.id, points);
  }
  return result;
}

/**
 * Compute timeline for a single stock symbol across all snapshots.
 */
export function computeStockTimeline(
  snapshots: PortfolioSnapshot[],
  symbol: string
): StockTimelinePoint[] {
  return snapshots.map((snap) => {
    const holding = snap.holdings[symbol];
    if (!holding) {
      return {
        date: formatDate(snap.uploadedAt),
        invested: 0,
        value: 0,
        pnl: 0,
        pnlPercent: 0,
        quantity: 0,
      };
    }
    const pnl = holding.currentValue - holding.invested;
    const pnlPercent =
      holding.invested > 0
        ? Number(((pnl / holding.invested) * 100).toFixed(2))
        : 0;
    return {
      date: formatDate(snap.uploadedAt),
      invested: Number(holding.invested.toFixed(2)),
      value: Number(holding.currentValue.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      pnlPercent,
      quantity: holding.quantity,
    };
  });
}

/**
 * Compute per-stock timelines for every symbol in a given set across all snapshots.
 * Returns a map of symbol → StockTimelinePoint[].
 */
export function computeSetStockTimelines(
  snapshots: PortfolioSnapshot[],
  set: StockSet
): Map<string, StockTimelinePoint[]> {
  const result = new Map<string, StockTimelinePoint[]>();
  for (const symbol of set.symbols) {
    result.set(symbol, computeStockTimeline(snapshots, symbol));
  }
  return result;
}

/**
 * Returns a sorted list of unique stock symbols found across all snapshots.
 */
export function getAllStockSymbols(snapshots: PortfolioSnapshot[]): string[] {
  const symbolSet = new Set<string>();
  for (const snap of snapshots) {
    for (const symbol of Object.keys(snap.holdings)) {
      symbolSet.add(symbol);
    }
  }
  return Array.from(symbolSet).sort();
}

/**
 * Money-weighted index benchmark: simulates investing the SAME cash flows
 * (changes in invested/cost-basis) that the real portfolio (or set / stock)
 * experienced, but into the index instead.
 *
 * For each snapshot we:
 *   1. Pick the index close on the nearest trading day <= the snapshot date.
 *   2. Treat the change in `investedSeries` since the previous snapshot as the
 *      cash flow on that date and buy/sell that many index units at that price.
 *   3. Value the accumulated units and express it as P&L % on the same invested
 *      base used by the real series: (unitsValue / invested - 1) * 100.
 *
 * The result is directly comparable to the entity's own `pnlPercent` line.
 * Returns one value per snapshot (aligned 1:1), or null if no price data.
 *
 * @param investedSeries invested (cost basis) per snapshot for the entity being
 *   compared (portfolio total, set total, or single-stock invested).
 */
export function computeIndexSeries(
  snapshots: PortfolioSnapshot[],
  closes: IndexClose[],
  investedSeries: number[]
): (number | null)[] | null {
  if (closes.length === 0 || snapshots.length === 0) return null;

  // Build sorted array for binary search
  const sortedCloses = [...closes].sort((a, b) => a.date.localeCompare(b.date));

  function floorClose(isoDate: string): number | null {
    // isoDate is like "2024-01-15" (YYYY-MM-DD); snapshot uploadedAt is full ISO
    const day = isoDate.slice(0, 10);
    let lo = 0;
    let hi = sortedCloses.length - 1;
    let best: number | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (sortedCloses[mid].date <= day) {
        best = sortedCloses[mid].close;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  }

  const prices = snapshots.map((snap) => floorClose(snap.uploadedAt));
  if (!prices.some((p) => p != null && p > 0)) return null;

  let units = 0;
  let prevInvested: number | null = null; // null until the first valid price
  const out: (number | null)[] = [];

  for (let i = 0; i < snapshots.length; i++) {
    const price = prices[i];
    const invested = investedSeries[i] ?? 0;

    if (price == null || price <= 0) {
      // No tradeable price yet/here: carry state forward, leave a gap.
      out.push(null);
      continue;
    }

    if (prevInvested == null) {
      // First investable point: buy the starting cost basis worth of index.
      units = invested / price;
    } else {
      const delta = invested - prevInvested;
      units += delta / price;
    }
    prevInvested = invested;

    const indexValue = units * price;
    const pnlPct = invested > 0 ? (indexValue / invested - 1) * 100 : 0;
    out.push(Number(pnlPct.toFixed(2)));
  }

  return out;
}

/**
 * Merges index series into existing timeline rows, adding `idx_<id>` numeric
 * keys so Recharts <Line dataKey="idx_nifty50"> can overlay directly.
 *
 * Mutates a shallow copy of each row — the original timeline array is NOT
 * modified.
 */
export function mergeIndexSeries<T extends { date: string }>(
  timeline: T[],
  seriesById: Map<string, (number | null)[]>
): (T & Record<string, number | null | string>)[] {
  return timeline.map((pt, i) => {
    const extra: Record<string, number | null> = {};
    for (const [id, series] of seriesById) {
      extra[`idx_${id}`] = series[i] ?? null;
    }
    return { ...pt, ...extra };
  });
}
