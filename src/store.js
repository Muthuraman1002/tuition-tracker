// All data lives in one JSON file in the app's private folder on this phone.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { File, Paths } from "expo-file-system";
import * as N from "./notify";
import { active, feeFor, uid } from "./logic";

const EMPTY = { students: [], classes: [], payments: [], carry: {}, settings: { remindBefore: 10, defaultDuration: 60, centerName: "", accent: "teal", waRemindBefore: 30, waAsk: { scheduled: true, rescheduled: true, cancelled: true, payment: true } } };
const file = () => new File(Paths.document, "tuition.json");

async function load() {
  try {
    const f = file();
    if (!f.exists) return EMPTY;
    const d = JSON.parse(await f.text());
    return { ...EMPTY, ...d, settings: { ...EMPTY.settings, ...(d.settings || {}) } };
  } catch { return EMPTY; }
}
async function save(d) {
  const f = file();
  if (!f.exists) f.create();
  await f.write(JSON.stringify(d));
}

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [db, setDb] = useState(null);
  const ref = useRef(null);

  useEffect(() => { load().then((d) => { ref.current = d; setDb(d); }); N.setup(); }, []);

  // Every change goes through here: saved to disk, and class reminders re-synced.
  const update = useCallback(async (fn) => {
    const next = fn(ref.current);
    ref.current = next;
    setDb(next);
    await save(next);
    N.sync(next).catch(() => {});
  }, []);

  useEffect(() => { if (db) N.sync(db).catch(() => {}); }, [!!db]); // eslint-disable-line

  if (!db) return null;

  const studentById = (id) => db.students.find((s) => s.id === id);

  const api = {
    db, studentById,

    saveStudent: (s) => update((d) => {
      const clean = { ...s, name: s.name.trim(), subjects: (s.subjects || []).filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), fee: Number(x.fee) || 0 })) };
      return { ...d, students: clean.id && d.students.some((x) => x.id === clean.id) ? d.students.map((x) => (x.id === clean.id ? clean : x)) : [...d.students, { ...clean, id: uid(), createdAt: Date.now() }] };
    }),
    // Removes the student and takes them out of future classes; finished classes and payments are kept for the record.
    removeStudent: (id) => update((d) => ({
      ...d,
      students: d.students.filter((s) => s.id !== id),
      classes: d.classes.map((c) => (c.status === "scheduled" ? { ...c, studentIds: c.studentIds.filter((x) => x !== id) } : c)).filter((c) => c.status !== "scheduled" || c.studentIds.length),
    })),

    // starts: list of start times (several when repeating weekly)
    // Returns the new classes so callers can message parents about them.
    addClasses: (base, starts) => {
      const made = starts.map((start) => ({ ...base, id: uid(), start, status: "scheduled", createdAt: Date.now() }));
      update((d) => ({ ...d, classes: [...d.classes, ...made] }));
      return made;
    },
    updateClass: (id, patch) => update((d) => ({ ...d, classes: d.classes.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    deleteClass: (id) => update((d) => ({ ...d, classes: d.classes.filter((c) => c.id !== id) })),

    // Fees each attending student would be charged for this class.
    chargesFor: (c, attendees) => Object.fromEntries((attendees || c.studentIds).map((sid) => [sid, c.free ? 0 : feeFor(db.students.find((s) => s.id === sid), c.subject)])),
    completeClass: (id, charges) => update((d) => ({ ...d, classes: d.classes.map((c) => (c.id === id ? { ...c, status: "completed", completedAt: Date.now(), charges } : c)) })),
    undoComplete: (id) => update((d) => ({ ...d, classes: d.classes.map((c) => (c.id === id ? { ...c, status: "scheduled", completedAt: null, charges: null } : c)) })),

    // Homework set in a class: [{ id, text, done, doneAt }]
    addHomework: (classId, text) => update((d) => ({ ...d, classes: d.classes.map((c) => (c.id === classId ? { ...c, homework: [...(c.homework || []), { id: uid(), text: text.trim(), done: false, doneAt: null }] } : c)) })),
    toggleHomework: (classId, hwId) => update((d) => ({ ...d, classes: d.classes.map((c) => (c.id === classId ? { ...c, homework: (c.homework || []).map((h) => (h.id === hwId ? { ...h, done: !h.done, doneAt: h.done ? null : Date.now() } : h)) } : c)) })),
    removeHomework: (classId, hwId) => update((d) => ({ ...d, classes: d.classes.map((c) => (c.id === classId ? { ...c, homework: (c.homework || []).filter((h) => h.id !== hwId) } : c)) })),

    addPayment: (p) => update((d) => ({ ...d, payments: [...d.payments, { ...p, id: uid(), amount: Number(p.amount) }] })),
    removePayment: (id) => update((d) => ({ ...d, payments: d.payments.filter((p) => p.id !== id) })),

    setCarry: (studentId, month, n) => update((d) => {
      const carry = { ...d.carry };
      if (n > 0) carry[`${studentId}|${month}`] = n; else delete carry[`${studentId}|${month}`];
      return { ...d, carry };
    }),

    saveSettings: (patch) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
    activeClasses: () => db.classes.filter(active),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
