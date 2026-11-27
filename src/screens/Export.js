import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useStore } from "../store";
import { ACCENTS, useTheme } from "../theme";
import { Button, Chip, DateTimeField, H, Notice, Row, Segmented, Sheet, T } from "../ui";
import { exportCSV, exportPDF, gather } from "../export";
import { money } from "../logic";

const startOfMonth = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); };

const RANGES = [
  ["month", "This month", () => [startOfMonth(), Date.now()]],
  ["last", "Last month", () => { const d = new Date(startOfMonth()); const end = d.getTime() - 1; d.setMonth(d.getMonth() - 1); return [d.getTime(), end]; }],
  ["3m", "3 months", () => { const d = new Date(startOfMonth()); d.setMonth(d.getMonth() - 2); return [d.getTime(), Date.now()]; }],
];

export function ExportSheet({ studentIds, onClose }) {
  const store = useStore();
  const t = useTheme();
  const { db } = store;
  const [ids, setIds] = useState(studentIds && studentIds.length ? studentIds : db.students.map((s) => s.id));
  const [range, setRange] = useState("month");
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(Date.now());
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState(null);

  const pick = (k) => { setRange(k); const r = RANGES.find((x) => x[0] === k); if (r) { const [a, b] = r[2](); setFrom(a); setTo(b); } };
  const groups = useMemo(() => gather(db, ids, from, to, cancelled), [db, ids, from, to, cancelled]);
  const sessions = groups.reduce((n, g) => n + g.sessions.length, 0);
  const toggle = (id) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  const run = async (kind) => {
    setErr(null);
    if (!ids.length) return setErr("Pick at least one student.");
    if (from > to) return setErr("The start date is after the end date.");
    setBusy(kind);
    try {
      if (kind === "pdf") await exportPDF(groups, from, to, db.settings.centerName, (ACCENTS[db.settings.accent] || ACCENTS.teal).light);
      else await exportCSV(groups, from, to);
    } catch (e) { setErr(e.message || "Couldn't create the file."); }
    finally { setBusy(""); }
  };

  return (
    <Sheet onClose={onClose} title="Export sessions">
      <T size={13} muted style={{ marginBottom: 6 }}>Students</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {db.students.map((s) => <Chip key={s.id} label={s.name} on={ids.includes(s.id)} onPress={() => toggle(s.id)} />)}
      </View>
      <View style={{ flexDirection: "row", gap: 14, marginBottom: 14 }}>
        <Pressable hitSlop={8} onPress={() => setIds(db.students.map((s) => s.id))}><T size={13} color={t.brand}>Select all</T></Pressable>
        <Pressable hitSlop={8} onPress={() => setIds([])}><T size={13} color={t.brand}>Clear</T></Pressable>
      </View>

      <T size={13} muted style={{ marginBottom: 6 }}>Dates</T>
      <Segmented value={range} onChange={pick} options={[...RANGES.map(([k, l]) => [k, l]), ["custom", "Custom"]]} />
      <View style={{ height: 10 }} />
      <DateTimeField label="From" mode="date" value={from} onChange={(v) => { setRange("custom"); setFrom(v); }} />
      <DateTimeField label="To" mode="date" value={to} onChange={(v) => { setRange("custom"); setTo(v); }} />
      <Segmented value={cancelled} onChange={setCancelled} options={[[false, "Skip cancelled"], [true, "Include cancelled"]]} />

      <H style={{ marginTop: 18 }}>Summary</H>
      {groups.map((g, i) => (
        <Row key={g.s.id} label={g.s.name} value={`${g.sessions.length} session${g.sessions.length === 1 ? "" : "s"} · ${money(g.charged)}`} last={i === groups.length - 1} />
      ))}
      {!groups.length && <T muted>No students picked.</T>}
      {err && <View style={{ marginTop: 10 }}><Notice tone="error">{err}</Notice></View>}

      <Button title="Share PDF statement" style={{ marginTop: 16 }} loading={busy === "pdf"} disabled={!!busy || !ids.length} onPress={() => run("pdf")} />
      <Button kind="ghost" title="Share CSV for Excel" style={{ marginTop: 10 }} loading={busy === "csv"} disabled={!!busy || !ids.length} onPress={() => run("csv")} />
      <T size={12} muted style={{ marginTop: 10, lineHeight: 17 }}>
        The PDF has one page per student: classes with date, time, subject, status, fee and homework, payments received, and the balance. Send it on WhatsApp, Mail or save to Files. {sessions ? `${sessions} sessions in total.` : ""}
      </T>
    </Sheet>
  );
}
