import { useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { parseHoldingsFile } from "../lib/csv";
import styles from "./UploadArea.module.css";

export function UploadArea() {
  const { setPortfolio, mode } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File | null) => {
    setError(null);
    setFileName(null);
    if (!file) return;
    setFileName(file.name);
    parseHoldingsFile(file)
      .then((portfolio) => {
        setPortfolio(portfolio);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to parse CSV");
      });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Upload holdings</h2>
      <div className={styles.instructions}>
        <p className={styles.instructionText}>
          Get your holdings CSV from{" "}
          <a
            href="https://kite.zerodha.com/holdings/all"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.instructionLink}
          >
            Kite → Holdings
          </a>
          : open Holdings, then click <strong>Download</strong>.
        </p>
        <img
          src="/zerodha-holdings-download.png"
          alt="Zerodha Kite: go to Holdings tab, then click Download button"
          className={styles.instructionImage}
        />
      </div>
      <div
        className={`${styles.dropZone} ${dragOver ? styles.dragOver : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="Upload Zerodha holdings CSV"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className={styles.input}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          aria-hidden
        />
        <span className={styles.icon}>Upload</span>
        <p className={styles.label}>
          Drop your Zerodha holdings CSV or click to choose
        </p>
        <p className={styles.hint}>
          Columns: Instrument, Qty., Invested, Cur. val, Avg. cost
        </p>
      </div>
      {fileName && <p className={styles.fileName}>Loaded: {fileName}</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {mode === "demo" && (
        <p className={styles.demoHint}>
          Demo mode: you can still upload a CSV to replace the sample data.
        </p>
      )}
    </section>
  );
}
