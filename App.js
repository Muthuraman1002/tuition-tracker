import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { StoreProvider, useStore } from "./src/store";
import { useTheme } from "./src/theme";
import { T } from "./src/ui";
import { MonthTab, ScheduleTab, TodayTab } from "./src/screens/Home";
import { StudentForm, StudentSheet, StudentsTab } from "./src/screens/Students";
import { ClassSheet, ScheduleSheet } from "./src/screens/Classes";

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

  // Tapping a class notification opens that class.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const id = r.notification.request.content.data && r.notification.request.content.data.classId;
      if (id && store.db.classes.some((c) => c.id === id)) openClass(id);
    });
    return () => sub.remove();
  }, [store.db.classes]);

  const title = { today: "Tuition", schedule: "Schedule", students: "Students", month: "Month" }[tab];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.surface }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}><T size={22} weight="800">{title}</T></View>
      <View style={{ flex: 1, backgroundColor: t.ground }}>
        {tab === "today" && <TodayTab openClass={openClass} openStudent={openStudent} schedule={schedule} />}
        {tab === "schedule" && <ScheduleTab openClass={openClass} schedule={schedule} />}
        {tab === "students" && <StudentsTab openStudent={openStudent} newStudent={() => setSheet({ kind: "studentForm" })} />}
        {tab === "month" && <MonthTab openStudent={openStudent} />}
      </View>
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: t.surface, borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.line }}>
        <View style={{ flexDirection: "row" }} accessibilityRole="tablist">
          {TABS.map(([k, label]) => (
            <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={{ flex: 1, alignItems: "center", paddingVertical: 12 }}>
              <T size={13} weight={tab === k ? "800" : "500"} color={tab === k ? t.brand : t.muted}>{label}</T>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      {sheet && sheet.kind === "class" && <ClassSheet id={sheet.id} onClose={close} onEdit={(c) => setSheet({ kind: "schedule", initial: c })} openStudent={openStudent} />}
      {sheet && sheet.kind === "schedule" && <ScheduleSheet initial={sheet.initial} studentIds={sheet.studentIds} onClose={close} />}
      {sheet && sheet.kind === "student" && <StudentSheet id={sheet.id} onClose={close} onEdit={(s) => setSheet({ kind: "studentForm", student: s })} openClass={openClass} schedule={schedule} />}
      {sheet && sheet.kind === "studentForm" && <StudentForm student={sheet.student} onClose={close} />}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="auto" />
        <Main />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
