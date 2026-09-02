import { db } from "@/lib/db";
import { isDemoMode } from "./demo-mode";
import type { SyncLog } from "@/types/database";

export async function getRecentSyncLogs(limit = 20): Promise<SyncLog[]> {
  if (isDemoMode()) return [];

  const logs = await db.syncLog.findMany({
    select: {
      id: true,
      source_sheet: true,
      started_at: true,
      finished_at: true,
      status: true,
      records_read: true,
      records_inserted: true,
      records_updated: true,
      errors_count: true,
    },
    orderBy: { started_at: "desc" },
    take: limit,
  });

  return logs.map((l) => ({
    ...l,
    started_at: l.started_at.toISOString(),
    finished_at: l.finished_at?.toISOString() ?? null,
    status: l.status as SyncLog["status"],
  }));
}
