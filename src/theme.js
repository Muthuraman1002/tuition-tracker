import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";

// Warm neutral base, with an accent colour picked in Settings.
const base = {
  light: { ground: "#F6F3EE", surface: "#FFFFFF", ink: "#1E2329", muted: "#6B7078", line: "#E6E1D8", gain: "#15803D", loss: "#DC2626", flag: "#D97706", onBrand: "#FFFFFF" },
  dark: { ground: "#111315", surface: "#1B1E21", ink: "#ECEDEE", muted: "#9BA1A6", line: "#2B3034", gain: "#4ADE80", loss: "#F87171", flag: "#FBBF24", onBrand: "#0B0D0E" },
};

export const ACCENTS = {
  teal: { label: "Teal", light: "#0F766E", dark: "#2DD4BF" },
  violet: { label: "Violet", light: "#6D28D9", dark: "#A78BFA" },
  rose: { label: "Rose", light: "#BE185D", dark: "#F472B6" },
  orange: { label: "Orange", light: "#C2410C", dark: "#FB923C" },
  green: { label: "Green", light: "#3F6212", dark: "#A3E635" },
  blue: { label: "Blue", light: "#1D4ED8", dark: "#60A5FA" },
};

export const AccentContext = createContext("teal");
const cache = {};

export function useTheme() {
  const accent = useContext(AccentContext);
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const key = `${accent}-${mode}`;
  if (!cache[key]) {
    const a = ACCENTS[accent] || ACCENTS.teal;
    const brand = a[mode];
    cache[key] = { ...base[mode], brand, brandSoft: brand + (mode === "dark" ? "26" : "1A"), mode };
  }
  return cache[key];
}
export const tone = (t, v) => (v > 0 ? t.gain : v < 0 ? t.loss : t.ink);
