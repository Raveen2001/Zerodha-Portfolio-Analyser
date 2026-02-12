import { useState } from "react";
import { useApp } from "../context/AppContext";
import { analyzeSet } from "../analysis";
import { SetResults } from "./SetResults";
import { SetForm } from "./SetForm";
import { UncategorizedSection } from "./UncategorizedSection";
import type { StockSet } from "../types";
import styles from "./SetList.module.css";

function useUncategorizedSymbols(
  portfolio: Record<string, unknown> | null,
  sets: StockSet[]
): string[] {
  if (!portfolio || Object.keys(portfolio).length === 0) return [];
  const inAnySet = new Set(sets.flatMap((s) => s.symbols));
  return Object.keys(portfolio).filter((sym) => !inAnySet.has(sym));
}

export function SetList() {
  const { portfolio, sets, addSet, updateSet, removeSet } = useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<StockSet | null>(null);
  const [formInitialSymbols, setFormInitialSymbols] = useState<
    string[] | undefined
  >(undefined);

  const uncategorizedSymbols = useUncategorizedSymbols(portfolio, sets);

  const openNewSetForm = (initialSymbols?: string[]) => {
    setFormInitialSymbols(initialSymbols);
    setEditingSet(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingSet(null);
    setFormInitialSymbols(undefined);
  };

  const handleAddToSet = (symbol: string, setId: string | "new") => {
    if (setId === "new") {
      openNewSetForm([symbol]);
      return;
    }
    const set = sets.find((s) => s.id === setId);
    if (!set) return;
    if (set.symbols.includes(symbol)) return;
    updateSet(setId, { symbols: [...set.symbols, symbol] });
  };

  const handleBulkAddToSet = (symbols: string[], setId: string) => {
    const set = sets.find((s) => s.id === setId);
    if (!set) return;
    const existing = new Set(set.symbols);
    const toAdd = symbols.filter((s) => !existing.has(s));
    if (toAdd.length === 0) return;
    updateSet(setId, { symbols: [...set.symbols, ...toAdd] });
  };

  const handleCreateSetFromSelected = (symbols: string[]) => {
    openNewSetForm(symbols);
  };

  if (!portfolio || Object.keys(portfolio).length === 0) {
    return (
      <section className={styles.section}>
        <p className={styles.empty}>
          Upload a Zerodha holdings CSV to see set analysis.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <SetForm
        open={formOpen}
        set={editingSet}
        portfolioSymbols={Object.keys(portfolio)}
        initialSymbols={formInitialSymbols}
        uncategorizedSymbols={uncategorizedSymbols}
        onClose={closeForm}
        onSave={async (name, symbols) => {
          if (editingSet) {
            await updateSet(editingSet.id, { name, symbols });
          } else {
            await addSet(name, symbols);
          }
          closeForm();
        }}
      />

      <div className={styles.toolbar}>
        <h2 className={styles.title}>Your sets</h2>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => openNewSetForm()}
        >
          New set
        </button>
      </div>
      {sets.length === 0 ? (
        <p className={styles.empty}>
          No sets yet. Create one from uncategorized stocks below or add stocks
          manually.
        </p>
      ) : (
        <div className={styles.list}>
          {sets.map((set) => (
            <div key={set.id} className={styles.setCard}>
              <div className={styles.setHeader}>
                <div className={styles.setMeta}>
                  <h3 className={styles.setName}>{set.name}</h3>
                  <span className={styles.symbolCount}>
                    {set.symbols.length} stocks
                  </span>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.btnText}
                    onClick={() => {
                      setEditingSet(set);
                      setFormInitialSymbols(undefined);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.btnText}
                    onClick={() => removeSet(set.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <SetResults analysis={analyzeSet(portfolio, set.symbols)} />
            </div>
          ))}
        </div>
      )}

      <UncategorizedSection
        portfolio={portfolio}
        sets={sets}
        onAddToSet={handleAddToSet}
        onBulkAddToSet={handleBulkAddToSet}
        onCreateSetFromSelected={handleCreateSetFromSelected}
      />
    </section>
  );
}
