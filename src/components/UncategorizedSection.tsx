import { useState, useMemo } from "react";
import type { PortfolioData, StockSet, Holding } from "../types";
import styles from "./UncategorizedSection.module.css";

function formatMoney(n: number) {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface UncategorizedSectionProps {
  portfolio: PortfolioData;
  sets: StockSet[];
  onAddToSet: (symbol: string, setId: string | "new") => void;
  onBulkAddToSet: (symbols: string[], setId: string) => void;
  onCreateSetFromSelected: (symbols: string[]) => void;
}

export function UncategorizedSection({
  portfolio,
  sets,
  onAddToSet,
  onBulkAddToSet,
  onCreateSetFromSelected,
}: UncategorizedSectionProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSetId, setBulkSetId] = useState<string>("");

  const uncategorizedSymbols = useMemo(() => {
    const inAnySet = new Set(sets.flatMap((s) => s.symbols));
    return Object.keys(portfolio).filter((sym) => !inAnySet.has(sym));
  }, [portfolio, sets]);

  const uncategorizedHoldings = useMemo(
    () =>
      uncategorizedSymbols
        .map((sym) => ({ sym, holding: portfolio[sym] }))
        .filter((x) => x.holding) as { sym: string; holding: Holding }[],
    [uncategorizedSymbols, portfolio]
  );

  const toggleSelect = (symbol: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === uncategorizedSymbols.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(uncategorizedSymbols));
    }
  };

  const handleBulkAddToSet = () => {
    if (!bulkSetId || selected.size === 0) return;
    onBulkAddToSet(Array.from(selected), bulkSetId);
    setSelected(new Set());
    setBulkSetId("");
  };

  const handleCreateSetFromSelected = () => {
    if (selected.size === 0) return;
    onCreateSetFromSelected(Array.from(selected));
    setSelected(new Set());
  };

  if (uncategorizedSymbols.length === 0) return null;

  const totalInvested = uncategorizedHoldings.reduce(
    (s, { holding: h }) => s + h.invested,
    0
  );
  const totalValue = uncategorizedHoldings.reduce(
    (s, { holding: h }) => s + h.currentValue,
    0
  );
  const pnl = totalValue - totalInvested;
  const pnlPercent =
    totalInvested > 0 ? ((pnl / totalInvested) * 100).toFixed(2) : "0.00";

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>Uncategorized</h3>
      <p className={styles.hint}>
        Stocks not in any set. Assign to a set or create a new set from
        selection.
      </p>
      <div className={styles.summary}>
        <div className={styles.row}>
          <span className={styles.label}>Stocks</span>
          <span className={styles.value}>{uncategorizedSymbols.length}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Total invested</span>
          <span className={styles.value}>{formatMoney(totalInvested)}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Current value</span>
          <span className={styles.value}>{formatMoney(totalValue)}</span>
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
      </div>

      {selected.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkLabel}>{selected.size} selected</span>
          {sets.length > 0 && (
            <>
              <select
                value={bulkSetId}
                onChange={(e) => setBulkSetId(e.target.value)}
                className={styles.select}
                aria-label="Select set to add to"
              >
                <option value="">Add to set…</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.bulkBtn}
                onClick={handleBulkAddToSet}
                disabled={!bulkSetId}
              >
                Add to set
              </button>
            </>
          )}
          <button
            type="button"
            className={styles.bulkBtnPrimary}
            onClick={handleCreateSetFromSelected}
          >
            Create set from selected
          </button>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thCheck}>
                <input
                  type="checkbox"
                  checked={
                    uncategorizedSymbols.length > 0 &&
                    selected.size === uncategorizedSymbols.length
                  }
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                  className={styles.checkbox}
                />
              </th>
              <th>Stock</th>
              <th>Qty</th>
              <th>Invested</th>
              <th>Current value</th>
              <th>P&L</th>
              <th className={styles.thAction}>Add to set</th>
            </tr>
          </thead>
          <tbody>
            {uncategorizedHoldings.map(({ sym, holding: h }) => {
              const pnlRow = h.currentValue - h.invested;
              const pnlPct =
                h.invested > 0
                  ? ((pnlRow / h.invested) * 100).toFixed(2)
                  : "0.00";
              return (
                <tr key={sym}>
                  <td className={styles.tdCheck}>
                    <input
                      type="checkbox"
                      checked={selected.has(sym)}
                      onChange={() => toggleSelect(sym)}
                      aria-label={`Select ${h.name}`}
                      className={styles.checkbox}
                    />
                  </td>
                  <td className={styles.stockName}>{h.name}</td>
                  <td>{h.quantity}</td>
                  <td>{formatMoney(h.invested)}</td>
                  <td>{formatMoney(h.currentValue)}</td>
                  <td
                    className={pnlRow >= 0 ? styles.positive : styles.negative}
                  >
                    {pnlRow >= 0 ? "+" : ""}
                    {formatMoney(pnlRow)} ({pnlRow >= 0 ? "+" : ""}
                    {pnlPct}%)
                  </td>
                  <td className={styles.tdAction}>
                    <select
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        e.target.value = "";
                        if (!v) return;
                        onAddToSet(sym, v as string | "new");
                      }}
                      className={styles.addSelect}
                      aria-label={`Add ${h.name} to set`}
                    >
                      <option value="">Add to set…</option>
                      {sets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                      <option value="new">New set…</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
