import { Feather } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '@/components/MoqawilUI';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';

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
const confirmAction = (title: string, message: string, action: () => void) => {
  if (Platform.OS === 'web') {
    if (globalThis.confirm(`${title}\n\n${message}`)) action();
    return;
  }
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: title, style: 'destructive', onPress: action }]);
};

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { isArabic } = useApp();
  const isAdmin = (user?.publicMetadata as Record<string, unknown> | undefined)?.role === 'admin' || (user?.publicMetadata as Record<string, unknown> | undefined)?.isAdmin === true || user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() === 'moqawil.ap@gmail.com';

  const [activeTab, setActiveTab] = useState<'Overview' | 'Contractors' | 'Workshops' | 'Listings' | 'Subscriptions' | 'Payments' | 'Settings'>('Overview');

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
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <View style={[styles.headerContainer, { paddingTop: insets.top + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.top}>
          <Pressable testID="admin-back" onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <BrandMark compact />
        </View>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Admin Console</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
           {(['Overview', 'Contractors', 'Workshops', 'Listings', 'Subscriptions', 'Payments', 'Settings'] as const).map(tab => (
            <Pressable key={tab} testID={`tab-${tab}`} style={[styles.tab, activeTab === tab && [styles.activeTab, { backgroundColor: colors.foreground }]]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab ? { color: colors.background } : { color: colors.mutedForeground }]}>{tab}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {activeTab === 'Overview' && <OverviewTab />}
        {activeTab === 'Contractors' && <ContractorsTab />}
         {activeTab === 'Workshops' && <WorkshopsTab />}
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
  const { data: overview, isLoading, isError, refetch, isRefetching } = useGetAdminOverview();

  if (isLoading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  if (isError || !overview) return <Text style={{ color: colors.destructive }}>Failed to load overview.</Text>;

  return (
    <View testID="admin-overview" style={styles.grid}>
      <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.statValue, { color: colors.foreground }]}>{overview.contractors}</Text>
        <Text style={[styles.statTitle, { color: colors.mutedForeground }]}>Contractors</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.statValue, { color: colors.foreground }]}>{overview.activeSubscriptions}</Text>
        <Text style={[styles.statTitle, { color: colors.mutedForeground }]}>Active Subs</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.statValue, { color: colors.destructive }]}>{overview.paymentDueSubscriptions}</Text>
        <Text style={[styles.statTitle, { color: colors.mutedForeground }]}>Payments Due</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.statValue, { color: colors.primary }]}>{overview.paymentsRecorded}</Text>
        <Text style={[styles.statTitle, { color: colors.mutedForeground }]}>Payments Recorded</Text>
      </View>
      <Pressable testID="refresh-overview" style={[styles.denseButton, { borderColor: colors.border, width: '100%', marginTop: 8 }]} onPress={() => refetch()}>
        <Feather name="refresh-cw" size={14} color={colors.foreground} />
        <Text style={[styles.denseButtonText, { color: colors.foreground }]}>{isRefetching ? 'Refreshing...' : 'Refresh Stats'}</Text>
      </Pressable>
    </View>
  );
}

const blankContractor = () => ({ businessName: '', city: '', businessNameArabic: '', wilayat: '', bio: '', bioArabic: '', serviceArea: '', phone: '', evaluationNotes: '', adminRating: '', agreedContractAmountOmaniRial: '', isVerified: false, isPublished: false });

function ContractorsTab() {
  const colors = useColors();
  const client = useQueryClient();
  const contractors = useListAdminContractors({ query: { queryKey: getListAdminContractorsQueryKey() } });

  const [form, setForm] = useState<any>(blankContractor());
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const invalidate = () => client.invalidateQueries({ queryKey: getListAdminContractorsQueryKey() });
  const create = useCreateAdminContractor({ mutation: { onSuccess: () => { invalidate(); setShowForm(false); setForm(blankContractor()); }, onError: (e) => Alert.alert('Validation', errorMessage(e)) } });
  const update = useUpdateAdminContractor({ mutation: { onSuccess: () => { invalidate(); setShowForm(false); setForm(blankContractor()); }, onError: (e) => Alert.alert('Validation', errorMessage(e)) } });
  const archive = useDeleteAdminContractor({ mutation: { onSuccess: invalidate, onError: (e) => Alert.alert('Failed', errorMessage(e)) } });

  const set = (key: string, value: string) => setForm((v: any) => ({ ...v, [key]: value }));
  const begin = (c?: AdminContractor) => {
    if (c) {
      setEditing(c.id);
      setForm({
        businessName: c.businessName, businessNameArabic: c.businessNameArabic ?? '',
        city: c.city, wilayat: c.wilayat ?? '', bio: c.bio ?? '', bioArabic: c.bioArabic ?? '',
        serviceArea: c.serviceArea ?? '', phone: c.phone ?? '', evaluationNotes: c.evaluationNotes ?? '',
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
      Alert.alert('Missing details', 'Business name and city are required.');
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

  return (
    <View testID="admin-contractors" style={styles.tabContainer}>
      <View style={styles.tabHeader}>
        <Text style={[styles.tabTitle, { color: colors.foreground }]}>Contractors</Text>
        <Pressable testID="add-contractor" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground }]} onPress={() => begin()}>
          <Feather name="plus" size={14} color={colors.background} />
          <Text style={[styles.denseButtonText, { color: colors.background }]}>Add</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>{editing ? 'Edit Contractor' : 'New Contractor'}</Text>
          <View style={styles.formGrid}>
            {([['businessName', 'Business name', 'default'], ['businessNameArabic', 'Arabic name', 'default'], ['city', 'City', 'default'], ['wilayat', 'Wilayat', 'default'], ['serviceArea', 'Service area', 'default'], ['phone', 'Phone', 'default'], ['adminRating', 'Admin rating (1-5)', 'decimal-pad'], ['agreedContractAmountOmaniRial', 'Agreed OMR', 'decimal-pad']] as const).map(([key, label, kType]) => (
              <View key={key} style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
                <TextInput testID={`contractor-field-${key}`} value={String(form[key] ?? '')} onChangeText={v => set(key, v)} keyboardType={kType as any} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              </View>
            ))}
          </View>
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>Bio</Text>
            <TextInput testID="contractor-field-bio" value={form.bio ?? ''} onChangeText={v => set('bio', v)} multiline style={[styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>Arabic Bio / النبذة بالعربية</Text>
            <TextInput testID="contractor-field-bioArabic" value={form.bioArabic ?? ''} onChangeText={v => set('bioArabic', v)} multiline textAlign="right" style={[styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>Evaluation Notes</Text>
            <TextInput testID="contractor-field-evaluationNotes" value={form.evaluationNotes ?? ''} onChangeText={v => set('evaluationNotes', v)} multiline style={[styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.toggles}>
            <Pressable testID="form-verified" style={styles.toggleRow} onPress={() => setForm((v: any) => ({ ...v, isVerified: !v.isVerified }))}>
              <Feather name={form.isVerified ? 'check-square' : 'square'} size={18} color={form.isVerified ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.toggleText, { color: colors.foreground }]}>Verified</Text>
            </Pressable>
            <Pressable testID="form-published" style={styles.toggleRow} onPress={() => setForm((v: any) => ({ ...v, isPublished: !v.isPublished }))}>
              <Feather name={form.isPublished ? 'check-square' : 'square'} size={18} color={form.isPublished ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.toggleText, { color: colors.foreground }]}>Published</Text>
            </Pressable>
          </View>
          <View style={styles.formActions}>
            <Pressable testID="save-server-contractor" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, flex: 1 }]} onPress={save}>
              <Text style={[styles.denseButtonText, { color: colors.background }]}>{create.isPending || update.isPending ? 'Saving...' : 'Save Contractor'}</Text>
            </Pressable>
            <Pressable testID="cancel-contractor-form" style={[styles.denseButton, { borderColor: colors.border }]} onPress={() => setShowForm(false)}>
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {contractors.isLoading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
      {contractors.isError && <Text style={{ color: colors.destructive }}>Unable to load contractors.</Text>}
      {contractors.data?.map(c => (
        <View key={c.id} style={[styles.denseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{c.businessName}</Text>
            <View style={styles.badges}>
              {c.isVerified && <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}><Text style={[styles.badgeText, { color: colors.primary }]}>Verified</Text></View>}
              <View style={[styles.badge, { backgroundColor: c.isPublished ? '#D9F8F2' : colors.muted }]}><Text style={[styles.badgeText, { color: c.isPublished ? '#0B6E6B' : colors.mutedForeground }]}>{c.isPublished ? 'Live' : 'Hidden'}</Text></View>
            </View>
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{c.city} • Linked: {c.accountLinkStatus}</Text>
          <View style={styles.cardActions}>
            <Pressable testID={`edit-contractor-${c.id}`} onPress={() => begin(c)} style={styles.actionLink}>
              <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
            </Pressable>
            <Pressable testID={`toggle-verify-${c.id}`} onPress={() => update.mutate({ id: c.id, data: { isVerified: !c.isVerified } })} style={styles.actionLink}>
              <Text style={[styles.actionText, { color: colors.foreground }]}>{c.isVerified ? 'Unverify' : 'Verify'}</Text>
            </Pressable>
            <Pressable testID={`toggle-publish-${c.id}`} onPress={() => update.mutate({ id: c.id, data: { isPublished: !c.isPublished } })} style={styles.actionLink}>
              <Text style={[styles.actionText, { color: colors.foreground }]}>{c.isPublished ? 'Unpublish' : 'Publish'}</Text>
            </Pressable>
            <Pressable testID={`archive-contractor-${c.id}`} onPress={() => confirmAction('Archive', 'This hides the profile permanently.', () => archive.mutate({ id: c.id, params: { confirm: true } }))} style={styles.actionLink}>
              <Text style={[styles.actionText, { color: colors.destructive }]}>Archive</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const blankWorkshop = () => ({ name: '', nameArabic: '', specialty: '', city: '', wilayat: '', phone: '', isPublished: false });

function WorkshopsTab() {
  const colors = useColors();
  const { isArabic } = useApp();
  const client = useQueryClient();
  const workshops = useListAdminContractors({ query: { queryKey: getListAdminContractorsQueryKey() } });
  const create = useCreateAdminContractor({
    mutation: {
      onSuccess: () => { client.invalidateQueries({ queryKey: getListAdminContractorsQueryKey() }); setForm(blankWorkshop()); setShowForm(false); },
      onError: (e) => Alert.alert('Validation', errorMessage(e)),
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
      isPublished: form.isPublished,
      isVerified: false,
      isWorkshop: true,
    };
    create.mutate({ data });
  };
  return (
    <View testID="admin-workshops" style={styles.tabContainer}>
      <View style={styles.tabHeader}>
        <View>
          <Text style={[styles.tabTitle, { color: colors.foreground }]}>Workshops</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>Add workshop names to the public building directory.</Text>
        </View>
        <Pressable testID="add-workshop" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground }]} onPress={() => setShowForm(true)}>
          <Feather name="plus" size={14} color={colors.background} />
          <Text style={[styles.denseButtonText, { color: colors.background }]}>Add</Text>
        </Pressable>
      </View>
      {showForm && (
        <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>New Workshop</Text>
          <View style={styles.formGrid}>
            {([['name', 'Workshop name'], ['nameArabic', 'Arabic name'], ['specialty', 'Specialty'], ['city', 'City'], ['wilayat', 'Wilayat'], ['phone', 'Phone']] as const).map(([key, label]) => (
              <View key={key} style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
                <TextInput testID={`workshop-field-${key}`} value={form[key]} onChangeText={(value) => set(key, value)} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              </View>
            ))}
          </View>
          <Pressable style={styles.toggleRow} onPress={() => set('isPublished', !form.isPublished)}>
            <Feather name={form.isPublished ? 'check-square' : 'square'} size={18} color={form.isPublished ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.toggleText, { color: colors.foreground }]}>Publish immediately</Text>
          </Pressable>
          <View style={styles.formActions}>
            <Pressable testID="save-workshop" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, flex: 1 }]} onPress={save}>
              <Text style={[styles.denseButtonText, { color: colors.background }]}>{create.isPending ? 'Saving...' : 'Save Workshop'}</Text>
            </Pressable>
            <Pressable style={[styles.denseButton, { borderColor: colors.border }]} onPress={() => setShowForm(false)}>
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
      {workshops.isLoading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
      {workshops.data?.map((workshop) => (
        <View key={workshop.id} style={[styles.denseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{workshop.businessName}</Text>
            <View style={[styles.badge, { backgroundColor: workshop.isPublished ? '#D9F8F2' : colors.muted }]}>
              <Text style={[styles.badgeText, { color: workshop.isPublished ? '#0B6E6B' : colors.mutedForeground }]}>{workshop.isPublished ? 'Live' : 'Hidden'}</Text>
            </View>
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{workshop.city}{workshop.wilayat ? ` • ${workshop.wilayat}` : ''}</Text>
        </View>
      ))}
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
  isPublished: boolean;
};
const blankListing = (): ListingForm => ({ title: '', titleArabic: '', type: 'sale', price: '', location: '', locationArabic: '', bedrooms: '0', bathrooms: '0', area: '', imageUrl: '', contactPhone: '', isPublished: false });

function ListingsTab() {
  const colors = useColors();
  const client = useQueryClient();
  const listings = useListAdminListings({ query: { queryKey: getListAdminListingsQueryKey() } });
  const [form, setForm] = useState(blankListing());
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const invalidate = () => client.invalidateQueries({ queryKey: getListAdminListingsQueryKey() });
  const closeForm = () => { setForm(blankListing()); setEditing(null); setShowForm(false); };
  const create = useCreateAdminListing({ mutation: { onSuccess: () => { invalidate(); closeForm(); }, onError: (e) => Alert.alert('Validation', errorMessage(e)) } });
  const update = useUpdateAdminListing({ mutation: { onSuccess: () => { invalidate(); closeForm(); }, onError: (e) => Alert.alert('Validation', errorMessage(e)) } });
  const remove = useDeleteAdminListing({ mutation: { onSuccess: invalidate, onError: (e) => Alert.alert('Failed', errorMessage(e)) } });
  const set = <Key extends keyof ListingForm>(key: Key, value: ListingForm[Key]) => setForm((current) => ({ ...current, [key]: value }));
  const begin = (listing?: MarketplaceListing) => {
    if (!listing) { setForm(blankListing()); setEditing(null); }
    else {
      setEditing(listing.id);
      setForm({ title: listing.title, titleArabic: listing.titleArabic, type: listing.type, price: listing.price, location: listing.location, locationArabic: listing.locationArabic, bedrooms: String(listing.bedrooms), bathrooms: String(listing.bathrooms), area: listing.area, imageUrl: listing.imageUrl ?? '', contactPhone: listing.contactPhone ?? '', isPublished: listing.isPublished });
    }
    setShowForm(true);
  };
  const save = () => {
    if (!form.title.trim() || !form.titleArabic.trim() || !form.price.trim() || !form.location.trim() || !form.locationArabic.trim() || !form.area.trim()) {
      Alert.alert('Missing details', 'Title, price, location, and area are required.');
      return;
    }
    const data: AdminListingInput = {
      title: form.title.trim(), titleArabic: form.titleArabic.trim(), type: form.type,
      price: form.price.trim(), location: form.location.trim(), locationArabic: form.locationArabic.trim(),
      bedrooms: Math.max(0, Number(form.bedrooms) || 0), bathrooms: Math.max(0, Number(form.bathrooms) || 0),
      area: form.area.trim(), imageUrl: form.imageUrl.trim() || null, contactPhone: form.contactPhone.trim() || null, isPublished: form.isPublished,
    };
    editing ? update.mutate({ id: editing, data }) : create.mutate({ data });
  };

  return (
    <View testID="admin-listings" style={styles.tabContainer}>
      <View style={styles.tabHeader}>
        <View>
          <Text style={[styles.tabTitle, { color: colors.foreground }]}>Property Listings</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>Create and publish ads for the marketplace.</Text>
        </View>
        <Pressable testID="add-listing" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground }]} onPress={() => begin()}>
          <Feather name="plus" size={14} color={colors.background} />
          <Text style={[styles.denseButtonText, { color: colors.background }]}>Add</Text>
        </Pressable>
      </View>
      {showForm && (
        <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>{editing ? 'Edit Listing' : 'New Listing'}</Text>
          <View style={styles.formGrid}>
            {([['title', 'Title'], ['titleArabic', 'Arabic title'], ['price', 'Price'], ['location', 'Location'], ['locationArabic', 'Arabic location'], ['area', 'Area'], ['bedrooms', 'Bedrooms'], ['bathrooms', 'Bathrooms'], ['contactPhone', 'Contact phone'], ['imageUrl', 'Image URL']] as const).map(([key, label]) => (
              <View key={key} style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
                <TextInput testID={`listing-field-${key}`} value={String(form[key])} onChangeText={(value) => set(key, value)} keyboardType={key === 'bedrooms' || key === 'bathrooms' ? 'number-pad' : 'default'} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              </View>
            ))}
          </View>
          <View style={styles.toggles}>
            {(['sale', 'rent'] as const).map((type) => (
              <Pressable key={type} style={styles.toggleRow} onPress={() => set('type', type)}>
                <Feather name={form.type === type ? 'check-circle' : 'circle'} size={18} color={form.type === type ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.toggleText, { color: colors.foreground }]}>{type === 'sale' ? 'For sale' : 'For rent'}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.toggleRow} onPress={() => set('isPublished', !form.isPublished)}>
              <Feather name={form.isPublished ? 'check-square' : 'square'} size={18} color={form.isPublished ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.toggleText, { color: colors.foreground }]}>Published</Text>
            </Pressable>
          </View>
          <View style={styles.formActions}>
            <Pressable testID="save-listing" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, flex: 1 }]} onPress={save}>
              <Text style={[styles.denseButtonText, { color: colors.background }]}>{create.isPending || update.isPending ? 'Saving...' : 'Save Listing'}</Text>
            </Pressable>
            <Pressable style={[styles.denseButton, { borderColor: colors.border }]} onPress={closeForm}>
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>Cancel</Text>
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
              <Text style={[styles.badgeText, { color: listing.isPublished ? '#0B6E6B' : colors.mutedForeground }]}>{listing.isPublished ? 'Live' : 'Draft'}</Text>
            </View>
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{listing.location} • {listing.price} • {listing.type === 'sale' ? 'For sale' : 'For rent'}</Text>
          <View style={styles.cardActions}>
            <Pressable testID={`edit-listing-${listing.id}`} onPress={() => begin(listing)} style={styles.actionLink}><Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text></Pressable>
            <Pressable testID={`toggle-listing-${listing.id}`} onPress={() => update.mutate({ id: listing.id, data: { isPublished: !listing.isPublished } })} style={styles.actionLink}><Text style={[styles.actionText, { color: colors.foreground }]}>{listing.isPublished ? 'Unpublish' : 'Publish'}</Text></Pressable>
            <Pressable testID={`delete-listing-${listing.id}`} onPress={() => confirmAction('Delete', 'This removes the listing and its engagement data.', () => remove.mutate({ id: listing.id }))} style={styles.actionLink}><Text style={[styles.actionText, { color: colors.destructive }]}>Delete</Text></Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function SubscriptionsTab() {
  const colors = useColors();
  const client = useQueryClient();
  const subs = useListAdminSubscriptions({ query: { queryKey: getListAdminSubscriptionsQueryKey() } });

  const updateSub = useUpdateAdminSubscription({
    mutation: {
      onSuccess: () => client.invalidateQueries({ queryKey: getListAdminSubscriptionsQueryKey() }),
      onError: (e) => Alert.alert('Error', errorMessage(e))
    }
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<any>('');
  const [extendMonths, setExtendMonths] = useState('1');

  if (subs.isLoading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  if (subs.isError) return <Text style={{ color: colors.destructive }}>Failed to load subscriptions.</Text>;

  const statuses = ['free_trial', 'active', 'payment_due', 'expired', 'cancelled', 'suspended'];

  return (
    <View testID="admin-subscriptions" style={styles.tabContainer}>
      <Text style={[styles.tabTitle, { color: colors.foreground, marginBottom: 12 }]}>Subscriptions</Text>
      {subs.data?.map(sub => (
        <View key={sub.id} style={[styles.denseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{sub.contractorName || 'Unknown'}</Text>
            <View style={[styles.badge, { backgroundColor: sub.status === 'active' ? '#D9F8F2' : (sub.status === 'payment_due' ? '#FDEBEB' : colors.muted) }]}>
              <Text style={[styles.badgeText, { color: sub.status === 'active' ? '#0B6E6B' : (sub.status === 'payment_due' ? '#C55353' : colors.mutedForeground) }]}>{sub.status.replace('_', ' ')}</Text>
            </View>
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{sub.planName} • {sub.priceOmaniRial} OMR</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>Period: {sub.currentPeriodStartsAt ? sub.currentPeriodStartsAt.split('T')[0] : 'N/A'} - {sub.currentPeriodEndsAt ? sub.currentPeriodEndsAt.split('T')[0] : 'N/A'}</Text>

          {editingId === sub.id ? (
            <View style={[styles.inlineForm, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>Set Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {statuses.map(s => (
                  <Pressable key={s} onPress={() => setFormStatus(s)} style={[styles.statusPill, formStatus === s ? { backgroundColor: colors.foreground, borderColor: colors.foreground } : { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.statusPillText, formStatus === s ? { color: colors.background } : { color: colors.foreground }]}>{s.replace('_', ' ')}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.formGroupFull}>
                <Text style={[styles.label, { color: colors.foreground }]}>Extend Trial (Months)</Text>
                <TextInput value={extendMonths} onChangeText={setExtendMonths} keyboardType="number-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
              </View>

              <View style={styles.formActions}>
                <Pressable testID={`save-sub-${sub.id}`} style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, flex: 1 }]} onPress={() => {
                  updateSub.mutate({ id: sub.id, data: { status: formStatus, extendTrialMonths: Number(extendMonths) || undefined } }, {
                    onSuccess: () => setEditingId(null)
                  });
                }}>
                  <Text style={[styles.denseButtonText, { color: colors.background }]}>Update</Text>
                </Pressable>
                <Pressable style={[styles.denseButton, { borderColor: colors.border }]} onPress={() => setEditingId(null)}>
                  <Text style={[styles.denseButtonText, { color: colors.foreground }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.cardActions}>
              <Pressable testID={`edit-sub-${sub.id}`} onPress={() => { setEditingId(sub.id); setFormStatus(sub.status); setExtendMonths(''); }} style={styles.actionLink}>
                <Text style={[styles.actionText, { color: colors.primary }]}>Manage</Text>
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
  const client = useQueryClient();
  const payments = useListAdminPayments({ query: { queryKey: getListAdminPaymentsQueryKey() } });

  const createPayment = useCreateAdminPayment({
    mutation: {
      onSuccess: () => {
         client.invalidateQueries({ queryKey: getListAdminPaymentsQueryKey() });
         setAdding(false);
         setForm({ subscriptionId: '', amountOmaniRial: '0', status: 'paid', provider: 'manual', providerReference: '' });
      },
      onError: (e) => Alert.alert('Error', errorMessage(e))
    }
  });

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ subscriptionId: '', amountOmaniRial: '0', status: 'paid', provider: 'manual', providerReference: '' });

  if (payments.isLoading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  if (payments.isError) return <Text style={{ color: colors.destructive }}>Failed to load payments.</Text>;

  const statuses = ['pending', 'paid', 'failed', 'refunded', 'void'];

  return (
    <View testID="admin-payments" style={styles.tabContainer}>
      <View style={styles.tabHeader}>
        <Text style={[styles.tabTitle, { color: colors.foreground }]}>Payments</Text>
        <Pressable testID="add-payment" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground }]} onPress={() => setAdding(true)}>
          <Feather name="plus" size={14} color={colors.background} />
          <Text style={[styles.denseButtonText, { color: colors.background }]}>Record</Text>
        </Pressable>
      </View>

      {adding && (
        <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Record Payment</Text>
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>Subscription ID</Text>
            <TextInput value={form.subscriptionId} onChangeText={v => setForm({ ...form, subscriptionId: v })} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.formGrid}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Amount (OMR)</Text>
              <TextInput value={form.amountOmaniRial} onChangeText={v => setForm({ ...form, amountOmaniRial: v })} keyboardType="decimal-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
            </View>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Provider</Text>
              <TextInput value={form.provider} onChangeText={v => setForm({ ...form, provider: v })} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
            </View>
          </View>
          <View style={styles.formGroupFull}>
            <Text style={[styles.label, { color: colors.foreground }]}>Provider Reference</Text>
            <TextInput value={form.providerReference} onChangeText={v => setForm({ ...form, providerReference: v })} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>

          <Text style={[styles.label, { color: colors.foreground, marginTop: 8 }]}>Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {statuses.map(s => (
              <Pressable key={s} onPress={() => setForm({ ...form, status: s })} style={[styles.statusPill, form.status === s ? { backgroundColor: colors.foreground, borderColor: colors.foreground } : { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.statusPillText, form.status === s ? { color: colors.background } : { color: colors.foreground }]}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.formActions}>
            <Pressable testID="save-payment" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, flex: 1 }]} onPress={() => {
              if (!form.subscriptionId) { Alert.alert('Required', 'Subscription ID is required'); return; }
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
              <Text style={[styles.denseButtonText, { color: colors.background }]}>{createPayment.isPending ? 'Saving...' : 'Save Payment'}</Text>
            </Pressable>
            <Pressable style={[styles.denseButton, { borderColor: colors.border }]} onPress={() => setAdding(false)}>
              <Text style={[styles.denseButtonText, { color: colors.foreground }]}>Cancel</Text>
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
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>Sub: {p.subscriptionId}</Text>
          {p.providerReference && <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>Ref: {p.providerReference}</Text>}
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{new Date(p.createdAt).toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
}

function SettingsTab() {
  const colors = useColors();
  const client = useQueryClient();
  const { data: settings, isLoading, isError } = useGetAdminSettings();
  const updateSettings = useUpdateAdminSettings({
    mutation: {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
        Alert.alert('Success', 'Settings updated');
      },
      onError: (e) => Alert.alert('Error', errorMessage(e))
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
  if (isError) return <Text style={{ color: colors.destructive }}>Failed to load settings.</Text>;
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
      <Text style={[styles.tabTitle, { color: colors.foreground, marginBottom: 16 }]}>Marketplace Settings</Text>

      <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.formTitle, { color: colors.foreground }]}>Billing Defaults</Text>
        <View style={styles.formGrid}>
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Trial Months</Text>
            <TextInput value={form.trialMonths} onChangeText={v => setForm({ ...form, trialMonths: v })} keyboardType="number-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Default Price (OMR)</Text>
            <TextInput value={form.defaultPriceOmaniRial} onChangeText={v => setForm({ ...form, defaultPriceOmaniRial: v })} keyboardType="decimal-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
        </View>
      </View>

      <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.formTitle, { color: colors.foreground }]}>Ranking Weights</Text>
        <View style={styles.formGrid}>
          {[
            ['wRating', 'Rating'], ['wReviews', 'Reviews'], ['wProjects', 'Projects'],
            ['wProfile', 'Profile'], ['wVerification', 'Verification'], ['wActivity', 'Activity'],
            ['wEngagement', 'Engagement']
          ].map(([key, label]) => (
            <View key={key} style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
              <TextInput value={form[key]} onChangeText={v => setForm({ ...form, [key]: v })} keyboardType="decimal-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
            </View>
          ))}
        </View>
      </View>

      <Pressable testID="save-settings" style={[styles.denseButtonPrimary, { backgroundColor: colors.foreground, marginTop: 8 }]} onPress={save}>
        <Text style={[styles.denseButtonText, { color: colors.background }]}>{updateSettings.isPending ? 'Saving...' : 'Save Settings'}</Text>
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

  inlineForm: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8 },
  statusPill: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
});
