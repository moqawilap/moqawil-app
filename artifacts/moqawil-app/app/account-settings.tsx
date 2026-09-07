import { Feather } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/expo';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, FixedBackButton } from '@/components/MoqawilUI';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function AccountSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isArabic, locale, setLocale } = useApp();
  const { isSignedIn, signOut } = useAuth();
  const { user, isLoaded } = useUser();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) {
      router.replace('/sign-in');
      return;
    }
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
  }, [isLoaded, isSignedIn, user]);

  const save = async () => {
    if (!user || !firstName.trim()) {
      Alert.alert(isArabic ? 'الاسم مطلوب' : 'Name required', isArabic ? 'أدخل اسمك الأول.' : 'Enter your first name.');
      return;
    }
    setSaving(true);
    try {
      await user.update({ firstName: firstName.trim(), lastName: lastName.trim() || null });
      Alert.alert(isArabic ? 'تم الحفظ' : 'Saved', isArabic ? 'تم تحديث بيانات حسابك.' : 'Your account details were updated.');
      router.back();
    } catch {
      Alert.alert(isArabic ? 'تعذر الحفظ' : 'Unable to save', isArabic ? 'تحقق من البيانات وحاول مرة أخرى.' : 'Check your details and try again.');
    } finally {
      setSaving(false);
    }
  };

  const switchAccount = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  if (!user) return <View style={[styles.container, { backgroundColor: colors.background }]} />;

  const email = user.primaryEmailAddress?.emailAddress ?? '';
  const displayName = user.fullName || email;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FixedBackButton testID="account-settings-back" onPress={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 76, paddingBottom: insets.bottom + 34 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.foreground }]}>{isArabic ? 'تعديل الحساب' : 'Edit account'}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{isArabic ? 'حدّث بياناتك وتفضيلات حسابك' : 'Update your details and account preferences'}</Text>

        <View style={[styles.identityCard, { backgroundColor: colors.navy }]}>
          <View style={styles.avatar}>
            {user.imageUrl ? <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>}
          </View>
          <View style={styles.identityText}>
            <Text style={styles.identityName}>{displayName}</Text>
            <Text style={styles.identityEmail}>{email}</Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{isArabic ? 'البيانات الشخصية' : 'Personal details'}</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'الاسم الأول' : 'First name'}</Text>
          <TextInput value={firstName} onChangeText={setFirstName} placeholder={isArabic ? 'الاسم الأول' : 'First name'} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, textAlign: isArabic ? 'right' : 'left' }]} />
          <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'اسم العائلة' : 'Last name'}</Text>
          <TextInput value={lastName} onChangeText={setLastName} placeholder={isArabic ? 'اسم العائلة' : 'Last name'} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, textAlign: isArabic ? 'right' : 'left' }]} />
          <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'البريد الإلكتروني' : 'Email'}</Text>
          <View style={[styles.readOnly, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Feather name="mail" size={17} color={colors.mutedForeground} />
            <Text style={[styles.readOnlyText, { color: colors.mutedForeground }]}>{email}</Text>
            <Feather name="lock" size={14} color={colors.mutedForeground} />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{isArabic ? 'لغة التطبيق' : 'App language'}</Text>
          <View style={styles.languageRow}>
            {(['ar', 'en'] as const).map((item) => {
              const selected = locale === item;
              return (
                <Pressable key={item} onPress={() => setLocale(item)} style={[styles.languageButton, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.background }]}>
                  <Text style={[styles.languageText, { color: selected ? colors.primary : colors.foreground }]}>{item === 'ar' ? 'العربية' : 'English'}</Text>
                  {selected ? <Feather name="check-circle" size={17} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <ActionButton label={saving ? (isArabic ? 'جارٍ الحفظ…' : 'Saving…') : (isArabic ? 'حفظ التغييرات' : 'Save changes')} onPress={() => { if (!saving) void save(); }} style={saving ? { opacity: 0.55 } : undefined} />
        <Pressable onPress={() => void switchAccount()} style={[styles.switchButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Feather name="repeat" size={18} color={colors.primary} />
          <Text style={[styles.switchText, { color: colors.foreground }]}>{isArabic ? 'تغيير الحساب' : 'Switch account'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14 },
  title: { fontSize: 27, fontWeight: '900' },
  subtitle: { fontSize: 13, marginTop: -7, marginBottom: 6 },
  identityCard: { borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: { width: 58, height: 58, borderRadius: 19, backgroundColor: '#21D8B7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#06213B', fontSize: 23, fontWeight: '900' },
  identityText: { flex: 1, gap: 4 },
  identityName: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  identityEmail: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  section: { borderWidth: 1, borderRadius: 19, padding: 15, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 3 },
  label: { fontSize: 12, fontWeight: '800', marginTop: 3 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 14 },
  readOnly: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  readOnlyText: { flex: 1, fontSize: 13 },
  languageRow: { flexDirection: 'row', gap: 9 },
  languageButton: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  languageText: { fontSize: 13, fontWeight: '800' },
  switchButton: { minHeight: 50, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  switchText: { fontSize: 14, fontWeight: '900' },
});