import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Header } from "../components/Header";
import { useApp } from "../context/AppContext";
import { analyzeSet } from "../analysis";
import type { SetAnalysis as SetAnalysisType } from "../types";
import styles from "./SetAnalysis.module.css";

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

export function SetAnalysis() {
  const navigate = useNavigate();
  const { portfolio, sets } = useApp();
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());

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

  const activeSets = useMemo(
    () => sets.filter((s) => selectedSetIds.has(s.id)),
    [sets, selectedSetIds]
  );

  const setAnalyses = useMemo(() => {
    if (!portfolio) return new Map<string, SetAnalysisType>();
    const result = new Map<string, SetAnalysisType>();
    for (const set of sets) {
      result.set(set.id, analyzeSet(portfolio, set.symbols));
    }
    return result;
  }, [portfolio, sets]);

  const singleSelectedSet = activeSets.length === 1 ? activeSets[0] : null;

  const hasPortfolio = portfolio && Object.keys(portfolio).length > 0;

  if (!hasPortfolio) {
    return (
      <div className={styles.wrapper}>
        <Header />
        <main className={styles.main}>
          <div className={styles.emptyCard}>
            <p className={styles.emptyTitle}>No portfolio loaded</p>
            <p className={styles.emptyDesc}>
              Upload your holdings first to start analyzing your sets.
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => navigate("/app")}
            >
              Go to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (sets.length === 0) {
    return (
      <div className={styles.wrapper}>
        <Header />
        <main className={styles.main}>
          <h1 className={styles.pageTitle}>Set Analysis</h1>
          <div className={styles.emptyCard}>
            <p className={styles.emptyTitle}>No sets defined</p>
            <p className={styles.emptyDesc}>
              Create sets on the Dashboard to group your stocks and analyze them
              here.
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => navigate("/app")}
            >
              Go to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <Header />
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Set Analysis</h1>
        <p className={styles.pageSubtitle}>
          Compare sets and stocks from your current portfolio
        </p>

        {/* Set selector */}
        <div className={styles.selectorWrap}>
          <span className={styles.selectorLabel}>Select sets to analyse</span>
          <div className={styles.selectorActions}>
            <button
              type="button"
              className={styles.selectorAction}
              onClick={selectAllSets}
              disabled={selectedSetIds.size === sets.length}
            >
              All
            </button>
            <button
              type="button"
              className={styles.selectorAction}
              onClick={clearAllSets}
              disabled={selectedSetIds.size === 0}
            >
              None
            </button>
          </div>
        </div>
        <div className={styles.pillRow}>
          {sets.map((set, i) => {
            const isActive = selectedSetIds.has(set.id);
            return (
              <button
                key={set.id}
                type="button"
                className={`${styles.pill} ${isActive ? styles.pillActive : ""}`}
                style={
                  isActive
                    ? {
                        borderColor: SET_COLORS[i % SET_COLORS.length],
                        background: `${SET_COLORS[i % SET_COLORS.length]}12`,
                      }
                    : undefined
                }
                onClick={() => toggleSet(set.id)}
              >
                <span
                  className={styles.pillDot}
                  style={{
                    background: isActive
                      ? SET_COLORS[i % SET_COLORS.length]
                      : "var(--color-border)",
                  }}
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
              Select one or more sets above to view their analysis.
            </p>
          </div>
        )}

        {/* Multi-set comparison */}
        {activeSets.length > 1 && (
          <MultiSetView
            activeSets={activeSets}
            allSets={sets}
            analyses={setAnalyses}
            onSelectSingle={(id) => setSelectedSetIds(new Set([id]))}
          />
        )}

        {/* Single set view */}
        {singleSelectedSet && (
          <SingleSetView
            set={singleSelectedSet}
            allSets={sets}
            analysis={setAnalyses.get(singleSelectedSet.id)}
            onBack={selectAllSets}
          />
        )}
      </main>
    </div>
  );
}

/* ================================================================
   Multi-set comparison view
   ================================================================ */

interface MultiSetViewProps {
  activeSets: { id: string; name: string; symbols: string[] }[];
  allSets: { id: string; name: string; symbols: string[] }[];
  analyses: Map<string, SetAnalysisType>;
  onSelectSingle: (id: string) => void;
}

function MultiSetView({
  activeSets,
  allSets,
  analyses,
  onSelectSingle,
}: MultiSetViewProps) {
  const pnlData = activeSets
    .map((set) => {
      const a = analyses.get(set.id);
      const pnl = a ? a.totalCurrentValue - a.totalInvested : 0;
      const pnlPct =
        a && a.totalInvested > 0
          ? Number(((pnl / a.totalInvested) * 100).toFixed(2))
          : 0;
      return { name: set.name, pnlPercent: pnlPct, setId: set.id };
    })
    .sort((a, b) => b.pnlPercent - a.pnlPercent);

  const valueData = activeSets.map((set) => {
    const a = analyses.get(set.id);
    return {
      name: set.name,
      invested: a?.totalInvested ?? 0,
      value: a?.totalCurrentValue ?? 0,
    };
  });

  return (
    <section className={styles.section}>
      {/* P&L % horizontal bar chart */}
      <div className={styles.chartCard}>
        <h2 className={styles.chartTitle}>P&L % Comparison</h2>
        <ResponsiveContainer
          width="100%"
          height={Math.max(200, activeSets.length * 52 + 40)}
        >
          <BarChart
            data={pnlData}
            layout="vertical"
            margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0,0,0,0.07)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 12, fill: "#6e6e73" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 13, fill: "#1d1d1f" }}
              width={100}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value: unknown) => [
                `${Number(value).toFixed(2)}%`,
                "P&L %",
              ]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.08)",
                fontSize: 13,
              }}
            />
            <Bar
              dataKey="pnlPercent"
              name="P&L %"
              radius={[0, 4, 4, 0]}
              barSize={28}
            >
              {pnlData.map((entry) => {
                const globalIdx = allSets.findIndex(
                  (s) => s.id === entry.setId
                );
                return (
                  <Cell
                    key={entry.setId}
                    fill={SET_COLORS[globalIdx % SET_COLORS.length]}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Invested vs Value grouped bar chart */}
      <div className={styles.chartCard}>
        <h2 className={styles.chartTitle}>Invested vs. Value by Set</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={valueData}
            margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0,0,0,0.07)"
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 13, fill: "#1d1d1f" }}
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
              formatter={(value: unknown, name: unknown) => [
                formatCurrency(Number(value)),
                String(name ?? ""),
              ]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.08)",
                fontSize: 13,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar
              dataKey="invested"
              name="Invested"
              fill="#6e6e73"
              radius={[4, 4, 0, 0]}
              barSize={32}
            />
            <Bar
              dataKey="value"
              name="Value"
              fill="#0071e3"
              radius={[4, 4, 0, 0]}
              barSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Set summary cards */}
      <div className={styles.cardsGrid}>
        {activeSets.map((set) => {
          const globalIdx = allSets.findIndex((s) => s.id === set.id);
          const a = analyses.get(set.id);
          if (!a) return null;
          const pnl = a.totalCurrentValue - a.totalInvested;
          const pnlPct =
            a.totalInvested > 0
              ? Number(((pnl / a.totalInvested) * 100).toFixed(2))
              : 0;
          return (
            <div
              key={set.id}
              className={styles.detailCard}
              onClick={() => onSelectSingle(set.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelectSingle(set.id);
                }
              }}
            >
              <span
                className={styles.detailDot}
                style={{
                  background: SET_COLORS[globalIdx % SET_COLORS.length],
                }}
              />
              <p className={styles.detailName}>{set.name}</p>
              <div className={styles.detailStats}>
                <div className={styles.detailStat}>
                  <span className={styles.detailStatLabel}>Stocks</span>
                  <span className={styles.detailStatValue}>
                    {set.symbols.length}
                  </span>
                </div>
                <div className={styles.detailStat}>
                  <span className={styles.detailStatLabel}>Invested</span>
                  <span className={styles.detailStatValue}>
                    {formatCurrency(a.totalInvested)}
                  </span>
                </div>
                <div className={styles.detailStat}>
                  <span className={styles.detailStatLabel}>Value</span>
                  <span
                    className={`${styles.detailStatValue} ${pnl >= 0 ? styles.positive : styles.negative}`}
                  >
                    {formatCurrency(a.totalCurrentValue)}
                  </span>
                </div>
                <div className={styles.detailStat}>
                  <span className={styles.detailStatLabel}>P&L %</span>
                  <span
                    className={`${styles.detailStatValue} ${pnlPct >= 0 ? styles.positive : styles.negative}`}
                  >
                    {formatPct(pnlPct)}
                  </span>
                </div>
              </div>
              <span className={styles.viewDetail}>View details &rarr;</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ================================================================
   Single-set detail view
   ================================================================ */

interface SingleSetViewProps {
  set: { id: string; name: string; symbols: string[] };
  allSets: { id: string; name: string; symbols: string[] }[];
  analysis: SetAnalysisType | undefined;
  onBack: () => void;
}

function SingleSetView({ set, allSets, analysis, onBack }: SingleSetViewProps) {
  if (!analysis) return null;

  const globalIdx = allSets.findIndex((s) => s.id === set.id);
  const setColor = SET_COLORS[globalIdx % SET_COLORS.length];
  const pnl = analysis.totalCurrentValue - analysis.totalInvested;
  const pnlPct =
    analysis.totalInvested > 0
      ? Number(((pnl / analysis.totalInvested) * 100).toFixed(2))
      : 0;

  const stockPnlData = [...analysis.holdings]
    .sort((a, b) => b.pnlPercent - a.pnlPercent)
    .map((h) => ({ name: h.name, pnlPercent: h.pnlPercent }));

  const stockValueData = analysis.holdings.map((h) => ({
    name: h.name,
    invested: h.invested,
    value: h.currentValue,
  }));

  return (
    <section className={styles.section}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        &larr; Back to all sets
      </button>

      <div className={styles.singleSetHeader}>
        <span
          className={styles.singleSetDot}
          style={{ background: setColor }}
        />
        <h2 className={styles.singleSetTitle}>{set.name}</h2>
        <span className={styles.singleSetBadge}>
          {set.symbols.length} stock{set.symbols.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className={styles.statRow}>
        <StatCard
          label="Invested"
          value={formatCurrency(analysis.totalInvested)}
        />
        <StatCard
          label="Current Value"
          value={formatCurrency(analysis.totalCurrentValue)}
          positive={pnl >= 0}
          negative={pnl < 0}
        />
        <StatCard
          label="Total P&L"
          value={formatCurrency(pnl)}
          positive={pnl >= 0}
          negative={pnl < 0}
        />
        <StatCard
          label="P&L %"
          value={formatPct(pnlPct)}
          positive={pnlPct >= 0}
          negative={pnlPct < 0}
        />
        <StatCard
          label="Target per Stock"
          value={formatCurrency(analysis.targetPerStock)}
        />
      </div>

      {/* Stock P&L % comparison */}
      <div className={styles.chartCard}>
        <h2 className={styles.chartTitle}>Stock P&L % Comparison</h2>
        <ResponsiveContainer
          width="100%"
          height={Math.max(200, analysis.holdings.length * 52 + 40)}
        >
          <BarChart
            data={stockPnlData}
            layout="vertical"
            margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0,0,0,0.07)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 12, fill: "#6e6e73" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 13, fill: "#1d1d1f" }}
              width={120}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value: unknown) => [
                `${Number(value).toFixed(2)}%`,
                "P&L %",
              ]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.08)",
                fontSize: 13,
              }}
            />
            <Bar
              dataKey="pnlPercent"
              name="P&L %"
              radius={[0, 4, 4, 0]}
              barSize={28}
            >
              {stockPnlData.map((h) => (
                <Cell
                  key={h.name}
                  fill={h.pnlPercent >= 0 ? "#34c759" : "#ff375f"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Invested vs Value per stock */}
      <div className={styles.chartCard}>
        <h2 className={styles.chartTitle}>Invested vs. Value by Stock</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={stockValueData}
            margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0,0,0,0.07)"
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "#1d1d1f" }}
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
              formatter={(value: unknown, name: unknown) => [
                formatCurrency(Number(value)),
                String(name ?? ""),
              ]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.08)",
                fontSize: 13,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar
              dataKey="invested"
              name="Invested"
              fill="#6e6e73"
              radius={[4, 4, 0, 0]}
              barSize={28}
            />
            <Bar
              dataKey="value"
              name="Value"
              fill={setColor}
              radius={[4, 4, 0, 0]}
              barSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Holdings table */}
      <div className={styles.chartCard}>
        <h2 className={styles.chartTitle}>Holdings Detail</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Stock</th>
                <th>Qty</th>
                <th>Invested</th>
                <th>Value</th>
                <th>P&L</th>
                <th>P&L %</th>
                <th>Target</th>
                <th>Diff</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {analysis.holdings.map((h) => (
                <tr key={h.name}>
                  <td className={styles.stockName}>{h.name}</td>
                  <td>{h.quantity}</td>
                  <td>{formatCurrency(h.invested)}</td>
                  <td>{formatCurrency(h.currentValue)}</td>
                  <td
                    className={
                      h.pnl >= 0 ? styles.positive : styles.negative
                    }
                  >
                    {formatCurrency(h.pnl)}
                  </td>
                  <td
                    className={
                      h.pnlPercent >= 0 ? styles.positive : styles.negative
                    }
                  >
                    {formatPct(h.pnlPercent)}
                  </td>
                  <td>{formatCurrency(h.targetInvestment)}</td>
                  <td
                    className={
                      h.difference >= 0 ? styles.positive : styles.negative
                    }
                  >
                    {h.difference >= 0 ? "+" : ""}
                    {formatCurrency(Math.abs(h.difference))}
                  </td>
                  <td>
                    <span
                      className={`${styles.actionBadge} ${
                        h.action === "BUY"
                          ? styles.actionBUY
                          : h.action === "SELL"
                            ? styles.actionSELL
                            : styles.actionHOLD
                      }`}
                    >
                      {h.action}
                      {h.action !== "HOLD" && (
                        <span className={styles.actionDetail}>
                          &nbsp;{h.shares}
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock detail cards */}
      <div className={styles.cardsGrid}>
        {analysis.holdings.map((h, hi) => (
          <div key={h.name} className={styles.stockCard}>
            <span
              className={styles.detailDot}
              style={{ background: SET_COLORS[hi % SET_COLORS.length] }}
            />
            <p className={styles.detailName}>{h.name}</p>
            <div className={styles.detailStats}>
              <div className={styles.detailStat}>
                <span className={styles.detailStatLabel}>Qty</span>
                <span className={styles.detailStatValue}>{h.quantity}</span>
              </div>
              <div className={styles.detailStat}>
                <span className={styles.detailStatLabel}>Invested</span>
                <span className={styles.detailStatValue}>
                  {formatCurrency(h.invested)}
                </span>
              </div>
              <div className={styles.detailStat}>
                <span className={styles.detailStatLabel}>Value</span>
                <span
                  className={`${styles.detailStatValue} ${h.pnl >= 0 ? styles.positive : styles.negative}`}
                >
                  {formatCurrency(h.currentValue)}
                </span>
              </div>
              <div className={styles.detailStat}>
                <span className={styles.detailStatLabel}>P&L</span>
                <span
                  className={`${styles.detailStatValue} ${h.pnl >= 0 ? styles.positive : styles.negative}`}
                >
                  {formatCurrency(h.pnl)}
                </span>
              </div>
              <div className={styles.detailStat}>
                <span className={styles.detailStatLabel}>P&L %</span>
                <span
                  className={`${styles.detailStatValue} ${h.pnlPercent >= 0 ? styles.positive : styles.negative}`}
                >
                  {formatPct(h.pnlPercent)}
                </span>
              </div>
              <div className={styles.detailStat}>
                <span className={styles.detailStatLabel}>Action</span>
                <span
                  className={`${styles.detailStatValue} ${
                    h.action === "BUY"
                      ? styles.positive
                      : h.action === "SELL"
                        ? styles.negative
                        : ""
                  }`}
                >
                  {h.action}
                  {h.action !== "HOLD" ? ` ${h.shares} shares` : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
