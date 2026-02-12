import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { StockSet } from "../types";
import styles from "./SetForm.module.css";

interface SetFormProps {
  open: boolean;
  set: StockSet | null;
  portfolioSymbols: string[];
  /** Pre-fill symbols when creating a new set (e.g. from uncategorized bulk). */
  initialSymbols?: string[];
  /** Uncategorized symbols (not in any set) – shown so user can add from here when editing. */
  uncategorizedSymbols?: string[];
  onClose: () => void;
  onSave: (name: string, symbols: string[]) => void;
}

export function SetForm({
  open,
  set,
  portfolioSymbols,
  initialSymbols,
  uncategorizedSymbols = [],
  onClose,
  onSave,
}: SetFormProps) {
  const [name, setName] = useState("");
  const [symbolInput, setSymbolInput] = useState("");
  const [symbols, setSymbols] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName(set?.name ?? "");
      setSymbols(set ? set.symbols : initialSymbols ?? []);
      setSymbolInput("");
    }
  }, [open, set, initialSymbols]);

  const addSymbol = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (s && !symbols.includes(s)) {
      setSymbols((prev) => [...prev, s]);
      setSymbolInput("");
    }
  };

  const removeSymbol = (s: string) => {
    setSymbols((prev) => prev.filter((x) => x !== s));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    onSave(n, symbols);
    onClose();
  };

  const suggestions = portfolioSymbols
    .filter(
      (s) =>
        s.toUpperCase().includes(symbolInput.trim().toUpperCase()) &&
        !symbols.includes(s)
    )
    .slice(0, 8);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className={styles.overlay} onClick={onClose} role="presentation">
        <motion.div
          className={styles.modal}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.15 }}
        >
          <h2 className={styles.title}>{set ? "Edit set" : "New set"}</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formBody}>
              <label className={styles.label}>
                Set name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Set A"
                  className={styles.input}
                  required
                />
              </label>
              <label className={styles.label}>
                Stocks (add one by one or pick from portfolio)
                <div className={styles.symbolRow}>
                  <input
                    type="text"
                    value={symbolInput}
                    onChange={(e) => setSymbolInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSymbol(symbolInput);
                      }
                    }}
                    placeholder="Type symbol and Enter"
                    className={styles.input}
                    list="symbol-suggestions"
                  />
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => addSymbol(symbolInput)}
                  >
                    Add
                  </button>
                </div>
                {suggestions.length > 0 && symbolInput.trim() && (
                  <div className={styles.suggestions}>
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={styles.suggestion}
                        onClick={() => addSymbol(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </label>
              <div className={styles.chips}>
                {symbols.map((s) => (
                  <span key={s} className={styles.chip}>
                    {s}
                    <button
                      type="button"
                      className={styles.chipRemove}
                      onClick={() => removeSymbol(s)}
                      aria-label={`Remove ${s}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {uncategorizedSymbols.length > 0 && (
                <div className={styles.uncategorizedBlock}>
                  <span className={styles.uncategorizedLabel}>
                    Uncategorized stocks (click to add)
                  </span>
                  <div className={styles.uncategorizedChips}>
                    {uncategorizedSymbols
                      .filter((s) => !symbols.includes(s))
                      .map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={styles.uncategorizedChip}
                          onClick={() => addSymbol(s)}
                        >
                          {s}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={styles.submit}>
                {set ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
