/**
 * The app runs in demo mode until real Supabase credentials are set.
 * Demo mode serves deterministic mock data shaped exactly like the real
 * schema (see supabase/migrations/0001_init.sql), generated from the
 * store/zone/tariff values found in the real audited source spreadsheet —
 * so every page is fully navigable before the Google Sheets sync exists.
 */
export function isDemoMode() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !url || url.includes("placeholder");
}
