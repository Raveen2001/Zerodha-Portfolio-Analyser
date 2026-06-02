import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface RequestBody {
  symbol: string;
  period1: number; // unix seconds
  period2: number; // unix seconds
}

interface YahooQuote {
  date: string; // YYYY-MM-DD
  close: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { symbol, period1, period2 } = body;
  if (!symbol || typeof period1 !== "number" || typeof period2 !== "number") {
    return new Response(
      JSON.stringify({ error: "Missing required fields: symbol, period1, period2" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const yahooUrl =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=history`;

  let yahooRes: Response;
  try {
    yahooRes = await fetch(yahooUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Failed to reach Yahoo Finance", detail: String(e) }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  if (!yahooRes.ok) {
    return new Response(
      JSON.stringify({ error: `Yahoo Finance returned ${yahooRes.status}` }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // deno-lint-ignore no-explicit-any
  let yahooData: any;
  try {
    yahooData = await yahooRes.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Could not parse Yahoo Finance response" }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const result = yahooData?.chart?.result?.[0];
  if (!result) {
    return new Response(
      JSON.stringify({ error: "No data returned for symbol", symbol }),
      { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  const quotes: YahooQuote[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null || isNaN(close)) continue;
    const d = new Date(timestamps[i] * 1000);
    const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD
    quotes.push({ date: dateStr, close: Number(close.toFixed(4)) });
  }

  // Deduplicate by date (keep last) and sort
  const byDate = new Map<string, number>();
  for (const q of quotes) byDate.set(q.date, q.close);
  const sortedQuotes: YahooQuote[] = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, close]) => ({ date, close }));

  return new Response(
    JSON.stringify({ symbol, quotes: sortedQuotes }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});
