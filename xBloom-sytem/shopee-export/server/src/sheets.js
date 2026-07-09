import { config, SHEET_HEADER } from "./config.js";
import { getClients } from "./google.js";
import { withRetry } from "./retry.js";
import { log } from "./logger.js";

const { sheetId, sheetTab } = config.google;

/** Ensure the target tab exists and has a header row. Safe to call repeatedly. */
export async function ensureSheetReady() {
  const { sheets } = getClients();

  // 1) Make sure the tab exists.
  const meta = await withRetry(() => sheets.spreadsheets.get({ spreadsheetId: sheetId }), {
    label: "sheets.get",
  });
  const exists = (meta.data.sheets || []).some((s) => s.properties?.title === sheetTab);
  if (!exists) {
    await withRetry(
      () =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: { requests: [{ addSheet: { properties: { title: sheetTab } } }] },
        }),
      { label: "sheets.addSheet" },
    );
    log.info(`created tab "${sheetTab}"`);
  }

  // 2) Make sure row 1 is the header.
  const head = await withRetry(
    () => sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${sheetTab}!A1:L1` }),
    { label: "sheets.getHeader" },
  );
  if (!head.data.values || head.data.values.length === 0) {
    await withRetry(
      () =>
        sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${sheetTab}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: [SHEET_HEADER] },
        }),
      { label: "sheets.writeHeader" },
    );
    log.info("wrote header row");
  }
}

/** Look up an order number in column A. Returns true if already present. */
export async function orderExists(orderNo) {
  const { sheets } = getClients();
  const res = await withRetry(
    () => sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${sheetTab}!A2:A` }),
    { label: "sheets.findOrder" },
  );
  const rows = res.data.values || [];
  return rows.some((r) => (r[0] || "").trim() === orderNo.trim());
}

/** Append a single row (array of cell values in SHEET_HEADER order). */
export async function appendRow(values) {
  const { sheets } = getClients();
  await withRetry(
    () =>
      sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetTab}!A:L`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [values] },
      }),
    { label: "sheets.append" },
  );
}
