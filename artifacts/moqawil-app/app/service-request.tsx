import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import { ActionButton, ScreenHeader } from '@/components/MoqawilUI';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { buildingServices } from '@/data/buildingServices';
import { omanGovernorates } from '@/data/omanLocations';
import { useCreateServiceRequest } from '@workspace/api-client-react';

export default function ServiceRequestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isArabic } = useApp();
  const { isSignedIn } = useAuth();
  const [service, setService] = useState(buildingServices[0]);
  const [governorateIndex, setGovernorateIndex] = useState(0);
  const [wilayatIndex, setWilayatIndex] = useState(0);
  const [requirements, setRequirements] = useState('');
  const [budget, setBudget] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const governorate = omanGovernorates[governorateIndex]!;
  const wilayat = governorate.wilayats[wilayatIndex]!;
  const createRequest = useCreateServiceRequest({ mutation: {
    onSuccess: () => {
      Alert.alert(isArabic ? 'تم إرسال الطلب' : 'Request sent', isArabic ? 'سيصل طلبك إلى الورش المطابقة وستظهر عروضهم في طلباتي.' : 'Matching workshops can now respond. Their quotes will appear in My requests.', [{ text: isArabic ? 'عرض الطلبات' : 'View requests', onPress: () => router.replace('/requests' as never) }]);
    },
    onError: () => Alert.alert(isArabic ? 'تعذر إرسال الطلب' : 'Could not send request', isArabic ? 'تحقق من البيانات وحاول مرة أخرى.' : 'Check the details and try again.'),
  }});
  const chooseGovernorate = (index: number) => { setGovernorateIndex(index); setWilayatIndex(0); };
  const pickImage = async () => {
    if (images.length >= 5) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(isArabic ? 'نحتاج إذن الصور' : 'Photo access needed', isArabic ? 'اسمح بالوصول للصور لإرفاق حالة العمل.' : 'Allow photo access to attach the work details.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.55, base64: true });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    const image = asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
    setImages((current) => [...current, image]);
  };
  const valid = requirements.trim().length >= 8;
  if (!isSignedIn) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.foreground }]}>{isArabic ? 'سجّل الدخول لإرسال طلب خدمة' : 'Sign in to request a service'}</Text><ActionButton label={isArabic ? 'تسجيل الدخول' : 'Sign in'} onPress={() => router.push('/sign-in')} /></View>;
  return <View style={[styles.page, { backgroundColor: colors.background }]}><ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 50 }} keyboardShouldPersistTaps="handled"><View style={styles.content}>
    <Pressable onPress={() => router.back()}><Feather name="arrow-left" size={20} color={colors.foreground} /></Pressable>
    <ScreenHeader title={isArabic ? 'أحتاج خدمة' : 'I need a service'} subtitle={isArabic ? 'أرسل طلبًا واحدًا لعدة ورش قريبة' : 'Send one request to matching workshops nearby'} />
    <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'نوع الخدمة' : 'Service type'}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{buildingServices.slice(0, 12).map((item) => <Pressable key={item.name} onPress={() => setService(item)} style={[styles.chip, { borderColor: colors.border, backgroundColor: service.name === item.name ? colors.primarySoft : colors.surface }]}><Text style={{ color: service.name === item.name ? colors.primary : colors.foreground, fontSize: 12 }}>{isArabic ? item.nameAr : item.name}</Text></Pressable>)}</ScrollView>
    <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'المحافظة' : 'Governorate'}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{omanGovernorates.map((item, index) => <Pressable key={item.name} onPress={() => chooseGovernorate(index)} style={[styles.chip, { borderColor: colors.border, backgroundColor: governorateIndex === index ? colors.primarySoft : colors.surface }]}><Text style={{ color: governorateIndex === index ? colors.primary : colors.foreground, fontSize: 12 }}>{isArabic ? item.nameAr : item.name}</Text></Pressable>)}</ScrollView>
    <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'الولاية' : 'Wilayat'}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{governorate.wilayats.map((item, index) => <Pressable key={item.name} onPress={() => setWilayatIndex(index)} style={[styles.chip, { borderColor: colors.border, backgroundColor: wilayatIndex === index ? colors.primarySoft : colors.surface }]}><Text style={{ color: wilayatIndex === index ? colors.primary : colors.foreground, fontSize: 12 }}>{isArabic ? item.nameAr : item.name}</Text></Pressable>)}</ScrollView>
    <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'وصف المطلوب' : 'What do you need?'}</Text>
    <TextInput value={requirements} onChangeText={setRequirements} multiline textAlign={isArabic ? 'right' : 'left'} placeholder={isArabic ? 'اكتب تفاصيل العمل، المقاس، والموعد المطلوب…' : 'Describe the work, size, and preferred timing…'} placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} />
    <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'الميزانية التقريبية (ر.ع) - اختياري' : 'Estimated budget (OMR) - optional'}</Text>
    <TextInput value={budget} onChangeText={setBudget} keyboardType="decimal-pad" placeholder="e.g. 150" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} />
    <View style={styles.imageHeader}><Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'صور العمل - اختياري' : 'Work photos - optional'}</Text><Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{images.length}/5</Text></View>
    <ScrollView horizontal contentContainerStyle={styles.images}>{images.map((image, index) => <View key={`${image.slice(0, 15)}-${index}`}><Image source={{ uri: image }} style={styles.thumb} /><Pressable onPress={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={[styles.remove, { backgroundColor: colors.navy }]}><Feather name="x" size={12} color="#fff" /></Pressable></View>)}<Pressable onPress={pickImage} style={[styles.addPhoto, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}><Feather name="camera" size={20} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 11 }}>{isArabic ? 'إضافة' : 'Add'}</Text></Pressable></ScrollView>
    <Text style={[styles.note, { color: colors.mutedForeground }]}>{isArabic ? 'سيتم إرسال الطلب للورش المنشورة في نفس المحافظة والولاية.' : 'Your request is sent to published workshops in the same governorate and wilayat.'}</Text>
    <ActionButton label={createRequest.isPending ? (isArabic ? 'جارٍ الإرسال…' : 'Sending…') : (isArabic ? 'إرسال الطلب للورش' : 'Send to workshops')} onPress={() => { if (!valid) { Alert.alert(isArabic ? 'أضف تفاصيل أكثر' : 'Add more details', isArabic ? 'اكتب 8 أحرف على الأقل عن الخدمة المطلوبة.' : 'Please describe the service in at least 8 characters.'); return; } createRequest.mutate({ data: { serviceCategory: 'building', serviceName: service.name, governorate: governorate.name, wilayat: wilayat.name, requirements: requirements.trim(), budgetOmaniRial: budget.trim() ? Number(budget) : null, imageUrls: images } }); }} />
    {createRequest.isPending ? <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} /> : null}
  </View></ScrollView></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 }, content: { paddingHorizontal: 20, gap: 11 }, title: { fontSize: 22, fontWeight: '800', textAlign: 'center' }, label: { fontSize: 12, fontWeight: '800', marginTop: 7 }, chips: { gap: 8, paddingVertical: 2 }, chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, input: { borderWidth: 1, borderRadius: 13, minHeight: 47, paddingHorizontal: 12, fontSize: 14 }, textarea: { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }, imageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 5 }, images: { gap: 10, alignItems: 'center' }, thumb: { width: 72, height: 72, borderRadius: 13 }, addPhoto: { width: 72, height: 72, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 }, remove: { position: 'absolute', right: -5, top: -5, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, note: { fontSize: 12, lineHeight: 18, marginVertical: 3 },
});