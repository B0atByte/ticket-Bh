import "dotenv/config";

/** Fail-fast config. Required values throw at startup, not deep in a request. */
function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required environment variable: ${name}`);
  return v.trim();
}

export const config = {
  port: Number(process.env.PORT || 8787),
  apiKey: (process.env.API_KEY || "").trim(),

  google: {
    credentialsFile: required("GOOGLE_APPLICATION_CREDENTIALS"),
    sheetId: required("SHEET_ID"),
    sheetTab: (process.env.SHEET_TAB || "Orders").trim(),
    driveFolderId: (process.env.DRIVE_FOLDER_ID || "").trim(),
  },
};

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
