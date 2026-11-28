import React, { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useTheme } from "../theme";
import { Button, Notice, Sheet, T } from "../ui";
import { openWhatsApp, waNumber } from "../whatsapp";

// One row per parent: the message (editable) and a button that opens their WhatsApp chat with it typed in.
export function WhatsAppSheet({ title, items, onClose }) {
  const t = useTheme();
  const [texts, setTexts] = useState(items.map((x) => x.text));
  const [sent, setSent] = useState({});
  const [err, setErr] = useState(null);

  const send = async (i) => {
    setErr(null);
    try { await openWhatsApp(items[i].student.phone, texts[i]); setSent({ ...sent, [i]: true }); }
    catch (e) { setErr(e.message); }
  };

  return (
    <Sheet onClose={onClose} title={title || "Send on WhatsApp"}>
      <T size={13} muted style={{ marginBottom: 12 }}>Each button opens WhatsApp with the message typed in. Tap Send there, then come back for the next one.</T>
      {err && <Notice tone="error">{err}</Notice>}
      {items.map((x, i) => {
        const has = !!waNumber(x.student.phone);
        return (
          <View key={x.student.id + i} style={{ paddingVertical: 12, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: t.line }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <T weight="700">{x.student.parentName || x.student.name}{x.student.parentName ? <T size={13} muted>  ({x.student.name})</T> : null}</T>
              {sent[i] ? <T size={13} weight="700" color={t.gain}>Opened ✓</T> : null}
            </View>
            <TextInput multiline value={texts[i]} onChangeText={(v) => setTexts(texts.map((y, j) => (j === i ? v : y)))}
              style={{ borderWidth: 1, borderColor: t.line, backgroundColor: t.ground, color: t.ink, borderRadius: 8, padding: 10, fontSize: 14, minHeight: 90, textAlignVertical: "top" }} />
            {has
              ? <Button title={sent[i] ? "Open WhatsApp again" : `Send on WhatsApp${x.student.phone ? ` · ${x.student.phone}` : ""}`} kind={sent[i] ? "ghost" : "solid"} style={{ marginTop: 8, backgroundColor: sent[i] ? "transparent" : "#1FA855", borderColor: "#1FA855" }} onPress={() => send(i)} />
              : <T size={13} color={t.flag} style={{ marginTop: 8 }}>No phone number saved for {x.student.name}. Add it in their details.</T>}
          </View>
        );
      })}
      <Button kind="ghost" title="Done" style={{ marginTop: 12 }} onPress={onClose} />
    </Sheet>
  );
}
