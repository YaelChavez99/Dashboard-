import { BigQuery } from "@google-cloud/bigquery";

/**
 * Server-only. Reuses the same Google service account as the Sheets sync
 * (GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY) — grant it "BigQuery Data
 * Viewer" + "BigQuery Job User" on the project to use this. See
 * .env.example and docs/data-audit.md.
 */
function getClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const projectId = process.env.BIGQUERY_PROJECT_ID;

  if (!email || !key || !projectId) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY / BIGQUERY_PROJECT_ID missing — see .env.example."
    );
  }

  return new BigQuery({
    projectId,
    credentials: {
      client_email: email,
      private_key: key.replace(/\\n/g, "\n"),
    },
  });
}

export async function queryBigQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const client = getClient();
  const [rows] = await client.query({ query: sql });
  return rows as T[];
}
