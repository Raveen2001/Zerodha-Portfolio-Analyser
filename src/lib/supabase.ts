import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "Supabase URL or anon key missing. Auth and cloud storage will be disabled."
  );
}

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export const hasSupabase = (): boolean => !!supabase;
