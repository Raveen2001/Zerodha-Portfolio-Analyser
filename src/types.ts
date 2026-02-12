/** Single holding from Zerodha CSV (parsed) */
export interface Holding {
  name: string;
  quantity: number;
  invested: number;
  currentValue: number;
  avgCost: number;
}

/** Portfolio data keyed by instrument (uppercase) */
export type PortfolioData = Record<string, Holding>;

/** User-defined set: name + list of stock symbols */
export interface StockSet {
  id: string;
  name: string;
  symbols: string[];
}

/** Analyzed holding with BUY/SELL/HOLD and targets */
export interface AnalyzedHolding extends Holding {
  targetInvestment: number;
  difference: number;
  action: "BUY" | "SELL" | "HOLD";
  shares: number;
  amount: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

/** Result of analyzing one set */
export interface SetAnalysis {
  holdings: AnalyzedHolding[];
  totalInvested: number;
  totalCurrentValue: number;
  targetPerStock: number;
  stockCount: number;
}

/** Stored portfolio snapshot (for Supabase or localStorage) */
export interface PortfolioSnapshot {
  uploadedAt: string;
  holdings: PortfolioData;
}

/** Guest/local storage shape */
export interface GuestStorage {
  portfolio: PortfolioData | null;
  portfolioUploadedAt: string | null;
  sets: StockSet[];
  timestamp: string;
}
