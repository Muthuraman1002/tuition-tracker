// Exports a student's sessions for a date range as a PDF statement (for parents) or a CSV file (for Excel/Numbers),
// handed to the iOS share sheet (WhatsApp, Mail, Files, AirDrop...).
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { classEnd, fmtTime, money } from "./logic";

const day = (ms) => new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const iso = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const csvCell = (v) => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const STATUS = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled" };

// Sessions and money for each student in [from, to] (whole days, inclusive).
export function gather(db, studentIds, from, to, includeCancelled) {
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(to); b.setHours(23, 59, 59, 999);
  return studentIds.map((sid) => db.students.find((s) => s.id === sid)).filter(Boolean).map((s) => {
    const sessions = db.classes
      .filter((c) => c.studentIds.includes(s.id) && c.start >= a.getTime() && c.start <= b.getTime() && (includeCancelled || c.status !== "cancelled"))
      .sort((x, y) => x.start - y.start)
      .map((c) => {
        const charged = c.status === "completed" && c.charges ? c.charges[s.id] : undefined;
        return {
          c, charged, absent: c.status === "completed" && charged == null,
          status: (c.status === "completed" && charged == null ? "Absent" : STATUS[c.status]) + (c.free ? " (bonus class)" : ""),
          group: c.studentIds.length > 1, homework: c.homework || [],
        };
      });
    const payments = db.payments.filter((p) => p.studentId === s.id && p.date >= a.getTime() && p.date <= b.getTime()).sort((x, y) => x.date - y.date);
    const allPaid = db.payments.filter((p) => p.studentId === s.id).reduce((t, p) => t + p.amount, 0);
    const allUsed = db.classes.reduce((t, c) => t + (c.status === "completed" && c.charges && c.charges[s.id] != null ? c.charges[s.id] : 0), 0);
    return {
      s, sessions, payments,
      completed: sessions.filter((x) => x.charged != null).length,
      charged: sessions.reduce((t, x) => t + (x.charged || 0), 0),
      paid: payments.reduce((t, p) => t + p.amount, 0),
      balance: allPaid - allUsed,
    };
  });
}

function fileName(groups, from, to, ext) {
  const who = groups.length === 1 ? groups[0].s.name.replace(/[^A-Za-z0-9]+/g, "_") : `${groups.length}_students`;
  return `Sessions_${who}_${iso(from)}_to_${iso(to)}.${ext}`;
}

async function share(uri, mimeType, UTI, title) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this phone.");
  await Sharing.shareAsync(uri, { mimeType, UTI, dialogTitle: title });
}

export async function exportCSV(groups, from, to) {
  const head = ["Student", "Parent", "Phone", "Date", "Start", "End", "Minutes", "Subject", "Group class", "Status", "Fee charged (Rs)", "Homework", "Homework done", "Note"];
  const rows = [head];
  for (const g of groups) for (const x of g.sessions) {
    rows.push([
      g.s.name, g.s.parentName, g.s.phone, iso(x.c.start), fmtTime(x.c.start), fmtTime(classEnd(x.c)), x.c.durationMin, x.c.subject,
      x.group ? "Yes" : "No", x.status, x.charged != null ? x.charged : "",
      x.homework.map((h) => h.text).join("; "), x.homework.length ? `${x.homework.filter((h) => h.done).length}/${x.homework.length}` : "", x.c.note || "",
    ]);
  }
  const f = new File(Paths.cache, fileName(groups, from, to, "csv"));
  if (f.exists) f.delete();
  f.create();
  f.write("﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")); // BOM so Excel reads ₹ and Tamil names correctly
  await share(f.uri, "text/csv", "public.comma-separated-values-text", "Share sessions (CSV)");
}

export async function exportPDF(groups, from, to, centerName, brand) {
  const section = (g) => `
    <section>
      <h2>${esc(g.s.name)}</h2>
      <p class="meta">${[g.s.parentName && `Parent: ${esc(g.s.parentName)}`, g.s.phone && esc(g.s.phone), g.s.subjects.map((x) => `${esc(x.name)} ${money(x.fee)}/class`).join(", ")].filter(Boolean).join(" · ")}</p>
      <div class="cards">
        <div><b>${g.completed}</b><span>classes attended</span></div>
        <div><b>${money(g.charged)}</b><span>fees for these classes</span></div>
        <div><b>${money(g.paid)}</b><span>paid in this period</span></div>
        <div class="${g.balance <= 0 ? "due" : ""}"><b>${g.balance < 0 ? "−" + money(-g.balance) : money(g.balance)}</b><span>${g.balance <= 0 ? "fee due now" : "balance now"}</span></div>
      </div>
      ${g.sessions.length ? `<table>
        <tr><th>Date</th><th>Time</th><th>Subject</th><th>Status</th><th class="r">Fee</th><th>Homework</th></tr>
        ${g.sessions.map((x) => `<tr class="${x.c.status === "cancelled" || x.absent ? "dim" : ""}">
          <td>${day(x.c.start)}</td><td>${fmtTime(x.c.start)}–${fmtTime(classEnd(x.c))}</td>
          <td>${esc(x.c.subject)}${x.group ? ' <small>(group)</small>' : ""}</td><td>${x.status}</td>
          <td class="r">${x.charged != null ? money(x.charged) : "—"}</td>
          <td>${x.homework.map((h) => `${h.done ? "✓" : "○"} ${esc(h.text)}`).join("<br>")}</td></tr>`).join("")}
      </table>` : `<p class="meta">No sessions in this period.</p>`}
      ${g.payments.length ? `<h3>Payments received</h3><table><tr><th>Date</th><th>Note</th><th class="r">Amount</th></tr>
        ${g.payments.map((p) => `<tr><td>${day(p.date)}</td><td>${esc(p.note)}</td><td class="r">${money(p.amount)}</td></tr>`).join("")}</table>` : ""}
    </section>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1E2329; margin: 28px; font-size: 12px; }
    header { border-bottom: 3px solid ${brand}; padding-bottom: 10px; margin-bottom: 8px; }
    header h1 { margin: 0; font-size: 22px; color: ${brand}; } header p { margin: 4px 0 0; color: #6B7078; }
    section { page-break-inside: auto; margin-top: 18px; } section + section { page-break-before: always; }
    h2 { margin: 0; font-size: 18px; } h3 { font-size: 13px; margin: 16px 0 6px; }
    .meta { color: #6B7078; margin: 4px 0 10px; }
    .cards { display: flex; gap: 8px; margin-bottom: 12px; }
    .cards div { flex: 1; border: 1px solid #E6E1D8; border-radius: 8px; padding: 8px; }
    .cards b { display: block; font-size: 15px; } .cards span { color: #6B7078; font-size: 10px; }
    .cards .due { border-color: #DC2626; background: #FEF2F2; } .cards .due b { color: #DC2626; }
    table { width: 100%; border-collapse: collapse; } th { text-align: left; background: ${brand}1A; color: ${brand}; padding: 6px; font-size: 11px; }
    td { padding: 6px; border-bottom: 1px solid #EEE; vertical-align: top; } .r { text-align: right; } tr.dim td { color: #9BA1A6; }
    footer { margin-top: 24px; color: #9BA1A6; font-size: 10px; }
  </style></head><body>
    <header><h1>${esc(centerName || "Tuition")}</h1><p>Sessions from ${day(from)} to ${day(to)}</p></header>
    ${groups.map(section).join("")}
    <footer>Generated on ${day(Date.now())}</footer>
  </body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  let out = uri;
  try {
    const dest = new File(Paths.cache, fileName(groups, from, to, "pdf"));
    if (dest.exists) dest.delete();
    new File(uri).move(dest);
    out = dest.uri;
  } catch {}
  await share(out, "application/pdf", "com.adobe.pdf", "Share sessions (PDF)");
}
