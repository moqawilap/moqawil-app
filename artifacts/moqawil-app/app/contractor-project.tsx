import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, FixedBackButton, ScreenHeader } from '@/components/MoqawilUI';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import {
  getGetMeQueryKey,
  getGetMyContractorProfileQueryKey,
  useCreateMyContractorProject,
  useGetMe,
  useGetMyContractorProfile,
} from '@workspace/api-client-react';

type ProjectMedia = {
  id: string;
  dataUrl: string;
  type: 'image' | 'video';
  name: string;
  size: number;
};

const MAX_MEDIA = 15;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid file'));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.readAsDataURL(blob);
  });
}

export default function ContractorProjectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isArabic } = useApp();
  const { isSignedIn } = useAuth();
  const me = useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled: !!isSignedIn, retry: false } });
  const isContractor = me.data?.role === 'contractor';
  const profile = useGetMyContractorProfile({ query: { queryKey: getGetMyContractorProfileQueryKey(), enabled: !!isSignedIn && isContractor, retry: false } });
  const [form, setForm] = useState({ title: '', city: '', description: '' });
  const [media, setMedia] = useState<ProjectMedia[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);

  const createProject = useCreateMyContractorProject({ mutation: {
    onSuccess: () => {
      Alert.alert(
        isArabic ? 'تم إرسال المشروع' : 'Project submitted',
        isArabic ? 'تم حفظ إعلان مشروعك وسيظهر بعد مراجعة الإدارة.' : 'Your project ad was saved and will appear after administrator review.',
        [{ text: isArabic ? 'حسنًا' : 'OK', onPress: () => router.back() }],
      );
    },
    onError: () => Alert.alert(isArabic ? 'تعذر إرسال المشروع' : 'Could not submit project', isArabic ? 'تحقق من البيانات والوسائط ثم حاول مرة أخرى.' : 'Check the details and media, then try again.'),
  } });

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const pickMedia = async () => {
    if (media.length >= MAX_MEDIA || mediaLoading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(isArabic ? 'نحتاج إذن الصور والفيديو' : 'Media access needed', isArabic ? 'اسمح بالوصول إلى مكتبة الصور والفيديو لإضافة أعمالك.' : 'Allow access to your photo and video library to add your work.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA - media.length,
      quality: 0.6,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;
    setMediaLoading(true);
    try {
      const additions: ProjectMedia[] = [];
      let totalBytes = media.reduce((total, item) => total + item.size, 0);
      for (const asset of result.assets) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const size = asset.fileSize ?? blob.size;
        if (size > MAX_FILE_BYTES || totalBytes + size > MAX_TOTAL_BYTES) continue;
        const dataUrl = await blobToDataUrl(blob);
        const type = asset.type === 'video' || asset.mimeType?.startsWith('video/') ? 'video' : 'image';
        additions.push({
          id: `${asset.assetId ?? asset.uri}-${Date.now()}-${additions.length}`,
          dataUrl,
          type,
          name: asset.fileName ?? (type === 'video' ? (isArabic ? 'فيديو مشروع' : 'Project video') : (isArabic ? 'صورة مشروع' : 'Project photo')),
          size,
        });
        totalBytes += size;
      }
      setMedia((current) => [...current, ...additions].slice(0, MAX_MEDIA));
      if (additions.length !== result.assets.length) {
        Alert.alert(isArabic ? 'لم تتم إضافة بعض الملفات' : 'Some files were not added', isArabic ? 'الحد الأقصى 5 ميجابايت لكل ملف و24 ميجابايت لجميع الملفات.' : 'The limit is 5 MB per file and 24 MB across all files.');
      }
    } catch {
      Alert.alert(isArabic ? 'تعذر قراءة الملفات' : 'Could not read files', isArabic ? 'اختر ملفات أخرى وحاول مرة ثانية.' : 'Choose different files and try again.');
    } finally {
      setMediaLoading(false);
    }
  };

  if (!isSignedIn) {
    return <View style={[styles.page, styles.center, { backgroundColor: colors.background }]}><Text style={[styles.blockTitle, { color: colors.foreground }]}>{isArabic ? 'سجّل الدخول لتسجيل مشروع' : 'Sign in to register a project'}</Text><ActionButton label={isArabic ? 'تسجيل الدخول' : 'Sign in'} onPress={() => router.push('/sign-in')} /></View>;
  }
  if (me.isLoading || (isContractor && profile.isLoading)) {
    return <View style={[styles.page, styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!isContractor || !profile.data) {
    return (
      <View style={[styles.page, { backgroundColor: colors.background, direction: isArabic ? 'rtl' : 'ltr' }]}>
        <FixedBackButton onPress={() => router.back()} />
        <View style={styles.center}>
          <View style={[styles.blockIcon, { backgroundColor: colors.primarySoft }]}><Feather name="briefcase" size={27} color={colors.primary} /></View>
          <Text style={[styles.blockTitle, { color: colors.foreground }]}>{isArabic ? 'هذه الفئة للمقاولين' : 'This category is for contractors'}</Text>
          <Text style={[styles.blockText, { color: colors.mutedForeground }]}>{isArabic ? 'يجب إنشاء ملف مقاول أولًا قبل تسجيل مشروع أو نشر أعمال.' : 'Create a contractor profile before registering a project or publishing work.'}</Text>
          <ActionButton label={isArabic ? 'إنشاء ملف مقاول' : 'Create contractor profile'} onPress={() => router.replace('/contractor-profile' as never)} />
        </View>
      </View>
    );
  }

  const totalBytes = media.reduce((total, item) => total + item.size, 0);
  const valid = form.title.trim().length >= 2 && form.city.trim().length >= 2 && form.description.trim().length >= 20 && media.length >= 1 && termsAccepted;
  const terms = isArabic ? [
    'يجب أن يكون مقدم الإعلان مقاولًا وأن تكون بيانات المنشأة صحيحة.',
    'يجب أن يكون المشروع من تنفيذ المقاول، مع امتلاك حق نشر الصور والفيديوهات وموافقة صاحب المشروع عند الحاجة.',
    'يسمح بحد أقصى 15 صورة وفيديو معًا، وبحد 5 ميجابايت لكل ملف و60 ثانية للفيديو.',
    'يمنع نشر بيانات شخصية للعملاء أو محتوى مضلل أو منسوخ أو مخالف للأنظمة.',
    'تراجع الإدارة الإعلان قبل ظهوره، ويحق لها طلب تعديل المحتوى أو رفضه أو إزالته.',
  ] : [
    'The advertiser must be a contractor and provide accurate business information.',
    'The project must be the contractor’s own work, with rights and any required client consent to publish its media.',
    'Upload up to 15 photos and videos combined, with a 5 MB limit per file and 60 seconds per video.',
    'Do not publish client personal data, misleading content, copied work, or unlawful material.',
    'The administrator reviews every ad before it appears and may request changes, reject it, or remove it.',
  ];

  return (
    <View style={[styles.page, { backgroundColor: colors.background, direction: isArabic ? 'rtl' : 'ltr' }]}>
      <FixedBackButton testID="contractor-project-back" onPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <ScreenHeader title={isArabic ? 'تسجيل مشروع مقاول' : 'Register a contractor project'} subtitle={isArabic ? 'أضف مشروعك لعرضه بعد مراجعة الإدارة' : 'Add your project for administrator review'} />
          <View style={[styles.ownerCard, { backgroundColor: colors.navy }]}>
            <Feather name="shield" size={20} color="#FFFFFF" />
            <View style={styles.ownerCopy}><Text style={styles.ownerTitle}>{profile.data.businessName}</Text><Text style={styles.ownerText}>{isArabic ? 'سيتم تسجيل المشروع تحت ملف المقاول هذا' : 'This project will be registered under this contractor profile'}</Text></View>
          </View>
          <View><Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'اسم المشروع' : 'Project name'}</Text><TextInput testID="project-title" value={form.title} onChangeText={(value) => update('title', value)} textAlign={isArabic ? 'right' : 'left'} placeholder={isArabic ? 'مثال: إنشاء فيلا سكنية' : 'Example: Residential villa construction'} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /></View>
          <View><Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'موقع المشروع' : 'Project location'}</Text><TextInput testID="project-city" value={form.city} onChangeText={(value) => update('city', value)} textAlign={isArabic ? 'right' : 'left'} placeholder={isArabic ? 'المحافظة أو الولاية' : 'Governorate or wilayat'} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /></View>
          <View><Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'وصف المشروع' : 'Project description'}</Text><TextInput testID="project-description" value={form.description} onChangeText={(value) => update('description', value)} multiline textAlign={isArabic ? 'right' : 'left'} placeholder={isArabic ? 'اشرح نوع المشروع، نطاق العمل، المواد، ومدة التنفيذ…' : 'Describe the project, scope, materials, and delivery period…'} placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.description, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /><Text style={[styles.counter, { color: colors.mutedForeground }]}>{form.description.length}/5000</Text></View>
          <View style={styles.mediaHeading}><View><Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'صور وفيديوهات المشروع' : 'Project photos and videos'}</Text><Text style={[styles.mediaHint, { color: colors.mutedForeground }]}>{isArabic ? `المجموع ${media.length}/${MAX_MEDIA} · ${(totalBytes / 1024 / 1024).toFixed(1)} من 24 م.ب` : `${media.length}/${MAX_MEDIA} total · ${(totalBytes / 1024 / 1024).toFixed(1)} of 24 MB`}</Text></View></View>
          <View style={styles.mediaGrid}>
            {media.map((item) => <View key={item.id} style={[styles.mediaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>{item.type === 'image' ? <Image source={{ uri: item.dataUrl }} style={styles.preview} /> : <View style={[styles.videoPreview, { backgroundColor: colors.primarySoft }]}><Feather name="video" size={24} color={colors.primary} /><Text numberOfLines={1} style={[styles.videoName, { color: colors.foreground }]}>{item.name}</Text></View>}<Pressable accessibilityLabel={isArabic ? 'حذف الملف' : 'Remove file'} onPress={() => setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id))} style={[styles.removeMedia, { backgroundColor: colors.navy }]}><Feather name="x" size={13} color="#FFFFFF" /></Pressable></View>)}
            {media.length < MAX_MEDIA ? <Pressable testID="add-project-media" onPress={pickMedia} disabled={mediaLoading} style={[styles.addMedia, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>{mediaLoading ? <ActivityIndicator color={colors.primary} /> : <><Feather name="plus" size={23} color={colors.primary} /><Text style={[styles.addMediaText, { color: colors.primary }]}>{isArabic ? 'إضافة وسائط' : 'Add media'}</Text></>}</Pressable> : null}
          </View>
          <View style={[styles.termsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.termsTitle, { color: colors.foreground }]}>{isArabic ? 'شروط تسجيل الإعلان' : 'Advertisement terms'}</Text>
            {terms.map((term, index) => <View key={term} style={styles.termRow}><Text style={[styles.termNumber, { color: colors.primary }]}>{index + 1}</Text><Text style={[styles.termText, { color: colors.mutedForeground }]}>{term}</Text></View>)}
            <Pressable testID="project-terms" accessibilityRole="checkbox" accessibilityState={{ checked: termsAccepted }} onPress={() => setTermsAccepted((current) => !current)} style={[styles.acceptRow, { borderTopColor: colors.border }]}><Feather name={termsAccepted ? 'check-square' : 'square'} size={20} color={colors.primary} /><Text style={[styles.acceptText, { color: colors.foreground }]}>{isArabic ? 'أوافق على شروط تسجيل ونشر الإعلان' : 'I agree to the advertisement registration and publishing terms'}</Text></Pressable>
          </View>
          <View testID="submit-contractor-project"><ActionButton label={createProject.isPending ? (isArabic ? 'جارٍ الإرسال…' : 'Submitting…') : (isArabic ? 'إرسال المشروع للمراجعة' : 'Submit project for review')} onPress={() => { if (!valid) { Alert.alert(isArabic ? 'أكمل بيانات المشروع' : 'Complete the project details', isArabic ? 'أدخل الاسم والموقع ووصفًا من 20 حرفًا على الأقل، وأضف ملفًا واحدًا، ثم وافق على الشروط.' : 'Enter a name, location, a description of at least 20 characters, add one file, and accept the terms.'); return; } createProject.mutate({ data: { title: form.title.trim(), city: form.city.trim(), description: form.description.trim(), mediaUrls: media.map((item) => item.dataUrl), termsAccepted: true } }); }} /></View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  blockIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  blockTitle: { fontSize: 21, fontWeight: '800', textAlign: 'center' },
  blockText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  content: { paddingHorizontal: 20, gap: 14 },
  ownerCard: { borderRadius: 17, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  ownerCopy: { flex: 1, gap: 3 },
  ownerTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  ownerText: { color: '#D9E3EC', fontSize: 11 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  input: { minHeight: 49, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 14 },
  description: { minHeight: 125, paddingTop: 12, textAlignVertical: 'top' },
  counter: { fontSize: 10, marginTop: 4 },
  mediaHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  mediaHint: { fontSize: 10 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mediaCard: { width: 92, height: 92, borderRadius: 14, borderWidth: 1, overflow: 'visible' },
  preview: { width: '100%', height: '100%', borderRadius: 13 },
  videoPreview: { flex: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 5 },
  videoName: { width: '100%', textAlign: 'center', fontSize: 9 },
  removeMedia: { position: 'absolute', right: -6, top: -6, width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addMedia: { width: 92, height: 92, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 7 },
  addMediaText: { fontSize: 10, fontWeight: '700' },
  termsCard: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 10 },
  termsTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  termRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  termNumber: { width: 18, height: 18, borderRadius: 9, textAlign: 'center', fontSize: 10, lineHeight: 18, fontWeight: '800' },
  termText: { flex: 1, fontSize: 11, lineHeight: 18 },
  acceptRow: { borderTopWidth: 1, paddingTop: 12, marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 9 },
  acceptText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '700' },
});