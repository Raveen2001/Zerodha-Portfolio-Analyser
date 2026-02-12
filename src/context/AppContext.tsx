import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PortfolioData, StockSet, GuestStorage } from "../types";
import {
  loadGuestStorage,
  saveGuestStorage,
  saveGuestPortfolio,
  saveGuestSets,
  loadSupabasePortfolio,
  loadSupabaseSets,
  saveSupabasePortfolio,
  saveSupabaseSets,
  getPortfolioUploadedAt,
  loadDemoStorage,
  saveDemoStorage,
} from "../lib/storage";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

type Mode = "guest" | "demo" | "logged_in";

interface AppState {
  mode: Mode;
  user: User | null;
  portfolio: PortfolioData | null;
  portfolioUploadedAt: string | null;
  sets: StockSet[];
  loading: boolean;
  error: string | null;
}

interface AppContextValue extends AppState {
  setMode: (mode: "guest" | "demo") => void;
  setPortfolio: (portfolio: PortfolioData | null) => Promise<void>;
  setSets: (sets: StockSet[]) => Promise<void>;
  addSet: (name: string, symbols: string[]) => Promise<void>;
  updateSet: (
    id: string,
    updates: { name?: string; symbols?: string[] }
  ) => Promise<void>;
  removeSet: (id: string) => Promise<void>;
  loadDemo: () => void;
  clearData: () => void;
  mergeGuestIntoAccount: () => Promise<void>;
  clearError: () => void;
}

const defaultState: AppState = {
  mode: "guest",
  user: null,
  portfolio: null,
  portfolioUploadedAt: null,
  sets: [],
  loading: true,
  error: null,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);

  const loadGuest = useCallback(() => {
    const stored = loadGuestStorage();
    setState((s) => ({
      ...s,
      mode: "guest",
      user: null,
      portfolio: stored?.portfolio ?? null,
      portfolioUploadedAt: stored?.portfolioUploadedAt ?? null,
      sets: stored?.sets ?? [],
      loading: false,
    }));
  }, []);

  const loadDemo = useCallback(() => {
    let stored = loadDemoStorage();
    if (!stored) {
      stored = {
        portfolio: getDemoPortfolio(),
        portfolioUploadedAt: new Date().toISOString(),
        sets: getDemoSets(),
        timestamp: new Date().toISOString(),
      };
      saveDemoStorage(stored);
    }
    setState((s) => ({
      ...s,
      mode: "demo",
      user: null,
      portfolio: stored!.portfolio,
      portfolioUploadedAt: stored!.portfolioUploadedAt,
      sets: stored!.sets,
      loading: false,
    }));
  }, []);

  const loadLoggedIn = useCallback(async (user: User) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [portfolio, sets, uploadedAt] = await Promise.all([
        loadSupabasePortfolio(user.id),
        loadSupabaseSets(user.id),
        getPortfolioUploadedAt(user.id),
      ]);
      setState((s) => ({
        ...s,
        mode: "logged_in",
        user,
        portfolio: portfolio ?? null,
        portfolioUploadedAt: uploadedAt ?? null,
        sets,
        loading: false,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load data",
      }));
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      loadGuest();
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadLoggedIn(session.user);
      } else {
        loadGuest();
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadLoggedIn(session.user);
      } else {
        loadGuest();
      }
    });
    return () => subscription.unsubscribe();
  }, [loadGuest, loadLoggedIn]);

  const setMode = useCallback(
    (mode: "guest" | "demo") => {
      if (mode === "demo") {
        loadDemo();
      } else {
        loadGuest();
      }
    },
    [loadDemo, loadGuest]
  );

  const setPortfolio = useCallback(
    async (portfolio: PortfolioData | null) => {
      if (state.mode === "demo") {
        const stored = loadDemoStorage();
        const next: GuestStorage = {
          portfolio,
          portfolioUploadedAt: portfolio ? new Date().toISOString() : null,
          sets: stored?.sets ?? state.sets,
          timestamp: new Date().toISOString(),
        };
        saveDemoStorage(next);
        setState((s) => ({
          ...s,
          portfolio,
          portfolioUploadedAt: next.portfolioUploadedAt,
        }));
        return;
      }
      if (state.mode === "guest") {
        if (portfolio) saveGuestPortfolio(portfolio);
        else {
          saveGuestStorage({
            portfolio: null,
            portfolioUploadedAt: null,
            sets: state.sets,
            timestamp: new Date().toISOString(),
          });
        }
        setState((s) => ({
          ...s,
          portfolio,
          portfolioUploadedAt: portfolio ? new Date().toISOString() : null,
        }));
        return;
      }
      if (state.mode === "logged_in" && state.user) {
        if (!portfolio) {
          setState((s) => ({
            ...s,
            portfolio: null,
            portfolioUploadedAt: null,
          }));
          return;
        }
        const ok = await saveSupabasePortfolio(state.user.id, portfolio);
        if (ok) {
          setState((s) => ({
            ...s,
            portfolio,
            portfolioUploadedAt: new Date().toISOString(),
          }));
        } else {
          setState((s) => ({ ...s, error: "Failed to save portfolio" }));
        }
      }
    },
    [state.mode, state.user, state.sets]
  );

  const setSets = useCallback(
    async (sets: StockSet[]) => {
      if (state.mode === "demo") {
        const stored = loadDemoStorage();
        const next: GuestStorage = {
          ...stored!,
          sets,
          timestamp: new Date().toISOString(),
        };
        saveDemoStorage(next);
        setState((s) => ({ ...s, sets }));
        return;
      }
      if (state.mode === "guest") {
        saveGuestSets(sets);
        setState((s) => ({ ...s, sets }));
        return;
      }
      if (state.mode === "logged_in" && state.user) {
        const ok = await saveSupabaseSets(state.user.id, sets);
        if (ok) setState((s) => ({ ...s, sets }));
        else setState((s) => ({ ...s, error: "Failed to save sets" }));
      }
    },
    [state.mode, state.user]
  );

  const addSet = useCallback(
    async (name: string, symbols: string[]) => {
      const newSet: StockSet = { id: crypto.randomUUID(), name, symbols };
      await setSets([...state.sets, newSet]);
    },
    [state.sets, setSets]
  );

  const updateSet = useCallback(
    async (id: string, updates: { name?: string; symbols?: string[] }) => {
      const next = state.sets.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      );
      await setSets(next);
    },
    [state.sets, setSets]
  );

  const removeSet = useCallback(
    async (id: string) => {
      await setSets(state.sets.filter((s) => s.id !== id));
    },
    [state.sets, setSets]
  );

  const clearData = useCallback(() => {
    if (state.mode === "demo") {
      sessionStorage.removeItem("zerodha_demo");
      loadDemo();
      return;
    }
    if (state.mode === "guest") {
      localStorage.removeItem("zerodhaPortfolio_guest");
      loadGuest();
    }
    if (state.mode === "logged_in") {
      setPortfolio(null);
    }
  }, [state.mode, loadGuest, loadDemo, setPortfolio]);

  const mergeGuestIntoAccount = useCallback(async () => {
    const guest = loadGuestStorage();
    if (!guest?.portfolio || !state.user || !supabase) return;
    await saveSupabasePortfolio(state.user.id, guest.portfolio);
    if (guest.sets?.length) await saveSupabaseSets(state.user.id, guest.sets);
    localStorage.removeItem("zerodhaPortfolio_guest");
    loadLoggedIn(state.user);
  }, [state.user, loadLoggedIn]);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      setMode,
      setPortfolio,
      setSets,
      addSet,
      updateSet,
      removeSet,
      loadDemo,
      clearData,
      mergeGuestIntoAccount,
      clearError,
    }),
    [
      state,
      setMode,
      setPortfolio,
      setSets,
      addSet,
      updateSet,
      removeSet,
      loadDemo,
      clearData,
      mergeGuestIntoAccount,
      clearError,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// ---------- Demo data ----------

function getDemoPortfolio(): PortfolioData {
  const rows = [
    { name: "PARAS", qty: 10, invested: 85000, curVal: 92000, avgCost: 8500 },
    { name: "CAMS", qty: 5, invested: 45000, curVal: 48000, avgCost: 9000 },
    {
      name: "POLYCAB",
      qty: 8,
      invested: 120000,
      curVal: 132000,
      avgCost: 15000,
    },
    { name: "SYRMA", qty: 20, invested: 60000, curVal: 58000, avgCost: 3000 },
    { name: "AVALON", qty: 15, invested: 75000, curVal: 78000, avgCost: 5000 },
    {
      name: "SONACOMS",
      qty: 12,
      invested: 48000,
      curVal: 52000,
      avgCost: 4000,
    },
    { name: "CDSL", qty: 6, invested: 72000, curVal: 75000, avgCost: 12000 },
    {
      name: "CIPLA",
      qty: 10,
      invested: 130000,
      curVal: 128000,
      avgCost: 13000,
    },
    { name: "AMBER", qty: 25, invested: 50000, curVal: 54000, avgCost: 2000 },
    { name: "HATSUN", qty: 30, invested: 90000, curVal: 95000, avgCost: 3000 },
  ];
  const data: PortfolioData = {};
  for (const r of rows) {
    data[r.name] = {
      name: r.name,
      quantity: r.qty,
      invested: r.invested,
      currentValue: r.curVal,
      avgCost: r.invested / r.qty,
    };
  }
  return data;
}

function getDemoSets(): StockSet[] {
  return [
    {
      id: crypto.randomUUID(),
      name: "Set A",
      symbols: ["PARAS", "CAMS", "POLYCAB", "SYRMA", "AVALON"],
    },
    {
      id: crypto.randomUUID(),
      name: "Set B",
      symbols: ["SONACOMS", "CDSL", "CIPLA", "AMBER", "HATSUN"],
    },
  ];
}
