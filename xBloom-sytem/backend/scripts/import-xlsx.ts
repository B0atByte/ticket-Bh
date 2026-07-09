/**
 * One-off importer: loads the production-style spreadsheet ("xBloom Warranty.xlsx")
 * into the database. Run with tsx (xlsx is a devDependency, so this lives in
 * scripts/ and is excluded from the app build):
 *
 *   DATABASE_URL=mysql://xbloom:pw@localhost:3306/xbloom \
 *   JWT_SECRET=x npx tsx scripts/import-xlsx.ts ["../xBloom Warranty.xlsx"]
 *
 * It REPLACES the contents of users/machines/warranties/tickets/activity_log.
 */
import bcrypt from "bcryptjs";
import xlsx from "xlsx";
import { db, pool } from "../src/db/client.js";
import { activityLog, machines, tickets, users, warranties } from "../src/db/schema.js";
import { normTicketStatus as normStatus, toDate, toDateTime, toPhone, toPostal, toStr as s } from "../src/lib/coerce.js";

const FILE = process.argv[2] ?? "../xBloom Warranty.xlsx";

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

type Row = Record<string, unknown>;
const sheet = (wb: xlsx.WorkBook, name: string): Row[] => {
  const ws = wb.Sheets[name];
  if (!ws) {
    console.warn(`! sheet "${name}" not found — skipping`);
    return [];
  }
  return xlsx.utils.sheet_to_json<Row>(ws, { defval: null });
};

async function main() {
  const wb = xlsx.readFile(FILE);
  console.log(`Reading ${FILE} — sheets: ${wb.SheetNames.join(", ")}`);

  const wRows = sheet(wb, "warranties");
  const tRows = sheet(wb, "tickets");
  const mRows = sheet(wb, "machines");
  const uRows = sheet(wb, "Users");
  const aRows = sheet(wb, "ActivityLog");

  // ── Users (hash PINs; create any technicians referenced by tickets) ──
  const userMap = new Map<string, { name: string; pin: string; role: "admin" | "staff" | "tech" | "customer" }>();
  for (const r of uRows) {
    const name = s(r.Name);
    if (!name) continue;
    const role = (s(r.role) ?? "staff").toLowerCase() as "admin" | "staff" | "tech" | "customer";
    const pin = s(r.PIN) ?? "0000";
    userMap.set(name, { name, pin: await bcrypt.hash(pin, 10), role: ["admin", "staff", "tech", "customer"].includes(role) ? role : "staff" });
  }
  const createdTechs: string[] = [];
  for (const r of tRows) {
    const a = s(r.assignedTo);
    if (a && !userMap.has(a)) {
      // Unknown PIN: random hash so the account can't be logged into until reset.
      userMap.set(a, { name: a, pin: await bcrypt.hash(`import-${a}-${Math.round((25569) * 1)}`, 10), role: "tech" });
      createdTechs.push(a);
    }
  }

  // ── Machines (from sheet + stubs for every referenced serial) ──
  const machineMap = new Map<string, Row>();
  for (const r of mRows) {
    const serial = s(r.serial);
    if (!serial) continue;
    machineMap.set(serial, {
      serial,
      newSerial: s(r.newSerial),
      product: s(r.product),
      customerName: s(r.customerName),
      status: s(r.status),
      notes: s(r.notes),
      updatedAt: toDateTime(r.updatedAt),
      source: s(r.source),
      globalStatus: s(r.globalStatus),
      assetType: ["store", "claim_fixed", "subscription"].includes(String(r.assetType)) ? r.assetType : null,
      subscriptionSource: s(r.subscriptionSource),
      warrantyStart: toDate(r.warrantyStart),
      warrantyEnd: toDate(r.warrantyEnd),
      location: s(r.location),
      noWarranty: r.noWarranty ? 1 : 0,
    });
  }
  for (const r of wRows) {
    const serial = s(r.serial);
    if (serial && !machineMap.has(serial)) {
      machineMap.set(serial, {
        serial,
        product: s(r.product),
        customerName: s(r.name),
        status: "registered",
        source: "warranty",
        warrantyStart: toDate(r.purchaseDate),
        warrantyEnd: toDate(r.expiryDate),
        noWarranty: 0,
      });
    }
  }
  for (const r of tRows) {
    const serial = s(r.serial);
    if (serial && !machineMap.has(serial)) {
      machineMap.set(serial, { serial, status: "from_ticket", source: "ticket", noWarranty: 0 });
    }
  }

  // ── Warranties ──
  const warrantyVals = wRows
    .filter((r) => s(r.serial) && s(r.id))
    .map((r) => ({
      id: s(r.id)!,
      registeredAt: toDateTime(r.registeredAt),
      serial: s(r.serial)!,
      product: s(r.product),
      company: s(r.company),
      purchaseDate: toDate(r.purchaseDate),
      expiryDate: toDate(r.expiryDate),
      name: s(r.name),
      phone: toPhone(r.phone),
      email: s(r.email),
      postal: toPostal(r.postal),
      houseNo: s(r.houseNo),
      building: s(r.building),
      subdistrict: s(r.subdistrict),
      district: s(r.district),
      province: s(r.province),
      address: s(r.address),
      receiptName: s(r.receiptName),
      status: s(r.status) ?? "active",
      receiptDriveUrl: s(r.receiptDriveUrl),
      type: (s(r.type)?.toLowerCase() === "replacement" ? "replacement" : "normal") as "normal" | "replacement",
      replacementOf: s(r.replacementOf),
    }));

  // ── Tickets ──
  const ticketVals = tRows
    .filter((r) => s(r.ticketId) && s(r.serial))
    .map((r) => ({
      ticketId: s(r.ticketId)!,
      createdAt: toDateTime(r.createdAt),
      serial: s(r.serial)!,
      name: s(r.name),
      phone: toPhone(r.phone),
      email: s(r.email),
      lineId: s(r.lineId),
      issueType: s(r.issueType),
      description: s(r.description),
      logUrl: s(r.logUrl),
      videoFilename: s(r.videoFilename),
      videoUrl: s(r.videoUrl),
      repairType: ["warranty", "standard", "repair_claim"].includes(String(r.repairType))
        ? (r.repairType as "warranty" | "standard" | "repair_claim")
        : null,
      status: normStatus(r.status),
      assignedTo: s(r.assignedTo),
      staffNote: s(r.staffNote),
      techNote: s(r.techNote),
      updatedAt: toDateTime(r.updatedAt),
      approvedBy: s(r.approvedBy),
      trackingLink: s(r.trackingLink),
      warrantyCase: r.warrantyCase ? 1 : 0,
      globalClaimStatus: s(r.globalClaimStatus),
      gcOldMachine: s(r.gcOldMachine),
      gcNewMachine: s(r.gcNewMachine),
      gcLot: s(r.gcLot),
      globalClaimNote: s(r.globalClaimNote),
      videoProof: s(r.videoProof),
    }));

  // Dedupe on PK — the source has occasional double submissions (same id).
  const uniqBy = <T>(arr: T[], key: (t: T) => string): T[] => {
    const m = new Map<string, T>();
    for (const x of arr) m.set(key(x), x); // later row wins (most recent)
    return [...m.values()];
  };
  const warrantyU = uniqBy(warrantyVals, (w) => w.id);
  const ticketU = uniqBy(ticketVals, (t) => t.ticketId);

  // ── Activity log ──
  const activityVals = aRows.map((r) => ({
    timestamp: toDateTime(r.timestamp),
    userName: s(r.userName),
    userRole: s(r.userRole),
    action: s(r.action),
    target: s(r.target),
    detail: s(r.detail),
  }));

  // ── Write (replace) in FK-safe order ──
  console.log("Clearing existing data…");
  await db.delete(activityLog);
  await db.delete(tickets);
  await db.delete(warranties);
  await db.delete(machines);
  await db.delete(users);

  const userVals = [...userMap.values()];
  for (const c of chunk(userVals, 200)) await db.insert(users).values(c);
  for (const c of chunk([...machineMap.values()] as (typeof machines.$inferInsert)[], 200)) await db.insert(machines).values(c);
  for (const c of chunk(warrantyU, 100)) await db.insert(warranties).values(c);
  for (const c of chunk(ticketU, 100)) await db.insert(tickets).values(c);
  for (const c of chunk(activityVals, 200)) await db.insert(activityLog).values(c);

  console.log("\n✓ import complete");
  console.log(`  users:        ${userVals.length} (created technicians: ${createdTechs.length}${createdTechs.length ? " → " + createdTechs.join(", ") : ""})`);
  console.log(`  machines:     ${machineMap.size} (sheet ${mRows.length} + stubs)`);
  console.log(`  warranties:   ${warrantyU.length} (from ${warrantyVals.length} rows)`);
  console.log(`  tickets:      ${ticketU.length} (from ${ticketVals.length} rows)`);
  console.log(`  activity_log: ${activityVals.length}`);
  if (createdTechs.length) console.log("  NOTE: imported technician accounts have random PINs — admin must reset them.");

  await pool.end();
}

main().catch(async (err) => {
  console.error("✗ import failed:", err);
  await pool.end();
  process.exit(1);
});
