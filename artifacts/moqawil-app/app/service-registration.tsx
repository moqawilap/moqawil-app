import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, FixedBackButton, ScreenHeader, ServiceIcon } from '@/components/MoqawilUI';
import { SubscriptionPlanSelector, type SubscriptionPlanCode } from '@/components/SubscriptionPlanSelector';
import { serviceItems, type ServiceId } from '@/data/mockData';
import { omanGovernorates, omanWilayatAreas } from '@/data/omanLocations';
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
const propertyTypes = [
  { value: 'apartment', ar: 'شقة', en: 'Apartment' },
  { value: 'villa', ar: 'فيلا', en: 'Villa' },
  { value: 'house', ar: 'بيت', en: 'House' },
  { value: 'land', ar: 'أرض', en: 'Land' },
  { value: 'office', ar: 'مكتب', en: 'Office' },
  { value: 'shop', ar: 'محل', en: 'Shop' },
  { value: 'warehouse', ar: 'مخزن', en: 'Warehouse' },
  { value: 'farm', ar: 'مزرعة', en: 'Farm' },
] as const;
const propertyTypesWithoutRoomCounts = new Set(['land', 'office', 'shop', 'warehouse', 'farm']);
const countFields = [
  { key: 'bedrooms', ar: 'غرف النوم', en: 'Bedrooms' },
  { key: 'livingRooms', ar: 'الصالات', en: 'Living rooms' },
  { key: 'majlis', ar: 'المجالس', en: 'Majlis' },
  { key: 'kitchens', ar: 'المطابخ', en: 'Kitchens' },
  { key: 'bathrooms', ar: 'دورات المياه', en: 'Bathrooms' },
] as const;

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
  const [form, setForm] = useState({ title: '', specialty: '', phone: '', description: '' });
  const [serviceWilayats, setServiceWilayats] = useState<string[]>([]);
  const [serviceGovernorates, setServiceGovernorates] = useState<string[]>([]);
  const [serviceLocationLevel, setServiceLocationLevel] = useState<'governorates' | 'wilayats'>('governorates');
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [propertyGovernorate, setPropertyGovernorate] = useState('');
  const [propertyWilayat, setPropertyWilayat] = useState('');
  const [propertyArea, setPropertyArea] = useState('');
  const [customPropertyArea, setCustomPropertyArea] = useState('');
  const [listingType, setListingType] = useState<'sale' | 'rent'>('sale');
  const [propertyType, setPropertyType] = useState('');
  const [propertySize, setPropertySize] = useState('');
  const [propertyCounts, setPropertyCounts] = useState({ bedrooms: 0, livingRooms: 0, majlis: 0, kitchens: 0, bathrooms: 0 });
  const [activeCount, setActiveCount] = useState<keyof typeof propertyCounts | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [subscriptionPlanCode, setSubscriptionPlanCode] = useState<SubscriptionPlanCode | ''>('');
  const [couponCode, setCouponCode] = useState('');
  const [mediaLoading, setMediaLoading] = useState(false);
  const [commercialRegistrationPdf, setCommercialRegistrationPdf] = useState('');
  const [commercialRegistrationName, setCommercialRegistrationName] = useState('');
  const totalBytes = useMemo(() => media.reduce((sum, item) => sum + item.size, 0), [media]);
  const servesAllGovernorates = serviceWilayats.length === allWilayats.length;
  const isProperty = category === 'real-estate';
  const selectedServiceGovernorates = omanGovernorates.filter((item) => serviceGovernorates.includes(item.name));
  const serviceWilayatOptions = selectedServiceGovernorates.flatMap((item) => item.wilayats.map((wilayat) => ({ ...wilayat, governorate: item.name, governorateAr: item.nameAr })));
  const toggleServiceGovernorate = (name: string) => {
    const governorate = omanGovernorates.find((item) => item.name === name);
    if (!governorate) return;
    const selected = serviceGovernorates.includes(name);
    setServiceGovernorates((current) => selected ? current.filter((item) => item !== name) : [...current, name]);
    setServiceWilayats((current) => selected
      ? current.filter((item) => !governorate.wilayats.some((wilayat) => wilayat.name === item))
      : [...new Set([...current, ...governorate.wilayats.map((wilayat) => wilayat.name)])]);
  };
  const toggleServiceWilayat = (name: string) => setServiceWilayats((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const goBackServiceLocation = () => setServiceLocationLevel('governorates');
  const selectedGovernorate = omanGovernorates.find((item) => item.name === propertyGovernorate);
  const selectedWilayat = selectedGovernorate?.wilayats.find((item) => item.name === propertyWilayat);
  const knownAreas = propertyWilayat ? omanWilayatAreas[propertyWilayat] ?? [] : [];
  const finalPropertyArea = propertyArea === '__other__' ? customPropertyArea.trim() : propertyArea;
  const showPropertyCounts = !propertyTypesWithoutRoomCounts.has(propertyType);
  const normalizedPhone = form.phone.replace(/\D/g, '').replace(/^968/, '');
  const locationLevel = !propertyGovernorate ? 'governorate' : !propertyWilayat ? 'wilayat' : 'area';
  const locationLevelTitle = locationLevel === 'governorate' ? (isArabic ? 'المحافظة' : 'Governorate') : locationLevel === 'wilayat' ? (isArabic ? 'الولاية' : 'Wilayat') : (isArabic ? 'المنطقة' : 'Area');
  const locationOptions = locationLevel === 'governorate'
    ? omanGovernorates.map((item) => ({ value: item.name, label: isArabic ? item.nameAr : item.name }))
    : locationLevel === 'wilayat'
      ? (selectedGovernorate?.wilayats ?? []).map((item) => ({ value: item.name, label: isArabic ? item.nameAr : item.name }))
      : [...knownAreas.map((item) => ({ value: item.name, label: isArabic ? item.nameAr : item.name })), { value: '__other__', label: isArabic ? 'منطقة أخرى' : 'Other area' }];
  const goBackLocationLevel = () => {
    if (locationLevel === 'area') {
      setPropertyArea('');
      setCustomPropertyArea('');
      setPropertyWilayat('');
    } else if (locationLevel === 'wilayat') {
      setPropertyGovernorate('');
      setPropertyWilayat('');
    }
  };
  const chooseLocationOption = (value: string) => {
    if (locationLevel === 'governorate') {
      setPropertyGovernorate(value);
      setPropertyWilayat('');
      setPropertyArea('');
      setCustomPropertyArea('');
    } else if (locationLevel === 'wilayat') {
      setPropertyWilayat(value);
      setPropertyArea('');
      setCustomPropertyArea('');
    } else {
      setPropertyArea(value);
      setCustomPropertyArea('');
    }
  };
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
  const pickCommercialRegistration = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if ((asset.size ?? 0) > 5 * 1024 * 1024) {
      Alert.alert(isArabic ? 'الملف كبير' : 'File too large', isArabic ? 'الحد الأقصى لملف السجل التجاري 5 ميجابايت.' : 'The commercial registration PDF must be 5 MB or smaller.');
      return;
    }
    const dataUrl = await blobToDataUrl(await (await fetch(asset.uri)).blob());
    setCommercialRegistrationPdf(dataUrl);
    setCommercialRegistrationName(asset.name);
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
  const validProperty = !isProperty || (propertyGovernorate && propertyWilayat && finalPropertyArea.length >= 2 && propertyType && Number(propertySize) > 0);
  const valid = form.title.trim().length >= 2 && (isProperty || form.specialty.trim().length >= 2) && normalizedPhone.length === 8 && (isProperty ? validProperty : serviceWilayats.length > 0) && form.description.trim().length >= 20 && media.length > 0 && (category === 'maintenance' || !!commercialRegistrationPdf) && subscriptionPlanCode.length > 0 && termsAccepted;
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
           {isProperty ? <>
             <View testID="property-location-picker" style={[styles.coverageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
               <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'موقع العقار' : 'Property location'}</Text>
               <Text style={[styles.hint, { color: colors.mutedForeground }]}>{isArabic ? 'اختر الموقع خطوة بخطوة داخل نفس القائمة.' : 'Choose the location step by step in the same list.'}</Text>
               <View style={[styles.locationPath, { borderColor: colors.border, backgroundColor: colors.background }]}>
                 {locationLevel !== 'governorate' ? <Pressable testID="property-location-back" accessibilityLabel={isArabic ? 'العودة للمستوى السابق' : 'Go back'} onPress={goBackLocationLevel} style={styles.locationBack}><Feather name={isArabic ? 'chevron-right' : 'chevron-left'} size={20} color={colors.primary} /></Pressable> : null}
                 <View style={{ flex: 1 }}><Text style={[styles.locationLevel, { color: colors.primary }]}>{locationLevelTitle}</Text><Text style={[styles.locationSelection, { color: colors.foreground }]} numberOfLines={1}>{propertyArea && propertyArea !== '__other__' ? propertyArea : propertyWilayat || propertyGovernorate || (isArabic ? 'اختر من القائمة' : 'Choose from the list')}</Text></View>
                 <Feather name="list" size={18} color={colors.mutedForeground} />
               </View>
               <ChoiceGrid options={locationOptions} value={locationLevel === 'governorate' ? propertyGovernorate : locationLevel === 'wilayat' ? propertyWilayat : propertyArea} onChange={chooseLocationOption} colors={colors} />
               {propertyArea === '__other__' ? <TextInput testID="property-custom-area" value={customPropertyArea} onChangeText={setCustomPropertyArea} textAlign={isArabic ? 'right' : 'left'} placeholder={isArabic ? 'اكتب اسم المنطقة' : 'Enter the area name'} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} /> : null}
             </View>
             <ChoiceSection title={isArabic ? 'الغرض من الإعلان' : 'Listing purpose'} options={[{ value: 'sale', label: isArabic ? 'بيع' : 'For sale' }, { value: 'rent', label: isArabic ? 'تأجير' : 'For rent' }]} value={listingType} onChange={(value) => setListingType(value as 'sale' | 'rent')} colors={colors} />
              <ChoiceSection title={isArabic ? 'نوع العقار' : 'Property type'} options={propertyTypes.map((item) => ({ value: item.value, label: isArabic ? item.ar : item.en }))} value={propertyType} onChange={(value) => {
                setPropertyType(value);
                if (propertyTypesWithoutRoomCounts.has(value)) {
                  setPropertyCounts({ bedrooms: 0, livingRooms: 0, majlis: 0, kitchens: 0, bathrooms: 0 });
                }
              }} colors={colors} />
             <View style={[styles.coverageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
               <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'مساحة العقار (متر مربع)' : 'Property size (square meters)'}</Text>
               <TextInput testID="property-size" value={propertySize} onChangeText={(value) => setPropertySize(value.replace(/[^0-9]/g, ''))} keyboardType="numeric" inputMode="numeric" textAlign={isArabic ? 'right' : 'left'} placeholder={isArabic ? 'مثال: 120' : 'Example: 120'} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
                {showPropertyCounts ? <>
                  <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'تفاصيل العقار بالأرقام' : 'Property details'}</Text>
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>{isArabic ? 'اضغط على أي خانة وحدد العدد من عجلة الاختيار.' : 'Tap a field and choose its number from the wheel.'}</Text>
                  <View style={styles.counterGrid}>{countFields.map((item) => <Pressable key={item.key} testID={`property-count-${item.key}`} onPress={() => setActiveCount(item.key)} style={[styles.counterCard, { borderColor: colors.border, backgroundColor: colors.background }]}><Text style={[styles.counterValue, { color: colors.primary }]}>{propertyCounts[item.key]}</Text><Text style={[styles.counterLabel, { color: colors.foreground }]}>{isArabic ? item.ar : item.en}</Text><Feather name="chevron-down" size={14} color={colors.mutedForeground} /></Pressable>)}</View>
                </> : null}
             </View>
           </> : <>
           <Field label={isArabic ? categoryCopy.specialtyAr : categoryCopy.specialtyEn} testID="registration-specialty" value={form.specialty} onChangeText={(value) => update('specialty', value)} placeholder={isArabic ? categoryCopy.specialtyPlaceholderAr : categoryCopy.specialtyPlaceholderEn} isArabic={isArabic} colors={colors} />
              {servesAllGovernorates ? null : <View testID="service-location-picker" style={[styles.coverageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
               <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'الولايات التي تقدم فيها الخدمة' : 'Wilayats you serve'}</Text>
               <Text style={[styles.hint, { color: colors.mutedForeground }]}>{isArabic ? 'اختر المحافظات والولايات داخل نفس القائمة.' : 'Choose governorates and wilayats in the same list.'}</Text>
               {serviceLocationLevel === 'wilayats' ? <Pressable testID="service-location-back" accessibilityLabel={isArabic ? 'العودة للمحافظات' : 'Back to governorates'} onPress={goBackServiceLocation} style={[styles.locationPath, { borderColor: colors.border, backgroundColor: colors.background }]}><Feather name={isArabic ? 'chevron-right' : 'chevron-left'} size={20} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[styles.locationLevel, { color: colors.primary }]}>{isArabic ? 'الولايات' : 'Wilayats'}</Text><Text style={[styles.locationSelection, { color: colors.foreground }]}>{isArabic ? `${serviceGovernorates.length} محافظة مختارة` : `${serviceGovernorates.length} governorates selected`}</Text></View></Pressable> : null}
               {serviceLocationLevel === 'governorates'
                 ? <MultiChoiceGrid options={omanGovernorates.map((item) => ({ value: item.name, label: isArabic ? item.nameAr : item.name }))} values={serviceGovernorates} onToggle={toggleServiceGovernorate} colors={colors} prefix="coverage-governorate" />
                 : <MultiChoiceGrid options={serviceWilayatOptions.map((item) => ({ value: item.name, label: isArabic ? item.nameAr : item.name }))} values={serviceWilayats} onToggle={toggleServiceWilayat} colors={colors} prefix="coverage-wilayat" />}
               {serviceLocationLevel === 'governorates' && serviceGovernorates.length > 0 ? <ActionButton label={isArabic ? 'اختيار الولايات' : 'Choose wilayats'} onPress={() => setServiceLocationLevel('wilayats')} /> : null}
              </View>}
              <Pressable testID="coverage-all-oman" accessibilityRole="checkbox" accessibilityState={{ checked: servesAllGovernorates }} onPress={() => { const next = !servesAllGovernorates; setServiceWilayats(next ? allWilayats.map((item) => item.name) : []); setServiceGovernorates(next ? omanGovernorates.map((item) => item.name) : []); setServiceLocationLevel('governorates'); }} style={[styles.choiceRow, { borderColor: servesAllGovernorates ? colors.primary : colors.border, backgroundColor: servesAllGovernorates ? colors.primarySoft : colors.surface }]}>
                <Feather name={servesAllGovernorates ? 'check-square' : 'square'} size={19} color={colors.primary} />
                <View style={{ flex: 1 }}><Text style={[styles.choiceTitle, { color: colors.foreground }]}>{isArabic ? 'كل السلطنة' : 'All Oman'}</Text><Text style={[styles.hint, { color: colors.mutedForeground }]}>{isArabic ? 'تفعيل هذا الخيار يلغي اختيار المحافظات والولايات.' : 'Enabling this hides the governorate and wilayat picker.'}</Text></View>
              </Pressable>
             <Pressable testID="delivery-available" accessibilityRole="checkbox" accessibilityState={{ checked: deliveryAvailable }} onPress={() => setDeliveryAvailable((current) => !current)} style={[styles.deliveryRow, { borderTopColor: colors.border }]}>
               <Feather name={deliveryAvailable ? 'check-square' : 'square'} size={20} color={colors.primary} />
               <Text style={[styles.choiceTitle, { color: colors.foreground }]}>{isArabic ? 'يوفر التوصيل أو الوصول إلى موقع العميل' : 'Delivery or travel to the customer is available'}</Text>
             </Pressable>
           </>}
           <Field label={isArabic ? 'رقم الهاتف وواتساب للتواصل' : 'Phone and WhatsApp contact'} testID="registration-phone" value={form.phone} onChangeText={(value) => update('phone', value.replace(/\D/g, '').slice(0, 11))} placeholder={isArabic ? 'مثال: 91234567' : 'Example: 91234567'} isArabic={isArabic} colors={colors} />
           <View><Text style={[styles.label, { color: colors.foreground }]}>{isProperty ? (isArabic ? 'وصف العقار' : 'Property description') : (isArabic ? 'نبذة عن الأعمال والخدمات' : 'About the work and services')}</Text><TextInput testID="registration-description" value={form.description} onChangeText={(value) => update('description', value)} multiline textAlign={isArabic ? 'right' : 'left'} placeholder={isArabic ? categoryCopy.descriptionPlaceholderAr : categoryCopy.descriptionPlaceholderEn} placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.description, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /></View>
          <View><Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'صور وفيديوهات الأعمال' : 'Work photos and videos'}</Text><Text style={[styles.hint, { color: colors.mutedForeground }]}>{isArabic ? `${media.length}/15 · الحد الإجمالي 24 م.ب` : `${media.length}/15 · 24 MB total limit`}</Text></View>
          <View style={styles.mediaGrid}>
            {media.map((item) => <View key={item.id} style={[styles.mediaCard, { borderColor: colors.border }]}>{item.type === 'image' ? <Image source={{ uri: item.dataUrl }} style={styles.preview} /> : <View style={[styles.video, { backgroundColor: colors.primarySoft }]}><Feather name="video" size={23} color={colors.primary} /><Text numberOfLines={1} style={[styles.videoName, { color: colors.foreground }]}>{item.name}</Text></View>}<Pressable onPress={() => setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id))} style={[styles.remove, { backgroundColor: colors.navy }]}><Feather name="x" size={13} color="#FFFFFF" /></Pressable></View>)}
            {media.length < MAX_MEDIA ? <Pressable testID="add-registration-media" onPress={pickMedia} disabled={mediaLoading} style={[styles.addMedia, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>{mediaLoading ? <ActivityIndicator color={colors.primary} /> : <><Feather name="plus" size={23} color={colors.primary} /><Text style={[styles.addMediaText, { color: colors.primary }]}>{isArabic ? 'إضافة وسائط' : 'Add media'}</Text></>}</Pressable> : null}
          </View>
           {category !== 'maintenance' ? <View style={[styles.termsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'السجل التجاري (PDF) *' : 'Commercial registration (PDF) *'}</Text><Pressable testID="pick-commercial-registration" onPress={pickCommercialRegistration} style={[styles.addMedia, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}><Feather name={commercialRegistrationPdf ? 'check-circle' : 'file-text'} size={22} color={colors.primary} /><Text numberOfLines={1} style={[styles.addMediaText, { color: colors.primary }]}>{commercialRegistrationName || (isArabic ? 'اختيار ملف PDF' : 'Choose PDF file')}</Text></Pressable></View> : null}
           <SubscriptionPlanSelector category={isProperty ? 'real-estate' : 'service'} value={subscriptionPlanCode} onChange={(code) => { setSubscriptionPlanCode(code); setCouponCode(''); }} couponCode={couponCode} onCouponChange={setCouponCode} />
          <View style={[styles.termsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.termsTitle, { color: colors.foreground }]}>{isArabic ? 'شروط التسجيل والإعلان' : 'Registration and advertising terms'}</Text>
            {terms.map((term, index) => <View key={term} style={styles.termRow}><Text style={[styles.termNumber, { color: colors.primary }]}>{index + 1}</Text><Text style={[styles.termText, { color: colors.mutedForeground }]}>{term}</Text></View>)}
            <Pressable testID="registration-terms" accessibilityRole="checkbox" accessibilityState={{ checked: termsAccepted }} onPress={() => setTermsAccepted((current) => !current)} style={[styles.acceptRow, { borderTopColor: colors.border }]}><Feather name={termsAccepted ? 'check-square' : 'square'} size={20} color={colors.primary} /><Text style={[styles.acceptText, { color: colors.foreground }]}>{isArabic ? 'أوافق على شروط التسجيل والنشر' : 'I agree to the registration and publishing terms'}</Text></Pressable>
          </View>
             <ActionButton label={createRegistration.isPending ? (isArabic ? 'جارٍ الإرسال…' : 'Submitting…') : (isArabic ? 'إرسال للمراجعة' : 'Submit for review')} onPress={() => { if (!valid || (!isProperty && !primaryLocation)) { Alert.alert(isArabic ? 'أكمل البيانات' : 'Complete the details', isArabic ? 'أكمل جميع الاختيارات والحقول، وأدخل رقمًا عُمانيًا صحيحًا من 8 أرقام، وأرفق السجل التجاري PDF (ما عدا الصيانة)، ثم وافق على الشروط.' : 'Complete all fields, enter a valid 8-digit Oman phone number, attach the commercial registration PDF (except maintenance), and accept the terms.'); return; } createRegistration.mutate({ data: { category, title: form.title.trim(), specialty: isProperty ? propertyType : form.specialty.trim(), city: isProperty ? propertyGovernorate : primaryLocation!.governorate, phone: `+968${normalizedPhone}`, serviceWilayats: isProperty ? [propertyWilayat] : serviceWilayats, servesAllGovernorates: isProperty ? false : servesAllGovernorates, deliveryAvailable: isProperty ? false : deliveryAvailable, propertyDetails: isProperty ? { governorate: propertyGovernorate, wilayat: propertyWilayat, area: finalPropertyArea, listingType, propertyType, sizeSquareMeters: Number(propertySize), ...propertyCounts } : null, description: form.description.trim(), mediaUrls: media.map((item) => item.dataUrl), commercialRegistrationPdf: category === 'maintenance' ? null : commercialRegistrationPdf, subscriptionPlanCode: subscriptionPlanCode as SubscriptionPlanCode, couponCode: couponCode || null, termsAccepted: true } }); }} />
        </View>
      </ScrollView>
      <Modal visible={activeCount !== null} transparent animationType="fade" onRequestClose={() => setActiveCount(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActiveCount(null)}>
          <View style={[styles.wheelSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.wheelTitle, { color: colors.foreground }]}>{isArabic ? 'حدد العدد' : 'Choose a number'}</Text>
            <ScrollView style={styles.wheel} snapToInterval={48} decelerationRate="fast" showsVerticalScrollIndicator={false}>
              {Array.from({ length: 21 }, (_, number) => <Pressable key={number} testID={`wheel-value-${number}`} onPress={() => { if (activeCount) setPropertyCounts((current) => ({ ...current, [activeCount]: number })); setActiveCount(null); }} style={styles.wheelItem}><Text style={[styles.wheelNumber, { color: activeCount && propertyCounts[activeCount] === number ? colors.primary : colors.foreground }]}>{number}</Text></Pressable>)}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Field({ label, testID, value, onChangeText, placeholder, isArabic, colors }: { label: string; testID: string; value: string; onChangeText: (value: string) => void; placeholder: string; isArabic: boolean; colors: ReturnType<typeof useColors> }) {
  return <View><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><TextInput testID={testID} value={value} onChangeText={onChangeText} textAlign={isArabic ? 'right' : 'left'} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /></View>;
}

function ChoiceGrid({ options, value, onChange, colors }: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.wilayatGrid}>{options.map((option) => { const selected = option.value === value; return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onChange(option.value)} style={[styles.wilayatChoice, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.background }]}><Feather name={selected ? 'check-circle' : 'circle'} size={16} color={selected ? colors.primary : colors.mutedForeground} /><Text style={[styles.wilayatChoiceText, { color: colors.foreground }]}>{option.label}</Text></Pressable>; })}</View>;
}

function MultiChoiceGrid({ options, values, onToggle, colors, prefix }: { options: { value: string; label: string }[]; values: string[]; onToggle: (value: string) => void; colors: ReturnType<typeof useColors>; prefix: string }) {
  return <View style={styles.wilayatGrid}>{options.map((option) => { const selected = values.includes(option.value); return <Pressable key={option.value} testID={`${prefix}-${option.value}`} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => onToggle(option.value)} style={[styles.wilayatChoice, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.background }]}><Feather name={selected ? 'check-square' : 'square'} size={16} color={selected ? colors.primary : colors.mutedForeground} /><Text style={[styles.wilayatChoiceText, { color: colors.foreground }]}>{option.label}</Text></Pressable>; })}</View>;
}

function ChoiceSection({ title, options, value, onChange, colors }: { title: string; options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.coverageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.label, { color: colors.foreground }]}>{title}</Text><ChoiceGrid options={options} value={value} onChange={onChange} colors={colors} /></View>;
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
  locationPath: { minHeight: 54, borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  locationBack: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  locationLevel: { fontSize: 10, fontWeight: '800' },
  locationSelection: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  deliveryRow: { borderTopWidth: 1, paddingTop: 12, marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 9 },
  governorateGroup: { gap: 7, marginTop: 4 },
  governorateTitle: { fontSize: 12, fontWeight: '800' },
  stepLabel: { fontSize: 11, fontWeight: '800', marginTop: 5 },
  wilayatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  wilayatChoice: { minHeight: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: '47%', flexGrow: 1, flexBasis: '47%' },
  wilayatChoiceText: { flexShrink: 1, fontSize: 11, fontWeight: '700' },
  counterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  counterCard: { width: '31%', minHeight: 88, flexGrow: 1, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 3, padding: 8 },
  counterValue: { fontSize: 23, fontWeight: '900' },
  counterLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5,18,30,0.55)', justifyContent: 'flex-end', padding: 18 },
  wheelSheet: { borderRadius: 24, padding: 18, maxHeight: 360 },
  wheelTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  wheel: { maxHeight: 280 },
  wheelItem: { height: 48, alignItems: 'center', justifyContent: 'center' },
  wheelNumber: { fontSize: 22, fontWeight: '800' },
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