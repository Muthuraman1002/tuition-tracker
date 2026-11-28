// WhatsApp messages to parents. WhatsApp lets apps open a chat with a message typed in; the tutor taps Send.
import { Linking } from "react-native";
import { classEnd, fmtTime, money } from "./logic";

const dayTime = (ms) => `${new Date(ms).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} at ${fmtTime(ms)}`;
const hello = (s) => `Hello${s.parentName ? ` ${s.parentName}` : ""},`;
const sign = (center) => (center ? `\n\n– ${center}` : "");

// Indian 10-digit numbers get +91; numbers with a country code are used as they are.
export function waNumber(phone) {
  const p = String(phone || "").replace(/[^\d+]/g, "");
  if (!p) return "";
  if (p.startsWith("+")) return p.slice(1);
  if (p.length === 10) return "91" + p;
  if (p.length === 11 && p.startsWith("0")) return "91" + p.slice(1);
  return p;
}

export async function openWhatsApp(phone, text) {
  const n = waNumber(phone);
  if (!n) throw new Error("No phone number for this parent.");
  await Linking.openURL(`https://wa.me/${n}?text=${encodeURIComponent(text)}`);
}

// How many more classes a balance pays for, per subject fee.
function classesLeft(s, balance) {
  const fees = [...new Set((s.subjects || []).map((x) => Number(x.fee) || 0).filter((f) => f > 0))];
  if (balance <= 0 || !fees.length) return "";
  if (fees.length === 1) { const n = Math.floor(balance / fees[0]); return `, enough for ${n} more class${n === 1 ? "" : "es"}`; }
  return ` (${s.subjects.filter((x) => x.fee > 0).map((x) => `${Math.floor(balance / x.fee)} ${x.name}`).join(" or ")} classes)`;
}

// Each builder returns [{ student, text }] — one message per student (a group class has several parents).
export const messages = {
  scheduled: (students, classesForStudent, center) => students.map((s) => {
    const list = classesForStudent(s.id).sort((a, b) => a.start - b.start);
    if (!list.length) return null;
    const c = list[0];
    const body = list.length === 1
      ? `${s.name}'s ${c.subject} class is scheduled on ${dayTime(c.start)} (${c.durationMin} min).${c.free ? " This is a bonus class, free of charge." : ""}`
      : `${s.name}'s ${c.subject} classes are scheduled at ${fmtTime(c.start)} on:\n${list.map((x) => `• ${new Date(x.start).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}`).join("\n")}`;
    return { student: s, text: `${hello(s)}\n${body}${sign(center)}` };
  }).filter(Boolean),

  reminder: (students, c, center) => students.map((s) => {
    const mins = Math.round((c.start - Date.now()) / 60e3);
    const when = mins > 0 && mins <= 180 ? `starts at ${fmtTime(c.start)} today (in ${mins} min)` : `is on ${dayTime(c.start)}`;
    return { student: s, text: `${hello(s)}\nReminder: ${s.name}'s ${c.subject} class ${when}.${c.note ? `\nTopic: ${c.note}` : ""}${sign(center)}` };
  }),

  rescheduled: (students, c, oldStart, center) => students.map((s) => ({
    student: s, text: `${hello(s)}\n${s.name}'s ${c.subject} class on ${dayTime(oldStart)} has been moved to ${dayTime(c.start)} (until ${fmtTime(classEnd(c))}).${sign(center)}`,
  })),

  cancelled: (students, c, center) => students.map((s) => ({
    student: s, text: `${hello(s)}\n${s.name}'s ${c.subject} class on ${dayTime(c.start)} is cancelled. No fee will be charged for it.${sign(center)}`,
  })),

  restored: (students, c, center) => students.map((s) => ({
    student: s, text: `${hello(s)}\n${s.name}'s ${c.subject} class on ${dayTime(c.start)} is back on as planned.${sign(center)}`,
  })),

  // balance is after this payment; monthly = monthStats for the current month (or null)
  payment: (s, amount, date, balance, monthly, center) => {
    const bal = balance > 0 ? `Balance: ${money(balance)}${classesLeft(s, balance)}.` : balance < 0 ? `Balance due: ${money(-balance)}.` : "The balance is now fully used.";
    const month = monthly && s.classesPerMonth ? `\nThis month: ${monthly.completed} of ${monthly.allowed} classes done.` : "";
    return [{ student: s, text: `${hello(s)}\nThank you! Payment of ${money(amount)} received for ${s.name} on ${new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.\n${bal}${month}${sign(center)}` }];
  },

  balance: (s, balance, center) => [{
    student: s,
    text: `${hello(s)}\n${balance > 0 ? `${s.name}'s fee balance is ${money(balance)}${classesLeft(s, balance)}.` : `${s.name}'s fee balance is used up${balance < 0 ? ` and ${money(-balance)} is due` : ""}. Please pay for the next classes.`}${sign(center)}`,
  }],
};

