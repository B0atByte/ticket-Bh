import { env } from "../../env.js";
import { getGoogleClients } from "./google.js";
import { withRetry } from "./retry.js";

// Column order written to the sheet (and its header row).
export const SHEET_HEADER = [
  "Order No",
  "Order Date",
  "Buyer",
  "Tracking No",
  "Courier",
  "Product Name",
  "Qty",
  "Sale Price",
  "Net Income",
  "Address",
  "Screenshot",
  "Saved At",
];

const tab = () => env.SHOPEE.sheetTab;
const sheetId = () => env.SHOPEE.sheetId;

/** Ensure the target tab exists and has a header row. Safe to call repeatedly. */
export async function ensureSheetReady(): Promise<void> {
  const { sheets } = getGoogleClients();
  const spreadsheetId = sheetId();
  const sheetTab = tab();

  const meta = await withRetry(() => sheets.spreadsheets.get({ spreadsheetId }), { label: "sheets.get" });
  const exists = (meta.data.sheets || []).some((s) => s.properties?.title === sheetTab);
  if (!exists) {
    await withRetry(
      () =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ addSheet: { properties: { title: sheetTab } } }] },
        }),
      { label: "sheets.addSheet" },
    );
  }

  const head = await withRetry(
    () => sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetTab}!A1:L1` }),
    { label: "sheets.getHeader" },
  );
  if (!head.data.values || head.data.values.length === 0) {
    await withRetry(
      () =>
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetTab}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: [SHEET_HEADER] },
        }),
      { label: "sheets.writeHeader" },
    );
  }
}

/** Append a single row (array of cell values in SHEET_HEADER order). */
export async function appendRow(values: (string | number)[]): Promise<void> {
  const { sheets } = getGoogleClients();
  await withRetry(
    () =>
      sheets.spreadsheets.values.append({
        spreadsheetId: sheetId(),
        range: `${tab()}!A:L`,
        // RAW (not USER_ENTERED): order data is untrusted (public extension
        // endpoint), so never let a cell like =IMPORTRANGE(...) become a formula.
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [values] },
      }),
    { label: "sheets.append" },
  );
}

/** A shareable link to the spreadsheet, for the staff UI status panel. */
export function sheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId()}/edit`;
}
