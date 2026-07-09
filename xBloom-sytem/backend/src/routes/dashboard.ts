import { and, desc, eq, like, ne, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.js";
import { activityLog, tickets, warranties } from "../db/schema.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { today } from "../lib/http.js";
import type { AppEnv } from "../types.js";

const IN_PROGRESS = ["diagnose", "quote", "approved", "repairing", "repair_done", "returned"];

async function countTickets(where: SQL | undefined) {
  const [{ n }] = await db.select({ n: sql<number>`COUNT(*)` }).from(tickets).where(where);
  return Number(n);
}

export const dashboardRoutes = new Hono<AppEnv>();
dashboardRoutes.use("*", requireAuth);
dashboardRoutes.use("*", requireStaff);

dashboardRoutes.get("/summary", async (c) => {
  const [needsAction, inProgress, closedToday, totalOpen, expiringSoon] = await Promise.all([
    countTickets(eq(tickets.status, "new")),
    countTickets(sql`${tickets.status} IN (${sql.join(IN_PROGRESS.map((s) => sql`${s}`), sql`, `)})`),
    countTickets(and(eq(tickets.status, "closed"), like(tickets.updatedAt, `${today()}%`))),
    countTickets(ne(tickets.status, "closed")),
    // Warranties expiring within 30 days (used by the Phase 5 alert too).
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(warranties)
      .where(
        and(
          sql`${warranties.expiryDate} >= ${today()}`,
          sql`${warranties.expiryDate} <= DATE_ADD(${today()}, INTERVAL 30 DAY)`,
        ),
      )
      .then((r) => Number(r[0].n)),
  ]);

  return c.json({ needsAction, inProgress, closedToday, totalOpen, expiringSoon });
});

// ── Activities that happened today (for the Today tab) ──
dashboardRoutes.get("/activity", async (c) => {
  const rows = await db
    .select({
      id: activityLog.id,
      timestamp: activityLog.timestamp,
      userName: activityLog.userName,
      userRole: activityLog.userRole,
      action: activityLog.action,
      target: activityLog.target,
      detail: activityLog.detail,
    })
    .from(activityLog)
    .where(like(activityLog.timestamp, `${today()}%`))
    .orderBy(desc(activityLog.timestamp))
    .limit(100);
  return c.json({ data: rows, count: rows.length });
});

// ── SLA / operations report ─────────────────────────────
const num = (v: unknown) => Number(v ?? 0);

dashboardRoutes.get("/reports", async (c) => {
  const slaDays = Math.min(Math.max(Number(c.req.query("slaDays") ?? 7), 1), 90);
  const slaHours = slaDays * 24;
  const open = ne(tickets.status, "closed");
  const closed = eq(tickets.status, "closed");
  const d = sql`DATEDIFF(${today()}, ${tickets.createdAt})`; // age in days

  const [byStatus, byType, openRow, resRow, monthCreated, monthClosed, expRow, breached] = await Promise.all([
    db.select({ status: tickets.status, n: sql<number>`COUNT(*)` }).from(tickets).groupBy(tickets.status),
    db.select({ type: tickets.repairType, n: sql<number>`COUNT(*)` }).from(tickets).groupBy(tickets.repairType),
    db
      .select({
        total: sql<number>`COUNT(*)`,
        fresh: sql<number>`SUM(${d} <= 3)`,
        week: sql<number>`SUM(${d} BETWEEN 4 AND 7)`,
        twoWeek: sql<number>`SUM(${d} BETWEEN 8 AND 14)`,
        stale: sql<number>`SUM(${d} > 14)`,
      })
      .from(tickets)
      .where(open),
    db
      .select({
        closedCount: sql<number>`COUNT(*)`,
        avgHours: sql<number>`AVG(TIMESTAMPDIFF(HOUR, ${tickets.createdAt}, ${tickets.updatedAt}))`,
        onTime: sql<number>`SUM(TIMESTAMPDIFF(HOUR, ${tickets.createdAt}, ${tickets.updatedAt}) <= ${slaHours})`,
      })
      .from(tickets)
      .where(closed),
    db
      .select({ ym: sql<string>`DATE_FORMAT(${tickets.createdAt}, '%Y-%m')`, n: sql<number>`COUNT(*)` })
      .from(tickets)
      .where(sql`${tickets.createdAt} >= DATE_SUB(${today()}, INTERVAL 6 MONTH)`)
      .groupBy(sql`DATE_FORMAT(${tickets.createdAt}, '%Y-%m')`),
    db
      .select({ ym: sql<string>`DATE_FORMAT(${tickets.updatedAt}, '%Y-%m')`, n: sql<number>`COUNT(*)` })
      .from(tickets)
      .where(and(closed, sql`${tickets.updatedAt} >= DATE_SUB(${today()}, INTERVAL 6 MONTH)`))
      .groupBy(sql`DATE_FORMAT(${tickets.updatedAt}, '%Y-%m')`),
    db
      .select({
        d30: sql<number>`SUM(${warranties.expiryDate} >= ${today()} AND ${warranties.expiryDate} <= DATE_ADD(${today()}, INTERVAL 30 DAY))`,
        d60: sql<number>`SUM(${warranties.expiryDate} >= ${today()} AND ${warranties.expiryDate} <= DATE_ADD(${today()}, INTERVAL 60 DAY))`,
        d90: sql<number>`SUM(${warranties.expiryDate} >= ${today()} AND ${warranties.expiryDate} <= DATE_ADD(${today()}, INTERVAL 90 DAY))`,
      })
      .from(warranties),
    countTickets(and(open, sql`${d} > ${slaDays}`)),
  ]);

  // Build the last 6 month buckets (oldest→newest) and merge created/closed counts.
  const createdMap = new Map(monthCreated.map((r) => [r.ym, num(r.n)]));
  const closedMap = new Map(monthClosed.map((r) => [r.ym, num(r.n)]));
  const now = new Date(`${today()}T00:00:00`);
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const dt = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    return { ym, created: createdMap.get(ym) ?? 0, closed: closedMap.get(ym) ?? 0 };
  });

  const avgHours = resRow[0]?.avgHours == null ? null : Math.round(num(resRow[0].avgHours));
  const closedCount = num(resRow[0]?.closedCount);
  const onTime = num(resRow[0]?.onTime);

  return c.json({
    slaDays,
    resolution: { closedCount, avgHours, avgDays: avgHours == null ? null : Math.round((avgHours / 24) * 10) / 10 },
    sla: { closedCount, onTime, breached, onTimeRate: closedCount ? Math.round((onTime / closedCount) * 100) : null },
    open: {
      total: num(openRow[0]?.total),
      fresh: num(openRow[0]?.fresh),
      week: num(openRow[0]?.week),
      twoWeek: num(openRow[0]?.twoWeek),
      stale: num(openRow[0]?.stale),
    },
    byStatus: byStatus.map((r) => ({ status: r.status ?? "—", n: num(r.n) })),
    byType: byType.map((r) => ({ type: r.type ?? "—", n: num(r.n) })),
    monthly,
    expiring: { d30: num(expRow[0]?.d30), d60: num(expRow[0]?.d60), d90: num(expRow[0]?.d90) },
  });
});

// Warranties expiring within `days` (default 30) — powers the dashboard alert.
dashboardRoutes.get("/expiring", async (c) => {
  const days = Math.min(Math.max(Number(c.req.query("days") ?? 30), 1), 365);
  const rows = await db
    .select({
      serial: warranties.serial,
      product: warranties.product,
      name: warranties.name,
      phone: warranties.phone,
      expiryDate: warranties.expiryDate,
    })
    .from(warranties)
    .where(
      and(
        sql`${warranties.expiryDate} >= ${today()}`,
        sql`${warranties.expiryDate} <= DATE_ADD(${today()}, INTERVAL ${sql.raw(String(days))} DAY)`,
      ),
    )
    .orderBy(warranties.expiryDate);
  return c.json({ data: rows, count: rows.length, days });
});
