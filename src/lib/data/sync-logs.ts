import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "./demo-mode";
import type { SyncLog } from "@/types/database";

export async function getRecentSyncLogs(limit = 20): Promise<SyncLog[]> {
  if (isDemoMode()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("sync_logs")
    .select("id, source_sheet, started_at, finished_at, status, records_read, records_inserted, records_updated, errors_count")
    .order("started_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}
