import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { StoreProvider, useStore } from "./src/store";
import { AccentContext, useTheme } from "./src/theme";
import { T } from "./src/ui";
import { MonthTab, ScheduleTab, TodayTab } from "./src/screens/Home";
import { StudentForm, StudentSheet, StudentsTab } from "./src/screens/Students";
import { ClassSheet, ScheduleSheet } from "./src/screens/Classes";
import { ExportSheet } from "./src/screens/Export";
import { WhatsAppSheet } from "./src/screens/WhatsApp";
import { messages, openWhatsApp, waNumber } from "./src/whatsapp";
import { balanceOf, monthKey, monthStats } from "./src/logic";

const TABS = [["today", "Today"], ["schedule", "Schedule"], ["students", "Students"], ["month", "Month"]];

function Main() {
  const store = useStore();
  const t = useTheme();
  const [tab, setTab] = useState("today");
  // One sheet at a time: { kind: "class" | "schedule" | "student" | "studentForm", ... }
  const [sheet, setSheet] = useState(null);
  const close = () => setSheet(null);

  const openClass = (id) => setSheet({ kind: "class", id });
  const openStudent = (id) => setSheet({ kind: "student", id });
  const schedule = (studentIds) => setSheet({ kind: "schedule", studentIds });
  const exportFor = (studentIds) => setSheet({ kind: "export", studentIds });

  // ---------- WhatsApp messages to parents
  const db = store.db;
  const center = (db.settings.centerName || "").trim();
  const studentsOf = (c) => c.studentIds.map((id) => store.studentById(id)).filter(Boolean);
  const showWhatsApp = (title, items, back) => { if (items.length) setSheet({ kind: "wa", title, items, back }); };
  const asked = (type) => !db.settings.waAsk || db.settings.waAsk[type] !== false;

  // Called after something parents should hear about. `force` = the tutor asked for it, so skip the setting.
  const whatsApp = (type, x, force) => {
    if (!force && !asked(type)) return;
    if (type === "scheduled") {
      const made = x; // the new classes (a weekly series shares its students)
      const students = [...new Set(made.flatMap((c) => c.studentIds))].map((id) => store.studentById(id)).filter(Boolean);
      showWhatsApp("Tell parents about the new class", messages.scheduled(students, (sid) => made.filter((c) => c.studentIds.includes(sid)), center));
    } else if (type === "reminder") showWhatsApp("Class reminder", messages.reminder(studentsOf(x), x, center), { kind: "class", id: x.id });
    else if (type === "rescheduled") showWhatsApp("Tell parents about the new time", messages.rescheduled(studentsOf(x.c), x.c, x.oldStart, center));
    else if (type === "cancelled") showWhatsApp("Tell parents it's cancelled", messages.cancelled(studentsOf(x), x, center), { kind: "class", id: x.id });
    else if (type === "restored") showWhatsApp("Tell parents it's back on", messages.restored(studentsOf(x), x, center), { kind: "class", id: x.id });
    else if (type === "payment") {
      const { student: s, amount, date } = x;
      const balance = balanceOf(s.id, db.payments, db.classes).balance + amount; // the new payment isn't saved in db yet
      showWhatsApp("Send payment receipt", messages.payment(s, amount, date, balance, monthStats(s, monthKey(Date.now()), db.classes, db.carry), center), { kind: "student", id: s.id });
    } else if (type === "balance") {
      showWhatsApp("Send fee balance", messages.balance(x, balanceOf(x.id, db.payments, db.classes).balance, center), { kind: "student", id: x.id });
    }
  };

  // Tapping a class notification opens that class; a WhatsApp reminder notification opens WhatsApp (or the send screen for a group).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data || {};
      const c = data.classId && store.db.classes.find((x) => x.id === data.classId);
      if (!c) return;
      if (data.kind === "wa" && c.status === "scheduled") {
        const items = messages.reminder(studentsOf(c), c, center);
        if (items.length === 1 && waNumber(items[0].student.phone)) openWhatsApp(items[0].student.phone, items[0].text).catch(() => showWhatsApp("Class reminder", items));
        else showWhatsApp("Class reminder", items);
      } else openClass(c.id);
    });
    return () => sub.remove();
  }, [store.db]); // eslint-disable-line

  const title = { today: center || "Tuition", schedule: "Schedule", students: "Students", month: "Month & settings" }[tab];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.brand }} edges={["top"]}>
      <StatusBar style={t.mode === "dark" ? "dark" : "light"} />
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, backgroundColor: t.brand }}>
        {tab !== "today" && center ? <T size={12} weight="600" color={t.onBrand} style={{ opacity: 0.8 }}>{center}</T> : null}
        <T size={24} weight="800" color={t.onBrand} numberOfLines={1}>{title}</T>
        {tab === "today" ? <T size={13} color={t.onBrand} style={{ opacity: 0.85 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</T> : null}
      </View>
      <View style={{ flex: 1, backgroundColor: t.ground }}>
        {tab === "today" && <TodayTab openClass={openClass} openStudent={openStudent} schedule={schedule} />}
        {tab === "schedule" && <ScheduleTab openClass={openClass} schedule={schedule} />}
        {tab === "students" && <StudentsTab openStudent={openStudent} newStudent={() => setSheet({ kind: "studentForm" })} />}
        {tab === "month" && <MonthTab openStudent={openStudent} exportFor={exportFor} />}
      </View>
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: t.surface, borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.line }}>
        <View style={{ flexDirection: "row" }} accessibilityRole="tablist">
          {TABS.map(([k, label]) => (
            <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={{ flex: 1, alignItems: "center", paddingVertical: 8 }}>
              <View style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, backgroundColor: tab === k ? t.brandSoft : "transparent" }}>
                <T size={13} weight={tab === k ? "800" : "500"} color={tab === k ? t.brand : t.muted}>{label}</T>
              </View>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      {sheet && sheet.kind === "class" && <ClassSheet id={sheet.id} onClose={close} onEdit={(c) => setSheet({ kind: "schedule", initial: c })} openStudent={openStudent} whatsApp={whatsApp} />}
      {sheet && sheet.kind === "schedule" && <ScheduleSheet initial={sheet.initial} studentIds={sheet.studentIds} onClose={close} whatsApp={whatsApp} />}
      {sheet && sheet.kind === "wa" && <WhatsAppSheet title={sheet.title} items={sheet.items} onClose={() => setSheet(sheet.back || null)} />}
      {sheet && sheet.kind === "student" && <StudentSheet id={sheet.id} onClose={close} onEdit={(s) => setSheet({ kind: "studentForm", student: s })} openClass={openClass} schedule={schedule} exportFor={exportFor} whatsApp={whatsApp} />}
      {sheet && sheet.kind === "export" && <ExportSheet studentIds={sheet.studentIds} onClose={close} />}
      {sheet && sheet.kind === "studentForm" && <StudentForm student={sheet.student} onClose={close} />}
    </SafeAreaView>
  );
}

// Applies the accent colour chosen in Settings to everything below it.
function Themed() {
  const store = useStore();
  return <AccentContext.Provider value={store.db.settings.accent || "teal"}><Main /></AccentContext.Provider>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Themed />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
