import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, FixedBackButton, ScreenHeader, ServiceIcon } from '@/components/MoqawilUI';
import { serviceItems, type ServiceId } from '@/data/mockData';
import { omanGovernorates } from '@/data/omanLocations';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useCreateMyServiceRegistration } from '@workspace/api-client-react';

type RegistrationCategory = Exclude<ServiceId, 'contractors'>;
type MediaItem = { id: string; dataUrl: string; type: 'image' | 'video'; name: string; size: number };

const MAX_MEDIA = 15;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
const categories: RegistrationCategory[] = ['consultants', 'design', 'building', 'real-estate', 'maintenance'];
const allWilayats = omanGovernorates.flatMap((governorate) => governorate.wilayats.map((wilayat) => ({ ...wilayat, governorate: governorate.name, governorateAr: governorate.nameAr })));

const copy: Record<RegistrationCategory, {
  titleAr: string;
  titleEn: string;
  nameAr: string;
  nameEn: string;
  namePlaceholderAr: string;
  namePlaceholderEn: string;
  specialtyAr: string;
  specialtyEn: string;
  specialtyPlaceholderAr: string;
  specialtyPlaceholderEn: string;
  locationAr: string;
  locationEn: string;
  descriptionPlaceholderAr: string;
  descriptionPlaceholderEn: string;
  ruleAr: string;
  ruleEn: string;
}> = {
  consultants: {
    titleAr: 'تسجيل خدمة استشارية', titleEn: 'Register a consultancy service',
    nameAr: 'اسم المكتب أو الاستشاري', nameEn: 'Office or consultant name',
    namePlaceholderAr: 'مثال: مكتب الرؤية للاستشارات', namePlaceholderEn: 'Example: Vision Consultancy',
    specialtyAr: 'مجال الاستشارة', specialtyEn: 'Consultancy field',
    specialtyPlaceholderAr: 'هندسي، معماري، إدارة مشاريع…', specialtyPlaceholderEn: 'Engineering, architecture, project management…',
    locationAr: 'موقع تقديم الخدمة', locationEn: 'Service location',
    descriptionPlaceholderAr: 'اكتب نبذة عن الخبرة والمؤهلات ونطاق الخدمات الاستشارية…', descriptionPlaceholderEn: 'Describe your experience, qualifications, and consultancy scope…',
    ruleAr: 'يجب امتلاك المؤهلات أو التراخيص المطلوبة للخدمة الاستشارية وعدم تقديم ادعاءات مهنية غير صحيحة.', ruleEn: 'You must hold any qualifications or licences required for the consultancy and avoid false professional claims.',
  },
  design: {
    titleAr: 'تسجيل خدمة تصميم', titleEn: 'Register a design service',
    nameAr: 'اسم المصمم أو الاستوديو', nameEn: 'Designer or studio name',
    namePlaceholderAr: 'مثال: استوديو أبعاد للتصميم', namePlaceholderEn: 'Example: Dimensions Design Studio',
    specialtyAr: 'نوع التصميم', specialtyEn: 'Design specialty',
    specialtyPlaceholderAr: 'داخلي، معماري، حدائق، واجهات…', specialtyPlaceholderEn: 'Interior, architectural, landscape, façades…',
    locationAr: 'منطقة تقديم الخدمة', locationEn: 'Service area',
    descriptionPlaceholderAr: 'اشرح أسلوب التصميم والخدمات التي تقدمها وخبرتك…', descriptionPlaceholderEn: 'Describe your design style, services, and experience…',
    ruleAr: 'يجب أن تكون التصاميم والأعمال المعروضة أصلية أو لديك إذن واضح لنشرها.', ruleEn: 'Displayed designs and work must be original or published with clear permission.',
  },
  building: {
    titleAr: 'تسجيل ورشة بناء', titleEn: 'Register a building workshop',
    nameAr: 'اسم الورشة', nameEn: 'Workshop name',
    namePlaceholderAr: 'مثال: ورشة الإتقان للألمنيوم', namePlaceholderEn: 'Example: Itqan Aluminium Workshop',
    specialtyAr: 'تخصص الورشة', specialtyEn: 'Workshop specialty',
    specialtyPlaceholderAr: 'ألمنيوم، نجارة، حدادة، زجاج…', specialtyPlaceholderEn: 'Aluminium, carpentry, steel, glass…',
    locationAr: 'موقع الورشة', locationEn: 'Workshop location',
    descriptionPlaceholderAr: 'اذكر المنتجات والخدمات والمعدات ونطاق التوصيل أو التركيب…', descriptionPlaceholderEn: 'Describe products, services, equipment, delivery, and installation coverage…',
    ruleAr: 'يجب أن تكون المنتجات والأعمال المعروضة من تنفيذ الورشة وأن تلتزم بمتطلبات السلامة والجودة.', ruleEn: 'Displayed products and work must be produced by the workshop and meet safety and quality requirements.',
  },
  'real-estate': {
    titleAr: 'تسجيل إعلان عقاري', titleEn: 'Register a real-estate listing',
    nameAr: 'اسم العقار أو المكتب', nameEn: 'Property or agency name',
    namePlaceholderAr: 'مثال: فيلا سكنية في بوشر', namePlaceholderEn: 'Example: Residential villa in Bawshar',
    specialtyAr: 'نوع العقار', specialtyEn: 'Property type',
    specialtyPlaceholderAr: 'فيلا، شقة، أرض، مكتب، محل…', specialtyPlaceholderEn: 'Villa, apartment, land, office, shop…',
    locationAr: 'موقع العقار', locationEn: 'Property location',
    descriptionPlaceholderAr: 'اكتب تفاصيل العقار ومساحته وحالته والغرض من الإعلان…', descriptionPlaceholderEn: 'Describe the property, its area, condition, and listing purpose…',
    ruleAr: 'يجب أن تكون مالك العقار أو مفوضًا بالإعلان عنه، وأن تكون بيانات الموقع والحالة والغرض صحيحة.', ruleEn: 'You must own the property or be authorised to advertise it, with accurate location, condition, and listing details.',
  },
  maintenance: {
    titleAr: 'تسجيل خدمة صيانة', titleEn: 'Register a maintenance service',
    nameAr: 'اسم مقدم الخدمة أو المنشأة', nameEn: 'Provider or business name',
    namePlaceholderAr: 'مثال: الحل السريع للصيانة', namePlaceholderEn: 'Example: Quick Fix Maintenance',
    specialtyAr: 'تخصص الصيانة', specialtyEn: 'Maintenance specialty',
    specialtyPlaceholderAr: 'كهرباء، سباكة، تكييف، أجهزة…', specialtyPlaceholderEn: 'Electrical, plumbing, AC, appliances…',
    locationAr: 'منطقة تغطية الخدمة', locationEn: 'Service coverage',
    descriptionPlaceholderAr: 'اشرح أنواع الصيانة والخبرة وساعات العمل وسرعة الاستجابة…', descriptionPlaceholderEn: 'Describe maintenance types, experience, hours, and response time…',
    ruleAr: 'يجب توفر الخبرة والأدوات المناسبة، والالتزام بالسلامة وعدم عرض خدمات تحتاج ترخيصًا دون امتلاكه.', ruleEn: 'You must have suitable experience and tools, follow safety rules, and not offer licensed work without the required licence.',
  },
};

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid file'));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.readAsDataURL(blob);
  });
}

export default function ServiceRegistrationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isArabic } = useApp();
  const { isSignedIn } = useAuth();
  const params = useLocalSearchParams<{ category?: string }>();
  const category = categories.includes(params.category as RegistrationCategory) ? params.category as RegistrationCategory : 'consultants';
  const categoryCopy = copy[category];
  const service = serviceItems.find((item) => item.id === category)!;
  const [form, setForm] = useState({ title: '', specialty: '', description: '' });
  const [serviceWilayats, setServiceWilayats] = useState<string[]>([]);
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const totalBytes = useMemo(() => media.reduce((sum, item) => sum + item.size, 0), [media]);
  const servesAllGovernorates = serviceWilayats.length === allWilayats.length;
  const toggleWilayat = (name: string) => setServiceWilayats((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);

  const createRegistration = useCreateMyServiceRegistration({ mutation: {
    onSuccess: () => Alert.alert(
      isArabic ? 'تم إرسال التسجيل' : 'Registration submitted',
      isArabic ? 'تم حفظ طلبك وسيظهر بعد مراجعة الإدارة.' : 'Your registration was saved and will appear after administrator review.',
      [{ text: isArabic ? 'حسنًا' : 'OK', onPress: () => router.back() }],
    ),
    onError: () => Alert.alert(isArabic ? 'تعذر إرسال التسجيل' : 'Could not submit registration', isArabic ? 'تحقق من البيانات والوسائط وحاول مرة أخرى.' : 'Check the details and media, then try again.'),
  } });

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const pickMedia = async () => {
    if (media.length >= MAX_MEDIA || mediaLoading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(isArabic ? 'نحتاج إذن الصور والفيديو' : 'Media access needed', isArabic ? 'اسمح بالوصول إلى مكتبة الصور والفيديو لإضافة أعمالك.' : 'Allow media-library access to add your work.');
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
      const additions: MediaItem[] = [];
      let usedBytes = totalBytes;
      for (const asset of result.assets) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const size = asset.fileSize ?? blob.size;
        if (size > MAX_FILE_BYTES || usedBytes + size > MAX_TOTAL_BYTES) continue;
        const type = asset.type === 'video' || asset.mimeType?.startsWith('video/') ? 'video' : 'image';
        additions.push({
          id: `${asset.assetId ?? asset.uri}-${Date.now()}-${additions.length}`,
          dataUrl: await blobToDataUrl(blob),
          type,
          name: asset.fileName ?? (type === 'video' ? (isArabic ? 'فيديو' : 'Video') : (isArabic ? 'صورة' : 'Photo')),
          size,
        });
        usedBytes += size;
      }
      setMedia((current) => [...current, ...additions].slice(0, MAX_MEDIA));
      if (additions.length !== result.assets.length) Alert.alert(isArabic ? 'لم تتم إضافة بعض الملفات' : 'Some files were not added', isArabic ? 'الحد 5 ميجابايت لكل ملف و24 ميجابايت إجمالًا.' : 'The limit is 5 MB per file and 24 MB in total.');
    } catch {
      Alert.alert(isArabic ? 'تعذر قراءة الملفات' : 'Could not read files');
    } finally {
      setMediaLoading(false);
    }
  };

  if (!isSignedIn) return <View style={[styles.page, styles.center, { backgroundColor: colors.background }]}><Text style={[styles.centerTitle, { color: colors.foreground }]}>{isArabic ? 'سجّل الدخول لإضافة خدمتك' : 'Sign in to add your service'}</Text><ActionButton label={isArabic ? 'تسجيل الدخول' : 'Sign in'} onPress={() => router.push('/sign-in')} /></View>;

  const terms = isArabic ? [
    categoryCopy.ruleAr,
    'يجب أن تكون المعلومات والصور والفيديوهات صحيحة وتمثل خدماتك أو أعمالك الفعلية.',
    'يسمح بحد أقصى 15 صورة وفيديو معًا، وبحد 5 ميجابايت لكل ملف و60 ثانية للفيديو.',
    'يمنع نشر بيانات شخصية للعملاء أو محتوى منسوخ أو مضلل أو مخالف للأنظمة.',
    'تراجع الإدارة التسجيل قبل ظهوره، ويحق لها طلب تعديل المحتوى أو رفضه أو إزالته.',
  ] : [
    categoryCopy.ruleEn,
    'Information, photos, and videos must be accurate and represent your real services or work.',
    'Upload up to 15 photos and videos combined, with a 5 MB limit per file and 60 seconds per video.',
    'Do not publish client personal data, copied work, misleading content, or unlawful material.',
    'The administrator reviews the registration before it appears and may request changes, reject it, or remove it.',
  ];
  const valid = form.title.trim().length >= 2 && form.specialty.trim().length >= 2 && serviceWilayats.length > 0 && form.description.trim().length >= 20 && media.length > 0 && termsAccepted;
  const primaryLocation = allWilayats.find((item) => item.name === serviceWilayats[0]);

  return (
    <View style={[styles.page, { backgroundColor: colors.background, direction: isArabic ? 'rtl' : 'ltr' }]}>
      <FixedBackButton testID="service-registration-back" onPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <ScreenHeader title={isArabic ? categoryCopy.titleAr : categoryCopy.titleEn} subtitle={isArabic ? 'أضف بياناتك وأعمالك للمراجعة' : 'Add your details and work for review'} />
          <View style={[styles.categoryBanner, { backgroundColor: service.color }]}>
            <View style={styles.bannerIcon}><ServiceIcon icon={service.icon} color="#FFFFFF" size={24} /></View>
            <View style={styles.bannerCopy}><Text style={styles.bannerTitle}>{isArabic ? service.labelAr : service.label}</Text><Text style={styles.bannerSubtitle}>{isArabic ? service.subtitleAr : service.subtitle}</Text></View>
          </View>
          <Field label={isArabic ? categoryCopy.nameAr : categoryCopy.nameEn} testID="registration-title" value={form.title} onChangeText={(value) => update('title', value)} placeholder={isArabic ? categoryCopy.namePlaceholderAr : categoryCopy.namePlaceholderEn} isArabic={isArabic} colors={colors} />
          <Field label={isArabic ? categoryCopy.specialtyAr : categoryCopy.specialtyEn} testID="registration-specialty" value={form.specialty} onChangeText={(value) => update('specialty', value)} placeholder={isArabic ? categoryCopy.specialtyPlaceholderAr : categoryCopy.specialtyPlaceholderEn} isArabic={isArabic} colors={colors} />
            <View style={[styles.coverageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'الولايات التي تقدم فيها الخدمة' : 'Wilayats you serve'}</Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>{isArabic ? 'يمكنك اختيار أكثر من ولاية.' : 'You can select more than one wilayat.'}</Text>
              <Pressable testID="coverage-all-oman" accessibilityRole="checkbox" accessibilityState={{ checked: servesAllGovernorates }} onPress={() => setServiceWilayats(servesAllGovernorates ? [] : allWilayats.map((item) => item.name))} style={[styles.choiceRow, { borderColor: servesAllGovernorates ? colors.primary : colors.border, backgroundColor: servesAllGovernorates ? colors.primarySoft : colors.background }]}>
                <Feather name={servesAllGovernorates ? 'check-square' : 'square'} size={19} color={colors.primary} />
                <View style={{ flex: 1 }}><Text style={[styles.choiceTitle, { color: colors.foreground }]}>{isArabic ? 'كل السلطنة' : 'All Oman'}</Text></View>
              </Pressable>
              {omanGovernorates.map((governorate) => <View key={governorate.name} style={styles.governorateGroup}>
                <Text style={[styles.governorateTitle, { color: colors.foreground }]}>{isArabic ? governorate.nameAr : governorate.name}</Text>
                <View style={styles.wilayatGrid}>{governorate.wilayats.map((wilayat) => {
                  const selected = serviceWilayats.includes(wilayat.name);
                  return <Pressable key={wilayat.name} testID={`coverage-wilayat-${wilayat.name}`} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleWilayat(wilayat.name)} style={[styles.wilayatChoice, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.background }]}>
                    <Feather name={selected ? 'check-square' : 'square'} size={16} color={selected ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.wilayatChoiceText, { color: colors.foreground }]}>{isArabic ? wilayat.nameAr : wilayat.name}</Text>
                  </Pressable>;
                })}</View>
              </View>)}
             <Pressable testID="delivery-available" accessibilityRole="checkbox" accessibilityState={{ checked: deliveryAvailable }} onPress={() => setDeliveryAvailable((current) => !current)} style={[styles.deliveryRow, { borderTopColor: colors.border }]}>
               <Feather name={deliveryAvailable ? 'check-square' : 'square'} size={20} color={colors.primary} />
               <Text style={[styles.choiceTitle, { color: colors.foreground }]}>{isArabic ? 'يوفر التوصيل أو الوصول إلى موقع العميل' : 'Delivery or travel to the customer is available'}</Text>
             </Pressable>
            </View>
          <View><Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'نبذة عن الأعمال والخدمات' : 'About the work and services'}</Text><TextInput testID="registration-description" value={form.description} onChangeText={(value) => update('description', value)} multiline textAlign={isArabic ? 'right' : 'left'} placeholder={isArabic ? categoryCopy.descriptionPlaceholderAr : categoryCopy.descriptionPlaceholderEn} placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.description, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /></View>
          <View><Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'صور وفيديوهات الأعمال' : 'Work photos and videos'}</Text><Text style={[styles.hint, { color: colors.mutedForeground }]}>{isArabic ? `${media.length}/15 · الحد الإجمالي 24 م.ب` : `${media.length}/15 · 24 MB total limit`}</Text></View>
          <View style={styles.mediaGrid}>
            {media.map((item) => <View key={item.id} style={[styles.mediaCard, { borderColor: colors.border }]}>{item.type === 'image' ? <Image source={{ uri: item.dataUrl }} style={styles.preview} /> : <View style={[styles.video, { backgroundColor: colors.primarySoft }]}><Feather name="video" size={23} color={colors.primary} /><Text numberOfLines={1} style={[styles.videoName, { color: colors.foreground }]}>{item.name}</Text></View>}<Pressable onPress={() => setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id))} style={[styles.remove, { backgroundColor: colors.navy }]}><Feather name="x" size={13} color="#FFFFFF" /></Pressable></View>)}
            {media.length < MAX_MEDIA ? <Pressable testID="add-registration-media" onPress={pickMedia} disabled={mediaLoading} style={[styles.addMedia, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>{mediaLoading ? <ActivityIndicator color={colors.primary} /> : <><Feather name="plus" size={23} color={colors.primary} /><Text style={[styles.addMediaText, { color: colors.primary }]}>{isArabic ? 'إضافة وسائط' : 'Add media'}</Text></>}</Pressable> : null}
          </View>
          <View style={[styles.termsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.termsTitle, { color: colors.foreground }]}>{isArabic ? 'شروط التسجيل والإعلان' : 'Registration and advertising terms'}</Text>
            {terms.map((term, index) => <View key={term} style={styles.termRow}><Text style={[styles.termNumber, { color: colors.primary }]}>{index + 1}</Text><Text style={[styles.termText, { color: colors.mutedForeground }]}>{term}</Text></View>)}
            <Pressable testID="registration-terms" accessibilityRole="checkbox" accessibilityState={{ checked: termsAccepted }} onPress={() => setTermsAccepted((current) => !current)} style={[styles.acceptRow, { borderTopColor: colors.border }]}><Feather name={termsAccepted ? 'check-square' : 'square'} size={20} color={colors.primary} /><Text style={[styles.acceptText, { color: colors.foreground }]}>{isArabic ? 'أوافق على شروط التسجيل والنشر' : 'I agree to the registration and publishing terms'}</Text></Pressable>
          </View>
           <ActionButton label={createRegistration.isPending ? (isArabic ? 'جارٍ الإرسال…' : 'Submitting…') : (isArabic ? 'إرسال للمراجعة' : 'Submit for review')} onPress={() => { if (!valid || !primaryLocation) { Alert.alert(isArabic ? 'أكمل البيانات' : 'Complete the details', isArabic ? 'اختر ولاية واحدة على الأقل، وأكمل جميع الحقول، وأضف ملفًا واحدًا على الأقل، ثم وافق على الشروط.' : 'Select at least one wilayat, complete all fields, add at least one media file, and accept the terms.'); return; } createRegistration.mutate({ data: { category, title: form.title.trim(), specialty: form.specialty.trim(), city: primaryLocation.governorate, serviceWilayats, servesAllGovernorates, deliveryAvailable, description: form.description.trim(), mediaUrls: media.map((item) => item.dataUrl), termsAccepted: true } }); }} />
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, testID, value, onChangeText, placeholder, isArabic, colors }: { label: string; testID: string; value: string; onChangeText: (value: string) => void; placeholder: string; isArabic: boolean; colors: ReturnType<typeof useColors> }) {
  return <View><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><TextInput testID={testID} value={value} onChangeText={onChangeText} textAlign={isArabic ? 'right' : 'left'} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 17 },
  centerTitle: { fontSize: 21, fontWeight: '800', textAlign: 'center' },
  content: { paddingHorizontal: 20, gap: 14 },
  categoryBanner: { borderRadius: 19, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIcon: { width: 47, height: 47, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  bannerCopy: { flex: 1, gap: 3 },
  bannerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  bannerSubtitle: { color: 'rgba(255,255,255,0.82)', fontSize: 11 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  hint: { fontSize: 10, marginTop: -3 },
  input: { minHeight: 49, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 14 },
  coverageCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 9 },
  choiceRow: { minHeight: 50, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  choiceTitle: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  deliveryRow: { borderTopWidth: 1, paddingTop: 12, marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 9 },
  governorateGroup: { gap: 7, marginTop: 4 },
  governorateTitle: { fontSize: 12, fontWeight: '800' },
  wilayatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  wilayatChoice: { minHeight: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: '47%', flexGrow: 1, flexBasis: '47%' },
  wilayatChoiceText: { flexShrink: 1, fontSize: 11, fontWeight: '700' },
  description: { minHeight: 122, paddingTop: 12, textAlignVertical: 'top' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mediaCard: { width: 92, height: 92, borderRadius: 14, borderWidth: 1 },
  preview: { width: '100%', height: '100%', borderRadius: 13 },
  video: { flex: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 5 },
  videoName: { width: '100%', textAlign: 'center', fontSize: 9 },
  remove: { position: 'absolute', right: -6, top: -6, width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addMedia: { width: 92, height: 92, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 7 },
  addMediaText: { fontSize: 10, fontWeight: '700' },
  termsCard: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 10 },
  termsTitle: { fontSize: 15, fontWeight: '800' },
  termRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  termNumber: { width: 18, height: 18, borderRadius: 9, textAlign: 'center', fontSize: 10, lineHeight: 18, fontWeight: '800' },
  termText: { flex: 1, fontSize: 11, lineHeight: 18 },
  acceptRow: { borderTopWidth: 1, paddingTop: 12, marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 9 },
  acceptText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '700' },
});