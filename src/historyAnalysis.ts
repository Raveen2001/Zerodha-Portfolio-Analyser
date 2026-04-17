import type {
  PortfolioSnapshot,
  StockSet,
  TimelinePoint,
  StockTimelinePoint,
} from "./types";

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
