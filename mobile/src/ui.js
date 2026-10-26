import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, statusColors } from './theme';

export function Page({ children, scroll = true, style }) {
  const Content = scroll ? ScrollView : View;
  return <View style={styles.page}>
    <View pointerEvents="none" style={styles.ambientTop} />
    <View pointerEvents="none" style={styles.ambientSide} />
    <Content style={[styles.scroll, style]} contentContainerStyle={scroll ? styles.content : undefined} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</Content>
  </View>;
}

export function Title({ eyebrow, children, right }) {
  return <View style={styles.titleRow}><View style={styles.titleContent}>{eyebrow ? <View style={styles.eyebrowPill}><View style={styles.eyebrowDot} /><Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text></View> : null}<Text style={styles.title}>{children}</Text></View>{right}</View>;
}

export function Panel({ children, style }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Button({ title, onPress, icon, secondary = false, disabled = false, loading = false, style }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, (pressed || disabled) && styles.pressed, style]}>
    {loading ? <ActivityIndicator color={secondary ? colors.forest : colors.white} /> : <>{icon ? <Ionicons name={icon} size={18} color={secondary ? colors.forest : colors.white} /> : null}<Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text></>}
  </Pressable>;
}

export function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline, ...props }) {
  return <View style={styles.fieldWrap}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} secureTextEntry={secureTextEntry} keyboardType={keyboardType} multiline={multiline} style={[styles.input, multiline && styles.multiline]} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} {...props} /></View>;
}

export function Badge({ label }) {
  const color = statusColors[label] || colors.forest;
  return <View style={[styles.badge, { backgroundColor: `${color}18` }]}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={[styles.badgeText, { color }]}>{label}</Text></View>;
}

export function EmptyState({ title, description, icon = 'leaf-outline' }) {
  return <View style={styles.empty}><Ionicons name={icon} size={27} color={colors.forest} /><Text style={styles.emptyTitle}>{title}</Text>{description ? <Text style={styles.emptyDescription}>{description}</Text> : null}</View>;
}

export function Row({ children, style }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper, overflow: 'hidden' },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  ambientTop: { position: 'absolute', width: 390, height: 390, borderRadius: 195, top: -260, right: -120, backgroundColor: colors.frost, opacity: 0.72 },
  ambientSide: { position: 'absolute', width: 210, height: 210, borderRadius: 105, bottom: 60, left: -160, backgroundColor: colors.lavender, opacity: 0.56 },
  content: { paddingHorizontal: 28, paddingTop: 28, paddingBottom: 48, gap: 20, alignSelf: 'center', width: '100%', maxWidth: 1080 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 76, marginBottom: 3 },
  titleContent: { gap: 8 },
  eyebrowPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.mint, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.coral },
  eyebrow: { color: colors.forest, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -0.9 },
  panel: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 3, borderLeftColor: colors.frost, padding: 21, gap: 15, shadowColor: colors.ink, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.07, shadowRadius: 18, elevation: 3 },
  button: { backgroundColor: colors.forest, minHeight: 52, paddingHorizontal: 20, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, shadowColor: colors.forest, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.24, shadowRadius: 10, elevation: 3 },
  secondaryButton: { backgroundColor: colors.ice, borderWidth: 1, borderColor: colors.frost, shadowOpacity: 0, elevation: 0 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  secondaryText: { color: colors.forest },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  fieldWrap: { gap: 8 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFCFA', paddingHorizontal: 15, color: colors.ink, fontSize: 15 },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 13 },
  badge: { alignSelf: 'flex-start', borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingHorizontal: 11, borderWidth: 1, borderColor: 'rgba(52,35,43,0.06)' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  empty: { backgroundColor: colors.white, borderRadius: 20, borderColor: colors.line, borderWidth: 1, padding: 32, alignItems: 'center', gap: 11, shadowColor: colors.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyDescription: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }
});