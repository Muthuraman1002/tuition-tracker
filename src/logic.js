// Pure rules: fees, balances, overlaps and monthly class counts. No React here.
//
// Fee model: parents pay in advance (payments). Each completed class takes that student's fee for the
// class subject off their balance. When the balance reaches zero it is highlighted as due.

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const MIN = 60e3, DAY = 864e5;

export const monthKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
export const addMonths = (key, n) => { const [y, m] = key.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return monthKey(d.getTime()); };
export const monthRange = (key) => { const [y, m] = key.split("-").map(Number); return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()]; };
export const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const classEnd = (c) => c.start + c.durationMin * MIN;
export const active = (c) => c.status !== "cancelled";

// Fee for one student in one class. Uses the student's fee for that subject, else their first subject's fee.
export function feeFor(student, subject) {
  if (!student) return 0;
  const s = (student.subjects || []).find((x) => x.name.toLowerCase() === (subject || "").toLowerCase()) || (student.subjects || [])[0];
  return s ? Number(s.fee) || 0 : 0;
}

export function balanceOf(studentId, payments, classes) {
  const paid = payments.filter((p) => p.studentId === studentId).reduce((a, p) => a + p.amount, 0);
  const used = classes.reduce((a, c) => a + (c.status === "completed" && c.charges && c.charges[studentId] != null ? c.charges[studentId] : 0), 0);
  return { paid, used, balance: paid - used };
}

// "due": balance used up (zero or below). "low": less than one more class left.
export function feeState(student, balance) {
  if (balance <= 0) return "due";
  const fees = (student.subjects || []).map((s) => Number(s.fee) || 0).filter((f) => f > 0);
  return fees.length && balance < Math.max(...fees) ? "low" : "ok";
}

// Classes that clash in time with [start, end). The tutor can only be in one class at a time,
// so any active class overlapping is a clash; students in both classes are listed.
export function overlaps(classes, start, end, ignoreId) {
  return classes.filter((c) => active(c) && c.id !== ignoreId && c.start < end && classEnd(c) > start);
}

// Monthly allowance: classes per month plus anything carried over from last month.
// carry: { "studentId|YYYY-MM": n } = classes carried OUT of that month into the next.
export function monthStats(student, month, classes, carry) {
  const [a, b] = monthRange(month);
  const mine = classes.filter((c) => c.studentIds.includes(student.id) && c.start >= a && c.start < b);
  const carriedIn = carry[`${student.id}|${addMonths(month, -1)}`] || 0;
  const carriedOut = carry[`${student.id}|${month}`] || 0;
  const allowed = (Number(student.classesPerMonth) || 0) + carriedIn;
  const completed = mine.filter((c) => c.status === "completed" && c.charges && c.charges[student.id] != null).length;
  const scheduled = mine.filter((c) => c.status === "scheduled").length;
  const remaining = Math.max(0, allowed - completed - carriedOut);
  return { allowed, carriedIn, carriedOut, completed, scheduled, remaining, toSchedule: Math.max(0, remaining - scheduled) };
}

// Start times for a class repeated weekly, `weeks` times in total.
export const repeatStarts = (start, weeks) => Array.from({ length: Math.max(1, weeks) }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + 7 * i); return d.getTime(); });

export const fmtTime = (ms) => new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
export const fmtDay = (ms) => new Date(ms).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
export const fmtMonth = (key) => { const [y, m] = key.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }); };
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const money = (v) => inr.format(v || 0);
