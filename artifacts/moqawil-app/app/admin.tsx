import { useAuth, useUser } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ActionButton, BrandMark, ScreenHeader } from '@/components/MoqawilUI';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Provider } from '@/data/mockData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FormState = { name: string; specialty: string; city: string; contractAmount: string; phone: string; rating: string; reviews: string; verified: boolean };
const emptyForm: FormState = { name: '', specialty: '', city: 'Muscat', contractAmount: '', phone: '+968 ', rating: '0', reviews: '0', verified: false };

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { managedProviders, addContractor, updateProvider, removeProvider } = useApp();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const contractors = useMemo(() => managedProviders.filter((provider) => provider.role === 'contractor'), [managedProviders]);
  const metadata = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const isAdmin = metadata.role === 'admin' || metadata.isAdmin === true;

  if (!isLoaded) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!isSignedIn) {
    return <View style={[styles.center, { backgroundColor: colors.background, padding: 28 }]}><BrandMark /><Text style={[styles.restrictedTitle, { color: colors.foreground }]}>Admin access</Text><Text style={[styles.restrictedText, { color: colors.mutedForeground }]}>Sign in with an administrator account to manage contractors, ratings, and contract settings.</Text><ActionButton label="Sign in" onPress={() => router.push('/sign-in')} style={{ minWidth: 170 }} /><Pressable onPress={() => router.back()}><Text style={[styles.cancelLink, { color: colors.primary }]}>Return to Moqawil</Text></Pressable></View>;
  }

  if (!isAdmin) {
    return <View style={[styles.center, { backgroundColor: colors.background, padding: 28 }]}><Feather name="shield-off" size={44} color={colors.primary} /><Text style={[styles.restrictedTitle, { color: colors.foreground }]}>Restricted area</Text><Text style={[styles.restrictedText, { color: colors.mutedForeground }]}>Your account is signed in, but it does not have administrator permissions.</Text><ActionButton label="Go back" secondary onPress={() => router.back()} style={{ minWidth: 170 }} /></View>;
  }

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const startEdit = (provider: Provider) => {
    setEditingId(provider.id);
    setForm({ name: provider.name, specialty: provider.specialty, city: provider.city, contractAmount: provider.contractAmount, phone: provider.phone, rating: String(provider.rating), reviews: String(provider.reviews), verified: Boolean(provider.verified) });
  };
  const resetForm = () => { setEditingId(null); setForm(emptyForm); };
  const save = () => {
    if (!form.name.trim() || !form.specialty.trim()) {
      Alert.alert('Missing details', 'Add the contractor name and specialty before saving.');
      return;
    }
    const patch: Partial<Provider> = { name: form.name.trim(), nameAr: form.name.trim(), specialty: form.specialty.trim(), specialtyAr: form.specialty.trim(), city: form.city.trim() || 'Muscat', contractAmount: form.contractAmount.trim() || 'Not set', phone: form.phone.trim() || 'Not set', rating: Math.min(5, Math.max(0, Number(form.rating) || 0)), reviews: Math.max(0, Number.parseInt(form.reviews, 10) || 0), verified: form.verified };
    if (editingId) {
      updateProvider(editingId, patch);
      Alert.alert('Contractor updated', 'The contractor profile and evaluation were saved.');
    } else {
      addContractor({ name: patch.name!, specialty: patch.specialty!, city: patch.city!, contractAmount: patch.contractAmount!, phone: patch.phone! });
      Alert.alert('Contractor added', 'The new contractor is now available in the marketplace.');
    }
    resetForm();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.topRow}><Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}><Feather name="arrow-left" size={18} color={colors.foreground} /></Pressable><BrandMark compact /><View style={{ flex: 1 }} /><Pressable onPress={() => router.push('/')}><Text style={[styles.exitText, { color: colors.primary }]}>Exit</Text></Pressable></View>
          <ScreenHeader title="Admin console" subtitle="Contractor operations and evaluations" />
          <View style={[styles.banner, { backgroundColor: colors.navy }]}><Feather name="shield" size={20} color={colors.accent} /><View style={{ flex: 1 }}><Text style={styles.bannerTitle}>Administrator mode</Text><Text style={styles.bannerText}>Changes are stored on this device for the prototype.</Text></View></View>
          <View style={styles.sectionHead}><View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{editingId ? 'Edit contractor' : 'Add contractor'}</Text><Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Use the agreed contract amount and current evaluation.</Text></View>{editingId ? <Pressable onPress={resetForm}><Text style={[styles.cancelLink, { color: colors.primary }]}>Cancel</Text></Pressable> : null}</View>
          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {([['name', 'Contractor name'], ['specialty', 'Specialty'], ['city', 'City'], ['contractAmount', 'Agreed contract amount'], ['phone', 'Contact phone'], ['rating', 'Rating (0–5)'], ['reviews', 'Review count']] as const).map(([key, label]) => <View key={key} style={styles.field}><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><TextInput keyboardType={key === 'rating' || key === 'reviews' ? 'decimal-pad' : 'default'} value={form[key]} onChangeText={(value) => updateForm(key, value)} placeholder={label} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></View>)}
            <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={[styles.label, { color: colors.foreground, marginBottom: 2 }]}>Verified provider</Text><Text style={[styles.switchHint, { color: colors.mutedForeground }]}>Show the verification badge in discovery.</Text></View><Switch value={form.verified} onValueChange={(value) => updateForm('verified', value)} trackColor={{ false: colors.border, true: colors.primarySoft }} thumbColor={form.verified ? colors.primary : colors.mutedForeground} /></View>
            <ActionButton label={editingId ? 'Save contractor changes' : 'Add contractor'} icon={editingId ? 'check' : 'plus'} onPress={save} />
          </View>
          <View style={styles.sectionHead}><View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Managed contractors</Text><Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{contractors.length} profiles in your workspace</Text></View></View>
          {contractors.map((provider) => <View key={provider.id} style={[styles.contractorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.contractorTop}><View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}><Text style={[styles.avatarText, { color: colors.primary }]}>{provider.name.charAt(0)}</Text></View><View style={{ flex: 1 }}><Text style={[styles.contractorName, { color: colors.foreground }]}>{provider.name}</Text><Text style={[styles.contractorMeta, { color: colors.mutedForeground }]}>{provider.specialty} · {provider.city}</Text></View><Pressable onPress={() => startEdit(provider)} style={[styles.smallButton, { backgroundColor: colors.primarySoft }]}><Feather name="edit-2" size={15} color={colors.primary} /></Pressable></View><View style={[styles.statsRow, { borderTopColor: colors.border }]}><Text style={[styles.stat, { color: colors.foreground }]}>★ {provider.rating.toFixed(1)} <Text style={{ color: colors.mutedForeground }}>({provider.reviews})</Text></Text><Text style={[styles.stat, { color: colors.foreground }]}>{provider.contractAmount}</Text><Pressable onPress={() => Alert.alert('Remove contractor?', 'This removes the profile from this device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => removeProvider(provider.id) }])}><Text style={[styles.removeText, { color: '#C55353' }]}>Remove</Text></Pressable></View></View>)}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  restrictedTitle: { fontSize: 25, fontWeight: '800', marginTop: 14 },
  restrictedText: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 330, marginBottom: 8 },
  cancelLink: { fontSize: 12, fontWeight: '800' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backButton: { width: 39, height: 39, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  exitText: { fontSize: 12, fontWeight: '800' },
  banner: { borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  bannerTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  bannerText: { color: 'rgba(255,255,255,0.68)', fontSize: 11, marginTop: 3 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 27, marginBottom: 11 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionHint: { fontSize: 11, marginTop: 4 },
  formCard: { borderRadius: 18, borderWidth: 1, padding: 15 },
  field: { marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 6 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginBottom: 10 },
  switchHint: { fontSize: 10 },
  contractorCard: { borderRadius: 17, borderWidth: 1, padding: 14, marginBottom: 10 },
  contractorTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '800' },
  contractorName: { fontSize: 13, fontWeight: '800' },
  contractorMeta: { fontSize: 11, marginTop: 3 },
  smallButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statsRow: { borderTopWidth: 1, marginTop: 13, paddingTop: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  stat: { fontSize: 11, fontWeight: '700', flex: 1 },
  removeText: { fontSize: 11, fontWeight: '800' },
});