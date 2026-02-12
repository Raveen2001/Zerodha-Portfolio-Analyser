import type { PortfolioData, StockSet, GuestStorage } from "../types";
import { supabase } from "./supabase";

const GUEST_STORAGE_KEY = "zerodhaPortfolio_guest";
const DEMO_STORAGE_KEY = "zerodha_demo";

// ---------- Guest (localStorage) ----------
// Guest: localStorage only; no DB.

export function loadGuestStorage(): GuestStorage | null {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as GuestStorage;
    if (!data.sets || !Array.isArray(data.sets)) {
      data.sets = [];
    }
    return data;
  } catch {
    return null;
  }
}

export function saveGuestStorage(storage: GuestStorage): void {
  storage.timestamp = new Date().toISOString();
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(storage));
}

export function saveGuestPortfolio(portfolio: PortfolioData): void {
  const existing = loadGuestStorage();
  const next: GuestStorage = {
    portfolio,
    portfolioUploadedAt: new Date().toISOString(),
    sets: existing?.sets ?? [],
    timestamp: new Date().toISOString(),
  };
  saveGuestStorage(next);
}

export function saveGuestSets(sets: StockSet[]): void {
  const existing = loadGuestStorage();
  const next: GuestStorage = {
    portfolio: existing?.portfolio ?? null,
    portfolioUploadedAt: existing?.portfolioUploadedAt ?? null,
    sets,
    timestamp: new Date().toISOString(),
  };
  saveGuestStorage(next);
}

// ---------- Demo (sessionStorage) ----------

export function loadDemoStorage(): GuestStorage | null {
  try {
    const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestStorage;
  } catch {
    return null;
  }
}

export function saveDemoStorage(storage: GuestStorage): void {
  sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(storage));
}

// ---------- Supabase (logged-in) ----------
// Logged-in: one row per upload by date; load latest.

export async function loadSupabasePortfolio(
  userId: string
): Promise<PortfolioData | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select("holdings")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.holdings) return null;
  return data.holdings as PortfolioData;
}

export async function loadSupabaseSets(userId: string): Promise<StockSet[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("sets")
    .select("id, name, symbols")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error || !data?.length) return [];
  return data.map((row: { id: string; name: string; symbols: string[] }) => ({
    id: row.id,
    name: row.name,
    symbols: row.symbols ?? [],
  }));
}

export async function saveSupabasePortfolio(
  userId: string,
  portfolio: PortfolioData
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("portfolio_snapshots").insert({
    user_id: userId,
    uploaded_at: new Date().toISOString(),
    holdings: portfolio,
  });
  return !error;
}

export async function saveSupabaseSets(
  userId: string,
  sets: StockSet[]
): Promise<boolean> {
  if (!supabase) return false;
  // Delete all and re-insert for simplicity (or use upsert by id)
  await supabase.from("sets").delete().eq("user_id", userId);
  if (sets.length === 0) return true;
  const rows = sets.map((s) => ({
    user_id: userId,
    id: s.id,
    name: s.name,
    symbols: s.symbols,
  }));
  const { error } = await supabase.from("sets").insert(rows);
  return !error;
}

export async function getPortfolioUploadedAt(
  userId: string
): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("portfolio_snapshots")
    .select("uploaded_at")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.uploaded_at ?? null;
}
