import { supabase } from "./supabase";

export interface IndexEntry {
  id: string;
  label: string;
  yahooSymbol: string;
  color: string;
}

export interface IndexClose {
  date: string; // YYYY-MM-DD
  close: number;
}

export const INDEX_REGISTRY: IndexEntry[] = [
  { id: "nifty50",    label: "Nifty 50",      yahooSymbol: "^NSEI",     color: "#ff9f0a" },
  { id: "sensex",     label: "Sensex",         yahooSymbol: "^BSESN",    color: "#af52de" },
  { id: "niftybank",  label: "Nifty Bank",     yahooSymbol: "^NSEBANK",  color: "#ff375f" },
  { id: "niftyit",    label: "Nifty IT",       yahooSymbol: "^CNXIT",    color: "#5ac8fa" },
  { id: "niftynext50",label: "Nifty Next 50",  yahooSymbol: "^NSMIDCP",  color: "#30d158" },
];

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CacheEntry {
  quotes: IndexClose[];
  fetchedAt: number;
}

function cacheKey(yahooSymbol: string, from: string, to: string): string {
  return `idx_cache|${yahooSymbol}|${from}|${to}`;
}

function readCache(key: string): IndexClose[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.quotes;
  } catch {
    return null;
  }
}

function writeCache(key: string, quotes: IndexClose[]): void {
  try {
    const entry: CacheEntry = { quotes, fetchedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage quota; silently ignore
  }
}

/**
 * Fetch daily closes for a Yahoo Finance symbol between two ISO date strings.
 * Results are cached in localStorage for 6 hours.
 * Requires Supabase to be initialised (login-gated page).
 */
export async function fetchIndexCloses(
  yahooSymbol: string,
  fromISO: string,
  toISO: string
): Promise<IndexClose[]> {
  if (!supabase) throw new Error("Supabase not initialised");

  // Align to YYYY-MM-DD for cache key stability
  const fromDate = fromISO.slice(0, 10);
  // Extend toDate by 5 days to cover weekends/holidays at the end
  const toDateExtended = new Date(new Date(toISO).getTime() + 5 * 86400_000)
    .toISOString()
    .slice(0, 10);

  const key = cacheKey(yahooSymbol, fromDate, toDateExtended);
  const cached = readCache(key);
  if (cached) return cached;

  const period1 = Math.floor(new Date(fromDate).getTime() / 1000);
  const period2 = Math.floor(new Date(toDateExtended + "T23:59:59Z").getTime() / 1000);

  const { data, error } = await supabase.functions.invoke<{
    symbol: string;
    quotes: IndexClose[];
  }>("index-prices", {
    body: { symbol: yahooSymbol, period1, period2 },
  });

  if (error) throw new Error(`index-prices function error: ${error.message}`);
  if (!data?.quotes) throw new Error("No quotes in response");

  const quotes = data.quotes.filter((q) => q.date >= fromDate && q.date <= toISO.slice(0, 10));
  writeCache(key, quotes);
  return quotes;
}
