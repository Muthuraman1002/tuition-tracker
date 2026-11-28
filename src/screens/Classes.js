import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useStore } from "../store";
import { useTheme } from "../theme";
import { BalancePill, Button, Chip, DateTimeField, Field, H, Notice, Row, Segmented, Sheet, T } from "../ui";
import { balanceOf, classEnd, feeFor, feeState, fmtDay, fmtTime, money, monthKey, monthStats, overlaps, repeatStarts, MIN, fmtMonth } from "../logic";

const names = (store, ids) => ids.map((id) => (store.studentById(id) || { name: "Removed student" }).name).join(", ");

// ---------------------------------------------------------------- one row in a list
export function ClassRow({ c, onPress, showDay }) {
  const store = useStore();
  const t = useTheme();
  const late = c.status === "scheduled" && classEnd(c) < Date.now();
  const tag = c.status === "completed" ? ["Completed", t.gain] : c.status === "cancelled" ? ["Cancelled", t.muted] : late ? ["Not marked", t.flag] : null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.line, opacity: c.status === "cancelled" ? 0.55 : 1, backgroundColor: pressed ? t.brandSoft : "transparent" })}>
      <View style={{ width: 64 }}>
        <T weight="700">{fmtTime(c.start)}</T>
        <T size={12} muted>{showDay ? fmtDay(c.start) : `${c.durationMin} min`}</T>
      </View>
      <View style={{ flex: 1 }}>
        <T weight="600">{c.subject || "Class"}{c.studentIds.length > 1 ? <T size={12} muted>  · group of {c.studentIds.length}</T> : null}{c.free ? <T size={12} weight="700" color={t.gain}>  · Bonus class</T> : null}</T>
        <T size={13} muted numberOfLines={2}>{names(store, c.studentIds)}</T>
        {(c.homework || []).length > 0 && (() => { const left = c.homework.filter((h) => !h.done).length; return <T size={12} weight="600" color={left ? t.flag : t.gain}>{left ? `Homework: ${left} pending` : "Homework done"}</T>; })()}
      </View>
      {tag && <T size={12} weight="700" color={tag[1]}>{tag[0]}</T>}
    </Pressable>
  );
}

// ---------------------------------------------------------------- schedule or edit
const DURATIONS = [30, 45, 60, 90, 120];
const REPEATS = [[1, "Once"], [4, "4 weeks"], [8, "8 weeks"], [12, "12 weeks"]];

function nextSlot() {
  const d = new Date(Date.now() + 60 * MIN);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d.getTime();
}

export function ScheduleSheet({ initial, studentIds: preset, onClose, whatsApp }) {
  const store = useStore();
  const t = useTheme();
  const { students, classes, settings, payments, carry } = store.db;
  const editing = !!(initial && initial.id);
  const [ids, setIds] = useState(initial ? initial.studentIds : preset || []);
  const [subject, setSubject] = useState(initial ? initial.subject : "");
  const [start, setStart] = useState(initial && initial.start ? initial.start : nextSlot());
  const [dur, setDur] = useState(initial ? initial.durationMin : settings.defaultDuration);
  const [weeks, setWeeks] = useState(1);
  const [note, setNote] = useState(initial ? initial.note || "" : "");
  const [free, setFree] = useState(!!(initial && initial.free));
  const [err, setErr] = useState(null);

  const chosen = ids.map((id) => students.find((s) => s.id === id)).filter(Boolean);
  const subjects = [...new Set(chosen.flatMap((s) => s.subjects.map((x) => x.name)))];
  useEffect(() => { if (!subject && subjects.length === 1) setSubject(subjects[0]); }, [ids.join(",")]); // eslint-disable-line
  const starts = editing ? [start] : repeatStarts(start, weeks);

  // Clashes for every occurrence, against existing classes.
  const clashes = useMemo(() => starts.flatMap((s) => overlaps(classes, s, s + dur * MIN, initial && initial.id)), [classes, start, dur, weeks]); // eslint-disable-line

  const toggle = (id) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  // Per-student notes: fee for this subject, fee already used up, beyond this month's classes.
  const studentNotes = chosen.map((s) => {
    const fee = feeFor(s, subject);
    const { balance } = balanceOf(s.id, payments, classes);
    const m = monthKey(start);
    const st = monthStats(s, m, classes, carry);
    const already = editing && initial.status === "scheduled" && initial.studentIds.includes(s.id) && monthKey(initial.start) === m ? 1 : 0;
    const adding = free ? 0 : starts.filter((x) => monthKey(x) === m).length;
    const over = st.scheduled - (initial && initial.free ? 0 : already) + adding - st.remaining;
    return { s, fee, balance, state: feeState(s, balance), over: Number(s.classesPerMonth) > 0 && over > 0 ? over : 0, month: m };
  });

  const save = () => {
    setErr(null);
    if (!ids.length) return setErr("Pick at least one student.");
    if (!subject.trim()) return setErr("Enter the subject.");
    const go = () => {
      const base = { studentIds: ids, subject: subject.trim(), durationMin: dur, note: note.trim(), free };
      onClose();
      if (editing) {
        const status = initial.status || "scheduled"; // a cancelled class restored via "Change time" arrives as scheduled
        store.updateClass(initial.id, { ...base, start, status });
        if (status === "scheduled" && start !== initial.start) whatsApp && whatsApp("rescheduled", { c: { ...initial, ...base, start, status }, oldStart: initial.start });
      } else {
        const made = store.addClasses(base, starts);
        whatsApp && whatsApp("scheduled", made);
      }
    };
    if (clashes.length) {
      Alert.alert("Classes overlap", `${clashes.length === 1 ? "This clashes with another class" : `This clashes with ${clashes.length} classes`}. Schedule it anyway?`, [
        { text: "Go back", style: "cancel" }, { text: "Schedule anyway", onPress: go },
      ]);
    } else go();
  };

  return (
    <Sheet onClose={onClose} title={editing ? "Change class" : "Schedule a class"}>
      <T size={13} muted style={{ marginBottom: 6 }}>Students (pick more than one for a group class)</T>
      {!students.length && <Notice tone="warn">Add a student first in the Students tab.</Notice>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {students.map((s) => <Chip key={s.id} label={s.name} on={ids.includes(s.id)} onPress={() => toggle(s.id)} />)}
      </View>

      <T size={13} muted style={{ marginBottom: 6 }}>Subject</T>
      {subjects.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {subjects.map((x) => <Chip key={x} label={x} on={subject === x} onPress={() => setSubject(x)} />)}
        </View>
      )}
      <Field value={subject} onChangeText={setSubject} placeholder="e.g. Maths" autoCapitalize="words" />

      <DateTimeField label="Starts" value={start} onChange={setStart} />
      <T size={13} muted style={{ marginBottom: 6 }}>Length</T>
      <Segmented value={dur} onChange={setDur} options={DURATIONS.map((d) => [d, d < 60 ? `${d}m` : `${d / 60}h`.replace(".5h", "½h")])} />
      <T size={12} muted style={{ marginTop: 4, marginBottom: 12 }}>{fmtTime(start)} – {fmtTime(start + dur * MIN)}</T>

      {!editing && <>
        <T size={13} muted style={{ marginBottom: 6 }}>Repeat every {new Date(start).toLocaleDateString("en-IN", { weekday: "long" })}</T>
        <Segmented value={weeks} onChange={setWeeks} options={REPEATS} />
        <View style={{ height: 12 }} />
      </>}
      <T size={13} muted style={{ marginBottom: 6 }}>Fee</T>
      <Segmented value={free} onChange={setFree} options={[[false, "Normal class"], [true, "Bonus class"]]} />
      <View style={{ height: 12 }} />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional, e.g. chapter 4" />

      {clashes.length > 0 && (
        <Notice tone="error">
          <T size={14} weight="700" color={t.loss}>Overlaps with {clashes.length === 1 ? "another class" : `${clashes.length} classes`}</T>
          {clashes.slice(0, 6).map((c) => <T key={c.id + c.start} size={13}>{fmtDay(c.start)}, {fmtTime(c.start)}–{fmtTime(classEnd(c))}: {c.subject} with {names(store, c.studentIds)}</T>)}
          {clashes.length > 6 && <T size={13} muted>and {clashes.length - 6} more</T>}
        </Notice>
      )}
      {studentNotes.filter((n) => n.over || (!free && (n.state === "due" || !n.fee))).map((n) => (
        <Notice key={n.s.id} tone="warn">
          {[
            !free && n.state === "due" ? `${n.s.name}'s fee is ${n.balance < 0 ? `overdue by ${money(-n.balance)}` : "used up"}.` : "",
            n.over ? `This goes ${n.over} class${n.over > 1 ? "es" : ""} beyond ${n.s.name}'s classes for ${fmtMonth(n.month)}.` : "",
            !free && !n.fee ? `${n.s.name} has no fee set for ${subject || "this subject"}.` : "",
          ].filter(Boolean).join(" ")}
        </Notice>
      ))}
      {chosen.length > 0 && subject ? <T size={13} muted style={{ marginBottom: 12 }}>{free ? "Bonus class: no fee, and it doesn't count towards the monthly classes." : `Fee per class: ${studentNotes.map((n) => `${n.s.name} ${money(n.fee)}`).join(", ")}`}</T> : null}
      {err && <Notice tone="error">{err}</Notice>}
      <Button title={clashes.length ? "Schedule anyway" : editing ? "Save changes" : starts.length > 1 ? `Schedule ${starts.length} classes` : "Schedule class"} danger={clashes.length > 0} onPress={save} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- class details and completing it
export function ClassSheet({ id, onClose, onEdit, openStudent, whatsApp }) {
  const store = useStore();
  const t = useTheme();
  const c = store.db.classes.find((x) => x.id === id);
  const [completing, setCompleting] = useState(false);
  const [present, setPresent] = useState(c ? c.studentIds : []);
  const [hw, setHw] = useState("");
  if (!c) return null;
  const { payments, classes } = store.db;
  const charges = store.chargesFor(c, present);
  const total = Object.values(charges).reduce((a, b) => a + b, 0);

  // The slot may have been booked again after cancelling, so check for clashes before restoring.
  const restore = () => {
    const clashes = overlaps(classes, c.start, classEnd(c), c.id);
    const doRestore = () => { store.updateClass(c.id, { status: "scheduled" }); whatsApp("restored", { ...c, status: "scheduled" }); };
    if (!clashes.length) return doRestore();
    const list = clashes.slice(0, 5).map((x) => `• ${fmtTime(x.start)}–${fmtTime(classEnd(x))} ${x.subject} with ${names(store, x.studentIds)}`).join("\n");
    Alert.alert("This time is now taken", `Restoring would overlap with:\n${list}${clashes.length > 5 ? `\nand ${clashes.length - 5} more` : ""}`, [
      { text: "Change time", onPress: () => onEdit({ ...c, status: "scheduled" }) },
      { text: "Restore anyway", style: "destructive", onPress: doRestore },
      { text: "Keep cancelled", style: "cancel" },
    ]);
  };

  const complete = () => { store.completeClass(c.id, charges); setCompleting(false); };
  const remove = () => Alert.alert("Delete this class?", c.status === "completed" ? "Its fees will be added back to the students' balances." : "", [
    { text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { store.deleteClass(c.id); onClose(); } },
  ]);

  return (
    <Sheet onClose={onClose} title={c.subject || "Class"}>
      <T size={16} weight="700">{fmtDay(c.start)}, {fmtTime(c.start)} – {fmtTime(classEnd(c))}</T>
      <T muted style={{ marginBottom: 12 }}>{c.durationMin} minutes{c.studentIds.length > 1 ? ` · group of ${c.studentIds.length}` : ""}{c.note ? ` · ${c.note}` : ""}</T>

      {c.free && c.status !== "completed" && <Notice tone="ok">Bonus class: no fee, and it doesn't count towards the monthly classes.</Notice>}
      {c.status === "completed" && <Notice tone="ok">{c.free ? "Completed. Bonus class, no fee taken." : `Completed. ${money(Object.values(c.charges || {}).reduce((a, b) => a + b, 0))} taken from fees.`}</Notice>}
      {c.status === "cancelled" && <Notice tone="warn">Cancelled. No fee is charged.</Notice>}

      <H style={{ marginTop: 4 }}>Students</H>
      {c.studentIds.map((sid, i) => {
        const s = store.studentById(sid);
        if (!s) return <Row key={sid} label="Removed student" value="" />;
        const { balance } = balanceOf(sid, payments, classes);
        const charged = c.charges ? c.charges[sid] : undefined;
        return (
          <Pressable key={sid} onPress={() => openStudent(sid)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: i === c.studentIds.length - 1 ? 0 : StyleSheet.hairlineWidth, borderColor: t.line }}>
            <View style={{ flex: 1 }}>
              <T weight="600">{s.name}</T>
              <T size={12} muted>{c.status === "completed" ? (charged != null ? `Charged ${money(charged)}` : "Absent, not charged") : (c.free ? "Bonus class, no fee" : `Fee ${money(feeFor(s, c.subject))}`)}</T>
            </View>
            <BalancePill state={feeState(s, balance)} balance={balance} money={money} />
          </Pressable>
        );
      })}

      {c.status === "scheduled" && !completing && <>
        <Button title="Mark completed" style={{ marginTop: 16 }} onPress={() => { setPresent(c.studentIds); setCompleting(true); }} />
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <Button kind="ghost" title="Change" style={{ flex: 1 }} onPress={() => onEdit(c)} />
          <Button kind="ghost" title="Cancel class" style={{ flex: 1 }} onPress={() => { store.updateClass(c.id, { status: "cancelled" }); whatsApp("cancelled", { ...c, status: "cancelled" }); }} />
        </View>
        <Button kind="ghost" title="Send reminder on WhatsApp" style={{ marginTop: 10, borderColor: "#1FA855" }} onPress={() => whatsApp("reminder", c, true)} />
      </>}

      {completing && <>
        <H style={{ marginTop: 16 }}>Who attended?</H>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {c.studentIds.map((sid) => { const s = store.studentById(sid); return s ? <Chip key={sid} label={s.name} on={present.includes(sid)} onPress={() => setPresent(present.includes(sid) ? present.filter((x) => x !== sid) : [...present, sid])} /> : null; })}
        </View>
        {present.map((sid) => {
          const s = store.studentById(sid);
          const after = balanceOf(sid, payments, classes).balance - charges[sid];
          return <Row key={sid} label={`${s.name}: ${money(charges[sid])}`} value={after <= 0 ? (after < 0 ? `Owes ${money(-after)} after this` : "Fee used up after this") : `${money(after)} left`} color={after <= 0 ? t.loss : feeState(s, after) === "low" ? t.flag : undefined} />;
        })}
        <Row label="Total fees for this class" value={money(total)} color={t.brand} last />
        <Button title={present.length ? `Complete and take ${money(total)}` : "Complete, nobody charged"} style={{ marginTop: 12 }} onPress={complete} />
        <Button kind="ghost" title="Back" style={{ marginTop: 10 }} onPress={() => setCompleting(false)} />
      </>}

      <Homework c={c} hw={hw} setHw={setHw} />

      {c.status === "completed" && <Button kind="ghost" title="Undo completed" style={{ marginTop: 16 }} onPress={() => store.undoComplete(c.id)} />}
      {c.status === "cancelled" && <Button kind="ghost" title="Restore class" style={{ marginTop: 16 }} onPress={restore} />}
      <Button kind="ghost" danger title="Delete class" style={{ marginTop: 10 }} onPress={remove} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- homework for one class
export function Homework({ c, hw, setHw }) {
  const store = useStore();
  const t = useTheme();
  const items = c.homework || [];
  const add = () => { if (hw.trim()) { store.addHomework(c.id, hw); setHw(""); } };
  return (
    <>
      <H style={{ marginTop: 20 }}>Homework{items.length ? ` · ${items.filter((h) => h.done).length}/${items.length} done` : ""}</H>
      {items.map((h) => <HomeworkItem key={h.id} h={h} onToggle={() => store.toggleHomework(c.id, h.id)}
        onRemove={() => Alert.alert("Delete this homework?", h.text, [{ text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => store.removeHomework(c.id, h.id) }])} />)}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: items.length ? 8 : 0 }}>
        <Field style={{ flex: 1, marginBottom: 0 }} value={hw} onChangeText={setHw} placeholder="e.g. Exercise 4.2, Q1–10" onSubmitEditing={add} returnKeyType="done" />
        <Button title="Add" onPress={add} disabled={!hw.trim()} />
      </View>
      <T size={12} muted style={{ marginTop: 6 }}>Tap the circle when it's done. Long-press to delete.</T>
    </>
  );
}

export function HomeworkItem({ h, onToggle, onRemove, sub }) {
  const t = useTheme();
  return (
    <Pressable onPress={onToggle} onLongPress={onRemove} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.line }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: h.done ? t.gain : t.muted, backgroundColor: h.done ? t.gain : "transparent", alignItems: "center", justifyContent: "center" }}>
        {h.done ? <T size={14} weight="800" color={t.surface}>✓</T> : null}
      </View>
      <View style={{ flex: 1 }}>
        <T style={h.done ? { textDecorationLine: "line-through", color: t.muted } : null}>{h.text}</T>
        {sub ? <T size={12} muted>{sub}</T> : null}
        {h.done && h.doneAt ? <T size={12} color={t.gain}>Done {fmtDay(h.doneAt)}</T> : null}
      </View>
    </Pressable>
  );
}
