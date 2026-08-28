import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, ScreenHeader } from '@/components/MoqawilUI';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useUpsertMyContractorProfile } from '@workspace/api-client-react';

export default function ContractorProfileScreen() {
  const colors = useColors(), insets = useSafeAreaInsets(); const { isArabic } = useApp(); const { isSignedIn } = useAuth();
  const [form, setForm] = useState({ businessName: '', city: '', serviceArea: '', phone: '', bio: '' });
  const [publishIntent, setPublishIntent] = useState(true);
  const upsert = useUpsertMyContractorProfile({ mutation: { onSuccess: (result) => Alert.alert(isArabic ? 'تم إنشاء التجربة' : 'Trial created', isArabic ? `تم إنشاء تجربة اشتراكك حتى ${new Date(result.subscription.trialEndsAt).toLocaleDateString()}.` : `Your subscription trial runs until ${new Date(result.subscription.trialEndsAt).toLocaleDateString()}.`, [{ text: isArabic ? 'عرض الاشتراك' : 'View subscription', onPress: () => router.replace('/subscription' as never) }]) } });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  if (!isSignedIn) return <View style={[styles.page, styles.center, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.foreground }]}>{isArabic ? 'سجّل الدخول للانضمام كمقاول' : 'Sign in to join as a contractor'}</Text><ActionButton label={isArabic ? 'تسجيل الدخول' : 'Sign in'} onPress={() => router.push('/sign-in')} /></View>;
  return <View style={[styles.page, { backgroundColor: colors.background }]}><ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 45 }} keyboardShouldPersistTaps="handled"><View style={styles.content}>
    <Pressable testID="contractor-profile-back" onPress={() => router.back()}><Feather name="arrow-left" size={20} color={colors.foreground} /></Pressable>
    <ScreenHeader title={isArabic ? 'ملف المقاول' : 'Contractor profile'} subtitle={isArabic ? 'أنشئ ملفك وستظهر تفاصيل التجربة من الخادم' : 'Create your profile; plan details come from the server'} />
    {([['businessName', isArabic ? 'اسم المنشأة' : 'Business name'], ['city', isArabic ? 'الولاية / المدينة' : 'Wilayat / city'], ['serviceArea', isArabic ? 'منطقة الخدمة' : 'Service area'], ['phone', isArabic ? 'رقم الهاتف' : 'Phone'], ['bio', isArabic ? 'نبذة عن الأعمال والخدمات' : 'Business and services bio']] as const).map(([key, label]) => <View key={key}><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><TextInput testID={`contractor-${key}`} value={form[key]} onChangeText={(value) => update(key, value)} multiline={key === 'bio'} textAlign={isArabic ? 'right' : 'left'} placeholder={label} placeholderTextColor={colors.mutedForeground} style={[styles.input, key === 'bio' && styles.bio, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /></View>)}
    <Pressable testID="contractor-publish-intent" onPress={() => setPublishIntent((value) => !value)} style={[styles.intent, { borderColor: colors.border, backgroundColor: colors.surface }]}><Feather name={publishIntent ? 'check-square' : 'square'} size={19} color={colors.primary} /><Text style={{ color: colors.foreground, flex: 1 }}>{isArabic ? 'أرغب في نشر ملفي بعد المراجعة' : 'I want my profile published after review'}</Text></Pressable>
    <Text style={[styles.note, { color: colors.mutedForeground }]}>{isArabic ? 'يتم نشر الملف بعد مراجعة الإدارة.' : 'Publishing is controlled by administrator review.'}</Text>
    <View testID="save-contractor-profile"><ActionButton label={upsert.isPending ? (isArabic ? 'جارٍ الحفظ…' : 'Saving…') : (isArabic ? 'إنشاء ملف المقاول' : 'Create contractor profile')} onPress={() => { if (form.businessName.trim().length < 2 || form.city.trim().length < 2) { Alert.alert(isArabic ? 'بيانات ناقصة' : 'Missing details', isArabic ? 'أدخل اسم المنشأة والمدينة.' : 'Enter a business name and city.'); return; } upsert.mutate({ data: form }); }} /></View>
  </View></ScrollView></View>;
}
const styles = StyleSheet.create({ page:{flex:1},center:{alignItems:'center',justifyContent:'center',padding:28,gap:18},content:{paddingHorizontal:20,gap:12},title:{fontSize:22,fontWeight:'800',textAlign:'center'},label:{fontSize:12,fontWeight:'800',marginBottom:6},input:{borderWidth:1,borderRadius:13,minHeight:47,paddingHorizontal:12,fontSize:14},bio:{minHeight:90,paddingTop:12,textAlignVertical:'top'},intent:{borderWidth:1,borderRadius:13,padding:13,flexDirection:'row',gap:10,alignItems:'center',marginTop:3},note:{fontSize:12,lineHeight:18} });