import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, FixedBackButton, ScreenHeader } from '@/components/MoqawilUI';
import { SubscriptionPlanSelector, type ServiceSubscriptionPlanCode } from '@/components/SubscriptionPlanSelector';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getGetMeQueryKey, getGetMyContractorProfileQueryKey, useGetMe, useGetMyContractorProfile, useUpsertMyContractorProfile } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

export default function ContractorProfileScreen() {
  const colors = useColors(), insets = useSafeAreaInsets(); const { isArabic } = useApp(); const { isSignedIn } = useAuth();
  const client = useQueryClient();
  const [form, setForm] = useState({ businessName: '', city: '', wilayat: '', serviceArea: '', phone: '', bio: '' });
  const [photos, setPhotos] = useState<string[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [publishIntent, setPublishIntent] = useState(true);
  const [subscriptionPlanCode, setSubscriptionPlanCode] = useState<ServiceSubscriptionPlanCode | ''>('');
  const profile = useGetMyContractorProfile({ query: { queryKey: getGetMyContractorProfileQueryKey(), enabled: !!isSignedIn, retry: false } });
  useEffect(() => {
    if (!profile.data) return;
    setForm({
      businessName: profile.data.businessName,
      city: profile.data.city,
      wilayat: profile.data.wilayat ?? '',
      serviceArea: profile.data.serviceArea ?? '',
      phone: profile.data.phone ?? '',
      bio: profile.data.bio ?? '',
    });
    setPhotos(profile.data.imageUrls ?? []);
  }, [profile.data]);
  const upsert = useUpsertMyContractorProfile({ mutation: {
    onSuccess: (result) => {
      const wasCreating = !profile.data;
      client.invalidateQueries({ queryKey: getGetMeQueryKey() });
      client.invalidateQueries({ queryKey: getGetMyContractorProfileQueryKey() });
      if (wasCreating) router.replace('/subscription' as never);
      Alert.alert(wasCreating ? (isArabic ? 'تم إنشاء التجربة' : 'Trial created') : (isArabic ? 'تم تحديث الملف' : 'Profile updated'), isArabic ? `ينتهي اشتراكك التجريبي في ${new Date(result.subscription.trialEndsAt).toLocaleDateString()}.` : `Your subscription trial runs until ${new Date(result.subscription.trialEndsAt).toLocaleDateString()}.`);
    },
    onError: () => Alert.alert(isArabic ? 'تعذر الحفظ' : 'Save failed', isArabic ? 'تحقق من البيانات وحاول مرة أخرى.' : 'Check the details and try again.'),
  } });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const pickPhotos = async () => {
    if (photos.length >= 15 || photosLoading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(isArabic ? 'نحتاج إذن الصور' : 'Photo access needed', isArabic ? 'اسمح بالوصول إلى مكتبة الصور لإضافة صور أعمالك.' : 'Allow access to your photo library to add your work photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 15 - photos.length,
      quality: 0.55,
      base64: true,
    });
    if (result.canceled) return;
    setPhotosLoading(true);
    try {
      const additions: string[] = [];
      for (const asset of result.assets) {
        let dataUrl = asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : '';
        if (!dataUrl) {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          if (blob.size > 1_500_000) continue;
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image'));
            reader.onerror = () => reject(reader.error ?? new Error('Unable to read image'));
            reader.readAsDataURL(blob);
          });
        }
        if (dataUrl.length <= 1_950_000) additions.push(dataUrl);
      }
      setPhotos((current) => [...current, ...additions].slice(0, 15));
      if (additions.length !== result.assets.length) {
        Alert.alert(isArabic ? 'لم تتم إضافة بعض الصور' : 'Some photos were not added', isArabic ? 'الحد الأقصى 15 صورة، ويجب أن يكون حجم الصورة مناسبًا.' : 'Up to 15 photos are allowed, and each photo must be a reasonable size.');
      }
    } catch {
      Alert.alert(isArabic ? 'تعذر قراءة الصور' : 'Could not read photos', isArabic ? 'اختر صورًا أخرى وحاول مرة ثانية.' : 'Choose different photos and try again.');
    } finally {
      setPhotosLoading(false);
    }
  };
  if (!isSignedIn) return <View style={[styles.page, styles.center, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.foreground }]}>{isArabic ? 'سجّل الدخول للانضمام كمقاول' : 'Sign in to join as a contractor'}</Text><ActionButton label={isArabic ? 'تسجيل الدخول' : 'Sign in'} onPress={() => router.push('/sign-in')} /></View>;
  return <View style={[styles.page, { backgroundColor: colors.background, direction: isArabic ? 'rtl' : 'ltr' }]}><FixedBackButton testID="contractor-profile-back" onPress={() => router.back()} /><ScrollView contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: 45 }} keyboardShouldPersistTaps="handled"><View style={styles.content}>
     <ScreenHeader title={isArabic ? 'ملف المقاول' : 'Contractor profile'} subtitle={profile.data ? (isArabic ? 'حدّث بيانات ملفك' : 'Keep your listing details up to date') : (isArabic ? 'أنشئ ملفك واختر الباقة' : 'Create your profile and choose a plan')} />
    {profile.isLoading ? <ActivityIndicator testID="contractor-profile-loading" color={colors.primary} /> : null}
     {([['businessName', isArabic ? 'اسم المنشأة' : 'Business name'], ['city', isArabic ? 'المحافظة' : 'Governorate'], ['wilayat', isArabic ? 'الولاية' : 'Wilayat'], ['serviceArea', isArabic ? 'منطقة الخدمة' : 'Service area'], ['phone', isArabic ? 'رقم الهاتف' : 'Phone'], ['bio', isArabic ? 'نبذة عن الأعمال والخدمات' : 'Business and services bio']] as const).map(([key, label]) => <View key={key}><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><TextInput testID={`contractor-${key}`} value={form[key]} onChangeText={(value) => update(key, value)} multiline={key === 'bio'} textAlign={isArabic ? 'right' : 'left'} placeholder={label} placeholderTextColor={colors.mutedForeground} style={[styles.input, key === 'bio' && styles.bio, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /></View>)}
      {!profile.data ? <SubscriptionPlanSelector category="service" value={subscriptionPlanCode} onChange={(code) => setSubscriptionPlanCode(code as ServiceSubscriptionPlanCode)} /> : null}
      <View style={styles.photosSection}>
       <View style={styles.photosHeading}><View><Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'صور الأعمال' : 'Work photos'}</Text><Text style={[styles.photosHint, { color: colors.mutedForeground }]}>{isArabic ? `أضف صورًا لأعمالك (${photos.length}/15)` : `Add photos of your work (${photos.length}/15)`}</Text></View><Feather name="image" size={19} color={colors.primary} /></View>
       <View style={styles.photosGrid}>
         {photos.map((photo, index) => <View key={`${photo.slice(0, 20)}-${index}`} style={[styles.photoCard, { borderColor: colors.border }]}><Image source={{ uri: photo }} style={styles.photo} /><Pressable testID={`remove-contractor-photo-${index}`} accessibilityLabel={isArabic ? 'حذف الصورة' : 'Remove photo'} onPress={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} style={[styles.removePhoto, { backgroundColor: colors.navy }]}><Feather name="x" size={13} color="#FFFFFF" /></Pressable></View>)}
         {photos.length < 15 ? <Pressable testID="add-contractor-photos" onPress={pickPhotos} disabled={photosLoading} style={[styles.addPhotos, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>{photosLoading ? <ActivityIndicator color={colors.primary} /> : <><Feather name="plus" size={22} color={colors.primary} /><Text style={[styles.addPhotosText, { color: colors.primary }]}>{isArabic ? 'إضافة صور' : 'Add photos'}</Text></>}</Pressable> : null}
       </View>
       <Text style={[styles.note, { color: colors.mutedForeground }]}>{isArabic ? 'يمكنك إضافة 15 صورة كحد أقصى، وستظهر تحت نبذة الأعمال والخدمات في ملفك.' : 'You can add up to 15 photos. They will appear below your business and services bio.'}</Text>
     </View>
    <Pressable testID="contractor-publish-intent" onPress={() => setPublishIntent((value) => !value)} style={[styles.intent, { borderColor: colors.border, backgroundColor: colors.surface }]}><Feather name={publishIntent ? 'check-square' : 'square'} size={19} color={colors.primary} /><Text style={{ color: colors.foreground, flex: 1 }}>{isArabic ? 'أرغب في نشر ملفي بعد المراجعة' : 'I want my profile published after review'}</Text></Pressable>
    <Text style={[styles.note, { color: colors.mutedForeground }]}>{isArabic ? 'يتم نشر الملف بعد مراجعة الإدارة.' : 'Publishing is controlled by administrator review.'}</Text>
      <View testID="save-contractor-profile"><ActionButton label={upsert.isPending ? (isArabic ? 'جارٍ الحفظ…' : 'Saving…') : profile.data ? (isArabic ? 'حفظ التعديلات' : 'Save profile changes') : (isArabic ? 'إنشاء ملف المقاول' : 'Create contractor profile')} onPress={() => { if (form.businessName.trim().length < 2 || form.city.trim().length < 2 || form.wilayat.trim().length < 2 || (!profile.data && !subscriptionPlanCode)) { Alert.alert(isArabic ? 'بيانات ناقصة' : 'Missing details', isArabic ? 'أدخل بيانات المنشأة واختر الباقة الشهرية أو السنوية.' : 'Enter the business details and choose a monthly or annual plan.'); return; } upsert.mutate({ data: { ...form, imageUrls: photos, subscriptionPlanCode: subscriptionPlanCode || undefined } }); }} /></View>
  </View></ScrollView></View>;
}
 const styles = StyleSheet.create({ page:{flex:1},center:{alignItems:'center',justifyContent:'center',padding:28,gap:18},content:{paddingHorizontal:20,gap:12},title:{fontSize:22,fontWeight:'800',textAlign:'center'},label:{fontSize:12,fontWeight:'800',marginBottom:6},input:{borderWidth:1,borderRadius:13,minHeight:47,paddingHorizontal:12,fontSize:14},bio:{minHeight:90,paddingTop:12,textAlignVertical:'top'},photosSection:{gap:8,marginTop:2},photosHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},photosHint:{fontSize:11,marginTop:-2},photosGrid:{flexDirection:'row',flexWrap:'wrap',gap:9},photoCard:{width:78,height:78,borderWidth:1,borderRadius:13},photo:{width:'100%',height:'100%',borderRadius:12},removePhoto:{position:'absolute',right:-6,top:-6,width:22,height:22,borderRadius:11,alignItems:'center',justifyContent:'center'},addPhotos:{width:78,height:78,borderWidth:1,borderStyle:'dashed',borderRadius:13,alignItems:'center',justifyContent:'center',gap:5},addPhotosText:{fontSize:10,fontWeight:'700'},intent:{borderWidth:1,borderRadius:13,padding:13,flexDirection:'row',gap:10,alignItems:'center',marginTop:3},note:{fontSize:12,lineHeight:18} });