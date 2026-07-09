import nodemailer from "nodemailer";

// Email is optional: configure SMTP_* to enable. If unset, sends are skipped
// (logged) so the app works without email in dev.
const HOST = process.env.SMTP_HOST;
const USER = process.env.SMTP_USER;
const PASS = process.env.SMTP_PASS;
const PORT = Number(process.env.SMTP_PORT ?? 587);
const FROM = process.env.MAIL_FROM || (USER ? `xBloom Thailand <${USER}>` : "xBloom <no-reply@xbloom>");

const transporter =
  HOST && USER && PASS
    ? nodemailer.createTransport({ host: HOST, port: PORT, secure: PORT === 465, auth: { user: USER, pass: PASS } })
    : null;

export const mailEnabled = !!transporter;

/** Fire-and-forget email. Never throws into the request path. */
export async function sendMail(to: string | null | undefined, subject: string, html: string): Promise<void> {
  if (!to) return;
  if (!transporter) {
    console.log(`[mail] not configured — skipped "${subject}" → ${to}`);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`[mail] sent "${subject}" → ${to}`);
  } catch (e) {
    console.error("[mail] send failed:", e);
  }
}

const shell = (title: string, bodyHtml: string) => `
  <div style="font-family:Segoe UI,Tahoma,sans-serif;max-width:560px;margin:0 auto;color:#16181d">
    <div style="border-bottom:2px solid #0d4d43;padding:16px 0;font-weight:700;font-size:18px">
      xBloom <span style="color:#e7522b">·</span> Thailand
    </div>
    <h2 style="font-size:18px;margin:20px 0 8px">${title}</h2>
    ${bodyHtml}
    <p style="color:#8b9099;font-size:12px;border-top:1px solid #e4e6e9;margin-top:24px;padding-top:12px">
      Brewing Happiness · บริการหลังการขาย xBloom Thailand
    </p>
  </div>`;

const row = (k: string, v: string) =>
  `<tr><td style="color:#8b9099;padding:4px 12px 4px 0">${k}</td><td style="font-weight:600">${v}</td></tr>`;

export function warrantyEmail(name: string, serial: string, product: string, expiry: string) {
  return shell(
    "ลงทะเบียนรับประกันสำเร็จ / You're registered",
    `<p>เรียน ${name || "ลูกค้า"}, ประกันของคุณมีผลแล้ว / Your warranty is now active.</p>
     <table style="font-size:14px;margin-top:8px">
       ${row("หมายเลขเครื่อง / Serial", serial)}
       ${row("รุ่น / Model", product || "-")}
       ${row("หมดประกัน / Expires", expiry)}
     </table>`,
  );
}

// A free-text staff message (often AI-drafted, staff-edited) wrapped in the brand shell.
export function customerMessageEmail(caseId: string, message: string) {
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return shell(
    `อัปเดตเคส / Case update · ${caseId}`,
    `<p style="white-space:pre-wrap">${safe}</p>
     <p style="margin-top:12px;color:#8b9099">ติดตามสถานะได้ที่หน้า "ติดตามเคส" ด้วยหมายเลขเคส ${caseId}</p>`,
  );
}

export function caseEmail(name: string, caseId: string, serial: string, issue: string) {
  return shell(
    "รับเรื่องแล้ว / Case received",
    `<p>เรียน ${name || "ลูกค้า"}, เราได้รับเรื่องของคุณแล้ว ทีมงานจะติดต่อกลับภายใน 3 วันทำการ /
     We've received your case and will be in touch within 3 business days.</p>
     <table style="font-size:14px;margin-top:8px">
       ${row("หมายเลขเคส / Case ID", caseId)}
       ${row("เครื่อง / Serial", serial)}
       ${row("ปัญหา / Issue", issue || "-")}
     </table>
     <p style="margin-top:12px">ติดตามสถานะได้ที่หน้า "ติดตามเคส" ด้วยหมายเลขเคสนี้</p>`,
  );
}
