import { google } from "googleapis";
import { env } from "../../env.js";

// One shared, memoised auth client for both Sheets and Drive.
// Created lazily so the API boots fine without Google configured.
let clients: { sheets: ReturnType<typeof google.sheets>; drive: ReturnType<typeof google.drive> } | null = null;

export function getGoogleClients() {
  if (clients) return clients;
  const auth = new google.auth.GoogleAuth({
    keyFile: env.SHOPEE.credentialsFile,
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
