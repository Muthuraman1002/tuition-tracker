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

  // Tapping a class notification opens that class.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const id = r.notification.request.content.data && r.notification.request.content.data.classId;
      if (id && store.db.classes.some((c) => c.id === id)) openClass(id);
    });
    return () => sub.remove();
  }, [store.db.classes]);

  const center = (store.db.settings.centerName || "").trim();
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
        {tab === "schedule" && <ScheduleTab openClass={openClass} schedule={schedule} exportFor={exportFor} />}
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

      {sheet && sheet.kind === "class" && <ClassSheet id={sheet.id} onClose={close} onEdit={(c) => setSheet({ kind: "schedule", initial: c })} openStudent={openStudent} />}
      {sheet && sheet.kind === "schedule" && <ScheduleSheet initial={sheet.initial} studentIds={sheet.studentIds} onClose={close} />}
      {sheet && sheet.kind === "student" && <StudentSheet id={sheet.id} onClose={close} onEdit={(s) => setSheet({ kind: "studentForm", student: s })} openClass={openClass} schedule={schedule} exportFor={exportFor} />}
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
