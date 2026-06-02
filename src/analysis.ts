import type {
  PortfolioData,
  StockSet,
  SetAnalysis,
  AnalyzedHolding,
} from "./types";

/**
 * Analyze a single set: compute targets (max invested amount per stock),
 * BUY/SELL/HOLD, difference, P&L. Matches original index.html logic.
 */
export function analyzeSet(
  portfolioData: PortfolioData,
  stocks: string[]
): SetAnalysis {
  const holdings: AnalyzedHolding[] = [];
  let totalInvested = 0;
  let totalCurrentValue = 0;
  let maxInvested = 0;

  for (const symbol of stocks) {
    const stockData = portfolioData[symbol];
    if (stockData) {
      holdings.push({
        name: stockData.name,
        quantity: stockData.quantity,
        invested: stockData.invested,
        currentValue: stockData.currentValue,
        avgCost: stockData.avgCost,
      } as AnalyzedHolding);
      totalInvested += stockData.invested;
      totalCurrentValue += stockData.currentValue;
      maxInvested = Math.max(maxInvested, stockData.invested);
    } else {
      holdings.push({
        name: symbol,
        quantity: 0,
        invested: 0,
        currentValue: 0,
        avgCost: 0,
      } as AnalyzedHolding);
    }
  }

  const targetPerStock = maxInvested;

  const actions: AnalyzedHolding[] = holdings.map((holding) => {
    const difference = targetPerStock - holding.invested;
    const currentPrice =
      holding.quantity > 0
        ? holding.currentValue / holding.quantity
        : holding.avgCost;
    const pnl = holding.currentValue - holding.invested;
    const pnlPercent =
      holding.invested > 0
        ? Number(((pnl / holding.invested) * 100).toFixed(2))
        : 0;

    let action: "BUY" | "SELL" | "HOLD";
    let shares: number;
    let amount: number;

    if (Math.abs(difference) < 100) {
      action = "HOLD";
      shares = 0;
      amount = 0;
    } else if (difference > 0) {
      action = "BUY";
      amount = difference;
      shares = currentPrice > 0 ? Math.ceil(difference / currentPrice) : 0;
    } else {
      action = "SELL";
      amount = Math.abs(difference);
      shares =
        currentPrice > 0 ? Math.floor(Math.abs(difference) / currentPrice) : 0;
    }

    return {
      ...holding,
      targetInvestment: targetPerStock,
      difference,
      action,
      shares,
      amount,
      currentPrice,
      pnl,
      pnlPercent,
    };
  });

  return {
    holdings: actions,
    totalInvested,
    totalCurrentValue,
    targetPerStock,
    stockCount: stocks.length,
  };
}

/**
 * Analyze multiple sets (e.g. for comparison view).
 */
export function analyzeSets(
  portfolioData: PortfolioData,
  sets: StockSet[]
): Map<string, SetAnalysis> {
  const result = new Map<string, SetAnalysis>();
  for (const set of sets) {
    result.set(set.id, analyzeSet(portfolioData, set.symbols));
  }
  return result;
}
