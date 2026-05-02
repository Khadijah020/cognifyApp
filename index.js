// Suppress Expo Go SDK 53 warnings about remote push notifications.
// The app only uses local notifications (reminders + fall alerts), which still work fine.
const _warn = console.warn;
const _error = console.error;
const _notifMsg = (m) =>
  m.includes("expo-notifications") ||
  m.includes("Android Push notifications") ||
  m.includes("remote notifications") ||
  m.includes("not fully supported in Expo Go");
console.warn = (...a) => {
  if (_notifMsg(a[0]?.toString?.() ?? "")) return;
  _warn(...a);
};
console.error = (...a) => {
  if (_notifMsg(a[0]?.toString?.() ?? "")) return;
  _error(...a);
};

import { registerRootComponent } from "expo";
import App from "./app/App";

registerRootComponent(App);
