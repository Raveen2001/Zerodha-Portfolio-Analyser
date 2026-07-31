import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { KiteConnect } from "npm:kiteconnect@5.3.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-client-info",
};

interface RequestBody {
  user_id: string;
  api_key: string;
  access_token: string;
}

interface Holding {
  name: string;
  quantity: number;
  invested: number;
  currentValue: number;
  avgCost: number;
  type?: "equity" | "mutual_fund";
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceRoleKey || !supabaseUrl) {
    return json(500, {
      error: "Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const providedToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (providedToken !== serviceRoleKey) {
    return json(401, { error: "Unauthorized" });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { user_id, api_key, access_token } = body ?? ({} as RequestBody);
  if (!user_id || !api_key || !access_token) {
    return json(400, {
      error: "Missing required fields: user_id, api_key, access_token",
    });
  }

  const kc = new KiteConnect({ api_key });
  kc.setAccessToken(access_token);

  // deno-lint-ignore no-explicit-any
  let rawHoldings: any[];
  try {
    rawHoldings = await kc.getHoldings();
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const err = e as any;
    return json(502, {
      error: "Kite Connect getHoldings failed",
      detail: err?.message ?? String(e),
    });
  }

  // deno-lint-ignore no-explicit-any
  let rawMFHoldings: any[] = [];
  try {
    const mfResult = await kc.getMFHoldings();
    rawMFHoldings = Array.isArray(mfResult) ? mfResult : mfResult?.data ?? [];
    console.log("[MF] getMFHoldings rawMFHoldings length:", rawMFHoldings.length);
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const err = e as any;
    return json(502, {
      error: "Kite Connect getMFHoldings failed",
      detail: err?.message ?? String(e),
    });
  }

  const holdings: Record<string, Holding> = {};
  for (const h of rawHoldings ?? []) {
    const symbol = String(h.tradingsymbol ?? "")
      .trim()
      .toUpperCase();
    // t1_quantity holds shares bought but not yet settled into demat.
    const quantity = (Number(h.quantity) || 0) + (Number(h.t1_quantity) || 0);
    const avgCost = Number(h.average_price) || 0;
    const lastPrice = Number(h.last_price) || 0;
    const invested = quantity * avgCost;
    if (!symbol || invested <= 0) continue;
    holdings[symbol] = {
      name: symbol,
      quantity,
      invested: Number(invested.toFixed(2)),
      currentValue: Number((quantity * lastPrice).toFixed(2)),
      avgCost: Number(avgCost.toFixed(4)),
      type: "equity",
    };
  }

  // Parse MF holdings into intermediate entries; NAV is resolved from mfapi below.
  interface MFEntry {
    key: string;
    isin: string;
    name: string;
    quantity: number;
    avgCost: number;
    invested: number;
  }
  const mfEntries: MFEntry[] = [];
  for (const mf of rawMFHoldings ?? []) {
    const isin = String(mf.tradingsymbol ?? "")
      .trim()
      .toUpperCase();
    const fundName = String(mf.fund ?? "").trim();
    const key = isin || fundName.toUpperCase();
    const quantity = Number(mf.quantity) || 0;
    const avgCost = Number(mf.average_price) || 0;
    const kiteLastPrice = Number(mf.last_price) || 0;
    const pnl = Number(mf.pnl) || 0;
    // average_price can be 0 for units transferred in from outside Zerodha;
    // recover invested from Kite's current value minus P&L in that case.
    let invested = quantity * avgCost;
    if (invested <= 0) invested = quantity * kiteLastPrice - pnl;
    if (!key || quantity <= 0 || invested <= 0) continue;
    mfEntries.push({
      key,
      isin,
      name: fundName || key,
      quantity,
      avgCost,
      invested,
    });
  }

  console.log("[MF] parsed mfEntries count:", mfEntries.length,
    "isins:", mfEntries.map((e) => e.isin));

  if (mfEntries.length > 0) {
    // Every MF holding must carry an ISIN so we can map it to an mfapi scheme.
    const missingIsin = mfEntries.filter((e) => !e.isin).map((e) => e.name);
    if (missingIsin.length > 0) {
      return json(422, {
        error: "Mutual fund holding has no ISIN",
        detail: missingIsin,
      });
    }

    // Connect to the separate project that holds the ISIN -> mfapi scheme_code map.
    const mfmapUrl = Deno.env.get("ATLAS_SUPABASE_URL");
    const mfmapKey = Deno.env.get("ATLAS_SUPABASE_KEY");
    if (!mfmapUrl || !mfmapKey) {
      return json(500, {
        error: "Server missing ATLAS_SUPABASE_URL or ATLAS_SUPABASE_KEY",
      });
    }
    const mfmapClient = createClient(mfmapUrl, mfmapKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const isins = [...new Set(mfEntries.map((e) => e.isin))];
    const { data: mapRows, error: mapError } = await mfmapClient
      .from("mf_scheme_map")
      .select("isin, scheme_code")
      .in("isin", isins);
    if (mapError) {
      return json(500, {
        error: "Failed to query mf_scheme_map",
        detail: mapError.message,
      });
    }

    console.log("[MF] mf_scheme_map rows returned:", (mapRows ?? []).length,
      "for isins queried:", isins.length);

    const schemeByIsin = new Map<string, string>();
    for (const row of mapRows ?? []) {
      const rowIsin = String(row.isin ?? "")
        .trim()
        .toUpperCase();
      const scheme = String(row.scheme_code ?? "").trim();
      if (rowIsin && scheme) schemeByIsin.set(rowIsin, scheme);
    }

    const unmapped = isins.filter((i) => !schemeByIsin.has(i));
    console.log("[MF] mapped:", schemeByIsin.size, "unmapped:", unmapped);
    if (unmapped.length > 0) {
      return json(422, {
        error: "Missing mfapi scheme mapping for ISIN(s)",
        detail: unmapped,
      });
    }

    // Fetch the latest NAV for each unique scheme from mfapi.in.
    const uniqueSchemes = [...new Set(schemeByIsin.values())];
    const navResults = await Promise.all(
      uniqueSchemes.map(async (scheme) => {
        try {
          const res = await fetch(`https://api.mfapi.in/mf/${scheme}/latest`);
          if (!res.ok) return { scheme, nav: NaN, error: `HTTP ${res.status}` };
          const payload = await res.json();
          const nav = Number(payload?.data?.[0]?.nav);
          return { scheme, nav, error: null as string | null };
        } catch (e) {
          return { scheme, nav: NaN, error: (e as Error).message };
        }
      }),
    );

    const navByScheme = new Map<string, number>();
    const navErrors: { scheme: string; error: string }[] = [];
    for (const r of navResults) {
      if (r.error || !Number.isFinite(r.nav) || r.nav <= 0) {
        navErrors.push({ scheme: r.scheme, error: r.error ?? "Invalid NAV" });
      } else {
        navByScheme.set(r.scheme, r.nav);
      }
    }
    console.log("[MF] nav fetched ok:", navByScheme.size, "nav errors:", navErrors);
    if (navErrors.length > 0) {
      return json(502, {
        error: "Failed to fetch latest NAV from mfapi",
        detail: navErrors,
      });
    }

    console.log("[MF] adding", mfEntries.length, "mutual funds to holdings");
    for (const e of mfEntries) {
      const nav = navByScheme.get(schemeByIsin.get(e.isin)!)!;
      holdings[e.key] = {
        name: e.name,
        quantity: e.quantity,
        invested: Number(e.invested.toFixed(2)),
        currentValue: Number((e.quantity * nav).toFixed(2)),
        avgCost: Number(e.avgCost.toFixed(4)),
        type: "mutual_fund",
      };
    }
  }

  const allHoldings = Object.values(holdings);
  console.log("[MF] final holdings total:", allHoldings.length,
    "equity:", allHoldings.filter((h) => h.type === "equity").length,
    "mutual_fund:", allHoldings.filter((h) => h.type === "mutual_fund").length);

  if (Object.keys(holdings).length === 0) {
    return json(404, { error: "No valid holdings returned from Kite" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inserted, error: insertError } = await supabase
    .from("portfolio_snapshots")
    .insert({ user_id, holdings })
    .select("id, uploaded_at")
    .single();

  if (insertError) {
    return json(500, {
      error: "Failed to insert snapshot",
      detail: insertError.message,
    });
  }

  return json(200, {
    snapshot_id: inserted.id,
    uploaded_at: inserted.uploaded_at,
    holdings_count: Object.keys(holdings).length,
  });
});
