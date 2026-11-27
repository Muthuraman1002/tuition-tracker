import React, { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { useStore } from "../store";
import { useTheme } from "../theme";
import { BalancePill, Button, Card, DateTimeField, Field, H, Notice, Row, Screen, Sheet, T } from "../ui";
import { balanceOf, classEnd, feeState, fmtDay, fmtMonth, fmtTime, money, monthKey, monthStats } from "../logic";

// ---------------------------------------------------------------- list tab
export function StudentsTab({ openStudent, newStudent }) {
  const store = useStore();
  const t = useTheme();
  const { students, payments, classes, carry } = store.db;
  const month = monthKey(Date.now());
  const rows = students.map((s) => ({ s, bal: balanceOf(s.id, payments, classes).balance, st: monthStats(s, month, classes, carry) }))
    .map((r) => ({ ...r, state: feeState(r.s, r.bal) }))
    .sort((a, b) => ({ due: 0, low: 1, ok: 2 }[a.state] - { due: 0, low: 1, ok: 2 }[b.state]) || a.s.name.localeCompare(b.s.name));
  return (
    <Screen>
      <Button title="Add a student" onPress={newStudent} style={{ marginBottom: 12 }} />
      {!rows.length ? (
        <Card><H>No students yet</H><T muted>Add each student with their parent's name, phone number, subjects and fee per class.</T></Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {rows.map(({ s, bal, st, state }, i) => (
            <Pressable key={s.id} onPress={() => openStudent(s.id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", paddingVertical: 11, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: t.line, backgroundColor: state === "due" ? t.loss + "12" : pressed ? t.brandSoft : "transparent", marginHorizontal: -16, paddingHorizontal: 16 })}>
              <View style={{ flex: 1 }}>
                <T weight="700">{s.name}</T>
                <T size={12} muted numberOfLines={1}>{s.subjects.map((x) => x.name).join(", ") || "No subjects"}{s.classesPerMonth ? ` · ${st.completed}/${st.allowed} this month` : ""}</T>
              </View>
              <BalancePill state={state} balance={bal} money={money} />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------- add or edit
export function StudentForm({ student, onClose }) {
  const store = useStore();
  const [f, setF] = useState(student ? { ...student, classesPerMonth: String(student.classesPerMonth || ""), subjects: student.subjects.map((x) => ({ ...x, fee: String(x.fee) })) }
    : { name: "", parentName: "", phone: "", classesPerMonth: "", note: "", subjects: [{ name: "", fee: "" }] });
  const [err, setErr] = useState(null);
  const setSub = (i, patch) => setF({ ...f, subjects: f.subjects.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  const save = () => {
    if (!f.name.trim()) return setErr("Enter the student's name.");
    const subs = f.subjects.filter((x) => x.name.trim());
    if (!subs.length) return setErr("Add at least one subject.");
    if (subs.some((x) => !(Number(x.fee) >= 0) || x.fee === "")) return setErr("Enter the fee per class for each subject (0 if free).");
    if (f.phone && !/^[+\d][\d\s-]{6,}$/.test(f.phone.trim())) return setErr("Check the phone number.");
    store.saveStudent({ ...f, phone: f.phone.trim(), parentName: f.parentName.trim(), classesPerMonth: Number(f.classesPerMonth) || 0 });
    onClose();
  };

  return (
    <Sheet onClose={onClose} title={student ? `Edit ${student.name}` : "Add a student"}>
      <Field label="Student's name" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} autoCapitalize="words" />
      <Field label="Parent's name" value={f.parentName} onChangeText={(v) => setF({ ...f, parentName: v })} autoCapitalize="words" />
      <Field label="Phone number" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" placeholder="e.g. 98765 43210" />

      <T size={13} muted style={{ marginBottom: 6 }}>Subjects and fee per class</T>
      {f.subjects.map((x, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <Field style={{ flex: 1.4 }} value={x.name} onChangeText={(v) => setSub(i, { name: v })} placeholder="Subject" autoCapitalize="words" />
          <Field style={{ flex: 1 }} value={x.fee} onChangeText={(v) => setSub(i, { fee: v.replace(/[^\d.]/g, "") })} placeholder="₹ per class" keyboardType="decimal-pad" />
          {f.subjects.length > 1 && <Pressable accessibilityLabel="Remove subject" onPress={() => setF({ ...f, subjects: f.subjects.filter((_, j) => j !== i) })} style={{ paddingTop: 10 }}><T muted size={20}>×</T></Pressable>}
        </View>
      ))}
      <Button kind="ghost" small title="Add another subject" style={{ alignSelf: "flex-start", marginBottom: 14 }} onPress={() => setF({ ...f, subjects: [...f.subjects, { name: "", fee: "" }] })} />

      <Field label="Classes per month" value={f.classesPerMonth} onChangeText={(v) => setF({ ...f, classesPerMonth: v.replace(/\D/g, "") })} keyboardType="number-pad" placeholder="e.g. 8" hint="All subjects together. Unused classes can be carried over to the next month." />
      <Field label="Notes" value={f.note} onChangeText={(v) => setF({ ...f, note: v })} multiline />
      {err && <Notice tone="error">{err}</Notice>}
      <Button title={student ? "Save" : "Add student"} onPress={save} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- details
export function StudentSheet({ id, onClose, onEdit, openClass, schedule }) {
  const store = useStore();
  const t = useTheme();
  const s = store.studentById(id);
  const [pay, setPay] = useState({ amount: "", date: Date.now(), note: "" });
  const [msg, setMsg] = useState(null);
  if (!s) return null;
  const { payments, classes, carry } = store.db;
  const { paid, used, balance } = balanceOf(s.id, payments, classes);
  const state = feeState(s, balance);
  const month = monthKey(Date.now());
  const st = monthStats(s, month, classes, carry);
  const mine = classes.filter((c) => c.studentIds.includes(s.id));
  const upcoming = mine.filter((c) => c.status === "scheduled" && classEnd(c) >= Date.now()).sort((a, b) => a.start - b.start);
  const done = mine.filter((c) => c.status === "completed").sort((a, b) => b.start - a.start);
  const myPays = payments.filter((p) => p.studentId === s.id).sort((a, b) => b.date - a.date);
  const phone = (s.phone || "").replace(/[^\d+]/g, "");
  const wa = phone ? (phone.startsWith("+") ? phone.slice(1) : phone.length === 10 ? "91" + phone : phone) : "";

  const addPay = () => {
    const a = Number(pay.amount);
    if (!(a > 0)) return setMsg("Enter the amount paid.");
    store.addPayment({ studentId: s.id, amount: a, date: pay.date, note: pay.note.trim() });
    setPay({ amount: "", date: Date.now(), note: "" });
    setMsg(`Recorded ${money(a)}.`);
  };
  const remove = () => Alert.alert(`Remove ${s.name}?`, "Their future classes are removed. Finished classes and payments stay in your records.", [
    { text: "Keep", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => { store.removeStudent(s.id); onClose(); } },
  ]);

  return (
    <Sheet onClose={onClose} title={s.name}>
      <Card style={{ borderColor: state === "due" ? t.loss : state === "low" ? t.flag : t.line, borderWidth: state === "ok" ? StyleSheet.hairlineWidth : 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T muted size={13}>Fee balance</T><BalancePill state={state} balance={balance} money={money} />
        </View>
        <T size={32} weight="800" color={state === "due" ? t.loss : undefined}>{money(balance)}</T>
        {state === "due" && <T color={t.loss} weight="600">{balance < 0 ? `${money(-balance)} owed for classes already taken.` : "The fee paid has been used up."} Collect the next payment.</T>}
        {state === "low" && <T color={t.flag} weight="600">Less than one class left.</T>}
        <Row label="Paid so far" value={money(paid)} />
        <Row label="Used for classes" value={money(used)} last />
      </Card>

      <H>Details</H>
      {s.parentName ? <Row label="Parent" value={s.parentName} /> : null}
      {s.phone ? <Row label="Phone" value={s.phone} onPress={() => Linking.openURL(`tel:${phone}`)} /> : null}
      {wa ? <Row label="WhatsApp" value="Send a message" onPress={() => Linking.openURL(`https://wa.me/${wa}`)} /> : null}
      {s.subjects.map((x) => <Row key={x.name} label={x.name} value={`${money(x.fee)} per class`} />)}
      {s.note ? <Row label="Notes" value={s.note} /> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Button title="Schedule a class" style={{ flex: 1 }} onPress={() => schedule([s.id])} />
        <Button kind="ghost" title="Edit" style={{ flex: 1 }} onPress={() => onEdit(s)} />
      </View>

      <H style={{ marginTop: 20 }}>{fmtMonth(month)}</H>
      {s.classesPerMonth ? <>
        <Row label="Classes this month" value={`${s.classesPerMonth}${st.carriedIn ? ` + ${st.carriedIn} carried over` : ""}`} />
        <Row label="Completed" value={String(st.completed)} />
        <Row label="Scheduled" value={String(st.scheduled)} />
        <Row label="Still to schedule" value={String(st.toSchedule)} color={st.toSchedule ? t.flag : undefined} last />
      </> : <T muted>No monthly number of classes set.</T>}

      <H style={{ marginTop: 20 }}>Record a payment</H>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Field style={{ flex: 1 }} label="Amount (₹)" value={pay.amount} onChangeText={(v) => setPay({ ...pay, amount: v.replace(/[^\d.]/g, "") })} keyboardType="decimal-pad" />
        <Field style={{ flex: 1.3 }} label="Note" value={pay.note} onChangeText={(v) => setPay({ ...pay, note: v })} placeholder="e.g. UPI, December" />
      </View>
      <DateTimeField label="Paid on" mode="date" value={pay.date} onChange={(d) => setPay({ ...pay, date: d })} />
      {msg && <T size={13} color={t.gain} style={{ marginBottom: 8 }}>{msg}</T>}
      <Button title="Save payment" onPress={addPay} />

      {myPays.length > 0 && <>
        <H style={{ marginTop: 20 }}>Payments</H>
        {myPays.map((p, i) => (
          <Row key={p.id} label={`${fmtDay(p.date)}${p.note ? ` · ${p.note}` : ""}`} value={money(p.amount)} last={i === myPays.length - 1}
            onPress={() => Alert.alert("Delete this payment?", `${money(p.amount)} on ${fmtDay(p.date)}`, [{ text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => store.removePayment(p.id) }])} />
        ))}
        <T size={12} muted>Tap a payment to delete it.</T>
      </>}

      <H style={{ marginTop: 20 }}>Upcoming classes</H>
      {!upcoming.length ? <T muted>None scheduled.</T> : upcoming.slice(0, 10).map((c) => <Row key={c.id} label={`${fmtDay(c.start)}, ${fmtTime(c.start)}`} value={c.subject} onPress={() => openClass(c.id)} />)}

      <H style={{ marginTop: 20 }}>Completed classes</H>
      {!done.length ? <T muted>None yet.</T> : done.slice(0, 20).map((c) => (
        <Row key={c.id} label={`${fmtDay(c.start)} · ${c.subject}`} value={c.charges && c.charges[s.id] != null ? `− ${money(c.charges[s.id])}` : "Absent"} onPress={() => openClass(c.id)} />
      ))}

      <Button kind="ghost" danger title="Remove student" style={{ marginTop: 24 }} onPress={remove} />
    </Sheet>
  );
}
