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

import {
  useGetAdminOverview, getGetAdminOverviewQueryKey,
  useListAdminContractors, getListAdminContractorsQueryKey,
  useCreateAdminContractor, useUpdateAdminContractor, useDeleteAdminContractor,
  useListAdminSubscriptions, getListAdminSubscriptionsQueryKey, useUpdateAdminSubscription,
  useListAdminPayments, getListAdminPaymentsQueryKey, useCreateAdminPayment,
  useGetAdminSettings, getGetAdminSettingsQueryKey, useUpdateAdminSettings,
  useListAdminListings, getListAdminListingsQueryKey, useCreateAdminListing, useUpdateAdminListing, useDeleteAdminListing,
  type AdminContractor, type AdminContractorInput, type AdminListingInput, type MarketplaceListing
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
}[status] ?? status);
const confirmAction = (title: string, message: string, action: () => void, cancelLabel = 'Cancel') => {
  if (Platform.OS === 'web') {
    if (globalThis.confirm(`${title}\n\n${message}`)) action();
    return;
  }
  Alert.alert(title, message, [{ text: cancelLabel, style: 'cancel' }, { text: title, style: 'destructive', onPress: action }]);
};
const pickAdminImage = async (isArabic: boolean) => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(text(isArabic, 'Photo access needed', 'نحتاج إذن الصور'), text(isArabic, 'Allow access to choose an image.', 'اسمح بالوصول للصور لاختيار صورة.'));
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.45, base64: true });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const image = asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
  if (image.length > 2_000_000) {
    Alert.alert(text(isArabic, 'Image is too large', 'الصورة كبيرة جدًا'), text(isArabic, 'Choose a smaller image and try again.', 'اختر صورة أصغر ثم حاول مرة أخرى.'));
    return null;
  }
  return image;
};

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { isArabic } = useApp();
  const isAdmin = (user?.publicMetadata as Record<string, unknown> | undefined)?.role === 'admin' || (user?.publicMetadata as Record<string, unknown> | undefined)?.isAdmin === true || user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() === 'moqawil.ap@gmail.com';

  const [activeTab, setActiveTab] = useState<'Overview' | 'Contractors' | 'Workshops' | 'Designers' | 'Maintenance' | 'Listings' | 'Subscriptions' | 'Payments' | 'Settings'>('Overview');

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
           {(['Overview', 'Contractors', 'Workshops', 'Designers', 'Maintenance', 'Listings', 'Subscriptions', 'Payments', 'Settings'] as const).map(tab => (
            <Pressable key={tab} testID={`tab-${tab}`} style={[styles.tab, activeTab === tab && [styles.activeTab, { backgroundColor: colors.foreground }]]} onPress={() => setActiveTab(tab)}>
               <Text style={[styles.tabText, activeTab === tab ? { color: colors.background } : { color: colors.mutedForeground }]}>{text(isArabic, tab, ({ Overview: 'نظرة عامة', Contractors: 'المقاولون', Workshops: 'الورش', Designers: 'المصممون', Maintenance: 'الصيانة', Listings: 'العقارات', Subscriptions: 'الاشتراكات', Payments: 'المدفوعات', Settings: 'الإعدادات' } as Record<string, string>)[tab])}</Text>
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
        {activeTab === 'Subscriptions' && <SubscriptionsTab />}
        {activeTab === 'Payments' && <PaymentsTab />}
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

const blankContractor = () => ({ businessName: '', city: '', businessNameArabic: '', wilayat: '', bio: '', bioArabic: '', serviceArea: '', phone: '', avatarUrl: '', evaluationNotes: '', adminRating: '', agreedContractAmountOmaniRial: '', isVerified: false, isPublished: false });

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
        serviceArea: c.serviceArea ?? '', phone: c.phone ?? '', avatarUrl: c.avatarUrl ?? '', evaluationNotes: c.evaluationNotes ?? '',
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
    const image = await pickAdminImage(isArabic);
    if (image) set('avatarUrl', image);
  };

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
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Contractor photo', 'صورة المقاول')}</Text>
            {form.avatarUrl ? <Image source={{ uri: form.avatarUrl }} style={styles.listingImagePreview} /> : null}
            <Pressable testID="pick-contractor-image" onPress={chooseContractorImage} style={[styles.denseButton, { borderColor: colors.border, alignSelf: 'flex-start' }]}>
              <Feather name="image" size={16} color={colors.primary} />
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{form.avatarUrl ? text(isArabic, 'Change photo', 'تغيير الصورة') : text(isArabic, 'Choose photo', 'اختيار صورة')}</Text>
            </Pressable>
          </View>
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

const blankWorkshop = () => ({ name: '', nameArabic: '', specialty: '', city: '', wilayat: '', phone: '', avatarUrl: '', isPublished: false });

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
      isPublished: form.isPublished,
      isVerified: false,
      isWorkshop: true,
    };
    create.mutate({ data });
  };
  const chooseWorkshopImage = async () => {
    const image = await pickAdminImage(isArabic);
    if (image) set('avatarUrl', image);
  };
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
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Workshop photo', 'صورة الورشة')}</Text>
            {form.avatarUrl ? <Image source={{ uri: form.avatarUrl }} style={styles.listingImagePreview} /> : null}
            <Pressable testID="pick-workshop-image" onPress={chooseWorkshopImage} style={[styles.denseButton, { borderColor: colors.border, alignSelf: 'flex-start' }]}>
              <Feather name="image" size={16} color={colors.primary} />
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{form.avatarUrl ? text(isArabic, 'Change photo', 'تغيير الصورة') : text(isArabic, 'Choose photo', 'اختيار صورة')}</Text>
            </Pressable>
          </View>
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
  bio: '', bioArabic: '', avatarUrl: '', evaluationNotes: '', adminRating: '',
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
    const image = await pickAdminImage(isArabic);
    if (image) set('avatarUrl', image);
  };
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
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, `${designers ? 'Designer' : 'Provider'} photo`, `صورة ${designers ? 'المصمم' : 'المزود'}`)}</Text>
            {form.avatarUrl ? <Image source={{ uri: form.avatarUrl }} style={styles.listingImagePreview} /> : null}
            <Pressable testID={`pick-${kind}-image`} onPress={chooseImage} style={[styles.denseButton, { borderColor: colors.border, alignSelf: 'flex-start' }]}>
              <Feather name="image" size={16} color={colors.primary} />
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{form.avatarUrl ? text(isArabic, 'Change photo', 'تغيير الصورة') : text(isArabic, 'Choose photo', 'اختيار صورة')}</Text>
            </Pressable>
          </View>
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
  contactPhone: string;
  adminRating: string;
  isPublished: boolean;
};
const blankListing = (): ListingForm => ({ title: '', titleArabic: '', type: 'sale', price: '', location: '', locationArabic: '', bedrooms: '0', bathrooms: '0', area: '', imageUrl: '', contactPhone: '', adminRating: '', isPublished: false });

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
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(text(isArabic, 'Photo access needed', 'نحتاج إذن الصور'), text(isArabic, 'Allow access to choose a listing photo.', 'اسمح بالوصول للصور لاختيار صورة الإعلان.'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.45, base64: true });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    const image = asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
    if (image.length > 2_000_000) {
      Alert.alert(text(isArabic, 'Image is too large', 'الصورة كبيرة جدًا'), text(isArabic, 'Choose a smaller image and try again.', 'اختر صورة أصغر ثم حاول مرة أخرى.'));
      return;
    }
    set('imageUrl', image);
  };
  const begin = (listing?: MarketplaceListing) => {
    if (!listing) { setForm(blankListing()); setEditing(null); }
    else {
      setEditing(listing.id);
      setForm({ title: listing.title, titleArabic: listing.titleArabic, type: listing.type, price: listing.price, location: listing.location, locationArabic: listing.locationArabic, bedrooms: String(listing.bedrooms), bathrooms: String(listing.bathrooms), area: listing.area, imageUrl: listing.imageUrl ?? '', contactPhone: listing.contactPhone ?? '', adminRating: listing.rating ? String(listing.rating) : '', isPublished: listing.isPublished });
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
      area: form.area.trim(), imageUrl: form.imageUrl.trim() || null, contactPhone: form.contactPhone.trim() || null, adminRating: form.adminRating === '' ? null : Number(form.adminRating), isPublished: form.isPublished,
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
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>{text(isArabic, 'Listing photo', 'صورة الإعلان')}</Text>
            {form.imageUrl ? <Image source={{ uri: form.imageUrl }} style={styles.listingImagePreview} /> : null}
            <Pressable testID="pick-listing-image" onPress={pickListingImage} style={[styles.denseButton, { borderColor: colors.border, alignSelf: 'flex-start' }]}>
              <Feather name="image" size={16} color={colors.primary} />
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{form.imageUrl ? text(isArabic, 'Change photo', 'تغيير الصورة') : text(isArabic, 'Choose photo', 'اختيار صورة')}</Text>
            </Pressable>
          </View>
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
        }
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

  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginVertical: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleText: { fontSize: 14, fontWeight: '600' },

  formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  denseButtonPrimary: { height: 44, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16 },
  denseButton: { height: 44, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16 },
  denseButtonText: { fontSize: 14, fontWeight: '700' },
  listingImagePreview: { width: '100%', height: 190, borderRadius: 12, marginBottom: 10, resizeMode: 'cover' },
  adminCardImage: { width: 72, height: 72, borderRadius: 10, marginBottom: 10, resizeMode: 'cover' },

  inlineForm: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8 },
  statusPill: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
});
