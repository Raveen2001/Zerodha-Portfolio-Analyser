import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { analyzeSet } from "../analysis";
import type { PortfolioData, StockSet } from "../types";
import styles from "./SummaryInsights.module.css";

function formatMoney(n: number) {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

interface SetSummary {
  id: string;
  name: string;
  stockCount: number;
  invested: number;
  value: number;
  pnl: number;
  pnlPercent: string;
}

function useSummary(portfolio: PortfolioData | null, sets: StockSet[]) {
  return useMemo(() => {
    if (!portfolio || Object.keys(portfolio).length === 0) {
      return { setCards: [], uncategorized: null, portfolio: null };
    }
    const allSymbols = Object.keys(portfolio);
    const inAnySet = new Set(sets.flatMap((s) => s.symbols));
    const uncatSymbols = allSymbols.filter((s) => !inAnySet.has(s));

    const setCards: SetSummary[] = sets.map((set) => {
      const analysis = analyzeSet(portfolio, set.symbols);
      const pnl = analysis.totalCurrentValue - analysis.totalInvested;
      const invested = analysis.totalInvested;
      const pnlPercent =
        invested > 0 ? ((pnl / invested) * 100).toFixed(1) : "0";
      return {
        id: set.id,
        name: set.name,
        stockCount: set.symbols.length,
        invested,
        value: analysis.totalCurrentValue,
        pnl,
        pnlPercent,
      };
    });

    let uncatInvested = 0;
    let uncatValue = 0;
    for (const sym of uncatSymbols) {
      const h = portfolio[sym];
      if (h) {
        uncatInvested += h.invested;
        uncatValue += h.currentValue;
      }
    }
    const uncatPnl = uncatValue - uncatInvested;
    const uncatPnlPercent =
      uncatInvested > 0 ? ((uncatPnl / uncatInvested) * 100).toFixed(1) : "0";

    let totalInvested = 0;
    let totalValue = 0;
    for (const sym of allSymbols) {
      const h = portfolio[sym];
      if (h) {
        totalInvested += h.invested;
        totalValue += h.currentValue;
      }
    }
    const totalPnl = totalValue - totalInvested;
    const portPnlPercent =
      totalInvested > 0 ? ((totalPnl / totalInvested) * 100).toFixed(1) : "0";

    return {
      setCards,
      uncategorized:
        uncatSymbols.length > 0
          ? {
              count: uncatSymbols.length,
              invested: uncatInvested,
              value: uncatValue,
              pnl: uncatPnl,
              pnlPercent: uncatPnlPercent,
            }
          : null,
      portfolio: {
        count: allSymbols.length,
        invested: totalInvested,
        value: totalValue,
        pnl: totalPnl,
        pnlPercent: portPnlPercent,
      },
    };
  }, [portfolio, sets]);
}

export function SummaryInsights() {
  const { portfolio, sets } = useApp();
  const summary = useSummary(portfolio, sets);

  if (!portfolio || Object.keys(portfolio).length === 0) return null;

  const { setCards, uncategorized: uncatSummary, portfolio: portSummary } = summary;

  if (!portSummary) return null;

  return (
    <section className={styles.section} aria-label="Summary insights">
      <div className={styles.grid}>
        <div className={styles.card}>
          <span className={styles.label}>Portfolio</span>
          <span className={styles.value}>{portSummary.count} stocks</span>
          <span className={styles.sub}>
            {formatMoney(portSummary.invested)} → {formatMoney(portSummary.value)}
          </span>
          <span
            className={
              portSummary.pnl >= 0 ? styles.positive : styles.negative
            }
          >
            {portSummary.pnl >= 0 ? "+" : ""}
            {formatMoney(portSummary.pnl)} ({portSummary.pnlPercent}%)
          </span>
        </div>
        {setCards.map((s) => (
          <div key={s.id} className={styles.card}>
            <span className={styles.label}>{s.name}</span>
            <span className={styles.value}>{s.stockCount} stocks</span>
            <span className={styles.sub}>
              {formatMoney(s.invested)} → {formatMoney(s.value)}
            </span>
            <span
              className={s.pnl >= 0 ? styles.positive : styles.negative}
            >
              {s.pnl >= 0 ? "+" : ""}
              {formatMoney(s.pnl)} ({s.pnlPercent}%)
            </span>
          </div>
        ))}
        {uncatSummary && (
          <div className={styles.card}>
            <span className={styles.label}>Uncategorized</span>
            <span className={styles.value}>{uncatSummary.count} stocks</span>
            <span className={styles.sub}>
              {formatMoney(uncatSummary.invested)} → {formatMoney(uncatSummary.value)}
            </span>
            <span
              className={
                uncatSummary.pnl >= 0 ? styles.positive : styles.negative
              }
            >
              {uncatSummary.pnl >= 0 ? "+" : ""}
              {formatMoney(uncatSummary.pnl)} ({uncatSummary.pnlPercent}%)
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
