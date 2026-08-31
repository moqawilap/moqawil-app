import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth, useUser } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '@/components/MoqawilUI';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { designServices } from '@/data/designServices';
import { maintenanceItems } from '@/data/mockData';
import { omanGovernorates } from '@/data/omanLocations';

import {
  useGetAdminOverview, getGetAdminOverviewQueryKey,
  useListAdminContractors, getListAdminContractorsQueryKey,
  useCreateAdminContractor, useUpdateAdminContractor, useDeleteAdminContractor,
  useListAdminSubscriptions, getListAdminSubscriptionsQueryKey, useUpdateAdminSubscription,
  useListAdminPayments, getListAdminPaymentsQueryKey, useCreateAdminPayment,
  useGetAdminSettings, getGetAdminSettingsQueryKey, getGetHomepageSettingsQueryKey, useUpdateAdminSettings,
  useListAdminListings, getListAdminListingsQueryKey, useCreateAdminListing, useUpdateAdminListing, useDeleteAdminListing,
  useListAdminAdCampaigns, getListAdminAdCampaignsQueryKey, useCreateAdminAdCampaign, useUpdateAdminAdCampaign, processAdminAdVideo,
  useListAdminPushNotifications, getListAdminPushNotificationsQueryKey, useCreateAdminPushNotification,
  type AdminContractor, type AdminContractorInput, type AdminListingInput, type MarketplaceListing, type AdCampaign, type AdMediaItem, type AdminAdCampaignInput, type HomepageSettings
} from '@workspace/api-client-react';

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'The server could not process this request.';
const text = (isArabic: boolean, english: string, arabic: string) => isArabic ? arabic : english;
const statusText = (isArabic: boolean, status: string) => ({
  free_trial: text(isArabic, 'Free trial', 'تجربة مجانية'),
  active: text(isArabic, 'Active', 'نشط'),
  payment_due: text(isArabic, 'Payment due', 'الدفع مستحق'),
  expired: text(isArabic, 'Expired', 'منتهي'),
  cancelled: text(isArabic, 'Cancelled', 'ملغى'),
  suspended: text(isArabic, 'Suspended', 'معلّق'),
  pending: text(isArabic, 'Pending', 'قيد الانتظار'),
  paid: text(isArabic, 'Paid', 'مدفوع'),
  failed: text(isArabic, 'Failed', 'فشل'),
  refunded: text(isArabic, 'Refunded', 'مسترد'),
  void: text(isArabic, 'Void', 'ملغى'),
  draft: text(isArabic, 'Draft', 'مسودة'),
  paused: text(isArabic, 'Paused', 'متوقفة'),
  completed: text(isArabic, 'Completed', 'مكتملة'),
}[status] ?? status);
const confirmAction = (title: string, message: string, action: () => void, cancelLabel = 'Cancel') => {
  if (Platform.OS === 'web') {
    if (globalThis.confirm(`${title}\n\n${message}`)) action();
    return;
  }
  Alert.alert(title, message, [{ text: cancelLabel, style: 'cancel' }, { text: title, style: 'destructive', onPress: action }]);
};
const pickAdminImages = async (isArabic: boolean, selectionLimit = 15) => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(text(isArabic, 'Photo access needed', 'نحتاج إذن الصور'), text(isArabic, 'Allow access to choose images.', 'اسمح بالوصول للصور لاختيار الصور.'));
    return [] as string[];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit,
    quality: 0.45,
    base64: true,
  });
  if (result.canceled) return [] as string[];
  const images = result.assets
    .map((asset) => asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri)
    .filter((image) => image.length <= 2_000_000);
  if (images.length !== result.assets.length) {
    Alert.alert(text(isArabic, 'Some images were too large', 'بعض الصور كبيرة جدًا'), text(isArabic, 'Each image must be smaller than 2 MB.', 'يجب أن يكون حجم كل صورة أقل من 2 ميجابايت.'));
  }
  return images;
};

function AdminImageGallery({ images, label, testID, onAdd, onRemove }: { images: string[]; label: string; testID: string; onAdd: () => void; onRemove: (index: number) => void }) {
  const colors = useColors();
  return (
    <View style={styles.formGroupFull}>
      <View style={styles.mediaHeader}>
        <Text style={[styles.label, { color: colors.foreground, marginBottom: 0 }]}>{label}</Text>
        <Text style={[styles.mediaCounter, { color: colors.mutedForeground }]}>{images.length}/15</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaStrip}>
        {images.map((image, index) => (
          <View key={`${image.slice(0, 24)}-${index}`} style={[styles.mediaPreview, { borderColor: colors.border }]}>
            <Image source={{ uri: image }} style={styles.mediaPreviewImage} />
            <Pressable onPress={() => onRemove(index)} style={styles.removeMedia}><Feather name="x" size={16} color="#FFFFFF" /></Pressable>
          </View>
        ))}
        {images.length < 15 ? (
          <Pressable testID={testID} onPress={onAdd} style={[styles.multiImageButton, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Feather name="image" size={20} color={colors.primary} />
            <Text style={[styles.multiImageButtonText, { color: colors.foreground }]}>{images.length ? '＋' : ''}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const pickAdMedia = async (isArabic: boolean, type: AdMediaItem['type'], selectionLimit: number) => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      text(isArabic, 'Media access needed', 'نحتاج إذن الوصول للوسائط'),
      text(isArabic, 'Allow access to choose campaign media.', 'اسمح بالوصول لاختيار وسائط الحملة.'),
    );
    return { items: [] as AdMediaItem[], trimmedCount: 0 };
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: type === 'image' ? ['images'] : ['videos'],
    allowsMultipleSelection: true,
    selectionLimit,
    quality: type === 'image' ? 0.45 : 1,
    base64: type === 'image',
  });
  if (result.canceled) return { items: [] as AdMediaItem[], trimmedCount: 0 };
  const selected: AdMediaItem[] = [];
  let rejected = false;
  let trimmedCount = 0;
  for (const asset of result.assets) {
    const defaultMime = type === 'image' ? 'image/jpeg' : 'video/mp4';
    let base64 = asset.base64;
    if (!base64) {
      try {
        const bytes = new Uint8Array(await (await fetch(asset.uri)).arrayBuffer());
        const byteLimit = type === 'video' ? 24_000_000 : 1_490_000;
        if (bytes.byteLength > byteLimit) {
          rejected = true;
          continue;
        }
        let binary = '';
        const chunkSize = 32_768;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        base64 = globalThis.btoa(binary);
      } catch {
        rejected = true;
        continue;
      }
    }
    const url = `data:${asset.mimeType ?? defaultMime};base64,${base64}`;
    if (type === 'video') {
      try {
        const processed = await processAdminAdVideo({ dataUrl: url });
        selected.push(processed.media);
        if (processed.trimmed) trimmedCount += 1;
      } catch {
        rejected = true;
      }
      continue;
    }
    if (url.length > 2_000_000) {
      rejected = true;
      continue;
    }
    selected.push({ url, type });
  }
  if (rejected) {
    Alert.alert(
      text(isArabic, 'Some files were not added', 'لم تتم إضافة بعض الملفات'),
      type === 'video'
        ? text(isArabic, 'Choose a valid video smaller than 24 MB. Videos are prepared automatically for the campaign.', 'اختر فيديو صالحًا بحجم أقل من 24 ميجابايت. سيتم تجهيز الفيديو تلقائيًا للحملة.')
        : text(isArabic, 'Each image must be smaller than 2 MB.', 'يجب أن يكون حجم كل صورة أقل من 2 ميجابايت.'),
    );
  }
  return { items: selected, trimmedCount };
};

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { isArabic } = useApp();
  const isAdmin = (user?.publicMetadata as Record<string, unknown> | undefined)?.role === 'admin' || (user?.publicMetadata as Record<string, unknown> | undefined)?.isAdmin === true || user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() === 'moqawil.ap@gmail.com';

  const [activeTab, setActiveTab] = useState<'Overview' | 'Contractors' | 'Workshops' | 'Designers' | 'Maintenance' | 'Listings' | 'Advertising' | 'Subscriptions' | 'Payments' | 'Homepage' | 'Settings'>('Overview');

  if (!isLoaded) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!isSignedIn || !isAdmin) return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <BrandMark />
      <Text style={[styles.title, { color: colors.foreground }]}>{isSignedIn ? (isArabic ? 'هذه الصفحة للمدير فقط' : 'Administrator access only') : (isArabic ? 'سجّل الدخول للوصول إلى لوحة الإدارة' : 'Sign in to access the admin console')}</Text>
      <Text style={[styles.accessNote, { color: colors.mutedForeground }]}>{isSignedIn ? (isArabic ? 'سجّل الخروج ثم استخدم حساب المدير المعتمد.' : 'Sign out and use the approved administrator account.') : (isArabic ? 'تحتاج إلى تسجيل الدخول أولًا بحساب المدير.' : 'You need to sign in with the administrator account first.')}</Text>
      <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={() => isSignedIn ? router.back() : router.push('/sign-in')}>
        <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{isSignedIn ? (isArabic ? 'رجوع' : 'Go back') : (isArabic ? 'تسجيل الدخول' : 'Sign in')}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.page, { backgroundColor: colors.background, direction: isArabic ? 'rtl' : 'ltr' }]}>
      <View style={[styles.headerContainer, { paddingTop: insets.top + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.top}>
          <Pressable testID="admin-back" onPress={() => router.back()} hitSlop={10}>
            <Feather name={isArabic ? 'arrow-right' : 'arrow-left'} size={20} color={colors.foreground} />
          </Pressable>
          <BrandMark compact />
        </View>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>{text(isArabic, 'Admin Console', 'لوحة الإدارة')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
           {(['Overview', 'Contractors', 'Workshops', 'Designers', 'Maintenance', 'Listings', 'Advertising', 'Subscriptions', 'Payments', 'Homepage', 'Settings'] as const).map(tab => (
            <Pressable key={tab} testID={`tab-${tab}`} style={[styles.tab, activeTab === tab && [styles.activeTab, { backgroundColor: colors.foreground }]]} onPress={() => setActiveTab(tab)}>
               <Text style={[styles.tabText, activeTab === tab ? { color: colors.background } : { color: colors.mutedForeground }]}>{text(isArabic, tab, ({ Overview: 'نظرة عامة', Contractors: 'المقاولون', Workshops: 'الورش', Designers: 'المصممون', Maintenance: 'الصيانة', Listings: 'العقارات', Advertising: 'الإعلانات', Subscriptions: 'الاشتراكات', Payments: 'المدفوعات', Homepage: 'الصفحة الرئيسية', Settings: 'الإعدادات' } as Record<string, string>)[tab])}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {activeTab === 'Overview' && <OverviewTab />}
        {activeTab === 'Contractors' && <ContractorsTab />}
         {activeTab === 'Workshops' && <WorkshopsTab />}
          {activeTab === 'Designers' && <SpecialistsTab kind="designers" />}
          {activeTab === 'Maintenance' && <SpecialistsTab kind="maintenance" />}
         {activeTab === 'Listings' && <ListingsTab />}
        {activeTab === 'Advertising' && <AdvertisingTab />}
        {activeTab === 'Subscriptions' && <SubscriptionsTab />}
        {activeTab === 'Payments' && <PaymentsTab />}
        {activeTab === 'Homepage' && <HomepageSettingsTab />}
        {activeTab === 'Settings' && <SettingsTab />}
      </ScrollView>
    </View>
  );
}

function OverviewTab() {
  const colors = useColors();
  const { isArabic } = useApp();
  const { data: overview, isLoading, isError, refetch, isRefetching } = useGetAdminOverview();

  if (isLoading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  if (isError || !overview) return <Text style={{ color: colors.destructive }}>{text(isArabic, 'Failed to load overview.', 'تعذر تحميل النظرة العامة.')}</Text>;

  return (
    <View testID="admin-overview" style={styles.grid}>
      <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.statValue, { color: colors.foreground }]}>{overview.contractors}</Text>
        <Text style={[styles.statTitle, { color: colors.mutedForeground }]}>{text(isArabic, 'Contractors', 'المقاولون')}</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.statValue, { color: colors.foreground }]}>{overview.activeSubscriptions}</Text>
        <Text style={[styles.statTitle, { color: colors.mutedForeground }]}>{text(isArabic, 'Active Subs', 'الاشتراكات النشطة')}</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.statValue, { color: colors.destructive }]}>{overview.paymentDueSubscriptions}</Text>
        <Text style={[styles.statTitle, { color: colors.mutedForeground }]}>{text(isArabic, 'Payments Due', 'مدفوعات مستحقة')}</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.statValue, { color: colors.primary }]}>{overview.paymentsRecorded}</Text>
        <Text style={[styles.statTitle, { color: colors.mutedForeground }]}>{text(isArabic, 'Payments Recorded', 'المدفوعات المسجلة')}</Text>
      </View>
      <Pressable testID="refresh-overview" style={[styles.denseButton, { borderColor: colors.border, width: '100%', marginTop: 8 }]} onPress={() => refetch()}>
        <Feather name="refresh-cw" size={14} color={colors.foreground} />
        <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{isRefetching ? text(isArabic, 'Refreshing...', 'جارٍ التحديث...') : text(isArabic, 'Refresh Stats', 'تحديث الإحصاءات')}</Text>
      </Pressable>
    </View>
  );
}

const blankContractor = () => ({ businessName: '', city: '', businessNameArabic: '', wilayat: '', bio: '', bioArabic: '', serviceArea: '', phone: '', avatarUrl: '', imageUrls: [] as string[], evaluationNotes: '', adminRating: '', agreedContractAmountOmaniRial: '', isVerified: false, isPublished: false });

function ContractorsTab() {
  const colors = useColors();
  const { isArabic } = useApp();
  const client = useQueryClient();
  const contractors = useListAdminContractors({ query: { queryKey: getListAdminContractorsQueryKey() } });

  const [form, setForm] = useState<any>(blankContractor());
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const invalidate = () => client.invalidateQueries({ queryKey: getListAdminContractorsQueryKey() });
  const create = useCreateAdminContractor({ mutation: { onSuccess: () => { invalidate(); setShowForm(false); setForm(blankContractor()); }, onError: (e) => Alert.alert(text(isArabic, 'Validation', 'تحقق'), errorMessage(e)) } });
  const update = useUpdateAdminContractor({ mutation: { onSuccess: () => { invalidate(); setShowForm(false); setForm(blankContractor()); }, onError: (e) => Alert.alert(text(isArabic, 'Validation', 'تحقق'), errorMessage(e)) } });
  const archive = useDeleteAdminContractor({ mutation: { onSuccess: invalidate, onError: (e) => Alert.alert(text(isArabic, 'Failed', 'فشل'), errorMessage(e)) } });

  const set = (key: string, value: string) => setForm((v: any) => ({ ...v, [key]: value }));
  const begin = (c?: AdminContractor) => {
    if (c) {
      setEditing(c.id);
      setForm({
        businessName: c.businessName, businessNameArabic: c.businessNameArabic ?? '',
        city: c.city, wilayat: c.wilayat ?? '', bio: c.bio ?? '', bioArabic: c.bioArabic ?? '',
        serviceArea: c.serviceArea ?? '', phone: c.phone ?? '', avatarUrl: c.avatarUrl ?? '', imageUrls: c.imageUrls?.length ? c.imageUrls : c.avatarUrl ? [c.avatarUrl] : [], evaluationNotes: c.evaluationNotes ?? '',
        adminRating: c.adminRating ? String(c.adminRating) : '',
        agreedContractAmountOmaniRial: c.agreedContractAmountOmaniRial ? String(c.agreedContractAmountOmaniRial) : '',
        isVerified: c.isVerified, isPublished: c.isPublished
      });
    } else {
      setEditing(null);
      setForm(blankContractor());
    }
    setShowForm(true);
  };

  const save = () => {
    if (form.businessName.trim().length < 2 || form.city.trim().length < 2) {
      Alert.alert(text(isArabic, 'Missing details', 'بيانات ناقصة'), text(isArabic, 'Business name and city are required.', 'اسم النشاط والمدينة مطلوبان.'));
      return;
    }
    const data: AdminContractorInput = {
      ...form,
      businessName: form.businessName.trim(),
      city: form.city.trim(),
      adminRating: form.adminRating === '' ? null : Number(form.adminRating) || null,
      agreedContractAmountOmaniRial: form.agreedContractAmountOmaniRial === '' ? null : Number(form.agreedContractAmountOmaniRial) || null
    };
    editing ? update.mutate({ id: editing, data }) : create.mutate({ data });
  };
  const chooseContractorImage = async () => {
    const images = await pickAdminImages(isArabic, 15 - form.imageUrls.length);
    if (images.length) setForm((current: any) => {
      const imageUrls = [...current.imageUrls, ...images];
      return { ...current, imageUrls, avatarUrl: imageUrls[0] };
    });
  };
  const removeContractorImage = (index: number) => setForm((current: any) => {
    const imageUrls = current.imageUrls.filter((_: string, itemIndex: number) => itemIndex !== index);
    return { ...current, imageUrls, avatarUrl: imageUrls[0] ?? '' };
  });

  return (
    <View testID="admin-contractors" style={styles.tabContainer}>
      <View style={styles.tabHeader}>
        <Text style={[styles.tabTitle, { color: colors.foreground }]}>{text(isArabic, 'Contractors', 'المقاولون')}</Text>
        <Pressable testID="add-contractor" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground }]} onPress={() => begin()}>
          <Feather name="plus" size={14} color={colors.background} />
          <Text style={[styles.denseButtonText, { color: colors.background }]}>{text(isArabic, 'Add', 'إضافة')}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>{editing ? text(isArabic, 'Edit Contractor', 'تعديل مقاول') : text(isArabic, 'New Contractor', 'مقاول جديد')}</Text>
          <View style={styles.formGrid}>
            {([['businessName', 'Business name', 'اسم النشاط', 'default'], ['businessNameArabic', 'Arabic name', 'الاسم بالعربية', 'default'], ['city', 'City', 'المدينة', 'default'], ['wilayat', 'Wilayat', 'الولاية', 'default'], ['serviceArea', 'Service area', 'منطقة الخدمة', 'default'], ['phone', 'Phone', 'الهاتف', 'default'], ['adminRating', 'Admin rating (1-5)', 'تقييم المدير (1-5)', 'decimal-pad'], ['agreedContractAmountOmaniRial', 'Agreed OMR', 'قيمة العقد (ر.ع.)', 'decimal-pad']] as const).map(([key, label, labelAr, kType]) => (
              <View key={key} style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, label, labelAr)}</Text>
                <TextInput testID={`contractor-field-${key}`} value={String(form[key] ?? '')} onChangeText={v => set(key, v)} keyboardType={kType as any} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              </View>
            ))}
          </View>
          <AdminImageGallery images={form.imageUrls} label={text(isArabic, 'Contractor photos', 'صور المقاول')} testID="pick-contractor-image" onAdd={() => void chooseContractorImage()} onRemove={removeContractorImage} />
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Bio', 'النبذة')}</Text>
            <TextInput testID="contractor-field-bio" value={form.bio ?? ''} onChangeText={v => set('bio', v)} multiline style={[styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Arabic Bio', 'النبذة بالعربية')}</Text>
            <TextInput testID="contractor-field-bioArabic" value={form.bioArabic ?? ''} onChangeText={v => set('bioArabic', v)} multiline textAlign="right" style={[styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Evaluation Notes', 'ملاحظات التقييم')}</Text>
            <TextInput testID="contractor-field-evaluationNotes" value={form.evaluationNotes ?? ''} onChangeText={v => set('evaluationNotes', v)} multiline style={[styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.toggles}>
            <Pressable testID="form-verified" style={styles.toggleRow} onPress={() => setForm((v: any) => ({ ...v, isVerified: !v.isVerified }))}>
              <Feather name={form.isVerified ? 'check-square' : 'square'} size={18} color={form.isVerified ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.toggleText, { color: colors.foreground }]}>{text(isArabic, 'Verified', 'موثّق')}</Text>
            </Pressable>
            <Pressable testID="form-published" style={styles.toggleRow} onPress={() => setForm((v: any) => ({ ...v, isPublished: !v.isPublished }))}>
              <Feather name={form.isPublished ? 'check-square' : 'square'} size={18} color={form.isPublished ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.toggleText, { color: colors.foreground }]}>{text(isArabic, 'Published', 'منشور')}</Text>
            </Pressable>
          </View>
          <View style={styles.formActions}>
            <Pressable testID="save-server-contractor" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, flex: 1 }]} onPress={save}>
              <Text style={[styles.denseButtonText, { color: colors.background }]}>{create.isPending || update.isPending ? text(isArabic, 'Saving...', 'جارٍ الحفظ...') : text(isArabic, 'Save Contractor', 'حفظ المقاول')}</Text>
            </Pressable>
            <Pressable testID="cancel-contractor-form" style={[styles.denseButton, { borderColor: colors.border }]} onPress={() => setShowForm(false)}>
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{text(isArabic, 'Cancel', 'إلغاء')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {contractors.isLoading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
      {contractors.isError && <Text style={{ color: colors.destructive }}>{text(isArabic, 'Unable to load contractors.', 'تعذر تحميل المقاولين.')}</Text>}
      {contractors.data?.map(c => (
        <View key={c.id} style={[styles.denseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {c.avatarUrl ? <Image source={{ uri: c.avatarUrl }} style={styles.adminCardImage} /> : null}
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{c.businessName}</Text>
            <View style={styles.badges}>
              {c.isVerified && <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}><Text style={[styles.badgeText, { color: colors.primary }]}>{text(isArabic, 'Verified', 'موثّق')}</Text></View>}
              <View style={[styles.badge, { backgroundColor: c.isPublished ? '#D9F8F2' : colors.muted }]}><Text style={[styles.badgeText, { color: c.isPublished ? '#0B6E6B' : colors.mutedForeground }]}>{c.isPublished ? text(isArabic, 'Live', 'نشط') : text(isArabic, 'Hidden', 'مخفي')}</Text></View>
            </View>
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{c.city} • {text(isArabic, 'Linked', 'مرتبط')}: {c.accountLinkStatus}</Text>
          <View style={styles.cardActions}>
            <Pressable testID={`edit-contractor-${c.id}`} onPress={() => begin(c)} style={styles.actionLink}>
              <Text style={[styles.actionText, { color: colors.primary }]}>{text(isArabic, 'Edit', 'تعديل')}</Text>
            </Pressable>
            <Pressable testID={`toggle-verify-${c.id}`} onPress={() => update.mutate({ id: c.id, data: { isVerified: !c.isVerified } })} style={styles.actionLink}>
              <Text style={[styles.actionText, { color: colors.foreground }]}>{c.isVerified ? text(isArabic, 'Unverify', 'إلغاء التوثيق') : text(isArabic, 'Verify', 'توثيق')}</Text>
            </Pressable>
            <Pressable testID={`toggle-publish-${c.id}`} onPress={() => update.mutate({ id: c.id, data: { isPublished: !c.isPublished } })} style={styles.actionLink}>
              <Text style={[styles.actionText, { color: colors.foreground }]}>{c.isPublished ? text(isArabic, 'Unpublish', 'إلغاء النشر') : text(isArabic, 'Publish', 'نشر')}</Text>
            </Pressable>
            <Pressable testID={`archive-contractor-${c.id}`} onPress={() => confirmAction(text(isArabic, 'Archive', 'أرشفة'), text(isArabic, 'This hides the profile permanently.', 'سيؤدي هذا إلى إخفاء الملف نهائيًا.'), () => archive.mutate({ id: c.id, params: { confirm: true } }), text(isArabic, 'Cancel', 'إلغاء'))} style={styles.actionLink}>
              <Text style={[styles.actionText, { color: colors.destructive }]}>{text(isArabic, 'Archive', 'أرشفة')}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const blankWorkshop = () => ({ name: '', nameArabic: '', specialty: '', city: '', wilayat: '', phone: '', avatarUrl: '', imageUrls: [] as string[], isPublished: false });

function WorkshopsTab() {
  const colors = useColors();
  const { isArabic } = useApp();
  const client = useQueryClient();
  const workshops = useListAdminContractors({ query: { queryKey: getListAdminContractorsQueryKey() } });
  const create = useCreateAdminContractor({
    mutation: {
      onSuccess: () => { client.invalidateQueries({ queryKey: getListAdminContractorsQueryKey() }); setForm(blankWorkshop()); setShowForm(false); },
      onError: (e) => Alert.alert(text(isArabic, 'Validation', 'تحقق'), errorMessage(e)),
    },
  });
  const [form, setForm] = useState(blankWorkshop());
  const [showForm, setShowForm] = useState(false);
  const set = (key: keyof ReturnType<typeof blankWorkshop>, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const save = () => {
    if (form.name.trim().length < 2 || form.city.trim().length < 2) {
      Alert.alert(isArabic ? 'بيانات ناقصة' : 'Missing details', isArabic ? 'اسم الورشة والمدينة مطلوبان.' : 'Workshop name and city are required.');
      return;
    }
    const data: AdminContractorInput = {
      businessName: form.name.trim(),
      businessNameArabic: form.nameArabic.trim() || form.name.trim(),
      city: form.city.trim(),
      wilayat: form.wilayat.trim() || null,
      bio: form.specialty.trim() || 'Building workshop',
      bioArabic: form.specialty.trim() || 'ورشة بناء',
      phone: form.phone.trim() || null,
      avatarUrl: form.avatarUrl.trim() || null,
      imageUrls: form.imageUrls,
      isPublished: form.isPublished,
      isVerified: false,
      isWorkshop: true,
    };
    create.mutate({ data });
  };
  const chooseWorkshopImage = async () => {
    const images = await pickAdminImages(isArabic, 15 - form.imageUrls.length);
    if (images.length) setForm((current) => {
      const imageUrls = [...current.imageUrls, ...images];
      return { ...current, imageUrls, avatarUrl: imageUrls[0] };
    });
  };
  const removeWorkshopImage = (index: number) => setForm((current) => {
    const imageUrls = current.imageUrls.filter((_, itemIndex) => itemIndex !== index);
    return { ...current, imageUrls, avatarUrl: imageUrls[0] ?? '' };
  });
  return (
    <View testID="admin-workshops" style={styles.tabContainer}>
      <View style={styles.tabHeader}>
        <View>
          <Text style={[styles.tabTitle, { color: colors.foreground }]}>{text(isArabic, 'Workshops', 'الورش')}</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'Add workshop names to the public building directory.', 'أضف أسماء الورش إلى دليل البناء العام.')}</Text>
        </View>
        <Pressable testID="add-workshop" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground }]} onPress={() => setShowForm(true)}>
          <Feather name="plus" size={14} color={colors.background} />
          <Text style={[styles.denseButtonText, { color: colors.background }]}>{text(isArabic, 'Add', 'إضافة')}</Text>
        </Pressable>
      </View>
      {showForm && (
        <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>{text(isArabic, 'New Workshop', 'ورشة جديدة')}</Text>
          <View style={styles.formGrid}>
            {([['name', 'Workshop name', 'اسم الورشة'], ['nameArabic', 'Arabic name', 'الاسم بالعربية'], ['specialty', 'Specialty', 'التخصص'], ['city', 'City', 'المدينة'], ['wilayat', 'Wilayat', 'الولاية'], ['phone', 'Phone', 'الهاتف']] as const).map(([key, label, labelAr]) => (
              <View key={key} style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, label, labelAr)}</Text>
                <TextInput testID={`workshop-field-${key}`} value={form[key]} onChangeText={(value) => set(key, value)} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              </View>
            ))}
          </View>
          <AdminImageGallery images={form.imageUrls} label={text(isArabic, 'Workshop photos', 'صور الورشة')} testID="pick-workshop-image" onAdd={() => void chooseWorkshopImage()} onRemove={removeWorkshopImage} />
          <Pressable style={styles.toggleRow} onPress={() => set('isPublished', !form.isPublished)}>
            <Feather name={form.isPublished ? 'check-square' : 'square'} size={18} color={form.isPublished ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.toggleText, { color: colors.foreground }]}>{text(isArabic, 'Publish immediately', 'نشر فورًا')}</Text>
          </Pressable>
          <View style={styles.formActions}>
            <Pressable testID="save-workshop" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, flex: 1 }]} onPress={save}>
              <Text style={[styles.denseButtonText, { color: colors.background }]}>{create.isPending ? text(isArabic, 'Saving...', 'جارٍ الحفظ...') : text(isArabic, 'Save Workshop', 'حفظ الورشة')}</Text>
            </Pressable>
            <Pressable style={[styles.denseButton, { borderColor: colors.border }]} onPress={() => setShowForm(false)}>
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{text(isArabic, 'Cancel', 'إلغاء')}</Text>
            </Pressable>
          </View>
        </View>
      )}
      {workshops.isLoading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
      {workshops.data?.map((workshop) => (
        <View key={workshop.id} style={[styles.denseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {workshop.avatarUrl ? <Image source={{ uri: workshop.avatarUrl }} style={styles.adminCardImage} /> : null}
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{workshop.businessName}</Text>
            <View style={[styles.badge, { backgroundColor: workshop.isPublished ? '#D9F8F2' : colors.muted }]}>
            <Text style={[styles.badgeText, { color: workshop.isPublished ? '#0B6E6B' : colors.mutedForeground }]}>{workshop.isPublished ? text(isArabic, 'Live', 'نشط') : text(isArabic, 'Hidden', 'مخفي')}</Text>
            </View>
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{workshop.city}{workshop.wilayat ? ` • ${workshop.wilayat}` : ''}</Text>
        </View>
      ))}
    </View>
  );
}

type SpecialistKind = 'designers' | 'maintenance';
type SpecialistForm = {
  businessName: string;
  businessNameArabic: string;
  city: string;
  wilayat: string;
  serviceArea: string;
  phone: string;
  bio: string;
  bioArabic: string;
  avatarUrl: string;
  imageUrls: string[];
  evaluationNotes: string;
  adminRating: string;
  agreedContractAmountOmaniRial: string;
  serviceNames: string[];
  isVerified: boolean;
  isPublished: boolean;
};

const specialistOptions = (kind: SpecialistKind) => kind === 'designers'
  ? designServices.map((service) => ({ name: service.name, nameAr: service.nameAr }))
  : maintenanceItems.map((service) => ({ name: service.label, nameAr: service.labelAr }));

const blankSpecialist = (): SpecialistForm => ({
  businessName: '', businessNameArabic: '', city: '', wilayat: '', serviceArea: '', phone: '',
  bio: '', bioArabic: '', avatarUrl: '', imageUrls: [], evaluationNotes: '', adminRating: '',
  agreedContractAmountOmaniRial: '', serviceNames: [], isVerified: false, isPublished: false,
});

function SpecialistsTab({ kind }: { kind: SpecialistKind }) {
  const colors = useColors();
  const { isArabic } = useApp();
  const client = useQueryClient();
  const contractors = useListAdminContractors({ query: { queryKey: getListAdminContractorsQueryKey() } });
  const [form, setForm] = useState<SpecialistForm>(blankSpecialist());
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [specialtyQuery, setSpecialtyQuery] = useState('');
  const designers = kind === 'designers';
  const options = specialistOptions(kind);
  const title = designers ? text(isArabic, 'Designers', 'المصممون') : text(isArabic, 'Maintenance providers', 'مقدمو خدمات الصيانة');
  const singular = designers ? text(isArabic, 'designer', 'مصمم') : text(isArabic, 'maintenance provider', 'مزود صيانة');
  const list = contractors.data?.filter((item) => designers ? item.isDesigner : item.isMaintenance) ?? [];

  const invalidate = () => client.invalidateQueries({ queryKey: getListAdminContractorsQueryKey() });
  const create = useCreateAdminContractor({
    mutation: {
      onSuccess: () => { invalidate(); setShowForm(false); setForm(blankSpecialist()); },
      onError: (error) => Alert.alert(text(isArabic, 'Validation', 'تحقق'), errorMessage(error)),
    },
  });
  const update = useUpdateAdminContractor({
    mutation: {
      onSuccess: () => { invalidate(); setShowForm(false); setForm(blankSpecialist()); },
      onError: (error) => Alert.alert(text(isArabic, 'Validation', 'تحقق'), errorMessage(error)),
    },
  });
  const archive = useDeleteAdminContractor({ mutation: { onSuccess: invalidate, onError: (error) => Alert.alert(text(isArabic, 'Failed', 'فشل'), errorMessage(error)) } });

  const set = <K extends keyof SpecialistForm>(key: K, value: SpecialistForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const begin = (item?: AdminContractor) => {
    if (item) {
      setEditing(item.id);
      setForm({
        businessName: item.businessName,
        businessNameArabic: item.businessNameArabic ?? '',
        city: item.city,
        wilayat: item.wilayat ?? '',
        serviceArea: item.serviceArea ?? '',
        phone: item.phone ?? '',
        bio: item.bio ?? '',
        bioArabic: item.bioArabic ?? '',
        avatarUrl: item.avatarUrl ?? '',
        imageUrls: item.imageUrls?.length ? item.imageUrls : item.avatarUrl ? [item.avatarUrl] : [],
        evaluationNotes: item.evaluationNotes ?? '',
        adminRating: item.adminRating ? String(item.adminRating) : '',
        agreedContractAmountOmaniRial: item.agreedContractAmountOmaniRial ? String(item.agreedContractAmountOmaniRial) : '',
        serviceNames: item.serviceNames ?? [],
        isVerified: item.isVerified,
        isPublished: item.isPublished,
      });
    } else {
      setEditing(null);
      setForm(blankSpecialist());
    }
    setSpecialtyQuery('');
    setShowForm(true);
  };
  const save = () => {
    if (form.businessName.trim().length < 2 || form.city.trim().length < 2) {
      Alert.alert(text(isArabic, 'Missing details', 'بيانات ناقصة'), text(isArabic, `${singular} name and city are required.`, `اسم ${singular} والمدينة مطلوبان.`));
      return;
    }
    if (!form.serviceNames.length) {
      Alert.alert(text(isArabic, 'Choose a specialty', 'اختر التخصص'), text(isArabic, `Choose at least one ${designers ? 'design specialty' : 'maintenance service'}.`, designers ? 'اختر تخصص تصميم واحدًا على الأقل.' : 'اختر خدمة صيانة واحدة على الأقل.'));
      return;
    }
    const firstSpecialty = options.find((option) => option.name === form.serviceNames[0]);
    const data: AdminContractorInput = {
      businessName: form.businessName.trim(),
      businessNameArabic: form.businessNameArabic.trim() || form.businessName.trim(),
      city: form.city.trim(),
      wilayat: form.wilayat.trim() || null,
      serviceArea: form.serviceArea.trim() || null,
      phone: form.phone.trim() || null,
      bio: form.bio.trim() || firstSpecialty?.name || null,
      bioArabic: form.bioArabic.trim() || firstSpecialty?.nameAr || null,
      avatarUrl: form.avatarUrl.trim() || null,
      imageUrls: form.imageUrls,
      evaluationNotes: form.evaluationNotes.trim() || null,
      adminRating: form.adminRating === '' ? null : Number(form.adminRating) || null,
      agreedContractAmountOmaniRial: form.agreedContractAmountOmaniRial === '' ? null : Number(form.agreedContractAmountOmaniRial) || null,
      isVerified: form.isVerified,
      isPublished: form.isPublished,
      isDesigner: designers,
      isMaintenance: !designers,
      serviceNames: form.serviceNames,
    };
    if (editing) {
      update.mutate({ id: editing, data });
    } else {
      create.mutate({ data });
    }
  };
  const chooseImage = async () => {
    const images = await pickAdminImages(isArabic, 15 - form.imageUrls.length);
    if (images.length) setForm((current) => {
      const imageUrls = [...current.imageUrls, ...images];
      return { ...current, imageUrls, avatarUrl: imageUrls[0] };
    });
  };
  const removeImage = (index: number) => setForm((current) => {
    const imageUrls = current.imageUrls.filter((_, itemIndex) => itemIndex !== index);
    return { ...current, imageUrls, avatarUrl: imageUrls[0] ?? '' };
  });
  const toggleSpecialty = (name: string) => set('serviceNames', form.serviceNames.includes(name)
    ? form.serviceNames.filter((item) => item !== name)
    : [...form.serviceNames, name]);

  return (
    <View testID={`admin-${kind}`} style={styles.tabContainer}>
      <View style={styles.tabHeader}>
        <View>
          <Text style={[styles.tabTitle, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{designers ? text(isArabic, 'Manage design professionals and their specialties.', 'إدارة المصممين وتخصصاتهم.') : text(isArabic, 'Manage maintenance providers and their services.', 'إدارة مقدمي خدمات الصيانة وخدماتهم.')}</Text>
        </View>
        <Pressable testID={`add-${kind}`} style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground }]} onPress={() => begin()}>
          <Feather name="plus" size={14} color={colors.background} />
          <Text style={[styles.denseButtonText, { color: colors.background }]}>{text(isArabic, 'Add', 'إضافة')}</Text>
        </Pressable>
      </View>
      {showForm && (
        <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>{editing ? text(isArabic, `Edit ${singular}`, `تعديل ${singular}`) : text(isArabic, `New ${singular}`, `${designers ? 'مصمم' : 'مزود صيانة'} جديد`)}</Text>
          <View style={styles.formGrid}>
            {([
              ['businessName', designers ? 'Designer name' : 'Provider name', designers ? 'اسم المصمم' : 'اسم المزود'],
              ['businessNameArabic', 'Arabic name', 'الاسم بالعربية'],
              ['city', 'City', 'المدينة'],
              ['wilayat', 'Wilayat', 'الولاية'],
              ['serviceArea', 'Service area', 'منطقة الخدمة'],
              ['phone', 'Phone', 'الهاتف'],
              ['adminRating', 'Admin rating (1-5)', 'تقييم المدير (1-5)'],
              ['agreedContractAmountOmaniRial', 'Agreed OMR', 'قيمة العقد (ر.ع.)'],
            ] as const).map(([key, label, labelAr]) => (
              <View key={key} style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, label, labelAr)}</Text>
                <TextInput testID={`${kind}-field-${key}`} value={String(form[key])} onChangeText={(value) => set(key, value as never)} keyboardType={key === 'adminRating' || key === 'agreedContractAmountOmaniRial' ? 'decimal-pad' : 'default'} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              </View>
            ))}
          </View>
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, designers ? 'Design specialties' : 'Maintenance services', designers ? 'تخصصات التصميم' : 'خدمات الصيانة')}</Text>
            <TextInput
              testID={`${kind}-specialty-filter`}
              value={specialtyQuery}
              onChangeText={setSpecialtyQuery}
              placeholder={text(isArabic, designers ? 'Filter: interior, facade, kitchen...' : 'Filter maintenance services...', designers ? 'فلترة: تصميم داخلي، واجهات، مطابخ...' : 'فلترة خدمات الصيانة...')}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, marginBottom: 8 }]}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.buildingChips}>
              {options.filter((option) => !specialtyQuery.trim() || `${option.name} ${option.nameAr}`.toLowerCase().includes(specialtyQuery.trim().toLowerCase())).map((option) => {
                const selected = form.serviceNames.includes(option.name);
                return <Pressable key={option.name} testID={`${kind}-service-${option.name}`} onPress={() => toggleSpecialty(option.name)} style={({ pressed }) => [styles.buildingChip, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }, pressed && styles.filterPressed]}>
                  <Text style={{ color: selected ? colors.primaryForeground : colors.foreground }}>{isArabic ? option.nameAr : option.name}</Text>
                </Pressable>;
              })}
            </ScrollView>
          </View>
          <AdminImageGallery images={form.imageUrls} label={text(isArabic, `${designers ? 'Designer' : 'Provider'} photos`, `صور ${designers ? 'المصمم' : 'المزود'}`)} testID={`pick-${kind}-image`} onAdd={() => void chooseImage()} onRemove={removeImage} />
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Bio', 'النبذة')}</Text>
            <TextInput testID={`${kind}-field-bio`} value={form.bio} onChangeText={(value) => set('bio', value)} multiline style={[styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Arabic bio', 'النبذة بالعربية')}</Text>
            <TextInput testID={`${kind}-field-bioArabic`} value={form.bioArabic} onChangeText={(value) => set('bioArabic', value)} multiline textAlign="right" style={[styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Evaluation notes', 'ملاحظات التقييم')}</Text>
            <TextInput testID={`${kind}-field-evaluationNotes`} value={form.evaluationNotes} onChangeText={(value) => set('evaluationNotes', value)} multiline style={[styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.toggles}>
            <Pressable testID={`${kind}-form-verified`} style={styles.toggleRow} onPress={() => set('isVerified', !form.isVerified)}>
              <Feather name={form.isVerified ? 'check-square' : 'square'} size={18} color={form.isVerified ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.toggleText, { color: colors.foreground }]}>{text(isArabic, 'Verified', 'موثّق')}</Text>
            </Pressable>
            <Pressable testID={`${kind}-form-published`} style={styles.toggleRow} onPress={() => set('isPublished', !form.isPublished)}>
              <Feather name={form.isPublished ? 'check-square' : 'square'} size={18} color={form.isPublished ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.toggleText, { color: colors.foreground }]}>{text(isArabic, 'Published', 'منشور')}</Text>
            </Pressable>
          </View>
          <View style={styles.formActions}>
            <Pressable testID={`save-${kind}`} style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, flex: 1 }]} onPress={save}>
              <Text style={[styles.denseButtonText, { color: colors.background }]}>{create.isPending || update.isPending ? text(isArabic, 'Saving...', 'جارٍ الحفظ...') : text(isArabic, 'Save', 'حفظ')}</Text>
            </Pressable>
            <Pressable testID={`cancel-${kind}-form`} style={[styles.denseButton, { borderColor: colors.border }]} onPress={() => setShowForm(false)}>
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{text(isArabic, 'Cancel', 'إلغاء')}</Text>
            </Pressable>
          </View>
        </View>
      )}
      {contractors.isLoading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
      {contractors.isError && <Text style={{ color: colors.destructive }}>{text(isArabic, 'Unable to load providers.', 'تعذر تحميل مقدمي الخدمات.')}</Text>}
      {list.map((item) => (
        <View key={item.id} style={[styles.denseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {item.avatarUrl ? <Image source={{ uri: item.avatarUrl }} style={styles.adminCardImage} /> : null}
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{isArabic ? item.businessNameArabic || item.businessName : item.businessName}</Text>
            <View style={styles.badges}>
              {item.isVerified && <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}><Text style={[styles.badgeText, { color: colors.primary }]}>{text(isArabic, 'Verified', 'موثّق')}</Text></View>}
              <View style={[styles.badge, { backgroundColor: item.isPublished ? '#D9F8F2' : colors.muted }]}><Text style={[styles.badgeText, { color: item.isPublished ? '#0B6E6B' : colors.mutedForeground }]}>{item.isPublished ? text(isArabic, 'Live', 'نشط') : text(isArabic, 'Hidden', 'مخفي')}</Text></View>
            </View>
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{item.city}{item.wilayat ? ` • ${item.wilayat}` : ''}</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]} numberOfLines={2}>{(item.serviceNames ?? []).map((name) => options.find((option) => option.name === name)?.[isArabic ? 'nameAr' : 'name'] ?? name).join(' • ')}</Text>
          <View style={styles.cardActions}>
            <Pressable testID={`edit-${kind}-${item.id}`} onPress={() => begin(item)} style={styles.actionLink}><Text style={[styles.actionText, { color: colors.primary }]}>{text(isArabic, 'Edit', 'تعديل')}</Text></Pressable>
            <Pressable testID={`toggle-verify-${kind}-${item.id}`} onPress={() => update.mutate({ id: item.id, data: { isVerified: !item.isVerified } })} style={styles.actionLink}><Text style={[styles.actionText, { color: colors.foreground }]}>{item.isVerified ? text(isArabic, 'Unverify', 'إلغاء التوثيق') : text(isArabic, 'Verify', 'توثيق')}</Text></Pressable>
            <Pressable testID={`toggle-publish-${kind}-${item.id}`} onPress={() => update.mutate({ id: item.id, data: { isPublished: !item.isPublished } })} style={styles.actionLink}><Text style={[styles.actionText, { color: colors.foreground }]}>{item.isPublished ? text(isArabic, 'Unpublish', 'إلغاء النشر') : text(isArabic, 'Publish', 'نشر')}</Text></Pressable>
            <Pressable testID={`archive-${kind}-${item.id}`} onPress={() => confirmAction(text(isArabic, 'Archive', 'أرشفة'), text(isArabic, 'This hides the profile permanently.', 'سيؤدي هذا إلى إخفاء الملف نهائيًا.'), () => archive.mutate({ id: item.id, params: { confirm: true } }), text(isArabic, 'Cancel', 'إلغاء'))} style={styles.actionLink}><Text style={[styles.actionText, { color: colors.destructive }]}>{text(isArabic, 'Archive', 'أرشفة')}</Text></Pressable>
          </View>
        </View>
      ))}
      {!contractors.isLoading && !list.length ? <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, `No ${kind} added yet.`, `لم تتم إضافة ${designers ? 'مصممين' : 'مقدمي صيانة'} بعد.`)}</Text> : null}
    </View>
  );
}

type ListingForm = {
  title: string;
  titleArabic: string;
  type: 'sale' | 'rent';
  price: string;
  location: string;
  locationArabic: string;
  bedrooms: string;
  bathrooms: string;
  area: string;
  imageUrl: string;
  imageUrls: string[];
  contactPhone: string;
  adminRating: string;
  isPublished: boolean;
};
const blankListing = (): ListingForm => ({ title: '', titleArabic: '', type: 'sale', price: '', location: '', locationArabic: '', bedrooms: '0', bathrooms: '0', area: '', imageUrl: '', imageUrls: [], contactPhone: '', adminRating: '', isPublished: false });

function ListingsTab() {
  const colors = useColors();
  const { isArabic } = useApp();
  const client = useQueryClient();
  const listings = useListAdminListings({ query: { queryKey: getListAdminListingsQueryKey() } });
  const [form, setForm] = useState(blankListing());
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const invalidate = () => client.invalidateQueries({ queryKey: getListAdminListingsQueryKey() });
  const closeForm = () => { setForm(blankListing()); setEditing(null); setShowForm(false); };
  const create = useCreateAdminListing({ mutation: { onSuccess: () => { invalidate(); closeForm(); }, onError: (e) => Alert.alert(text(isArabic, 'Validation', 'تحقق'), errorMessage(e)) } });
  const update = useUpdateAdminListing({ mutation: { onSuccess: () => { invalidate(); closeForm(); }, onError: (e) => Alert.alert(text(isArabic, 'Validation', 'تحقق'), errorMessage(e)) } });
  const remove = useDeleteAdminListing({ mutation: { onSuccess: invalidate, onError: (e) => Alert.alert(text(isArabic, 'Failed', 'فشل'), errorMessage(e)) } });
  const set = <Key extends keyof ListingForm>(key: Key, value: ListingForm[Key]) => setForm((current) => ({ ...current, [key]: value }));
  const pickListingImage = async () => {
    const images = await pickAdminImages(isArabic, 15 - form.imageUrls.length);
    if (images.length) setForm((current) => {
      const imageUrls = [...current.imageUrls, ...images];
      return { ...current, imageUrls, imageUrl: imageUrls[0] };
    });
  };
  const removeListingImage = (index: number) => setForm((current) => {
    const imageUrls = current.imageUrls.filter((_, itemIndex) => itemIndex !== index);
    return { ...current, imageUrls, imageUrl: imageUrls[0] ?? '' };
  });
  const begin = (listing?: MarketplaceListing) => {
    if (!listing) { setForm(blankListing()); setEditing(null); }
    else {
      setEditing(listing.id);
      setForm({ title: listing.title, titleArabic: listing.titleArabic, type: listing.type, price: listing.price, location: listing.location, locationArabic: listing.locationArabic, bedrooms: String(listing.bedrooms), bathrooms: String(listing.bathrooms), area: listing.area, imageUrl: listing.imageUrl ?? '', imageUrls: listing.imageUrls?.length ? listing.imageUrls : listing.imageUrl ? [listing.imageUrl] : [], contactPhone: listing.contactPhone ?? '', adminRating: listing.rating ? String(listing.rating) : '', isPublished: listing.isPublished });
    }
    setShowForm(true);
  };
  const save = () => {
    if (!form.title.trim() || !form.titleArabic.trim() || !form.price.trim() || !form.location.trim() || !form.locationArabic.trim() || !form.area.trim()) {
      Alert.alert(text(isArabic, 'Missing details', 'بيانات ناقصة'), text(isArabic, 'Title, price, location, and area are required.', 'العنوان والسعر والموقع والمساحة مطلوبة.'));
      return;
    }
    const data: AdminListingInput = {
      title: form.title.trim(), titleArabic: form.titleArabic.trim(), type: form.type,
      price: form.price.trim(), location: form.location.trim(), locationArabic: form.locationArabic.trim(),
      bedrooms: Math.max(0, Number(form.bedrooms) || 0), bathrooms: Math.max(0, Number(form.bathrooms) || 0),
      area: form.area.trim(), imageUrl: form.imageUrl.trim() || null, imageUrls: form.imageUrls, contactPhone: form.contactPhone.trim() || null, adminRating: form.adminRating === '' ? null : Number(form.adminRating), isPublished: form.isPublished,
    };
    editing ? update.mutate({ id: editing, data }) : create.mutate({ data });
  };

  return (
    <View testID="admin-listings" style={styles.tabContainer}>
      <View style={styles.tabHeader}>
        <View>
          <Text style={[styles.tabTitle, { color: colors.foreground }]}>{text(isArabic, 'Property Listings', 'إعلانات العقارات')}</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'Create and publish ads for the marketplace.', 'أنشئ إعلانات وانشرها في السوق.')}</Text>
        </View>
        <Pressable testID="add-listing" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground }]} onPress={() => begin()}>
          <Feather name="plus" size={14} color={colors.background} />
          <Text style={[styles.denseButtonText, { color: colors.background }]}>{text(isArabic, 'Add', 'إضافة')}</Text>
        </Pressable>
      </View>
      {showForm && (
        <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>{editing ? text(isArabic, 'Edit Listing', 'تعديل الإعلان') : text(isArabic, 'New Listing', 'إعلان جديد')}</Text>
          <View style={styles.formGrid}>
            {([['title', 'Title', 'العنوان'], ['titleArabic', 'Arabic title', 'العنوان بالعربية'], ['price', 'Price', 'السعر'], ['location', 'Location', 'الموقع'], ['locationArabic', 'Arabic location', 'الموقع بالعربية'], ['area', 'Area', 'المساحة'], ['bedrooms', 'Bedrooms', 'غرف النوم'], ['bathrooms', 'Bathrooms', 'دورات المياه'], ['adminRating', 'Rating (1-5)', 'التقييم (1-5)'], ['contactPhone', 'Contact phone', 'هاتف التواصل']] as const).map(([key, label, labelAr]) => (
              <View key={key} style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, label, labelAr)}</Text>
                <TextInput testID={`listing-field-${key}`} value={String(form[key])} onChangeText={(value) => set(key, value)} keyboardType={key === 'bedrooms' || key === 'bathrooms' || key === 'adminRating' ? 'number-pad' : 'default'} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              </View>
            ))}
          </View>
          <AdminImageGallery images={form.imageUrls} label={text(isArabic, 'Listing photos', 'صور الإعلان')} testID="pick-listing-image" onAdd={() => void pickListingImage()} onRemove={removeListingImage} />
          <View style={styles.toggles}>
            {(['sale', 'rent'] as const).map((type) => (
              <Pressable key={type} style={styles.toggleRow} onPress={() => set('type', type)}>
                <Feather name={form.type === type ? 'check-circle' : 'circle'} size={18} color={form.type === type ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.toggleText, { color: colors.foreground }]}>{type === 'sale' ? text(isArabic, 'For sale', 'للبيع') : text(isArabic, 'For rent', 'للإيجار')}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.toggleRow} onPress={() => set('isPublished', !form.isPublished)}>
              <Feather name={form.isPublished ? 'check-square' : 'square'} size={18} color={form.isPublished ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.toggleText, { color: colors.foreground }]}>{text(isArabic, 'Published', 'منشور')}</Text>
            </Pressable>
          </View>
          <View style={styles.formActions}>
            <Pressable testID="save-listing" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, flex: 1 }]} onPress={save}>
              <Text style={[styles.denseButtonText, { color: colors.background }]}>{create.isPending || update.isPending ? text(isArabic, 'Saving...', 'جارٍ الحفظ...') : text(isArabic, 'Save Listing', 'حفظ الإعلان')}</Text>
            </Pressable>
            <Pressable style={[styles.denseButton, { borderColor: colors.border }]} onPress={closeForm}>
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{text(isArabic, 'Cancel', 'إلغاء')}</Text>
            </Pressable>
          </View>
        </View>
      )}
      {listings.isLoading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
      {listings.data?.map((listing) => (
        <View key={listing.id} style={[styles.denseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{listing.title}</Text>
            <View style={[styles.badge, { backgroundColor: listing.isPublished ? '#D9F8F2' : colors.muted }]}>
              <Text style={[styles.badgeText, { color: listing.isPublished ? '#0B6E6B' : colors.mutedForeground }]}>{listing.isPublished ? text(isArabic, 'Live', 'نشط') : text(isArabic, 'Draft', 'مسودة')}</Text>
            </View>
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{listing.location} • {listing.price} • {listing.type === 'sale' ? text(isArabic, 'For sale', 'للبيع') : text(isArabic, 'For rent', 'للإيجار')}</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{`★ ${listing.rating.toFixed(1)} • ${listing.likes ?? 0} ${text(isArabic, 'likes', 'إعجاب')} • ${listing.saves ?? 0} ${text(isArabic, 'saves', 'حفظ')} • ${listing.contacts ?? 0} ${text(isArabic, 'contacts', 'تواصل')} • ${listing.views ?? 0} ${text(isArabic, 'views', 'مشاهدة')}`}</Text>
          <View style={styles.cardActions}>
            <Pressable testID={`edit-listing-${listing.id}`} onPress={() => begin(listing)} style={styles.actionLink}><Text style={[styles.actionText, { color: colors.primary }]}>{text(isArabic, 'Edit', 'تعديل')}</Text></Pressable>
            <Pressable testID={`toggle-listing-${listing.id}`} onPress={() => update.mutate({ id: listing.id, data: { isPublished: !listing.isPublished } })} style={styles.actionLink}><Text style={[styles.actionText, { color: colors.foreground }]}>{listing.isPublished ? text(isArabic, 'Unpublish', 'إلغاء النشر') : text(isArabic, 'Publish', 'نشر')}</Text></Pressable>
            <Pressable testID={`delete-listing-${listing.id}`} onPress={() => confirmAction(text(isArabic, 'Delete', 'حذف'), text(isArabic, 'This removes the listing and its engagement data.', 'سيؤدي هذا إلى حذف الإعلان وبيانات تفاعله.'), () => remove.mutate({ id: listing.id }), text(isArabic, 'Cancel', 'إلغاء'))} style={styles.actionLink}><Text style={[styles.actionText, { color: colors.destructive }]}>{text(isArabic, 'Delete', 'حذف')}</Text></Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const blankAdCampaign = () => {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  return {
    contractorId: '',
    title: '',
    description: '',
    ctaLabel: 'تواصل معنا',
    ctaUrl: '',
    media: [] as AdMediaItem[],
    audienceCity: '',
    audienceWilayats: [] as string[],
    audienceService: '',
    frequencyCapPerDay: '3',
    totalBudgetOmaniRial: '25',
    dailyBudgetOmaniRial: '5',
    billingModel: 'cpc' as const,
    unitRateOmaniRial: '0.5',
    startAt: start.toISOString().slice(0, 10),
    endAt: end.toISOString().slice(0, 10),
    status: 'draft' as const,
  };
};

const omanWilayatOptions = omanGovernorates.flatMap((governorate) => governorate.wilayats.map((wilayat) => ({
  ...wilayat,
  governorate: governorate.nameAr,
})));

function PushNotificationPanel() {
  const colors = useColors();
  const { isArabic } = useApp();
  const client = useQueryClient();
  const notifications = useListAdminPushNotifications({ query: { queryKey: getListAdminPushNotificationsQueryKey() } });
  const [form, setForm] = useState({ title: '', body: '', imageUrl: '', targetUrl: '' });
  const send = useCreateAdminPushNotification({
    mutation: {
      onSuccess: (result) => {
        client.invalidateQueries({ queryKey: getListAdminPushNotificationsQueryKey() });
        setForm({ title: '', body: '', imageUrl: '', targetUrl: '' });
        Alert.alert(
          text(isArabic, 'Notification sent', 'تم إرسال الإشعار'),
          text(isArabic, `Sent to ${result.sentCount} customers; ${result.failedCount} failed.`, `تم الإرسال إلى ${result.sentCount} عميل، وتعذر الإرسال إلى ${result.failedCount}.`),
        );
      },
      onError: (error) => Alert.alert(text(isArabic, 'Send failed', 'تعذر الإرسال'), errorMessage(error)),
    },
  });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    if (!form.title.trim() || !form.body.trim()) {
      Alert.alert(text(isArabic, 'Missing content', 'المحتوى غير مكتمل'), text(isArabic, 'Enter a title and message.', 'أدخل عنوانًا ونصًا للإشعار.'));
      return;
    }
    confirmAction(
      text(isArabic, 'Send to all customers', 'إرسال لجميع العملاء'),
      text(isArabic, 'Each registered customer will receive this notification once.', 'سيصل هذا الإشعار مرة واحدة لكل عميل مسجل.'),
      () => send.mutate({ data: {
        title: form.title.trim(),
        body: form.body.trim(),
        imageUrl: form.imageUrl.trim() || null,
        targetUrl: form.targetUrl.trim() || null,
      } }),
      text(isArabic, 'Cancel', 'إلغاء'),
    );
  };

  return (
    <View testID="admin-push-notifications" style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.tabHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>{text(isArabic, 'Phone notification', 'إشعار على هواتف العملاء')}</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'Send a special offer, investment opportunity, property, or announcement once to every registered customer.', 'أرسل عرضًا خاصًا أو فرصة استثمارية أو عقارًا أو إعلانًا مرة واحدة لكل عميل مسجل.')}</Text>
        </View>
      </View>
      <View style={styles.formGrid}>
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Notification title', 'عنوان الإشعار')}</Text>
          <TextInput testID="push-title" value={form.title} onChangeText={(value) => update('title', value)} maxLength={120} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
        </View>
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Open link (optional)', 'رابط الفتح (اختياري)')}</Text>
          <TextInput testID="push-target-url" value={form.targetUrl} onChangeText={(value) => update('targetUrl', value)} autoCapitalize="none" keyboardType="url" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
        </View>
      </View>
      <View style={styles.formGroupFull}>
        <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Message', 'نص الإشعار')}</Text>
        <TextInput testID="push-body" value={form.body} onChangeText={(value) => update('body', value)} maxLength={1000} multiline style={[styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
      </View>
      <View style={styles.formGroupFull}>
        <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Image URL (optional)', 'رابط الصورة (اختياري)')}</Text>
        <TextInput testID="push-image-url" value={form.imageUrl} onChangeText={(value) => update('imageUrl', value)} autoCapitalize="none" keyboardType="url" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
        <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'The Moqawil app icon appears automatically with the notification.', 'يظهر شعار تطبيق مقاول تلقائيًا مع الإشعار.')}</Text>
      </View>
      <Pressable testID="send-push-notification" disabled={send.isPending} style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, alignSelf: 'flex-start', opacity: send.isPending ? 0.6 : 1 }]} onPress={submit}>
        <Feather name="send" size={14} color={colors.background} />
        <Text style={[styles.denseButtonText, { color: colors.background }]}>{send.isPending ? text(isArabic, 'Sending...', 'جارٍ الإرسال...') : text(isArabic, 'Send to all customers', 'إرسال لجميع العملاء')}</Text>
      </Pressable>
      {notifications.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {notifications.data?.slice(0, 5).map((item) => (
        <View key={item.id} style={[styles.denseCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{item.body}</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{statusText(isArabic, item.status)} • {item.sentCount}/{item.recipientCount} {text(isArabic, 'sent', 'تم إرسالها')} • {item.failedCount} {text(isArabic, 'failed', 'تعذر')}</Text>
        </View>
      ))}
    </View>
  );
}

function AdvertisingTab() {
  const colors = useColors();
  const { isArabic } = useApp();
  const client = useQueryClient();
  const campaigns = useListAdminAdCampaigns({ query: { queryKey: getListAdminAdCampaignsQueryKey() } });
  const contractors = useListAdminContractors({ query: { queryKey: getListAdminContractorsQueryKey() } });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(blankAdCampaign);
  const [processingVideo, setProcessingVideo] = useState(false);
  const invalidate = () => client.invalidateQueries({ queryKey: getListAdminAdCampaignsQueryKey() });
  const create = useCreateAdminAdCampaign({ mutation: { onSuccess: () => { invalidate(); setShowForm(false); setForm(blankAdCampaign()); }, onError: (e) => Alert.alert(text(isArabic, 'Validation', 'تحقق'), errorMessage(e)) } });
  const update = useUpdateAdminAdCampaign({ mutation: { onSuccess: invalidate, onError: (e) => Alert.alert(text(isArabic, 'Validation', 'تحقق'), errorMessage(e)) } });

  const set = (key: string, value: string) => setForm((current: any) => ({ ...current, [key]: value }));
  const begin = (campaign?: AdCampaign) => {
    if (!campaign) {
      setEditingId(null);
      setForm(blankAdCampaign());
      setShowForm(true);
      return;
    }
    setEditingId(campaign.id);
    setForm({
      contractorId: campaign.contractorId,
      title: campaign.title,
      description: campaign.description,
      ctaLabel: campaign.ctaLabel,
      ctaUrl: campaign.ctaUrl ?? '',
      media: campaign.media?.length ? campaign.media : [{ url: campaign.mediaUrl, type: campaign.mediaType }],
      audienceCity: campaign.audience.cities?.[0] ?? '',
      audienceWilayats: campaign.audience.wilayats ?? [],
      audienceService: campaign.audience.serviceCategories?.[0] ?? '',
      frequencyCapPerDay: String(campaign.frequencyCapPerDay),
      totalBudgetOmaniRial: String(campaign.totalBudgetOmaniRial),
      dailyBudgetOmaniRial: String(campaign.dailyBudgetOmaniRial),
      billingModel: campaign.billingModel,
      unitRateOmaniRial: String(campaign.unitRateOmaniRial),
      startAt: campaign.startAt.slice(0, 10),
      endAt: campaign.endAt.slice(0, 10),
      status: campaign.status === 'completed' ? 'paused' : campaign.status,
    });
    setShowForm(true);
  };
  const save = () => {
    const total = Number(form.totalBudgetOmaniRial);
    const daily = Number(form.dailyBudgetOmaniRial);
    const rate = Number(form.unitRateOmaniRial);
    const cap = Number(form.frequencyCapPerDay);
    if (!form.contractorId || form.title.trim().length < 2 || !form.media.length || !Number.isFinite(total) || !Number.isFinite(daily) || daily > total || !Number.isFinite(rate) || !Number.isInteger(cap) || cap < 1 || !form.startAt || !form.endAt) {
      Alert.alert(text(isArabic, 'Missing campaign details', 'بيانات الحملة غير مكتملة'), text(isArabic, 'Choose an advertiser, media, dates, and valid budgets. Daily budget cannot exceed total budget.', 'اختر المعلن والوسائط والتواريخ وأدخل ميزانيات صحيحة. لا يمكن أن تتجاوز الميزانية اليومية الإجمالية.'));
      return;
    }
    const data = {
      contractorId: form.contractorId,
      title: form.title.trim(),
      description: form.description.trim() || form.title.trim(),
      ctaLabel: form.ctaLabel.trim() || (isArabic ? 'اعرف المزيد' : 'Learn more'),
      ctaUrl: form.ctaUrl.trim() || null,
      media: form.media,
      audience: {
        ...(form.audienceCity.trim() ? { cities: [form.audienceCity.trim()] } : {}),
        ...(form.audienceWilayats.length ? { wilayats: form.audienceWilayats } : {}),
        ...(form.audienceService.trim() ? { serviceCategories: [form.audienceService.trim()] } : {}),
      },
      frequencyCapPerDay: cap,
      totalBudgetOmaniRial: total,
      dailyBudgetOmaniRial: daily,
      billingModel: form.billingModel,
      unitRateOmaniRial: rate,
      startAt: new Date(`${form.startAt}T00:00:00.000Z`).toISOString(),
      endAt: new Date(`${form.endAt}T23:59:59.000Z`).toISOString(),
      status: form.status,
    } as AdminAdCampaignInput;
    if (editingId) update.mutate({ id: editingId, data: data as any });
    else create.mutate({ data });
  };
  const imageCount = form.media.filter((item: AdMediaItem) => item.type === 'image').length;
  const videoCount = form.media.filter((item: AdMediaItem) => item.type === 'video').length;
  const addMedia = async (type: AdMediaItem['type']) => {
    const remaining = type === 'image' ? 15 - imageCount : 2 - videoCount;
    if (remaining <= 0) {
      Alert.alert(
        text(isArabic, 'Media limit reached', 'تم بلوغ حد الوسائط'),
        type === 'image'
          ? text(isArabic, 'A campaign can contain up to 15 images.', 'يمكن أن تحتوي الحملة على 15 صورة كحد أقصى.')
          : text(isArabic, 'A campaign can contain up to 2 videos.', 'يمكن أن تحتوي الحملة على مقطعي فيديو كحد أقصى.'),
      );
      return;
    }
    if (type === 'video') setProcessingVideo(true);
    try {
      const selected = await pickAdMedia(isArabic, type, remaining);
      setForm((current: any) => ({ ...current, media: [...current.media, ...selected.items] }));
      if (selected.trimmedCount > 0) {
        Alert.alert(
          text(isArabic, 'Video shortened', 'تم قص الفيديو'),
          text(isArabic, 'Videos longer than five seconds were automatically shortened to five seconds.', 'تم قص الفيديوهات الأطول من خمس ثوانٍ تلقائيًا إلى خمس ثوانٍ.'),
        );
      }
    } finally {
      if (type === 'video') setProcessingVideo(false);
    }
  };
  const removeMedia = (index: number) => {
    setForm((current: any) => ({ ...current, media: current.media.filter((_: AdMediaItem, itemIndex: number) => itemIndex !== index) }));
  };

  if (campaigns.isLoading || contractors.isLoading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  if (campaigns.isError || contractors.isError) return <Text style={{ color: colors.destructive }}>{text(isArabic, 'Failed to load advertising.', 'تعذر تحميل الإعلانات.')}</Text>;

  return (
    <View testID="admin-advertising" style={styles.tabContainer}>
      <PushNotificationPanel />
      <View style={styles.tabHeader}>
        <View>
          <Text style={[styles.tabTitle, { color: colors.foreground }]}>{text(isArabic, 'Advertising campaigns', 'الحملات الإعلانية')}</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'Paid campaigns shown to customers with daily frequency control.', 'حملات مدفوعة تظهر للعملاء مع التحكم في تكرار الظهور يوميًا.')}</Text>
        </View>
        <Pressable testID="add-ad-campaign" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground }]} onPress={() => begin()}>
          <Text style={[styles.denseButtonText, { color: colors.background }]}>{text(isArabic, 'New campaign', 'حملة جديدة')}</Text>
        </Pressable>
      </View>
      {showForm ? (
        <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>{text(isArabic, editingId ? 'Edit campaign' : 'Campaign setup', editingId ? 'تعديل الحملة' : 'إعداد الحملة')}</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Advertiser', 'المعلن')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {(contractors.data ?? []).map((contractor) => (
              <Pressable key={contractor.id} onPress={() => set('contractorId', contractor.id)} style={[styles.statusPill, form.contractorId === contractor.id ? { backgroundColor: colors.foreground, borderColor: colors.foreground } : { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.statusPillText, { color: form.contractorId === contractor.id ? colors.background : colors.foreground }]}>{isArabic ? contractor.businessNameArabic || contractor.businessName : contractor.businessName}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.formGrid}>
            {[
              ['title', 'Campaign title', 'عنوان الحملة'],
              ['ctaLabel', 'Button label', 'نص الزر'],
              ['ctaUrl', 'Action URL', 'رابط الإجراء'],
              ['audienceCity', 'Target city', 'المدينة المستهدفة'],
              ['audienceService', 'Target service', 'الخدمة المستهدفة'],
              ['startAt', 'Start date (YYYY-MM-DD)', 'تاريخ البدء'],
              ['endAt', 'End date (YYYY-MM-DD)', 'تاريخ الانتهاء'],
            ].map(([key, label, labelAr]) => (
              <View key={key} style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, label, labelAr)}</Text>
                <TextInput value={String((form as any)[key])} onChangeText={(value) => set(key, value)} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              </View>
            ))}
          </View>
          <View style={styles.wilayatPicker}>
            <View style={styles.mediaHeader}>
              <Text style={[styles.label, { color: colors.foreground, marginBottom: 0 }]}>{text(isArabic, 'Target wilayats', 'الولايات المستهدفة')}</Text>
              <Text style={[styles.mediaCounter, { color: colors.mutedForeground }]}>{form.audienceWilayats.length ? `${form.audienceWilayats.length} ${text(isArabic, 'selected', 'محددة')}` : text(isArabic, 'All Oman', 'كل السلطنة')}</Text>
            </View>
            <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'Select one or more wilayats. Leave empty to target all Oman.', 'اختر ولاية أو أكثر. اتركها فارغة لاستهداف جميع ولايات السلطنة.')}</Text>
            <ScrollView nestedScrollEnabled style={[styles.wilayatList, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <View style={styles.wilayatOptions}>
                {[...new Set([...form.audienceWilayats, ...omanWilayatOptions.map((wilayat) => wilayat.name)])].map((name) => {
                  const option = omanWilayatOptions.find((wilayat) => wilayat.name === name);
                  const selected = form.audienceWilayats.includes(name);
                  return (
                    <Pressable key={name} onPress={() => setForm((current: any) => ({ ...current, audienceWilayats: selected ? current.audienceWilayats.filter((item: string) => item !== name) : [...current.audienceWilayats, name] }))} style={[styles.wilayatOption, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface }]}>
                      <Feather name={selected ? 'check-square' : 'square'} size={15} color={selected ? colors.primary : colors.mutedForeground} />
                      <View style={styles.wilayatOptionCopy}>
                        <Text style={[styles.wilayatName, { color: colors.foreground }]}>{isArabic ? option?.nameAr ?? name : name}</Text>
                        {option ? <Text style={[styles.wilayatGovernorate, { color: colors.mutedForeground }]}>{option.governorate}</Text> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
          <View style={styles.mediaHeader}>
            <Text style={[styles.label, { color: colors.foreground, marginBottom: 0 }]}>{text(isArabic, 'Campaign gallery', 'معرض الحملة')}</Text>
            <Text style={[styles.mediaCounter, { color: colors.mutedForeground }]}>
              {text(isArabic, `Images ${imageCount}/15 · Videos ${videoCount}/2`, `الصور ${imageCount}/15 · الفيديو ${videoCount}/2`)}
            </Text>
          </View>
          <View style={styles.formActions}>
            <Pressable disabled={imageCount >= 15} onPress={() => void addMedia('image')} style={[styles.denseButton, { borderColor: colors.border, opacity: imageCount >= 15 ? 0.45 : 1 }]}>
              <Feather name="image" size={16} color={colors.foreground} />
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{text(isArabic, 'Add images', 'إضافة صور')}</Text>
            </Pressable>
            <Pressable testID="add-ad-video" disabled={videoCount >= 2 || processingVideo} onPress={() => void addMedia('video')} style={[styles.denseButton, { borderColor: colors.border, opacity: videoCount >= 2 || processingVideo ? 0.45 : 1 }]}>
              {processingVideo ? <ActivityIndicator size="small" color={colors.foreground} /> : <Feather name="video" size={16} color={colors.foreground} />}
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{processingVideo ? text(isArabic, 'Preparing video…', 'جاري تجهيز الفيديو…') : text(isArabic, 'Add videos', 'إضافة فيديو')}</Text>
            </Pressable>
          </View>
          {form.media.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaStrip}>
              {form.media.map((item: AdMediaItem, index: number) => (
                <View key={`${item.type}-${index}`} style={[styles.mediaPreview, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  {item.type === 'image'
                    ? <Image source={{ uri: item.url }} style={styles.mediaPreviewImage} />
                    : <View style={styles.mediaVideoPreview}><Feather name="play-circle" size={30} color={colors.primary} /><Text style={[styles.mediaTypeText, { color: colors.mutedForeground }]}>{text(isArabic, 'Video', 'فيديو')}</Text></View>}
                  <Pressable accessibilityLabel={text(isArabic, 'Remove media', 'حذف الوسائط')} onPress={() => removeMedia(index)} style={styles.removeMedia}>
                    <Feather name="x" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'Add at least one image or video. Maximum 15 images and 2 videos.', 'أضف صورة أو فيديو واحدًا على الأقل. الحد الأقصى 15 صورة وفيديوهان.')}</Text>}
          <View style={styles.formGrid}>
            {[
              ['totalBudgetOmaniRial', 'Total budget (OMR)', 'الميزانية الإجمالية (ر.ع.)'],
              ['dailyBudgetOmaniRial', 'Daily budget (OMR)', 'الميزانية اليومية (ر.ع.)'],
              ['unitRateOmaniRial', 'Rate per event (OMR)', 'سعر الحدث (ر.ع.)'],
              ['frequencyCapPerDay', 'Views per customer/day', 'ظهور العميل يوميًا'],
            ].map(([key, label, labelAr]) => <View key={key} style={styles.formGroup}><Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, label, labelAr)}</Text><TextInput value={String((form as any)[key])} onChangeText={(value) => set(key, value)} keyboardType="decimal-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} /></View>)}
          </View>
          <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Billing model', 'نموذج الفوترة')}</Text>
          <View style={styles.formActions}>
            {(['cpm', 'cpc', 'cpa'] as const).map((model) => <Pressable key={model} onPress={() => setForm((current: any) => ({ ...current, billingModel: model }))} style={[styles.statusPill, form.billingModel === model ? { backgroundColor: colors.foreground, borderColor: colors.foreground } : { backgroundColor: colors.background, borderColor: colors.border }]}><Text style={[styles.statusPillText, { color: form.billingModel === model ? colors.background : colors.foreground }]}>{model.toUpperCase()}</Text></Pressable>)}
          </View>
          <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Campaign state', 'حالة الحملة')}</Text>
          <View style={styles.formActions}>
            {(['draft', 'active', 'paused'] as const).map((state) => <Pressable key={state} onPress={() => setForm((current: any) => ({ ...current, status: state }))} style={[styles.statusPill, form.status === state ? { backgroundColor: colors.foreground, borderColor: colors.foreground } : { backgroundColor: colors.background, borderColor: colors.border }]}><Text style={[styles.statusPillText, { color: form.status === state ? colors.background : colors.foreground }]}>{statusText(isArabic, state)}</Text></Pressable>)}
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'Payment is reserved for the campaign budget; Visa/Apple Pay activation will be added after the payment connection is enabled.', 'المبلغ محجوز لميزانية الحملة؛ سيتم تفعيل Visa وApple Pay بعد ربط بوابة الدفع.')}</Text>
          <View style={styles.formActions}>
            <Pressable testID="save-ad-campaign" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, flex: 1 }]} onPress={save}><Text style={[styles.denseButtonText, { color: colors.background }]}>{text(isArabic, 'Save campaign', 'حفظ الحملة')}</Text></Pressable>
            <Pressable style={[styles.denseButton, { borderColor: colors.border }]} onPress={() => setShowForm(false)}><Text style={[styles.denseButtonText, { color: colors.foreground }]}>{text(isArabic, 'Cancel', 'إلغاء')}</Text></Pressable>
          </View>
        </View>
      ) : null}
      {!campaigns.data?.length ? <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'No campaigns yet.', 'لا توجد حملات بعد.')}</Text> : null}
      {campaigns.data?.map((campaign) => (
        <View key={campaign.id} style={[styles.denseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{campaign.title}</Text>
            <View style={[styles.badge, { backgroundColor: campaign.status === 'active' ? '#D9F8F2' : campaign.status === 'paused' ? '#FFF2D6' : colors.muted }]}><Text style={[styles.badgeText, { color: campaign.status === 'active' ? '#0B6E6B' : colors.mutedForeground }]}>{statusText(isArabic, campaign.status)}</Text></View>
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{campaign.advertiserNameArabic || campaign.advertiserName} • {campaign.billingModel.toUpperCase()} • {campaign.totalBudgetOmaniRial.toFixed(3)} OMR {text(isArabic, 'budget', 'ميزانية')}</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'Target wilayats', 'الولايات المستهدفة')}: {campaign.audience.wilayats?.length ? campaign.audience.wilayats.join('، ') : text(isArabic, 'All Oman', 'كل السلطنة')}</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'Spent', 'المصروف')}: {campaign.spentOmaniRial.toFixed(3)} • {text(isArabic, 'Remaining', 'المتبقي')}: {campaign.remainingOmaniRial.toFixed(3)} • {text(isArabic, 'Today', 'اليوم')}: {campaign.dailySpentOmaniRial.toFixed(3)} / {campaign.dailyBudgetOmaniRial.toFixed(3)} OMR</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{campaign.impressionCount} {text(isArabic, 'impressions', 'ظهور')} • {campaign.clickCount} {text(isArabic, 'clicks', 'نقرات')} • {campaign.conversionCount} {text(isArabic, 'results', 'نتائج')} • {text(isArabic, 'up to', 'حتى')} {campaign.frequencyCapPerDay} / {text(isArabic, 'customer/day', 'عميل/يوم')}</Text>
          <View style={styles.cardActions}>
            <Pressable testID={`edit-ad-${campaign.id}`} onPress={() => begin(campaign)} style={styles.actionLink}><Text style={[styles.actionText, { color: colors.primary }]}>{text(isArabic, 'Edit', 'تعديل')}</Text></Pressable>
            {campaign.status !== 'completed' ? <Pressable testID={`toggle-ad-${campaign.id}`} onPress={() => update.mutate({ id: campaign.id, data: { status: campaign.status === 'active' ? 'paused' : 'active' } as any })} style={styles.actionLink}><Text style={[styles.actionText, { color: colors.foreground }]}>{campaign.status === 'active' ? text(isArabic, 'Pause', 'إيقاف') : text(isArabic, 'Activate', 'تشغيل')}</Text></Pressable> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function SubscriptionsTab() {
  const colors = useColors();
  const { isArabic } = useApp();
  const client = useQueryClient();
  const subs = useListAdminSubscriptions({ query: { queryKey: getListAdminSubscriptionsQueryKey() } });

  const updateSub = useUpdateAdminSubscription({
    mutation: {
      onSuccess: () => client.invalidateQueries({ queryKey: getListAdminSubscriptionsQueryKey() }),
      onError: (e) => Alert.alert(text(isArabic, 'Error', 'خطأ'), errorMessage(e))
    }
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<any>('');
  const [extendMonths, setExtendMonths] = useState('1');

  if (subs.isLoading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  if (subs.isError) return <Text style={{ color: colors.destructive }}>{text(isArabic, 'Failed to load subscriptions.', 'تعذر تحميل الاشتراكات.')}</Text>;

  const statuses = ['free_trial', 'active', 'payment_due', 'expired', 'cancelled', 'suspended'];

  return (
    <View testID="admin-subscriptions" style={styles.tabContainer}>
      <Text style={[styles.tabTitle, { color: colors.foreground, marginBottom: 12 }]}>{text(isArabic, 'Subscriptions', 'الاشتراكات')}</Text>
      {subs.data?.map(sub => (
        <View key={sub.id} style={[styles.denseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{sub.contractorName || text(isArabic, 'Unknown', 'غير معروف')}</Text>
            <View style={[styles.badge, { backgroundColor: sub.status === 'active' ? '#D9F8F2' : (sub.status === 'payment_due' ? '#FDEBEB' : colors.muted) }]}>
              <Text style={[styles.badgeText, { color: sub.status === 'active' ? '#0B6E6B' : (sub.status === 'payment_due' ? '#C55353' : colors.mutedForeground) }]}>{statusText(isArabic, sub.status)}</Text>
            </View>
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{sub.planName} • {sub.priceOmaniRial} OMR</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'Period', 'الفترة')}: {sub.currentPeriodStartsAt ? sub.currentPeriodStartsAt.split('T')[0] : 'N/A'} - {sub.currentPeriodEndsAt ? sub.currentPeriodEndsAt.split('T')[0] : 'N/A'}</Text>

          {editingId === sub.id ? (
            <View style={[styles.inlineForm, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Set Status', 'تحديد الحالة')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {statuses.map(s => (
                  <Pressable key={s} onPress={() => setFormStatus(s)} style={[styles.statusPill, formStatus === s ? { backgroundColor: colors.foreground, borderColor: colors.foreground } : { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.statusPillText, formStatus === s ? { color: colors.background } : { color: colors.foreground }]}>{statusText(isArabic, s)}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.formGroupFull}>
                <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Extend Trial (Months)', 'تمديد التجربة (بالأشهر)')}</Text>
                <TextInput value={extendMonths} onChangeText={setExtendMonths} keyboardType="number-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
              </View>

              <View style={styles.formActions}>
                <Pressable testID={`save-sub-${sub.id}`} style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, flex: 1 }]} onPress={() => {
                  updateSub.mutate({ id: sub.id, data: { status: formStatus, extendTrialMonths: Number(extendMonths) || undefined } }, {
                    onSuccess: () => setEditingId(null)
                  });
                }}>
                  <Text style={[styles.denseButtonText, { color: colors.background }]}>{text(isArabic, 'Update', 'تحديث')}</Text>
                </Pressable>
                <Pressable style={[styles.denseButton, { borderColor: colors.border }]} onPress={() => setEditingId(null)}>
                  <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{text(isArabic, 'Cancel', 'إلغاء')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.cardActions}>
              <Pressable testID={`edit-sub-${sub.id}`} onPress={() => { setEditingId(sub.id); setFormStatus(sub.status); setExtendMonths(''); }} style={styles.actionLink}>
                <Text style={[styles.actionText, { color: colors.primary }]}>{text(isArabic, 'Manage', 'إدارة')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function PaymentsTab() {
  const colors = useColors();
  const { isArabic } = useApp();
  const client = useQueryClient();
  const payments = useListAdminPayments({ query: { queryKey: getListAdminPaymentsQueryKey() } });

  const createPayment = useCreateAdminPayment({
    mutation: {
      onSuccess: () => {
         client.invalidateQueries({ queryKey: getListAdminPaymentsQueryKey() });
         setAdding(false);
         setForm({ subscriptionId: '', amountOmaniRial: '0', status: 'paid', provider: 'manual', providerReference: '' });
      },
      onError: (e) => Alert.alert(text(isArabic, 'Error', 'خطأ'), errorMessage(e))
    }
  });

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ subscriptionId: '', amountOmaniRial: '0', status: 'paid', provider: 'manual', providerReference: '' });

  if (payments.isLoading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  if (payments.isError) return <Text style={{ color: colors.destructive }}>{text(isArabic, 'Failed to load payments.', 'تعذر تحميل المدفوعات.')}</Text>;

  const statuses = ['pending', 'paid', 'failed', 'refunded', 'void'];

  return (
    <View testID="admin-payments" style={styles.tabContainer}>
      <View style={styles.tabHeader}>
        <Text style={[styles.tabTitle, { color: colors.foreground }]}>{text(isArabic, 'Payments', 'المدفوعات')}</Text>
        <Pressable testID="add-payment" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground }]} onPress={() => setAdding(true)}>
          <Feather name="plus" size={14} color={colors.background} />
          <Text style={[styles.denseButtonText, { color: colors.background }]}>{text(isArabic, 'Record', 'تسجيل')}</Text>
        </Pressable>
      </View>

      {adding && (
        <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>{text(isArabic, 'Record Payment', 'تسجيل دفعة')}</Text>
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Subscription ID', 'معرّف الاشتراك')}</Text>
            <TextInput value={form.subscriptionId} onChangeText={v => setForm({ ...form, subscriptionId: v })} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.formGrid}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Amount (OMR)', 'المبلغ (ر.ع.)')}</Text>
              <TextInput value={form.amountOmaniRial} onChangeText={v => setForm({ ...form, amountOmaniRial: v })} keyboardType="decimal-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
            </View>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Provider', 'المزوّد')}</Text>
              <TextInput value={form.provider} onChangeText={v => setForm({ ...form, provider: v })} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
            </View>
          </View>
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Provider Reference', 'مرجع المزوّد')}</Text>
            <TextInput value={form.providerReference} onChangeText={v => setForm({ ...form, providerReference: v })} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>

          <Text style={[styles.label, { color: colors.foreground, marginTop: 8 }]}>{text(isArabic, 'Status', 'الحالة')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {statuses.map(s => (
              <Pressable key={s} onPress={() => setForm({ ...form, status: s })} style={[styles.statusPill, form.status === s ? { backgroundColor: colors.foreground, borderColor: colors.foreground } : { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.statusPillText, form.status === s ? { color: colors.background } : { color: colors.foreground }]}>{statusText(isArabic, s)}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.formActions}>
            <Pressable testID="save-payment" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, flex: 1 }]} onPress={() => {
              if (!form.subscriptionId) { Alert.alert(text(isArabic, 'Required', 'مطلوب'), text(isArabic, 'Subscription ID is required', 'معرّف الاشتراك مطلوب')); return; }
              createPayment.mutate({
                data: {
                  subscriptionId: form.subscriptionId,
                  amountOmaniRial: Number(form.amountOmaniRial) || 0,
                  status: form.status,
                  provider: form.provider,
                  providerReference: form.providerReference || undefined
                }
              });
            }}>
              <Text style={[styles.denseButtonText, { color: colors.background }]}>{createPayment.isPending ? text(isArabic, 'Saving...', 'جارٍ الحفظ...') : text(isArabic, 'Save Payment', 'حفظ الدفعة')}</Text>
            </Pressable>
            <Pressable style={[styles.denseButton, { borderColor: colors.border }]} onPress={() => setAdding(false)}>
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{text(isArabic, 'Cancel', 'إلغاء')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {payments.data?.map(p => (
        <View key={p.id} style={[styles.denseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{p.amountOmaniRial} OMR via {p.provider}</Text>
            <View style={[styles.badge, { backgroundColor: p.status === 'paid' ? '#D9F8F2' : colors.muted }]}>
              <Text style={[styles.badgeText, { color: p.status === 'paid' ? '#0B6E6B' : colors.mutedForeground }]}>{p.status}</Text>
            </View>
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'Sub', 'اشتراك')}: {p.subscriptionId}</Text>
          {p.providerReference && <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'Ref', 'مرجع')}: {p.providerReference}</Text>}
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{new Date(p.createdAt).toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
}

type HomepageSectionId = HomepageSettings['sectionOrder'][number];

function HomepageSettingsTab() {
  const colors = useColors();
  const { isArabic } = useApp();
  const client = useQueryClient();
  const { data: settings, isLoading, isError } = useGetAdminSettings();
  const [form, setForm] = useState<HomepageSettings | null>(null);
  const updateSettings = useUpdateAdminSettings({
    mutation: {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
        client.invalidateQueries({ queryKey: getGetHomepageSettingsQueryKey() });
        Alert.alert(text(isArabic, 'Homepage updated', 'تم تحديث الصفحة الرئيسية'), text(isArabic, 'Visitors will see the new content when the homepage refreshes.', 'سيظهر المحتوى الجديد للزوار عند تحديث الصفحة الرئيسية.'));
      },
      onError: (e) => Alert.alert(text(isArabic, 'Unable to save', 'تعذر الحفظ'), errorMessage(e)),
    },
  });

  useEffect(() => {
    if (settings?.homepage) setForm(JSON.parse(JSON.stringify(settings.homepage)) as HomepageSettings);
  }, [settings?.homepage]);

  if (isLoading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  if (isError || !settings) return <Text style={{ color: colors.destructive }}>{text(isArabic, 'Failed to load homepage settings.', 'تعذر تحميل إعدادات الصفحة الرئيسية.')}</Text>;
  if (!form) return null;

  const updateHero = (key: keyof HomepageSettings['hero'], value: string | boolean) => setForm((current) => current ? ({ ...current, hero: { ...current.hero, [key]: value } }) : current);
  const updateSection = (id: HomepageSectionId, key: keyof HomepageSettings['sections'][HomepageSectionId], value: string | number | boolean) => setForm((current) => current ? ({
    ...current,
    sections: { ...current.sections, [id]: { ...current.sections[id], [key]: value } },
  }) : current);
  const moveSection = (id: HomepageSectionId, direction: -1 | 1) => setForm((current) => {
    if (!current) return current;
    const order = [...current.sectionOrder];
    const index = order.indexOf(id);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= order.length) return current;
    [order[index], order[destination]] = [order[destination]!, order[index]!];
    return { ...current, sectionOrder: order };
  });
  const sectionNames: Record<HomepageSectionId, [string, string]> = {
    services: ['Services', 'الخدمات'],
    location: ['Location banner', 'بانر الموقع'],
    providers: ['Recommended providers', 'المزودون الموصى بهم'],
    properties: ['Featured properties', 'العقارات المختارة'],
    maintenance: ['Quick maintenance', 'الصيانة السريعة'],
  };
  const save = () => updateSettings.mutate({ data: { ...settings, homepage: form } });

  return (
    <View testID="admin-homepage-settings" style={styles.tabContainer}>
      <View>
        <Text style={[styles.tabTitle, { color: colors.foreground }]}>{text(isArabic, 'Homepage content', 'محتوى الصفحة الرئيسية')}</Text>
        <Text style={[styles.cardMeta, { color: colors.mutedForeground, marginTop: 5 }]}>{text(isArabic, 'Edit both languages, hide sections, and use the arrows to change their order.', 'عدّل اللغتين، أخفِ الأقسام، واستخدم الأسهم لتغيير ترتيبها.')}</Text>
      </View>

      <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.formTitle, { color: colors.foreground }]}>{text(isArabic, 'Visibility', 'الظهور')}</Text>
        <Pressable testID="homepage-toggle-ads" style={styles.toggleRow} onPress={() => setForm({ ...form, showSponsoredAds: !form.showSponsoredAds })}>
          <Feather name={form.showSponsoredAds ? 'check-square' : 'square'} size={19} color={form.showSponsoredAds ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.toggleText, { color: colors.foreground }]}>{text(isArabic, 'Show sponsored campaigns below the hero', 'عرض الحملات الإعلانية أسفل البانر الرئيسي')}</Text>
        </Pressable>
      </View>

      <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.homepageSectionHeader}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>{text(isArabic, 'Main hero and search', 'البانر الرئيسي والبحث')}</Text>
          <Pressable testID="homepage-toggle-hero" style={styles.toggleRow} onPress={() => updateHero('visible', !form.hero.visible)}>
            <Feather name={form.hero.visible ? 'eye' : 'eye-off'} size={18} color={form.hero.visible ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.toggleText, { color: colors.foreground }]}>{form.hero.visible ? text(isArabic, 'Visible', 'ظاهر') : text(isArabic, 'Hidden', 'مخفي')}</Text>
          </Pressable>
        </View>
        <View style={styles.formGrid}>
          {([
            ['eyebrowEn', 'Eyebrow (English)', 'العنوان العلوي (إنجليزي)'],
            ['eyebrowAr', 'Eyebrow (Arabic)', 'العنوان العلوي (عربي)'],
            ['titleEn', 'Main title (English)', 'العنوان الرئيسي (إنجليزي)'],
            ['titleAr', 'Main title (Arabic)', 'العنوان الرئيسي (عربي)'],
            ['searchPlaceholderEn', 'Search text (English)', 'نص البحث (إنجليزي)'],
            ['searchPlaceholderAr', 'Search text (Arabic)', 'نص البحث (عربي)'],
          ] as const).map(([key, label, labelAr]) => (
            <View key={key} style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, label, labelAr)}</Text>
              <TextInput testID={`homepage-hero-${key}`} value={String(form.hero[key])} onChangeText={(value) => updateHero(key, value)} textAlign={key.endsWith('Ar') ? 'right' : 'left'} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
            </View>
          ))}
        </View>
        {([
          ['subtitleEn', 'Description (English)', 'الوصف (إنجليزي)'],
          ['subtitleAr', 'Description (Arabic)', 'الوصف (عربي)'],
        ] as const).map(([key, label, labelAr]) => (
          <View key={key} style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, label, labelAr)}</Text>
            <TextInput testID={`homepage-hero-${key}`} value={form.hero[key]} onChangeText={(value) => updateHero(key, value)} multiline textAlign={key.endsWith('Ar') ? 'right' : 'left'} style={[styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
        ))}
      </View>

      {form.sectionOrder.map((id, index) => {
        const section = form.sections[id];
        const isLocation = id === 'location';
        return (
          <View key={id} testID={`homepage-section-${id}`} style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.homepageSectionHeader}>
              <View style={styles.homepageSectionTitle}>
                <Text style={[styles.homepageOrderNumber, { color: colors.primary, backgroundColor: colors.primarySoft }]}>{index + 1}</Text>
                <Text style={[styles.formTitle, { color: colors.foreground }]}>{text(isArabic, ...sectionNames[id])}</Text>
              </View>
              <View style={styles.homepageSectionActions}>
                <Pressable accessibilityLabel={text(isArabic, 'Move up', 'تحريك للأعلى')} disabled={index === 0} onPress={() => moveSection(id, -1)} style={[styles.homepageMoveButton, { borderColor: colors.border, opacity: index === 0 ? 0.35 : 1 }]}><Feather name="arrow-up" size={16} color={colors.foreground} /></Pressable>
                <Pressable accessibilityLabel={text(isArabic, 'Move down', 'تحريك للأسفل')} disabled={index === form.sectionOrder.length - 1} onPress={() => moveSection(id, 1)} style={[styles.homepageMoveButton, { borderColor: colors.border, opacity: index === form.sectionOrder.length - 1 ? 0.35 : 1 }]}><Feather name="arrow-down" size={16} color={colors.foreground} /></Pressable>
                <Pressable testID={`homepage-toggle-${id}`} accessibilityLabel={text(isArabic, 'Toggle section', 'إظهار أو إخفاء القسم')} onPress={() => updateSection(id, 'visible', !section.visible)} style={styles.homepageVisibilityButton}><Feather name={section.visible ? 'eye' : 'eye-off'} size={19} color={section.visible ? colors.primary : colors.mutedForeground} /></Pressable>
              </View>
            </View>
            <View style={styles.formGrid}>
              {([
                ['titleEn', 'Title (English)', 'العنوان (إنجليزي)'],
                ['titleAr', 'Title (Arabic)', 'العنوان (عربي)'],
                ['subtitleEn', isLocation ? 'Main line (English)' : 'Subtitle (English)', isLocation ? 'النص الرئيسي (إنجليزي)' : 'الوصف (إنجليزي)'],
                ['subtitleAr', isLocation ? 'Main line (Arabic)' : 'Subtitle (Arabic)', isLocation ? 'النص الرئيسي (عربي)' : 'الوصف (عربي)'],
              ] as const).map(([key, label, labelAr]) => (
                <View key={key} style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, label, labelAr)}</Text>
                  <TextInput value={section[key]} onChangeText={(value) => updateSection(id, key, value)} textAlign={key.endsWith('Ar') ? 'right' : 'left'} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
                </View>
              ))}
              {(isLocation || id === 'providers' || id === 'properties') ? ([
                ['actionEn', isLocation ? 'Status (English)' : 'Action (English)', isLocation ? 'حالة الموقع (إنجليزي)' : 'زر العرض (إنجليزي)'],
                ['actionAr', isLocation ? 'Status (Arabic)' : 'Action (Arabic)', isLocation ? 'حالة الموقع (عربي)' : 'زر العرض (عربي)'],
              ] as const).map(([key, label, labelAr]) => (
                <View key={key} style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, label, labelAr)}</Text>
                  <TextInput value={section[key]} onChangeText={(value) => updateSection(id, key, value)} textAlign={key.endsWith('Ar') ? 'right' : 'left'} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
                </View>
              )) : null}
              {!isLocation ? (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Items shown (1-12)', 'عدد العناصر (1-12)')}</Text>
                  <TextInput testID={`homepage-limit-${id}`} value={String(section.limit)} onChangeText={(value) => updateSection(id, 'limit', Math.min(12, Math.max(1, Number(value) || 1)))} keyboardType="number-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
                </View>
              ) : null}
            </View>
            {isLocation ? (
              <>
                <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{text(isArabic, 'Use {area} and {city} to insert the visitor’s current location.', 'استخدم {area} و{city} لإظهار منطقة ومدينة الزائر الحالية.')}</Text>
                {([
                  ['detailEn', 'Supporting text (English)', 'النص الإضافي (إنجليزي)'],
                  ['detailAr', 'Supporting text (Arabic)', 'النص الإضافي (عربي)'],
                ] as const).map(([key, label, labelAr]) => (
                  <View key={key} style={styles.formGroupFull}>
                    <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, label, labelAr)}</Text>
                    <TextInput value={section[key]} onChangeText={(value) => updateSection(id, key, value)} multiline textAlign={key.endsWith('Ar') ? 'right' : 'left'} style={[styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
                  </View>
                ))}
              </>
            ) : null}
          </View>
        );
      })}

      <Pressable testID="save-homepage-settings" disabled={updateSettings.isPending} style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, opacity: updateSettings.isPending ? 0.6 : 1 }]} onPress={save}>
        <Feather name="save" size={16} color={colors.background} />
        <Text style={[styles.denseButtonText, { color: colors.background }]}>{updateSettings.isPending ? text(isArabic, 'Saving…', 'جارٍ الحفظ…') : text(isArabic, 'Save homepage', 'حفظ الصفحة الرئيسية')}</Text>
      </Pressable>
    </View>
  );
}

function SettingsTab() {
  const colors = useColors();
  const { isArabic } = useApp();
  const client = useQueryClient();
  const { data: settings, isLoading, isError } = useGetAdminSettings();
  const updateSettings = useUpdateAdminSettings({
    mutation: {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
        Alert.alert(text(isArabic, 'Success', 'تم'), text(isArabic, 'Settings updated', 'تم تحديث الإعدادات'));
      },
      onError: (e) => Alert.alert(text(isArabic, 'Error', 'خطأ'), errorMessage(e))
    }
  });

  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (settings && !form) {
      setForm({
        trialMonths: String(settings.trialMonths),
        defaultPriceOmaniRial: String(settings.defaultPriceOmaniRial),
        wRating: String(settings.rankingWeights.rating),
        wReviews: String(settings.rankingWeights.reviews),
        wProjects: String(settings.rankingWeights.projects),
        wProfile: String(settings.rankingWeights.profile),
        wVerification: String(settings.rankingWeights.verification),
        wActivity: String(settings.rankingWeights.activity),
        wEngagement: String(settings.rankingWeights.engagement),
      });
    }
  }, [settings]);

  if (isLoading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  if (isError) return <Text style={{ color: colors.destructive }}>{text(isArabic, 'Failed to load settings.', 'تعذر تحميل الإعدادات.')}</Text>;
  if (!form) return null;

  const save = () => {
    updateSettings.mutate({
      data: {
        trialMonths: Number(form.trialMonths) || 1,
        defaultPriceOmaniRial: Number(form.defaultPriceOmaniRial) || 0,
        rankingWeights: {
          rating: Number(form.wRating) || 0,
          reviews: Number(form.wReviews) || 0,
          projects: Number(form.wProjects) || 0,
          profile: Number(form.wProfile) || 0,
          verification: Number(form.wVerification) || 0,
          activity: Number(form.wActivity) || 0,
          engagement: Number(form.wEngagement) || 0,
        },
        homepage: settings!.homepage,
      }
    });
  };

  return (
    <View testID="admin-settings" style={styles.tabContainer}>
      <Text style={[styles.tabTitle, { color: colors.foreground, marginBottom: 16 }]}>{text(isArabic, 'Marketplace Settings', 'إعدادات السوق')}</Text>

      <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.formTitle, { color: colors.foreground }]}>{text(isArabic, 'Billing Defaults', 'إعدادات الفوترة')}</Text>
        <View style={styles.formGrid}>
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Trial Months', 'أشهر التجربة')}</Text>
            <TextInput value={form.trialMonths} onChangeText={v => setForm({ ...form, trialMonths: v })} keyboardType="number-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Default Price (OMR)', 'السعر الافتراضي (ر.ع.)')}</Text>
            <TextInput value={form.defaultPriceOmaniRial} onChangeText={v => setForm({ ...form, defaultPriceOmaniRial: v })} keyboardType="decimal-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
        </View>
      </View>

      <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.formTitle, { color: colors.foreground }]}>{text(isArabic, 'Ranking Weights', 'أوزان الترتيب')}</Text>
        <View style={styles.formGrid}>
          {[
            ['wRating', 'Rating', 'التقييم'], ['wReviews', 'Reviews', 'المراجعات'], ['wProjects', 'Projects', 'المشاريع'],
            ['wProfile', 'Profile', 'الملف الشخصي'], ['wVerification', 'Verification', 'التوثيق'], ['wActivity', 'Activity', 'النشاط'],
            ['wEngagement', 'Engagement', 'التفاعل']
          ].map(([key, label, labelAr]) => (
            <View key={key} style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, label, labelAr)}</Text>
              <TextInput value={form[key]} onChangeText={v => setForm({ ...form, [key]: v })} keyboardType="decimal-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
            </View>
          ))}
        </View>
      </View>

      <Pressable testID="save-settings" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, marginTop: 8 }]} onPress={save}>
        <Text style={[styles.denseButtonText, { color: colors.background }]}>{updateSettings.isPending ? text(isArabic, 'Saving...', 'جارٍ الحفظ...') : text(isArabic, 'Save Settings', 'حفظ الإعدادات')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
  loader: { marginTop: 40 },
  button: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  buttonText: { fontWeight: '700', fontSize: 15 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  accessNote: { fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 300, marginTop: -4 },

  headerContainer: { paddingBottom: 0, borderBottomWidth: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  screenTitle: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16, marginBottom: 16, letterSpacing: -0.5 },
  tabScroll: { paddingHorizontal: 12, marginBottom: -1 },
  tabScrollContent: { gap: 4, paddingBottom: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  activeTab: {},
  tabText: { fontSize: 14, fontWeight: '700' },

  content: { padding: 16, paddingBottom: 60 },
  tabContainer: { gap: 12 },
  tabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tabTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '48%', borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  statValue: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  statTitle: { fontSize: 12, fontWeight: '600' },

  denseCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800', flex: 1, letterSpacing: -0.2 },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  cardMeta: { fontSize: 12, lineHeight: 16 },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 10 },
  actionLink: { paddingVertical: 4 },
  actionText: { fontSize: 13, fontWeight: '700' },

  formPanel: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12, marginBottom: 16 },
  formTitle: { fontSize: 16, fontWeight: '800' },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  formGroup: { width: '50%', paddingHorizontal: 6, marginBottom: 12 },
  formGroupFull: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, height: 40, paddingHorizontal: 12, fontSize: 14 },
  inputMulti: { borderWidth: 1, borderRadius: 8, minHeight: 80, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, textAlignVertical: 'top' },
  buildingChips: { gap: 8, paddingRight: 4 },
  buildingChip: { minHeight: 38, maxWidth: 250, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, justifyContent: 'center' },
  filterPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },

  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginVertical: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleText: { fontSize: 14, fontWeight: '600' },
  homepageSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  homepageSectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  homepageOrderNumber: { width: 28, height: 28, borderRadius: 14, textAlign: 'center', textAlignVertical: 'center', lineHeight: 28, fontSize: 12, fontWeight: '800' },
  homepageSectionActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  homepageMoveButton: { width: 34, height: 34, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  homepageVisibilityButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },

  formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  denseButtonPrimary: { height: 44, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16 },
  denseButton: { height: 44, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16 },
  denseButtonText: { fontSize: 14, fontWeight: '700' },
  listingImagePreview: { width: '100%', height: 190, borderRadius: 12, marginBottom: 10, resizeMode: 'cover' },
  adminCardImage: { width: 72, height: 72, borderRadius: 10, marginBottom: 10, resizeMode: 'cover' },
  mediaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  mediaCounter: { fontSize: 11, fontWeight: '700' },
  mediaStrip: { gap: 10, paddingVertical: 2 },
  mediaPreview: { width: 116, height: 90, borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  mediaPreviewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  mediaVideoPreview: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  mediaTypeText: { fontSize: 11, fontWeight: '700' },
  removeMedia: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.8)' },
  multiImageButton: { width: 116, height: 90, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 2 },
  multiImageButtonText: { fontSize: 18, fontWeight: '800' },
  wilayatPicker: { marginBottom: 14, gap: 7 },
  wilayatList: { maxHeight: 260, borderWidth: 1, borderRadius: 14, padding: 10 },
  wilayatOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 10 },
  wilayatOption: { width: '48%', minHeight: 52, borderWidth: 1, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  wilayatOptionCopy: { flex: 1 },
  wilayatName: { fontSize: 12, fontWeight: '800' },
  wilayatGovernorate: { fontSize: 9, marginTop: 2 },

  inlineForm: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8 },
  statusPill: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
});
