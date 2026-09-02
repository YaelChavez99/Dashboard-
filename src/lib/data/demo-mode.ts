/**
 * The app runs in demo mode until a real Cloud SQL connection is set.
 * Demo mode serves deterministic mock data shaped exactly like the real
 * schema (see prisma/schema.prisma), generated from the store/zone/tariff
 * values found in the real audited source spreadsheet — so every page is
 * fully navigable before the database exists.
 */
export function isDemoMode() {
  const url = process.env.DATABASE_URL;
  return !url || url.includes("placeholder");
}
