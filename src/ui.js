import React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "./theme";

export function Card({ children, style }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.surface, borderColor: t.line, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, marginBottom: 12 }, style]}>{children}</View>;
}
export function T({ children, style, size = 15, weight = "400", color, muted, numberOfLines }) {
  const t = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ fontSize: size, fontWeight: weight, color: color || (muted ? t.muted : t.ink), fontVariant: ["tabular-nums"] }, style]}>{children}</Text>;
}
export const H = ({ children, style }) => <T size={17} weight="700" style={[{ marginBottom: 8 }, style]}>{children}</T>;

export function Row({ label, value, color, last, onPress }) {
  const t = useTheme();
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderColor: t.line }}>
      <T muted size={14}>{label}</T><T size={14} weight="600" color={color || (onPress ? t.brand : undefined)}>{value}</T>
    </Pressable>
  );
}

export function Button({ title, onPress, kind = "solid", disabled, loading, style, danger, small }) {
  const t = useTheme();
  const solid = kind === "solid";
  const c = danger ? t.loss : t.brand;
  return (
    <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [{ backgroundColor: solid ? c : "transparent", borderColor: c, borderWidth: 1, borderRadius: 8, paddingVertical: small ? 6 : 11, paddingHorizontal: small ? 10 : 16, alignItems: "center", opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }, style]}>
      {loading ? <ActivityIndicator color={solid ? t.surface : c} /> : <T size={small ? 13 : 15} weight="600" color={solid ? t.surface : c}>{title}</T>}
    </Pressable>
  );
}

export function Segmented({ options, value, onChange }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: t.ground, borderRadius: 8, padding: 3, alignSelf: "flex-start", flexWrap: "wrap" }}>
      {options.map(([k, label]) => (
        <Pressable key={String(k)} onPress={() => onChange(k)} style={{ paddingVertical: 5, paddingHorizontal: 11, borderRadius: 6, backgroundColor: value === k ? t.surface : "transparent" }}>
          <T size={13} weight={value === k ? "700" : "400"} muted={value !== k}>{label}</T>
        </Pressable>
      ))}
    </View>
  );
}

export function Chip({ label, on, onPress, color }) {
  const t = useTheme();
  const c = color || t.brand;
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: on ? c : t.line, backgroundColor: on ? t.brandSoft : "transparent" }}>
      <T size={13} weight={on ? "700" : "400"} color={on ? c : undefined}>{label}</T>
    </Pressable>
  );
}

export function Field({ label, hint, style, ...props }) {
  const t = useTheme();
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      {label ? <T size={13} muted style={{ marginBottom: 4 }}>{label}</T> : null}
      <TextInput placeholderTextColor={t.muted} autoCorrect={false}
        style={{ borderWidth: 1, borderColor: t.line, backgroundColor: t.ground, color: t.ink, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 }} {...props} />
      {hint ? <T size={12} muted style={{ marginTop: 4 }}>{hint}</T> : null}
    </View>
  );
}

// Date and time with the iOS compact picker. value/onChange use milliseconds.
export function DateTimeField({ label, value, onChange, mode = "datetime" }) {
  return (
    <View style={{ marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <T size={14} muted>{label}</T>
      <DateTimePicker value={new Date(value)} mode={mode} display="compact" minuteInterval={5} onChange={(_, d) => d && onChange(d.getTime())} />
    </View>
  );
}

export function Sheet({ visible = true, onClose, title, children }) {
  const t = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.surface }} edges={["top", "bottom"]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.line }}>
          <T size={18} weight="800" numberOfLines={1} style={{ flex: 1 }}>{title}</T>
          <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={12} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.ground, alignItems: "center", justifyContent: "center" }}>
            <T size={18}>×</T>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function Notice({ children, tone = "info" }) {
  const t = useTheme();
  const c = tone === "error" ? t.loss : tone === "warn" ? t.flag : tone === "ok" ? t.gain : t.brand;
  return <View style={{ borderLeftWidth: 3, borderColor: c, paddingLeft: 10, paddingVertical: 4, marginBottom: 12 }}>{typeof children === "string" ? <T size={14}>{children}</T> : children}</View>;
}

export function Screen({ children }) {
  const t = useTheme();
  return <ScrollView style={{ backgroundColor: t.ground }} contentContainerStyle={{ padding: 14, paddingBottom: 90 }}>{children}</ScrollView>;
}

// Coloured pill for a student's fee balance: red when used up, amber when less than one class is left.
export function BalancePill({ state, balance, money }) {
  const t = useTheme();
  const c = state === "due" ? t.loss : state === "low" ? t.flag : t.gain;
  const label = state === "due" ? (balance < 0 ? `Owes ${money(-balance)}` : "Fee due") : money(balance);
  return (
    <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: 12, backgroundColor: state === "ok" ? "transparent" : c + "22", borderWidth: 1, borderColor: c }}>
      <T size={12} weight="700" color={c}>{label}</T>
    </View>
  );
}
