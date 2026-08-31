import { google } from "googleapis";

/**
 * Server-only. Requires a Google Cloud service account that has been
 * shared as Viewer on the source spreadsheet (see .env.example and
 * docs/data-audit.md). Never import this from client components.
 */
function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY missing — see .env.example."
    );
  }

  return new google.auth.JWT({
    email,
    // Vercel/most env var UIs escape newlines as literal \n.
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

/**
 * Fetches a single range as raw rows (row 0 is expected to be the header).
 * `range` uses standard A1 notation, e.g. "Usuarios!A1:C2000".
 */
export async function getSheetValues(range: string): Promise<string[][]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID missing — see .env.example.");
  }

  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  return (res.data.values as string[][] | undefined) ?? [];
}
