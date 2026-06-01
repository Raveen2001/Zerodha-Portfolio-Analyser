import type { SetAnalysis, AnalyzedHolding } from "../types";
import styles from "./SetResults.module.css";

function formatMoney(n: number) {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface SetResultsProps {
  analysis: SetAnalysis;
}

export function SetResults({ analysis }: SetResultsProps) {
  const pnl = analysis.totalCurrentValue - analysis.totalInvested;
  const pnlPercent =
    analysis.totalInvested > 0
      ? ((pnl / analysis.totalInvested) * 100).toFixed(2)
      : "0.00";

  return (
    <div className={styles.card}>
      <div className={styles.summary}>
        <div className={styles.row}>
          <span className={styles.label}>Total invested</span>
          <span className={styles.value}>
            {formatMoney(analysis.totalInvested)}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Current value</span>
          <span className={styles.value}>
            {formatMoney(analysis.totalCurrentValue)}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>P&L</span>
          <span
            className={`${styles.value} ${
              pnl >= 0 ? styles.positive : styles.negative
            }`}
          >
            {formatMoney(pnl)} ({pnl >= 0 ? "+" : ""}
            {pnlPercent}%)
          </span>
        </div>
        <div className={`${styles.row} ${styles.total}`}>
          <span className={styles.label}>Target per stock</span>
          <span className={styles.value}>
            {formatMoney(analysis.targetPerStock)}
          </span>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Stock</th>
              <th>Qty</th>
              <th>Invested</th>
              <th>Current value</th>
              <th>P&L</th>
              <th>Target</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            {analysis.holdings.map((h) => (
              <tr key={h.name}>
                <td className={styles.stockName}>{h.name}</td>
                <td>{h.quantity}</td>
                <td>{formatMoney(h.invested)}</td>
                <td>{formatMoney(h.currentValue)}</td>
                <td className={h.pnl >= 0 ? styles.positive : styles.negative}>
                  {h.pnl >= 0 ? "+" : ""}
                  {formatMoney(h.pnl)}
                  <br />
                  <small>
                    ({h.pnlPercent >= 0 ? "+" : ""}
                    {h.pnlPercent}%)
                  </small>
                </td>
                <td>{formatMoney(h.targetInvestment)}</td>
                <td
                  className={
                    h.difference >= 0 ? styles.positive : styles.negative
                  }
                >
                  {h.difference >= 0 ? "+" : ""}
                  {formatMoney(h.difference)}
                  {h.action !== "HOLD" && (
                    <>
                      <br />
                      <small className={styles.actionHint}>
                        {h.action} {h.shares} {h.shares === 1 ? "share" : "shares"}
                      </small>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ActionBadgeProps {
  action: AnalyzedHolding["action"];
}

export function ActionBadge({ action }: ActionBadgeProps) {
  const cls =
    action === "BUY"
      ? styles.buy
      : action === "SELL"
      ? styles.sell
      : styles.hold;
  return <span className={`${styles.badge} ${cls}`}>{action}</span>;
}
