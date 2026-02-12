import Papa from "papaparse";
import type { PortfolioData, Holding } from "../types";

export function parseCSV(data: unknown[]): PortfolioData {
  const portfolio: PortfolioData = {};
  for (const row of data as Record<string, unknown>[]) {
    const instrument = row.Instrument
      ? String(row.Instrument).trim().toUpperCase()
      : "";
    const invested = parseFloat(String(row.Invested ?? 0)) || 0;
    const qty = parseFloat(String(row["Qty."] ?? row.Qty ?? 0)) || 0;
    const curVal =
      parseFloat(String(row["Cur. val"] ?? row["Cur. val"] ?? 0)) || 0;
    const avgCost = parseFloat(String(row["Avg. cost"] ?? 0)) || 0;
    if (instrument && invested > 0) {
      portfolio[instrument] = {
        name: String(row.Instrument ?? instrument),
        quantity: qty,
        invested,
        currentValue: curVal,
        avgCost,
      } as Holding;
    }
  }
  return portfolio;
}

export function parseHoldingsFile(file: File): Promise<PortfolioData> {
  return new Promise((resolve, reject) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      reject(new Error("Please select a CSV file."));
      return;
    }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        if (results.errors.length) {
          reject(new Error(results.errors[0].message ?? "Failed to parse CSV"));
          return;
        }
        const portfolio = parseCSV(results.data);
        if (Object.keys(portfolio).length === 0) {
          reject(
            new Error(
              "No valid holdings found in CSV. Check column names: Instrument, Invested, Qty., Cur. val, Avg. cost"
            )
          );
          return;
        }
        resolve(portfolio);
      },
      error: (err) => {
        reject(new Error(err.message ?? "Failed to parse CSV"));
      },
    });
  });
}
