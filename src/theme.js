import { useColorScheme } from "react-native";

const light = {
  ground: "#EDF0F2", surface: "#FFFFFF", ink: "#15202B", muted: "#5B6875", line: "#D5DBE1",
  brand: "#1F3A93", brandSoft: "rgba(31,58,147,0.09)", gain: "#0F7B5F", loss: "#B8322A", flag: "#B07805",
  nifty: "#8A6D3B", inv: "#8C98A4", mf: "#0E8A9A", series: ["#1F3A93", "#0E8A9A", "#7A3FB5", "#C2410C", "#4D7C0F"],
};
const dark = {
  ground: "#0F1620", surface: "#17212D", ink: "#E6ECF2", muted: "#93A1B0", line: "#283544",
  brand: "#93AAFF", brandSoft: "rgba(147,170,255,0.12)", gain: "#3FC99A", loss: "#FF7A6B", flag: "#F2B33D",
  nifty: "#D9B77A", inv: "#6C7A88", mf: "#4FD1DE", series: ["#93AAFF", "#4FD1DE", "#C49BF2", "#FB923C", "#A3D96B"],
};
export function useTheme() { return useColorScheme() === "dark" ? dark : light; }
export const tone = (t, v) => (v > 0 ? t.gain : v < 0 ? t.loss : t.ink);
