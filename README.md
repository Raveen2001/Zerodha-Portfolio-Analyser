# Zerodha Portfolio Analyzer

Analyze your Zerodha holdings and balance your investment sets. Upload a Zerodha holdings CSV, define sets of stocks, and see BUY/SELL/HOLD suggestions to balance each set to a target per stock.

## Features

- **Login options**: Sign in / sign up with email, Continue with Google, continue without login (local storage), or try demo with sample data
- **Portfolio upload**: Drag-and-drop or click to upload Zerodha holdings CSV (Instrument, Qty., Invested, Cur. val, Avg. cost)
- **SET management**: Create, edit, and delete sets; add/remove stocks per set
- **Responsive**: Works on desktop and mobile

## Setup

### Install and run (no backend)

```bash
npm install
npm run dev
```

Open http://localhost:5173. Use **Continue without login** or **Try demo**; data is stored in the browser (localStorage or sessionStorage).

### Optional: Supabase backend

1. Create a project at [supabase.com](https://supabase.com).
2. In Authentication → Providers, enable **Email** and **Google** (configure OAuth in Google Cloud Console for Google).
3. Link the project and push migrations:
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```
   Or run the SQL in `supabase/migrations/20240212000000_create_portfolio_tables.sql` manually in the Supabase SQL Editor.
4. Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL` – project URL
   - `VITE_SUPABASE_ANON_KEY` – anon/public key

Then run `npm run dev`. Sign in with email or **Continue with Google** to sync portfolio and sets to Supabase.

### Build for production

```bash
npm run build
```

Output is in `dist/`. Serve with any static host (e.g. GitHub Pages, Netlify).

## CSV format

Zerodha holdings export should include columns: **Instrument**, **Qty.**, **Invested**, **Cur. val**, **Avg. cost**.

## Tech stack

- React 18, TypeScript, Vite
- React Router, Framer Motion (minimal)
- Supabase (Auth + Postgres, optional)
- PapaParse for CSV
