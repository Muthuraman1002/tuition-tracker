import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useStore } from "../store";
import { useTheme } from "../theme";
import * as N from "../notify";
import { BalancePill, Button, Card, H, Notice, Row, Screen, Segmented, T } from "../ui";
import { ClassRow } from "./Classes";
import { addMonths, balanceOf, classEnd, DAY, feeState, fmtDay, fmtMonth, money, monthKey, monthRange, monthStats, startOfDay } from "../logic";

// Re-render every minute so "now", "late" and "today" stay current.
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60e3); return () => clearInterval(id); }, []);
  return now;
}

function MonthPicker({ month, setMonth }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <Pressable hitSlop={12} onPress={() => setMonth(addMonths(month, -1))}><T size={22} color={t.brand}>‹</T></Pressable>
      <Pressable onPress={() => setMonth(monthKey(Date.now()))}><T size={17} weight="700">{fmtMonth(month)}</T></Pressable>
      <Pressable hitSlop={12} onPress={() => setMonth(addMonths(month, 1))}><T size={22} color={t.brand}>›</T></Pressable>
    </View>
  );
}

// ---------------------------------------------------------------- Today
export function TodayTab({ openClass, openStudent, schedule }) {
  const store = useStore();
  const t = useTheme();
  const now = useNow();
  const { students, classes, payments } = store.db;
  const today = startOfDay(now), tomorrow = today + DAY;
  const sched = classes.filter((c) => c.status === "scheduled").sort((a, b) => a.start - b.start);
  const unmarked = sched.filter((c) => classEnd(c) < now && c.start < today);
  const todays = classes.filter((c) => c.start >= today && c.start < tomorrow).sort((a, b) => a.start - b.start);
  const soon = sched.filter((c) => c.start >= tomorrow && c.start < today + 8 * DAY);
  const fees = students.map((s) => ({ s, bal: balanceOf(s.id, payments, classes).balance })).map((r) => ({ ...r, state: feeState(r.s, r.bal) })).filter((r) => r.state !== "ok")
    .sort((a, b) => a.bal - b.bal);

  return (
    <Screen>
      {N.permitted() === false && (
        <Notice tone="warn">
          <T size={14}>Notifications are off, so you won't be reminded of classes. </T>
          <Pressable onPress={() => Linking.openSettings()}><T size={14} weight="700" color={t.brand}>Turn them on in Settings</T></Pressable>
        </Notice>
      )}
      <Button title="Schedule a class" onPress={() => schedule()} style={{ marginBottom: 12 }} />

      {fees.length > 0 && (
        <Card style={{ borderColor: fees.some((f) => f.state === "due") ? t.loss : t.flag, borderWidth: 1.5 }}>
          <H>Fees to collect</H>
          {fees.map(({ s, bal, state }, i) => (
            <Pressable key={s.id} onPress={() => openStudent(s.id)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: t.line }}>
              <View style={{ flex: 1 }}><T weight="600">{s.name}</T>{s.parentName ? <T size={12} muted>{s.parentName}{s.phone ? ` · ${s.phone}` : ""}</T> : null}</View>
              <BalancePill state={state} balance={bal} money={money} />
            </Pressable>
          ))}
        </Card>
      )}

      {unmarked.length > 0 && (
        <Card>
          <H>Not marked yet</H>
          <T size={13} muted style={{ marginBottom: 4 }}>Earlier classes still waiting to be marked completed or cancelled.</T>
          {unmarked.slice(0, 10).map((c) => <ClassRow key={c.id} c={c} showDay onPress={() => openClass(c.id)} />)}
        </Card>
      )}

      <Card>
        <H>Today, {fmtDay(now)}</H>
        {!todays.length ? <T muted>No classes today.</T> : todays.map((c) => <ClassRow key={c.id} c={c} onPress={() => openClass(c.id)} />)}
      </Card>

      <Card>
        <H>Next 7 days</H>
        {!soon.length ? <T muted>Nothing scheduled.</T> : soon.map((c) => <ClassRow key={c.id} c={c} showDay onPress={() => openClass(c.id)} />)}
      </Card>
      {!students.length && <Notice>Start by adding your students in the Students tab.</Notice>}
    </Screen>
  );
}

// ---------------------------------------------------------------- Schedule (one month, by day)
export function ScheduleTab({ openClass, schedule }) {
  const store = useStore();
  const t = useTheme();
  useNow();
  const [month, setMonth] = useState(monthKey(Date.now()));
  const [show, setShow] = useState("all");
  const [a, b] = monthRange(month);
  const list = store.db.classes.filter((c) => c.start >= a && c.start < b && (show === "all" || c.status === show)).sort((x, y) => x.start - y.start);
  const days = [];
  for (const c of list) { const d = startOfDay(c.start); if (!days.length || days[days.length - 1][0] !== d) days.push([d, []]); days[days.length - 1][1].push(c); }
  const today = startOfDay(Date.now());
  return (
    <Screen>
      <MonthPicker month={month} setMonth={setMonth} />
      <Segmented value={show} onChange={setShow} options={[["all", "All"], ["scheduled", "Scheduled"], ["completed", "Completed"], ["cancelled", "Cancelled"]]} />
      <View style={{ height: 12 }} />
      {!days.length && <Card><T muted>No classes in {fmtMonth(month)}.</T></Card>}
      {days.map(([d, cs]) => (
        <Card key={d} style={d === today ? { borderColor: t.brand, borderWidth: 1.5 } : null}>
          <T weight="700" color={d === today ? t.brand : undefined} style={{ marginBottom: 4 }}>{d === today ? "Today · " : ""}{fmtDay(d)}</T>
          {cs.map((c) => <ClassRow key={c.id} c={c} onPress={() => openClass(c.id)} />)}
        </Card>
      ))}
      <Button title="Schedule a class" onPress={() => schedule()} />
    </Screen>
  );
}

// ---------------------------------------------------------------- Month: classes per student, carry over, fees
export function MonthTab({ openStudent }) {
  const store = useStore();
  const t = useTheme();
  const [month, setMonth] = useState(monthKey(Date.now()));
  const { students, classes, payments, carry, settings } = store.db;
  const [a, b] = monthRange(month);
  const next = addMonths(month, 1);
  const inMonth = classes.filter((c) => c.start >= a && c.start < b);
  const earned = inMonth.filter((c) => c.status === "completed").reduce((s, c) => s + Object.values(c.charges || {}).reduce((x, y) => x + y, 0), 0);
  const received = payments.filter((p) => p.date >= a && p.date < b).reduce((s, p) => s + p.amount, 0);

  return (
    <Screen>
      <MonthPicker month={month} setMonth={setMonth} />
      <Card>
        <Row label="Classes completed" value={String(inMonth.filter((c) => c.status === "completed").length)} />
        <Row label="Still scheduled" value={String(inMonth.filter((c) => c.status === "scheduled").length)} />
        <Row label="Fees earned from classes" value={money(earned)} />
        <Row label="Payments received" value={money(received)} last />
      </Card>

      <Card>
        <H>Classes per student</H>
        {!students.length && <T muted>No students yet.</T>}
        {students.map((s, i) => {
          const st = monthStats(s, month, classes, carry);
          const left = st.allowed - st.completed - st.carriedOut;
          return (
            <View key={s.id} style={{ paddingVertical: 10, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: t.line }}>
              <Pressable onPress={() => openStudent(s.id)}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <T weight="700">{s.name}</T>
                  <T weight="600">{st.completed} of {st.allowed || "—"} done</T>
                </View>
                <T size={12} muted>
                  {s.classesPerMonth ? `${s.classesPerMonth} a month` : "No monthly number set"}{st.carriedIn ? ` + ${st.carriedIn} carried in` : ""} · {st.scheduled} scheduled{st.toSchedule ? ` · ${st.toSchedule} to schedule` : ""}
                </T>
              </Pressable>
              {st.carriedOut > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <T size={13} color={t.gain}>{st.carriedOut} carried to {fmtMonth(next)}</T>
                  <Button kind="ghost" small title="Undo" onPress={() => store.setCarry(s.id, month, 0)} />
                </View>
              ) : left > 0 && st.scheduled < left ? (
                <Button kind="ghost" small style={{ alignSelf: "flex-start", marginTop: 6 }} title={`Carry ${left - st.scheduled} unused to ${fmtMonth(next)}`} onPress={() => store.setCarry(s.id, month, left - st.scheduled)} />
              ) : null}
            </View>
          );
        })}
        <T size={12} muted style={{ marginTop: 8 }}>Carrying over adds the unused classes to next month's number for that student. Scheduled classes still count in this month.</T>
      </Card>

      <Card>
        <H>Reminders</H>
        <T size={13} muted style={{ marginBottom: 8 }}>You always get a notification when a class starts. Also remind me before:</T>
        <Segmented value={settings.remindBefore} onChange={(v) => store.saveSettings({ remindBefore: v })} options={[[0, "Off"], [5, "5 min"], [10, "10 min"], [15, "15 min"], [30, "30 min"]]} />
        <T size={13} muted style={{ marginTop: 14, marginBottom: 8 }}>Usual class length</T>
        <Segmented value={settings.defaultDuration} onChange={(v) => store.saveSettings({ defaultDuration: v })} options={[[30, "30m"], [45, "45m"], [60, "1h"], [90, "1½h"], [120, "2h"]]} />
      </Card>
    </Screen>
  );
}
