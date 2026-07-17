// Links to the other 4 systems, shown from a "quick access" menu in the
// topbar. URLs default to local dev ports; override per environment via
// these env vars (same names/defaults are used identically across all 5
// systems' own quick-access config, so this file is easy to diff/copy).
export interface SystemLink {
  key: string;
  label: string;
  url: string;
}

const ALL_SYSTEMS: SystemLink[] = [
  { key: "bhlogistics", label: "Bhlogisticssystem (ขนส่ง)", url: import.meta.env.VITE_URL_BHLOGISTICS || "http://localhost:5173" },
  { key: "prsystem", label: "PRsystem (ขอซื้อ)", url: import.meta.env.VITE_URL_PRSYSTEM || "http://localhost:5174" },
  { key: "lmscasa", label: "lms-casa (เทรน/สอบ)", url: import.meta.env.VITE_URL_LMSCASA || "http://localhost:5175" },
  { key: "xbloom", label: "xBloom-sytem (ประกัน)", url: import.meta.env.VITE_URL_XBLOOM || "http://localhost:5176" },
  { key: "qsc", label: "QSC-Sytem (ตรวจสาขา)", url: import.meta.env.VITE_URL_QSC || "http://localhost:8083" },
];

export function otherSystems(selfKey: string): SystemLink[] {
  return ALL_SYSTEMS.filter((s) => s.key !== selfKey);
}
