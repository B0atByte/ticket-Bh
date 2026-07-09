import { randomUUID } from "node:crypto";
import { db, pool } from "./client.js";
import { hashPin } from "../lib/auth.js";
import { activityLog, machines, products, tickets, users, warranties } from "./schema.js";

/**
 * Idempotent dev seed: clears the tables (FK-safe order) then inserts samples.
 * PINs are bcrypt-hashed. Dev login PINs: Admin=0001, Staff=0002, Tech=0003.
 */
async function main() {
  // Clear children before parents to satisfy foreign keys.
  await db.delete(activityLog);
  await db.delete(tickets);
  await db.delete(warranties);
  await db.delete(products);
  await db.delete(machines);
  await db.delete(users);

  await db.insert(users).values([
    { name: "Admin", pin: await hashPin("0001"), role: "admin" },
    { name: "Staff", pin: await hashPin("0002"), role: "staff" },
    { name: "Tech", pin: await hashPin("0003"), role: "tech" },
  ]);

  await db.insert(machines).values([
    {
      serial: "XB-0001",
      product: "xBloom Studio",
      customerName: "สมชาย ใจดี",
      status: "active",
      source: "store",
      assetType: "store" as const,
      warrantyStart: "2025-01-10",
      warrantyEnd: "2026-01-10",
      location: "Bangkok",
      noWarranty: 0,
    },
    {
      serial: "XB-0002",
      product: "xBloom Studio",
      customerName: "Jane Doe",
      status: "active",
      source: "subscription",
      assetType: "subscription" as const,
      subscriptionSource: "Monthly Plan",
      warrantyStart: "2025-03-01",
      warrantyEnd: "2026-03-01",
      location: "Chiang Mai",
      noWarranty: 0,
    },
    {
      serial: "XB-0003",
      product: "xBloom Studio",
      customerName: "เครื่องสต๊อก",
      status: "in_stock",
      source: "claim",
      assetType: "claim_fixed" as const,
      noWarranty: 1,
    },
  ]);

  await db.insert(warranties).values([
    {
      id: randomUUID(),
      serial: "XB-0001",
      product: "xBloom Studio",
      company: "xBloom",
      purchaseDate: "2025-01-10",
      expiryDate: "2026-01-10",
      name: "สมชาย ใจดี",
      phone: "0812345678",
      email: "somchai@example.com",
      postal: "10110",
      houseNo: "12/3",
      subdistrict: "คลองเตย",
      district: "คลองเตย",
      province: "กรุงเทพมหานคร",
      status: "active",
      type: "normal" as const,
    },
    {
      id: randomUUID(),
      serial: "XB-0002",
      product: "xBloom Studio",
      company: "xBloom",
      purchaseDate: "2025-03-01",
      expiryDate: "2026-03-01",
      name: "Jane Doe",
      phone: "0890001122",
      email: "jane@example.com",
      postal: "50000",
      houseNo: "99",
      subdistrict: "Suthep",
      district: "Muang",
      province: "Chiang Mai",
      status: "active",
      type: "normal" as const,
    },
  ]);

  await db.insert(tickets).values([
    {
      ticketId: "TK-20250601-0001",
      serial: "XB-0001",
      name: "สมชาย ใจดี",
      phone: "0812345678",
      email: "somchai@example.com",
      lineId: "somchai_line",
      issueType: "ไม่จ่ายน้ำ",
      description: "เครื่องเปิดติดแต่ไม่จ่ายน้ำ",
      repairType: "warranty" as const,
      status: "new",
      warrantyCase: 1,
    },
    {
      ticketId: "TK-20250602-0002",
      serial: "XB-0002",
      name: "Jane Doe",
      phone: "0890001122",
      email: "jane@example.com",
      issueType: "เสียงดังผิดปกติ",
      description: "Loud grinding noise during brew",
      repairType: "standard" as const,
      status: "diagnose",
      assignedTo: "Tech",
      warrantyCase: 0,
    },
  ]);

  await db.insert(products).values([
    { name: "xBloom Studio", code: "XB-STUDIO", active: 1 },
    { name: "xBloom Studio Pro", code: "XB-STUDIO-PRO", active: 1 },
  ]);

  await db.insert(activityLog).values([
    {
      userName: "Admin",
      userRole: "admin",
      action: "seed",
      target: "system",
      detail: "Initial sample data seeded",
    },
  ]);

  console.log("✓ seed complete");
  await pool.end();
}

main().catch(async (err) => {
  console.error("✗ seed failed:", err);
  await pool.end();
  process.exit(1);
});
