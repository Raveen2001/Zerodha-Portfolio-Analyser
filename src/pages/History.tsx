import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Header } from "../components/Header";
import { useApp } from "../context/AppContext";
import {
  computePortfolioTimeline,
  computeSetTimelines,
  computeSetStockTimelines,
  computeStockTimeline,
  getAllStockSymbols,
  computeIndexSeries,
  mergeIndexSeries,
} from "../historyAnalysis";
import { fetchIndexCloses, INDEX_REGISTRY } from "../lib/indexData";
import { loadAllSnapshots } from "../lib/storage";
import type { PortfolioSnapshot } from "../types";

interface ChartClickState {
  activeTooltipIndex?: number;
}
import styles from "./History.module.css";

type Tab = "portfolio" | "sets" | "stock";

const SET_COLORS = [
  "#0071e3",
  "#34c759",
  "#ff9f0a",
  "#af52de",
  "#ff375f",
  "#5ac8fa",
  "#ffcc00",
  "#30d158",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function toNum(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function currencyFormatter(value: unknown, name: unknown): [string, string] {
  return [formatCurrency(toNum(value)), String(name ?? "")];
}

interface StatCardProps {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}
function StatCard({ label, value, positive, negative }: StatCardProps) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <span
        className={`${styles.statValue} ${positive ? styles.positive : ""} ${negative ? styles.negative : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

interface CompareSelection {
  startIdx: number | null;
  endIdx: number | null;
}

function useCompare() {
  const [sel, setSel] = useState<CompareSelection>({ startIdx: null, endIdx: null });

  const handleClick = useCallback((_data: unknown, index: number) => {
    setSel((prev) => {
      if (prev.startIdx === null || prev.endIdx !== null) {
        return { startIdx: index, endIdx: null };
      }
      const lo = Math.min(prev.startIdx, index);
      const hi = Math.max(prev.startIdx, index);
      if (lo === hi) return { startIdx: null, endIdx: null };
      return { startIdx: lo, endIdx: hi };
    });
  }, []);

  const clear = useCallback(() => setSel({ startIdx: null, endIdx: null }), []);

  return { sel, handleClick, clear };
}

interface CompareBannerProps {
  data: { date: string }[];
  sel: CompareSelection;
  getValues: (idx: number) => { label: string; val: number; isCurrency: boolean }[];
  onClear: () => void;
}
function CompareBanner({ data, sel, getValues, onClear }: CompareBannerProps) {
  if (sel.startIdx === null || sel.endIdx === null) {
    if (sel.startIdx !== null) {
      return (
        <div className={styles.compareBanner}>
          <span className={styles.compareHint}>
            Selected <strong>{data[sel.startIdx]?.date}</strong> — click another
            point to compare
          </span>
          <button type="button" className={styles.compareClear} onClick={onClear}>
            Cancel
          </button>
        </div>
      );
    }
    return null;
  }

  const startVals = getValues(sel.startIdx);
  const endVals = getValues(sel.endIdx);

  return (
    <div className={styles.compareBanner}>
      <span className={styles.compareRange}>
        {data[sel.startIdx]?.date} &rarr; {data[sel.endIdx]?.date}
      </span>
      <div className={styles.compareMetrics}>
        {startVals.map((sv, i) => {
          const ev = endVals[i];
          const diff = ev.val - sv.val;
          const diffPct = sv.val !== 0 ? (diff / Math.abs(sv.val)) * 100 : 0;
          const isUp = diff >= 0;
          return (
            <div key={sv.label} className={styles.compareMetric}>
              <span className={styles.compareMetricLabel}>{sv.label}</span>
              <span
                className={`${styles.compareMetricDelta} ${isUp ? styles.positive : styles.negative}`}
              >
                {sv.isCurrency ? formatCurrency(diff) : formatPct(diff)}
                {sv.isCurrency && (
                  <span className={styles.compareMetricPct}>
                    ({formatPct(diffPct)})
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <button type="button" className={styles.compareClear} onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

export function History() {
  const navigate = useNavigate();
  const { mode, user, sets } = useApp();
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("portfolio");

  // Index comparison state
  const [selectedIndexIds, setSelectedIndexIds] = useState<Set<string>>(new Set());
  const [indexClosesMap, setIndexClosesMap] = useState<
    Map<string, { date: string; close: number }[]>
  >(new Map());
  const [indexError, setIndexError] = useState<string | null>(null);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [selectedStock, setSelectedStock] = useState<string>("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockDropdownOpen, setStockDropdownOpen] = useState(false);
  const [highlightedStockIdx, setHighlightedStockIdx] = useState(0);
  const stockSearchWrapRef = useRef<HTMLDivElement>(null);

  const portfolioCompare = useCompare();
  const setCompare = useCompare();
  const stockValueCompare = useCompare();
  const stockPnlCompare = useCompare();

  const isLoggedIn = mode === "logged_in" && !!user;

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoadingSnapshots(true);
    loadAllSnapshots(user.id)
      .then(setSnapshots)
      .finally(() => setLoadingSnapshots(false));
  }, [isLoggedIn, user?.id]);

  useEffect(() => {
    portfolioCompare.clear();
    setCompare.clear();
    stockValueCompare.clear();
    stockPnlCompare.clear();
  }, [activeTab, selectedStock]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch closes for every selected index whenever selection or snapshots change
  useEffect(() => {
    if (snapshots.length < 2 || selectedIndexIds.size === 0) return;
    const fromISO = snapshots[0].uploadedAt;
    const toISO = snapshots[snapshots.length - 1].uploadedAt;

    let cancelled = false;
    setIndexError(null);

    // Read current map inside the effect to avoid stale-closure skips
    const toFetch = INDEX_REGISTRY.filter((idx) => selectedIndexIds.has(idx.id));
    if (toFetch.length === 0) return;

    Promise.all(
      toFetch.map((idx) =>
        fetchIndexCloses(idx.yahooSymbol, fromISO, toISO).then((quotes) => ({
          id: idx.id,
          quotes,
        }))
      )
    )
      .then((results) => {
        if (cancelled) return;
        setIndexClosesMap((prev) => {
          const next = new Map(prev);
          for (const r of results) next.set(r.id, r.quotes);
          return next;
        });
      })
      .catch((err) => {
        if (!cancelled)
          setIndexError(
            err instanceof Error ? err.message : "Failed to load index data"
          );
      });

    return () => {
      cancelled = true;
    };
  }, [selectedIndexIds, snapshots]); // eslint-disable-line react-hooks/exhaustive-deps

  // When snapshots change, clear the closes cache so stale data isn't shown
  useEffect(() => {
    setIndexClosesMap(new Map());
  }, [snapshots]);

  const portfolioTimeline = useMemo(
    () => computePortfolioTimeline(snapshots),
    [snapshots]
  );

  const setTimelines = useMemo(
    () => computeSetTimelines(snapshots, sets),
    [snapshots, sets]
  );

  useEffect(() => {
    if (sets.length > 0 && selectedSetIds.size === 0) {
      setSelectedSetIds(new Set(sets.map((s) => s.id)));
    }
  }, [sets]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSet = useCallback((setId: string) => {
    setSelectedSetIds((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });
  }, []);

  const selectAllSets = useCallback(() => {
    setSelectedSetIds(new Set(sets.map((s) => s.id)));
  }, [sets]);

  const clearAllSets = useCallback(() => {
    setSelectedSetIds(new Set());
  }, []);

  const toggleIndex = useCallback((id: string) => {
    setSelectedIndexIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Build money-weighted index series for a given invested-over-time series.
  // Each chart passes its own invested base (portfolio / set / stock).
  const buildIndexSeries = useCallback(
    (investedSeries: number[]) => {
      const result = new Map<string, (number | null)[]>();
      for (const idx of INDEX_REGISTRY) {
        if (!selectedIndexIds.has(idx.id)) continue;
        const closes = indexClosesMap.get(idx.id);
        if (!closes) continue;
        const series = computeIndexSeries(snapshots, closes, investedSeries);
        if (series) result.set(idx.id, series);
      }
      return result;
    },
    [selectedIndexIds, indexClosesMap, snapshots]
  );

  const activeSets = useMemo(
    () => sets.filter((s) => selectedSetIds.has(s.id)),
    [sets, selectedSetIds]
  );

  const singleSelectedSet = activeSets.length === 1 ? activeSets[0] : null;

  const singleSetStockTimelines = useMemo(() => {
    if (!singleSelectedSet || snapshots.length === 0) return null;
    return computeSetStockTimelines(snapshots, singleSelectedSet);
  }, [snapshots, singleSelectedSet]);

  const stockSymbols = useMemo(
    () => getAllStockSymbols(snapshots),
    [snapshots]
  );

  const activeStock = selectedStock || stockSymbols[0] || "";

  const filteredStockSymbols = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return stockSymbols;
    return stockSymbols.filter((s) => s.toLowerCase().includes(q));
  }, [stockSymbols, stockSearch]);

  // Close stock search dropdown when clicking outside
  useEffect(() => {
    if (!stockDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        stockSearchWrapRef.current &&
        !stockSearchWrapRef.current.contains(e.target as Node)
      ) {
        setStockDropdownOpen(false);
        setStockSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [stockDropdownOpen]);

  const handleStockSelect = useCallback((sym: string) => {
    setSelectedStock(sym);
    setStockSearch("");
    setStockDropdownOpen(false);
    setHighlightedStockIdx(0);
  }, []);

  const handleStockInputFocus = () => {
    setStockSearch("");
    setStockDropdownOpen(true);
    setHighlightedStockIdx(0);
  };

  const handleStockKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!stockDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setStockDropdownOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedStockIdx((i) =>
        Math.min(i + 1, filteredStockSymbols.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedStockIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const sym = filteredStockSymbols[highlightedStockIdx];
      if (sym) handleStockSelect(sym);
    } else if (e.key === "Escape") {
      setStockDropdownOpen(false);
      setStockSearch("");
    }
  };

  const stockTimeline = useMemo(
    () => (activeStock ? computeStockTimeline(snapshots, activeStock) : []),
    [snapshots, activeStock]
  );

  // Merge money-weighted index series into timelines for the P&L % charts.
  // Each entity uses its own invested-over-time as the cash-flow base.
  const portfolioIndexSeries = useMemo(
    () => buildIndexSeries(portfolioTimeline.map((p) => p.totalInvested)),
    [buildIndexSeries, portfolioTimeline]
  );
  const portfolioTimelineWithIdx = useMemo(
    () => mergeIndexSeries(portfolioTimeline, portfolioIndexSeries),
    [portfolioTimeline, portfolioIndexSeries]
  );

  // Per-set index series + merged timelines
  const setIndexSeriesMap = useMemo(() => {
    const result = new Map<string, Map<string, (number | null)[]>>();
    for (const [id, data] of setTimelines) {
      result.set(id, buildIndexSeries(data.map((p) => p.totalInvested)));
    }
    return result;
  }, [setTimelines, buildIndexSeries]);

  const setTimelineWithIdx = useMemo(() => {
    const result = new Map<string, ReturnType<typeof mergeIndexSeries>>();
    for (const [id, data] of setTimelines) {
      result.set(
        id,
        mergeIndexSeries(data, setIndexSeriesMap.get(id) ?? new Map())
      );
    }
    return result;
  }, [setTimelines, setIndexSeriesMap]);

  // Multi-set comparison chart: benchmark against the combined cash flows of
  // all currently-selected sets.
  const multiSetIndexSeries = useMemo(() => {
    if (activeSets.length === 0) return new Map<string, (number | null)[]>();
    const len = setTimelines.get(activeSets[0].id)?.length ?? 0;
    const combinedInvested = new Array(len).fill(0);
    for (const set of activeSets) {
      const data = setTimelines.get(set.id) ?? [];
      for (let i = 0; i < len; i++) {
        combinedInvested[i] += data[i]?.totalInvested ?? 0;
      }
    }
    return buildIndexSeries(combinedInvested);
  }, [activeSets, setTimelines, buildIndexSeries]);

  const stockIndexSeries = useMemo(
    () => buildIndexSeries(stockTimeline.map((p) => p.invested)),
    [buildIndexSeries, stockTimeline]
  );
  const stockTimelineWithIdx = useMemo(
    () => mergeIndexSeries(stockTimeline, stockIndexSeries),
    [stockTimeline, stockIndexSeries]
  );

  const portfolioLatest = portfolioTimeline[portfolioTimeline.length - 1];
  const portfolioFirst = portfolioTimeline[0];

  const portfolioDeltaPnlPct =
    portfolioFirst && portfolioLatest
      ? portfolioLatest.pnlPercent - portfolioFirst.pnlPercent
      : null;

  const stockLatest = stockTimeline[stockTimeline.length - 1];
  const stockFirst = stockTimeline[0];

  if (!isLoggedIn) {
    return (
      <div className={styles.wrapper}>
        <Header />
        <main className={styles.main}>
          <div className={styles.guestCard}>
            <h2 className={styles.guestTitle}>Historical Performance</h2>
            <p className={styles.guestDesc}>
              Track how your portfolio and each set have performed across
              uploads over time. This feature requires a free account so your
              upload history can be saved in the cloud.
            </p>
            <button
              type="button"
              className={styles.guestCta}
              onClick={() => navigate("/", { state: { tab: "signup" } })}
            >
              Create a free account
            </button>
            <button
              type="button"
              className={styles.guestSecondary}
              onClick={() => navigate("/app")}
            >
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (loadingSnapshots) {
    return (
      <div className={styles.wrapper}>
        <Header />
        <main className={styles.main}>
          <div className={styles.loading}>Loading history…</div>
        </main>
      </div>
    );
  }

  if (snapshots.length < 2) {
    return (
      <div className={styles.wrapper}>
        <Header />
        <main className={styles.main}>
          <h1 className={styles.pageTitle}>Historical Performance</h1>
          <div className={styles.emptyCard}>
            <p className={styles.emptyTitle}>Not enough data yet</p>
            <p className={styles.emptyDesc}>
              Upload your holdings at least twice to start seeing performance
              trends over time. Each CSV upload creates a new snapshot.
            </p>
            <button
              type="button"
              className={styles.guestCta}
              onClick={() => navigate("/app")}
            >
              Go to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  const refAreaColor = "rgba(0, 113, 227, 0.08)";
  const refDotColor = "#0071e3";

  function renderIndexLines(seriesById: Map<string, (number | null)[]>) {
    return INDEX_REGISTRY.filter((idx) => seriesById.has(idx.id)).map((idx) => (
      <Line
        key={`idx_${idx.id}`}
        type="linear"
        dataKey={`idx_${idx.id}`}
        name={idx.label}
        stroke={idx.color}
        strokeWidth={2}
        strokeDasharray="6 3"
        dot={false}
        activeDot={{ r: 4 }}
        connectNulls
      />
    ));
  }

  function renderCompareOverlay(
    data: { date: string }[],
    sel: CompareSelection,
    yDataKey: string
  ) {
    const nodes: React.ReactNode[] = [];
    if (sel.startIdx !== null && sel.endIdx !== null) {
      nodes.push(
        <ReferenceArea
          key="ref-area"
          x1={data[sel.startIdx]?.date}
          x2={data[sel.endIdx]?.date}
          fill={refAreaColor}
          fillOpacity={1}
        />
      );
    }
    if (sel.startIdx !== null) {
      const pt = data[sel.startIdx] as Record<string, unknown>;
      nodes.push(
        <ReferenceDot
          key="ref-start"
          x={pt.date as string}
          y={pt[yDataKey] as number}
          r={6}
          fill={refDotColor}
          stroke="#fff"
          strokeWidth={2}
        />
      );
    }
    if (sel.endIdx !== null) {
      const pt = data[sel.endIdx] as Record<string, unknown>;
      nodes.push(
        <ReferenceDot
          key="ref-end"
          x={pt.date as string}
          y={pt[yDataKey] as number}
          r={6}
          fill={refDotColor}
          stroke="#fff"
          strokeWidth={2}
        />
      );
    }
    return nodes;
  }

  return (
    <div className={styles.wrapper}>
      <Header />
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Historical Performance</h1>
        <p className={styles.pageSubtitle}>
          {snapshots.length} snapshots &mdash; from{" "}
          {portfolioTimeline[0]?.date} to{" "}
          {portfolioTimeline[portfolioTimeline.length - 1]?.date}
        </p>
        <p className={styles.compareInstruction}>
          Click any two points on a chart to compare them
        </p>

        <div className={styles.tabs} role="tablist">
          {(
            [
              { id: "portfolio", label: "Portfolio Overview" },
              { id: "sets", label: "Set Performance" },
              { id: "stock", label: "Stock Performance" },
            ] as { id: Tab; label: string }[]
          ).map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              type="button"
              className={`${styles.tab} ${activeTab === id ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Index benchmark selector */}
        <div className={styles.indexSelectorCard}>
          <div className={styles.indexSelectorHeader}>
            <span className={styles.indexSelectorTitle}>Benchmark comparison</span>
            <span className={styles.indexSelectorHint}>
              Select indices to overlay on P&L % charts
            </span>
          </div>
          {indexError && (
            <p className={styles.indexError}>{indexError}</p>
          )}
          <div className={styles.setPillRow}>
            {INDEX_REGISTRY.map((idx) => {
              const isActive = selectedIndexIds.has(idx.id);
              const isLoading = isActive && !indexClosesMap.has(idx.id);
              return (
                <button
                  key={idx.id}
                  type="button"
                  className={`${styles.setPill} ${isActive ? styles.setPillActive : ""}`}
                  style={
                    isActive
                      ? { borderColor: idx.color, background: `${idx.color}18` }
                      : undefined
                  }
                  onClick={() => toggleIndex(idx.id)}
                >
                  <span
                    className={styles.setPillDot}
                    style={{ background: isActive ? idx.color : "var(--color-border)" }}
                  />
                  {idx.label}
                  {isLoading && <span className={styles.indexLoadingDot} />}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "portfolio" && (
          <section className={styles.section}>
            <div className={styles.statRow}>
              {portfolioLatest && (
                <>
                  <StatCard
                    label="Total Invested"
                    value={formatCurrency(portfolioLatest.totalInvested)}
                  />
                  <StatCard
                    label="Current Value"
                    value={formatCurrency(portfolioLatest.totalValue)}
                    positive={portfolioLatest.pnl >= 0}
                    negative={portfolioLatest.pnl < 0}
                  />
                  <StatCard
                    label="Total P&L"
                    value={formatCurrency(portfolioLatest.pnl)}
                    positive={portfolioLatest.pnl >= 0}
                    negative={portfolioLatest.pnl < 0}
                  />
                  <StatCard
                    label="P&L %"
                    value={formatPct(portfolioLatest.pnlPercent)}
                    positive={portfolioLatest.pnlPercent >= 0}
                    negative={portfolioLatest.pnlPercent < 0}
                  />
                  {portfolioDeltaPnlPct !== null && (
                    <StatCard
                      label="Change since first upload"
                      value={formatPct(portfolioDeltaPnlPct)}
                      positive={portfolioDeltaPnlPct >= 0}
                      negative={portfolioDeltaPnlPct < 0}
                    />
                  )}
                </>
              )}
            </div>

            <CompareBanner
              data={portfolioTimeline}
              sel={portfolioCompare.sel}
              onClear={portfolioCompare.clear}
              getValues={(idx) => {
                const pt = portfolioTimeline[idx];
                return [
                  { label: "Invested", val: pt.totalInvested, isCurrency: true },
                  { label: "Value", val: pt.totalValue, isCurrency: true },
                  { label: "P&L", val: pt.pnl, isCurrency: true },
                  { label: "P&L %", val: pt.pnlPercent, isCurrency: false },
                ];
              }}
            />

            <div className={styles.chartCard}>
              <h2 className={styles.chartTitle}>Invested vs. Value over time</h2>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={portfolioTimeline}
                  margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
                  onClick={(state) => {
                    const s = state as unknown as ChartClickState;
                    if (s?.activeTooltipIndex != null)
                      portfolioCompare.handleClick(null, s.activeTooltipIndex);
                  }}
                  style={{ cursor: "crosshair" }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "#6e6e73" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) =>
                      new Intl.NumberFormat("en-IN", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(v)
                    }
                    tick={{ fontSize: 12, fill: "#6e6e73" }}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                  />
                  <Tooltip
                    formatter={currencyFormatter}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.08)",
                      fontSize: 13,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  {renderCompareOverlay(portfolioTimeline, portfolioCompare.sel, "totalValue")}
                  <Line
                    type="linear"
                    dataKey="totalInvested"
                    name="Invested"
                    stroke="#6e6e73"
                    strokeDasharray="4 3"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="linear"
                    dataKey="totalValue"
                    name="Value"
                    stroke="#0071e3"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.chartCard}>
              <h2 className={styles.chartTitle}>P&L % over time</h2>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={portfolioTimelineWithIdx as unknown as Record<string, unknown>[]}
                  margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
                  onClick={(state) => {
                    const s = state as unknown as ChartClickState;
                    if (s?.activeTooltipIndex != null)
                      portfolioCompare.handleClick(null, s.activeTooltipIndex);
                  }}
                  style={{ cursor: "crosshair" }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "#6e6e73" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 12, fill: "#6e6e73" }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [
                      `${toNum(value).toFixed(2)}%`,
                      String(name ?? ""),
                    ]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.08)",
                      fontSize: 13,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  {renderCompareOverlay(portfolioTimeline, portfolioCompare.sel, "pnlPercent")}
                  <Line
                    type="linear"
                    dataKey="pnlPercent"
                    name="P&L %"
                    stroke="#34c759"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                  {renderIndexLines(portfolioIndexSeries)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {activeTab === "sets" && (
          <section className={styles.section}>
            {sets.length === 0 ? (
              <div className={styles.emptyCard}>
                <p className={styles.emptyTitle}>No sets defined</p>
                <p className={styles.emptyDesc}>
                  Create sets on the Dashboard to see per-set performance here.
                </p>
                <button
                  type="button"
                  className={styles.guestCta}
                  onClick={() => navigate("/app")}
                >
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <>
                {/* Set selector */}
                <div className={styles.setSelectorWrap}>
                  <span className={styles.setSelectorLabel}>Select sets to analyse</span>
                  <div className={styles.setSelectorActions}>
                    <button
                      type="button"
                      className={styles.setSelectorAction}
                      onClick={selectAllSets}
                      disabled={selectedSetIds.size === sets.length}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={styles.setSelectorAction}
                      onClick={clearAllSets}
                      disabled={selectedSetIds.size === 0}
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className={styles.setPillRow}>
                  {sets.map((set, i) => {
                    const isActive = selectedSetIds.has(set.id);
                    return (
                      <button
                        key={set.id}
                        type="button"
                        className={`${styles.setPill} ${isActive ? styles.setPillActive : ""}`}
                        style={
                          isActive
                            ? { borderColor: SET_COLORS[i % SET_COLORS.length], background: `${SET_COLORS[i % SET_COLORS.length]}12` }
                            : undefined
                        }
                        onClick={() => toggleSet(set.id)}
                      >
                        <span
                          className={styles.setPillDot}
                          style={{ background: isActive ? SET_COLORS[i % SET_COLORS.length] : "var(--color-border)" }}
                        />
                        {set.name}
                      </button>
                    );
                  })}
                </div>

                {selectedSetIds.size === 0 && (
                  <div className={styles.emptyCard}>
                    <p className={styles.emptyTitle}>No sets selected</p>
                    <p className={styles.emptyDesc}>
                      Select one or more sets above to view their performance.
                    </p>
                  </div>
                )}

                {/* Multi-set comparison view */}
                {activeSets.length > 1 && (
                  <>
                    <CompareBanner
                      data={setTimelines.get(activeSets[0]?.id) ?? []}
                      sel={setCompare.sel}
                      onClear={setCompare.clear}
                      getValues={(idx) =>
                        activeSets.map((set) => {
                          const d = setTimelines.get(set.id) ?? [];
                          return {
                            label: `${set.name} P&L %`,
                            val: d[idx]?.pnlPercent ?? 0,
                            isCurrency: false,
                          };
                        })
                      }
                    />

                    <div className={styles.chartCard}>
                      <h2 className={styles.chartTitle}>Set P&L % over time</h2>
                      <ResponsiveContainer width="100%" height={320}>
                        <LineChart
                          margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
                          onClick={(state) => {
                            const s = state as unknown as ChartClickState;
                            if (s?.activeTooltipIndex != null)
                              setCompare.handleClick(null, s.activeTooltipIndex);
                          }}
                          style={{ cursor: "crosshair" }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(0,0,0,0.07)"
                          />
                          <XAxis
                            dataKey="date"
                            allowDuplicatedCategory={false}
                            tick={{ fontSize: 12, fill: "#6e6e73" }}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v) => `${v}%`}
                            tick={{ fontSize: 12, fill: "#6e6e73" }}
                            tickLine={false}
                            axisLine={false}
                            width={52}
                          />
                          <Tooltip
                            formatter={(value: unknown, name: unknown) => [
                              `${toNum(value).toFixed(2)}%`,
                              String(name ?? ""),
                            ]}
                            contentStyle={{
                              borderRadius: 8,
                              border: "1px solid rgba(0,0,0,0.08)",
                              fontSize: 13,
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 13 }} />
                          {(() => {
                            const firstSetData = setTimelines.get(activeSets[0]?.id) ?? [];
                            if (setCompare.sel.startIdx !== null && setCompare.sel.endIdx !== null) {
                              return (
                                <ReferenceArea
                                  x1={firstSetData[setCompare.sel.startIdx]?.date}
                                  x2={firstSetData[setCompare.sel.endIdx]?.date}
                                  fill={refAreaColor}
                                  fillOpacity={1}
                                />
                              );
                            }
                            return null;
                          })()}
                          {activeSets.map((set) => {
                            const globalIdx = sets.findIndex((s) => s.id === set.id);
                            const data = setTimelines.get(set.id) ?? [];
                            return (
                              <Line
                                key={set.id}
                                data={data}
                                dataKey="pnlPercent"
                                name={set.name}
                                stroke={SET_COLORS[globalIdx % SET_COLORS.length]}
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 5 }}
                                type="linear"
                              />
                            );
                          })}
                          {INDEX_REGISTRY.filter((idx) =>
                            multiSetIndexSeries.has(idx.id)
                          ).map((idx) => {
                            const series = multiSetIndexSeries.get(idx.id)!;
                            const data = (setTimelines.get(activeSets[0]?.id) ?? []).map(
                              (pt, i) => ({ date: pt.date, pct: series[i] ?? null })
                            );
                            return (
                              <Line
                                key={`idx_${idx.id}`}
                                data={data}
                                dataKey="pct"
                                name={idx.label}
                                stroke={idx.color}
                                strokeWidth={2}
                                strokeDasharray="6 3"
                                dot={false}
                                activeDot={{ r: 4 }}
                                type="linear"
                                connectNulls
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className={styles.setCardsGrid}>
                      {activeSets.map((set) => {
                        const globalIdx = sets.findIndex((s) => s.id === set.id);
                        const data = setTimelines.get(set.id) ?? [];
                        const latest = data[data.length - 1];
                        const first = data[0];
                        const deltaPct =
                          first && latest
                            ? latest.pnlPercent - first.pnlPercent
                            : null;
                        return (
                          <div key={set.id} className={styles.setDetailCard}>
                            <span
                              className={styles.setDetailDot}
                              style={{
                                background: SET_COLORS[globalIdx % SET_COLORS.length],
                              }}
                            />
                            <p className={styles.setDetailName}>{set.name}</p>
                            {latest && (
                              <div className={styles.setDetailStats}>
                                <div className={styles.setDetailStat}>
                                  <span className={styles.setDetailStatLabel}>
                                    Invested
                                  </span>
                                  <span className={styles.setDetailStatValue}>
                                    {formatCurrency(latest.totalInvested)}
                                  </span>
                                </div>
                                <div className={styles.setDetailStat}>
                                  <span className={styles.setDetailStatLabel}>
                                    Value
                                  </span>
                                  <span
                                    className={`${styles.setDetailStatValue} ${latest.pnl >= 0 ? styles.positive : styles.negative}`}
                                  >
                                    {formatCurrency(latest.totalValue)}
                                  </span>
                                </div>
                                <div className={styles.setDetailStat}>
                                  <span className={styles.setDetailStatLabel}>
                                    P&L %
                                  </span>
                                  <span
                                    className={`${styles.setDetailStatValue} ${latest.pnlPercent >= 0 ? styles.positive : styles.negative}`}
                                  >
                                    {formatPct(latest.pnlPercent)}
                                  </span>
                                </div>
                                {deltaPct !== null && (
                                  <div className={styles.setDetailStat}>
                                    <span className={styles.setDetailStatLabel}>
                                      Change
                                    </span>
                                    <span
                                      className={`${styles.setDetailStatValue} ${deltaPct >= 0 ? styles.positive : styles.negative}`}
                                    >
                                      {formatPct(deltaPct)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Single-set detail view */}
                {singleSelectedSet && (() => {
                  const singleSetData = setTimelines.get(singleSelectedSet.id) ?? [];
                  const latest = singleSetData[singleSetData.length - 1];
                  const first = singleSetData[0];
                  const globalIdx = sets.findIndex((s) => s.id === singleSelectedSet.id);
                  const setColor = SET_COLORS[globalIdx % SET_COLORS.length];
                  const deltaPct = first && latest ? latest.pnlPercent - first.pnlPercent : null;

                  return (
                    <>
                      <div className={styles.singleSetHeader}>
                        <span
                          className={styles.singleSetDot}
                          style={{ background: setColor }}
                        />
                        <h2 className={styles.singleSetTitle}>{singleSelectedSet.name}</h2>
                        <span className={styles.singleSetBadge}>
                          {singleSelectedSet.symbols.length} stock{singleSelectedSet.symbols.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {latest && (
                        <div className={styles.statRow}>
                          <StatCard
                            label="Invested"
                            value={formatCurrency(latest.totalInvested)}
                          />
                          <StatCard
                            label="Current Value"
                            value={formatCurrency(latest.totalValue)}
                            positive={latest.pnl >= 0}
                            negative={latest.pnl < 0}
                          />
                          <StatCard
                            label="Total P&L"
                            value={formatCurrency(latest.pnl)}
                            positive={latest.pnl >= 0}
                            negative={latest.pnl < 0}
                          />
                          <StatCard
                            label="P&L %"
                            value={formatPct(latest.pnlPercent)}
                            positive={latest.pnlPercent >= 0}
                            negative={latest.pnlPercent < 0}
                          />
                          {deltaPct !== null && (
                            <StatCard
                              label="Change since first upload"
                              value={formatPct(deltaPct)}
                              positive={deltaPct >= 0}
                              negative={deltaPct < 0}
                            />
                          )}
                        </div>
                      )}

                      <CompareBanner
                        data={singleSetData}
                        sel={setCompare.sel}
                        onClear={setCompare.clear}
                        getValues={(idx) => {
                          const pt = singleSetData[idx];
                          return [
                            { label: "Invested", val: pt.totalInvested, isCurrency: true },
                            { label: "Value", val: pt.totalValue, isCurrency: true },
                            { label: "P&L", val: pt.pnl, isCurrency: true },
                            { label: "P&L %", val: pt.pnlPercent, isCurrency: false },
                          ];
                        }}
                      />

                      <div className={styles.chartCard}>
                        <h2 className={styles.chartTitle}>
                          {singleSelectedSet.name} — Invested vs. Value
                        </h2>
                        <ResponsiveContainer width="100%" height={320}>
                          <LineChart
                            data={singleSetData}
                            margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
                            onClick={(state) => {
                              const s = state as unknown as ChartClickState;
                              if (s?.activeTooltipIndex != null)
                                setCompare.handleClick(null, s.activeTooltipIndex);
                            }}
                            style={{ cursor: "crosshair" }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 12, fill: "#6e6e73" }}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={(v) =>
                                new Intl.NumberFormat("en-IN", {
                                  notation: "compact",
                                  maximumFractionDigits: 1,
                                }).format(v)
                              }
                              tick={{ fontSize: 12, fill: "#6e6e73" }}
                              tickLine={false}
                              axisLine={false}
                              width={72}
                            />
                            <Tooltip
                              formatter={currencyFormatter}
                              contentStyle={{
                                borderRadius: 8,
                                border: "1px solid rgba(0,0,0,0.08)",
                                fontSize: 13,
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: 13 }} />
                            {renderCompareOverlay(singleSetData, setCompare.sel, "totalValue")}
                            <Line
                              type="linear"
                              dataKey="totalInvested"
                              name="Invested"
                              stroke="#6e6e73"
                              strokeDasharray="4 3"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                            <Line
                              type="linear"
                              dataKey="totalValue"
                              name="Value"
                              stroke={setColor}
                              strokeWidth={2.5}
                              dot={false}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className={styles.chartCard}>
                        <h2 className={styles.chartTitle}>
                          {singleSelectedSet.name} — P&L % over time
                        </h2>
                        <ResponsiveContainer width="100%" height={240}>
                          <LineChart
                            data={(setTimelineWithIdx.get(singleSelectedSet.id) ?? singleSetData) as unknown as Record<string, unknown>[]}
                            margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
                            onClick={(state) => {
                              const s = state as unknown as ChartClickState;
                              if (s?.activeTooltipIndex != null)
                                setCompare.handleClick(null, s.activeTooltipIndex);
                            }}
                            style={{ cursor: "crosshair" }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 12, fill: "#6e6e73" }}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={(v) => `${v}%`}
                              tick={{ fontSize: 12, fill: "#6e6e73" }}
                              tickLine={false}
                              axisLine={false}
                              width={52}
                            />
                            <Tooltip
                              formatter={(value: unknown, name: unknown) => [
                                `${toNum(value).toFixed(2)}%`,
                                String(name ?? ""),
                              ]}
                              contentStyle={{
                                borderRadius: 8,
                                border: "1px solid rgba(0,0,0,0.08)",
                                fontSize: 13,
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: 13 }} />
                            {renderCompareOverlay(singleSetData, setCompare.sel, "pnlPercent")}
                            <Line
                              type="linear"
                              dataKey="pnlPercent"
                              name="P&L %"
                              stroke={setColor}
                              strokeWidth={2.5}
                              dot={false}
                              activeDot={{ r: 5 }}
                            />
                            {renderIndexLines(
                              setIndexSeriesMap.get(singleSelectedSet.id) ?? new Map()
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Per-stock P&L % comparison within this set */}
                      {singleSetStockTimelines && singleSelectedSet.symbols.length > 0 && (
                        <div className={styles.chartCard}>
                          <h2 className={styles.chartTitle}>
                            Stock-level P&L % — {singleSelectedSet.name}
                          </h2>
                          <ResponsiveContainer width="100%" height={360}>
                            <LineChart
                              margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
                              style={{ cursor: "crosshair" }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
                              <XAxis
                                dataKey="date"
                                allowDuplicatedCategory={false}
                                tick={{ fontSize: 12, fill: "#6e6e73" }}
                                tickLine={false}
                              />
                              <YAxis
                                tickFormatter={(v) => `${v}%`}
                                tick={{ fontSize: 12, fill: "#6e6e73" }}
                                tickLine={false}
                                axisLine={false}
                                width={52}
                              />
                              <Tooltip
                                formatter={(value: unknown, name: unknown) => [
                                  `${toNum(value).toFixed(2)}%`,
                                  String(name ?? ""),
                                ]}
                                contentStyle={{
                                  borderRadius: 8,
                                  border: "1px solid rgba(0,0,0,0.08)",
                                  fontSize: 13,
                                }}
                              />
                              <Legend wrapperStyle={{ fontSize: 13 }} />
                              {singleSelectedSet.symbols.map((sym, si) => {
                                const data = singleSetStockTimelines.get(sym) ?? [];
                                return (
                                  <Line
                                    key={sym}
                                    data={data}
                                    dataKey="pnlPercent"
                                    name={sym}
                                    stroke={SET_COLORS[si % SET_COLORS.length]}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                    type="linear"
                                  />
                                );
                              })}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Per-stock stat cards within this set */}
                      {singleSetStockTimelines && (
                        <div className={styles.setCardsGrid}>
                          {singleSelectedSet.symbols.map((sym, si) => {
                            const data = singleSetStockTimelines.get(sym) ?? [];
                            const latestPt = data[data.length - 1];
                            const firstPt = data[0];
                            const stockDeltaPct =
                              firstPt && latestPt
                                ? latestPt.pnlPercent - firstPt.pnlPercent
                                : null;
                            return (
                              <div key={sym} className={styles.setDetailCard}>
                                <span
                                  className={styles.setDetailDot}
                                  style={{
                                    background: SET_COLORS[si % SET_COLORS.length],
                                  }}
                                />
                                <p className={styles.setDetailName}>{sym}</p>
                                {latestPt && (
                                  <div className={styles.setDetailStats}>
                                    <div className={styles.setDetailStat}>
                                      <span className={styles.setDetailStatLabel}>
                                        Invested
                                      </span>
                                      <span className={styles.setDetailStatValue}>
                                        {formatCurrency(latestPt.invested)}
                                      </span>
                                    </div>
                                    <div className={styles.setDetailStat}>
                                      <span className={styles.setDetailStatLabel}>
                                        Value
                                      </span>
                                      <span
                                        className={`${styles.setDetailStatValue} ${latestPt.pnl >= 0 ? styles.positive : styles.negative}`}
                                      >
                                        {formatCurrency(latestPt.value)}
                                      </span>
                                    </div>
                                    <div className={styles.setDetailStat}>
                                      <span className={styles.setDetailStatLabel}>
                                        P&L %
                                      </span>
                                      <span
                                        className={`${styles.setDetailStatValue} ${latestPt.pnlPercent >= 0 ? styles.positive : styles.negative}`}
                                      >
                                        {formatPct(latestPt.pnlPercent)}
                                      </span>
                                    </div>
                                    <div className={styles.setDetailStat}>
                                      <span className={styles.setDetailStatLabel}>
                                        Qty
                                      </span>
                                      <span className={styles.setDetailStatValue}>
                                        {latestPt.quantity}
                                      </span>
                                    </div>
                                    {stockDeltaPct !== null && (
                                      <div className={styles.setDetailStat}>
                                        <span className={styles.setDetailStatLabel}>
                                          Change
                                        </span>
                                        <span
                                          className={`${styles.setDetailStatValue} ${stockDeltaPct >= 0 ? styles.positive : styles.negative}`}
                                        >
                                          {formatPct(stockDeltaPct)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </section>
        )}

        {activeTab === "stock" && (
          <section className={styles.section}>
            <div className={styles.stockSelectorRow}>
              <span className={styles.stockSelectLabel}>Select stock</span>
              <div
                className={styles.stockSearchWrap}
                ref={stockSearchWrapRef}
                role="combobox"
                aria-expanded={stockDropdownOpen ? "true" : "false"}
                aria-haspopup="listbox"
                aria-controls="stock-symbol-listbox"
              >
                <input
                  type="text"
                  className={styles.stockSearchInput}
                  value={stockDropdownOpen ? stockSearch : activeStock}
                  placeholder="Search stock…"
                  onFocus={handleStockInputFocus}
                  onChange={(e) => {
                    setStockSearch(e.target.value);
                    setStockDropdownOpen(true);
                    setHighlightedStockIdx(0);
                  }}
                  onKeyDown={handleStockKeyDown}
                  aria-label="Search and select stock"
                  aria-autocomplete="list"
                  autoComplete="off"
                  spellCheck={false}
                />
                <svg
                  className={styles.stockSearchIcon}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {stockDropdownOpen && (
                  <div
                    id="stock-symbol-listbox"
                    className={styles.stockDropdown}
                    role="listbox"
                  >
                    {filteredStockSymbols.length === 0 ? (
                      <div className={styles.stockNoResults}>No results</div>
                    ) : (
                      filteredStockSymbols.map((sym, i) => (
                        <div
                          key={sym}
                          role="option"
                          aria-selected={sym === activeStock}
                          className={[
                            styles.stockOption,
                            i === highlightedStockIdx
                              ? styles.stockOptionHighlighted
                              : "",
                            sym === activeStock
                              ? styles.stockOptionSelected
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleStockSelect(sym);
                          }}
                          onMouseEnter={() => setHighlightedStockIdx(i)}
                        >
                          {sym}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {activeStock && (
              <>
                <div className={styles.statRow}>
                  {stockLatest && (
                    <>
                      <StatCard
                        label="Invested"
                        value={formatCurrency(stockLatest.invested)}
                      />
                      <StatCard
                        label="Current Value"
                        value={formatCurrency(stockLatest.value)}
                        positive={stockLatest.pnl >= 0}
                        negative={stockLatest.pnl < 0}
                      />
                      <StatCard
                        label="P&L"
                        value={formatCurrency(stockLatest.pnl)}
                        positive={stockLatest.pnl >= 0}
                        negative={stockLatest.pnl < 0}
                      />
                      <StatCard
                        label="P&L %"
                        value={formatPct(stockLatest.pnlPercent)}
                        positive={stockLatest.pnlPercent >= 0}
                        negative={stockLatest.pnlPercent < 0}
                      />
                      {stockFirst && (
                        <StatCard
                          label="Quantity"
                          value={String(stockLatest.quantity)}
                        />
                      )}
                    </>
                  )}
                </div>

                <CompareBanner
                  data={stockTimeline}
                  sel={stockValueCompare.sel}
                  onClear={stockValueCompare.clear}
                  getValues={(idx) => {
                    const pt = stockTimeline[idx];
                    return [
                      { label: "Invested", val: pt.invested, isCurrency: true },
                      { label: "Value", val: pt.value, isCurrency: true },
                      { label: "P&L", val: pt.pnl, isCurrency: true },
                      { label: "P&L %", val: pt.pnlPercent, isCurrency: false },
                    ];
                  }}
                />

                <div className={styles.chartCard}>
                  <h2 className={styles.chartTitle}>
                    {activeStock} — Invested vs. Value
                  </h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={stockTimeline}
                      margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
                      onClick={(state) => {
                        const s = state as unknown as ChartClickState;
                        if (s?.activeTooltipIndex != null)
                          stockValueCompare.handleClick(null, s.activeTooltipIndex);
                      }}
                      style={{ cursor: "crosshair" }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(0,0,0,0.07)"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: "#6e6e73" }}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) =>
                          new Intl.NumberFormat("en-IN", {
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(v)
                        }
                        tick={{ fontSize: 12, fill: "#6e6e73" }}
                        tickLine={false}
                        axisLine={false}
                        width={64}
                      />
                      <Tooltip
                        formatter={currencyFormatter}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid rgba(0,0,0,0.08)",
                          fontSize: 13,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 13 }} />
                      {renderCompareOverlay(stockTimeline, stockValueCompare.sel, "value")}
                      <Line
                        type="linear"
                        dataKey="invested"
                        name="Invested"
                        stroke="#6e6e73"
                        strokeDasharray="4 3"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="linear"
                        dataKey="value"
                        name="Value"
                        stroke="#0071e3"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <CompareBanner
                  data={stockTimeline}
                  sel={stockPnlCompare.sel}
                  onClear={stockPnlCompare.clear}
                  getValues={(idx) => {
                    const pt = stockTimeline[idx];
                    return [
                      { label: "P&L %", val: pt.pnlPercent, isCurrency: false },
                    ];
                  }}
                />

                <div className={styles.chartCard}>
                  <h2 className={styles.chartTitle}>
                    {activeStock} — P&L % over time
                  </h2>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={stockTimelineWithIdx as unknown as Record<string, unknown>[]}
                      margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
                      onClick={(state) => {
                        const s = state as unknown as ChartClickState;
                        if (s?.activeTooltipIndex != null)
                          stockPnlCompare.handleClick(null, s.activeTooltipIndex);
                      }}
                      style={{ cursor: "crosshair" }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(0,0,0,0.07)"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: "#6e6e73" }}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 12, fill: "#6e6e73" }}
                        tickLine={false}
                        axisLine={false}
                        width={52}
                      />
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => [
                          `${toNum(value).toFixed(2)}%`,
                          String(name ?? ""),
                        ]}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid rgba(0,0,0,0.08)",
                          fontSize: 13,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 13 }} />
                      {renderCompareOverlay(stockTimeline, stockPnlCompare.sel, "pnlPercent")}
                      <Line
                        type="linear"
                        dataKey="pnlPercent"
                        name="P&L %"
                        stroke="#34c759"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                      {renderIndexLines(stockIndexSeries)}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
