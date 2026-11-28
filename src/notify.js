// Local notifications for scheduled classes. iOS keeps at most 64 pending notifications per app,
// so after every change all pending ones are replaced with the next ones (up to 60).
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let allowed = null;
export async function setup() {
  const cur = await Notifications.getPermissionsAsync();
  allowed = cur.granted || (cur.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
  return allowed;
}
export const permitted = () => allowed;

let running = Promise.resolve();
export function sync(db) {
  running = running.then(() => doSync(db)).catch(() => {});
  return running;
}

async function doSync(db) {
  if (allowed === null) await setup();
  if (!allowed) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  const names = (c) => c.studentIds.map((id) => (db.students.find((s) => s.id === id) || {}).name).filter(Boolean).join(", ");
  const before = Number(db.settings.remindBefore) || 0;
  const waBefore = Number(db.settings.waRemindBefore) || 0;
  const items = [];
  for (const c of db.classes) {
    if (c.status !== "scheduled") continue;
    const who = names(c), what = c.subject || "Class";
    if (c.start > now) items.push({ at: c.start, title: `${what} class now`, body: `${who} · ${c.durationMin} min`, id: c.id });
    if (before > 0 && c.start - before * 60e3 > now) items.push({ at: c.start - before * 60e3, title: `${what} class in ${before} min`, body: who, id: c.id });
    // Prompt to send the parents a WhatsApp reminder; tapping it opens WhatsApp with the message ready.
    if (waBefore > 0 && c.start - waBefore * 60e3 > now) items.push({ at: c.start - waBefore * 60e3, title: "Send WhatsApp reminder", body: `Tap to remind ${c.studentIds.length > 1 ? "parents" : "the parent"}: ${what} at ${new Date(c.start).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} · ${who}`, id: c.id, kind: "wa" });
  }
  items.sort((a, b) => a.at - b.at);
  for (const it of items.slice(0, 60)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: it.title, body: it.body, data: { classId: it.id, kind: it.kind || "class" }, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(it.at) },
    });
  }
}
