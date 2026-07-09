import { google } from "googleapis";
import { config } from "./config.js";

// One shared, memoised auth client for both Sheets and Drive.
let clients = null;

export function getClients() {
  if (clients) return clients;
  const auth = new google.auth.GoogleAuth({
    keyFile: config.google.credentialsFile,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
  clients = {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
  return clients;
}
