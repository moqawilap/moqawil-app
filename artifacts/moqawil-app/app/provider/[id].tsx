import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, BrandMark, FixedBackButton, IconButton, Rating, StarRatingInput } from '@/components/MoqawilUI';
import { providers } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getContactMessage, getProviderUrl, getWhatsAppUrl, type ContactCategory } from '@/constants/contactMessages';
import { getGetContractorQueryKey, getGetContractorRatingQueryKey, getListContractorsQueryKey, useGetContractor, useGetContractorRating, useRateContractor, useRecordContactEvent } from '@workspace/api-client-react';

const serviceTranslations: Record<string, string> = {
  'general contracting': 'المقاولات العامة',
  'home and villa construction': 'بناء المنازل والفلل',
  'residential construction': 'البناء السكني',
  'commercial construction': 'البناء التجاري',
  'renovation': 'التجديد والترميم',
  'finishing work': 'أعمال التشطيب',
  'structural & design': 'التصميم والإنشاءات',
  'structural design': 'التصميم الإنشائي',
  'interior design': 'التصميم الداخلي',
  'architecture': 'الهندسة المعمارية',
  'engineering consultancy': 'الاستشارات الهندسية',
  'electrical': 'الأعمال الكهربائية',
  'plumbing': 'أعمال السباكة',
  'air conditioning': 'التكييف',
  'painting': 'الدهانات',
  'carpentry': 'النجارة',
  'aluminium': 'الألمنيوم',
  'kitchen design': 'تصميم المطابخ',
  'facade design': 'تصميم الواجهات',
};
const categoryTranslations: Record<string, string> = {
  contractors: 'المقاولات',
  consultants: 'الاستشارات الهندسية',
  design: 'التصميم',
  building: 'البناء والورش',
  maintenance: 'الصيانة',
};
function localizedServiceName(name: string, category: string, isArabic: boolean) {
  if (!isArabic) return name;
  return serviceTranslations[name.trim().toLowerCase()] ?? categoryTranslations[category.trim().toLowerCase()] ?? name;
}

export default function ProviderDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isArabic, isSaved, toggleSaved, managedProviders, activeService } = useApp();
  const contractor = useGetContractor(id);
  const persistedRating = useGetContractorRating(id, { query: { queryKey: getGetContractorRatingQueryKey(id), enabled: Boolean(id) } });
  const [selectedRating, setSelectedRating] = React.useState(0);
  const contactEvent = useRecordContactEvent({ mutation: { retry: 2, onError: () => Alert.alert(isArabic ? 'تعذر تسجيل التواصل' : 'Could not record contact', isArabic ? 'تم فتح وسيلة التواصل، لكن تعذر إشعار صاحب الإعلان.' : 'The contact app was opened, but the advertiser could not be notified.') } });
  const rate = useRateContractor({ mutation: { onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: getGetContractorQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetContractorRatingQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListContractorsQueryKey() });
  } } });
  const fallback = managedProviders.find((item) => item.id === id);
  const provider = contractor.data ? {
    id: contractor.data.id, name: contractor.data.businessName, nameAr: contractor.data.businessNameArabic || contractor.data.businessName,
    specialty: contractor.data.services.map((service) => service.name).join(' · ') || 'Contractor',
    specialtyAr: contractor.data.services.map((service) => service.name).join(' · ') || 'مقاول',
    city: contractor.data.city, rating: contractor.data.rating, reviews: contractor.data.reviewCount,
    verified: contractor.data.isVerified, projects: contractor.data.projects.length,
    image: contractor.data.avatarUrl ? { uri: contractor.data.avatarUrl } : require('@/assets/images/contractor-project.jpg'),
    description: contractor.data.bio || '', descriptionAr: contractor.data.bioArabic || contractor.data.bio || '', distance: contractor.data.city,
    phone: contractor.data.phone ?? '', contractAmount: '', startingPrice: '', role: 'contractor' as const, accent: '',
  } : fallback;
  if (!provider) return <View style={[styles.container, styles.unavailable, { backgroundColor: colors.background }]}>{contractor.isLoading ? <><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.mutedForeground }}>{isArabic ? 'جارٍ تحميل مقدم الخدمة…' : 'Loading provider…'}</Text></> : contractor.isError ? <><Feather name="alert-circle" size={28} color={colors.primary} /><Text style={[styles.unavailableTitle, { color: colors.foreground }]}>{isArabic ? 'تعذر تحميل مقدم الخدمة' : 'Could not load provider'}</Text><Text style={[styles.unavailableText, { color: colors.mutedForeground }]}>{isArabic ? 'تحقق من الاتصال ثم حاول مرة أخرى.' : 'Check your connection and try again.'}</Text><ActionButton testID="provider-retry" label={isArabic ? 'إعادة المحاولة' : 'Retry'} icon="refresh-cw" onPress={() => void contractor.refetch()} /><ActionButton label={isArabic ? 'رجوع' : 'Go back'} secondary onPress={() => router.back()} /></> : <><Text style={[styles.unavailableTitle, { color: colors.foreground }]}>{isArabic ? 'مقدم الخدمة غير متوفر.' : 'Provider unavailable.'}</Text><ActionButton label={isArabic ? 'رجوع' : 'Go back'} secondary onPress={() => router.back()} /></>}</View>;
  const contactCategory: ContactCategory =
    activeService === 'design' || provider.role === 'consultant' ? 'design'
      : activeService === 'maintenance' || provider.role === 'maintenance' ? 'maintenance'
        : activeService === 'building' ? 'workshop'
          : 'contractor';
  const subjectName = isArabic ? provider.nameAr : provider.name;
  const recordContact = (channel: 'call' | 'whatsapp', subject: { id: string; kind: 'provider' | 'project'; name: string } = { id: provider.id, kind: 'provider', name: subjectName }) => {
    contactEvent.mutate({ data: {
      category: contactCategory,
      channel,
      eventId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${subject.id}`,
      subjectId: subject.id,
      subjectKind: subject.kind,
      subjectName: subject.name,
    } });
  };
  const promptSignIn = (message: string) => {
    const title = isArabic ? 'سجّل الدخول للمتابعة' : 'Sign in to continue';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) router.push('/sign-in');
      return;
    }
    Alert.alert(title, message, [
      { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
      { text: isArabic ? 'تسجيل الدخول' : 'Sign in', onPress: () => router.push('/sign-in') },
    ]);
  };
  const requireContactSignIn = () => {
    if (isSignedIn) return false;
    promptSignIn(isArabic ? 'يلزم تسجيل الدخول للاتصال بصاحب الإعلان أو مراسلته.' : 'Sign in before calling or messaging the advertiser.');
    return true;
  };
  const openContactUrl = async (url: string, channel: 'call' | 'whatsapp', subject?: { id: string; kind: 'provider' | 'project'; name: string }) => {
    try {
      await Linking.openURL(url);
      recordContact(channel, subject);
    } catch {
      Alert.alert(
        isArabic ? 'تعذر فتح وسيلة التواصل' : 'Could not open contact app',
        isArabic ? 'تحقق من توفر تطبيق مناسب على جهازك ثم حاول مرة أخرى.' : 'Check that a suitable app is available on your device, then try again.',
      );
    }
  };
  const openCall = () => {
    if (!provider.phone.trim() || requireContactSignIn()) return;
    void openContactUrl(`tel:${provider.phone.replace(/\s/g, '')}`, 'call');
  };
  const openWhatsApp = () => {
    if (requireContactSignIn()) return;
    const message = getContactMessage(contactCategory, subjectName, isArabic, getProviderUrl(provider.id));
    const url = getWhatsAppUrl(provider.phone, message);
    if (!url) return;
    void openContactUrl(url, 'whatsapp');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FixedBackButton testID="provider-back" onPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <View style={{ width: 44 }} />
          <BrandMark compact />
          <IconButton icon="heart" active={isSaved(provider.id)} onPress={() => toggleSaved(provider.id, { subjectKind: 'provider', subjectName })} accessibilityLabel={isArabic ? 'حفظ مقدم الخدمة' : 'Save provider'} />
        </View>
         <Image source={provider.image} style={styles.heroImage} />
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <View style={styles.verifiedRow}>
                <Text style={[styles.providerTitle, { color: colors.foreground }]}>{isArabic ? provider.nameAr : provider.name}</Text>
                {provider.verified ? <View style={[styles.verifiedPill, { backgroundColor: colors.primarySoft }]}><Feather name="check" size={12} color={colors.primary} /><Text style={[styles.verifiedText, { color: colors.primary }]}>{isArabic ? 'موثّق' : 'Verified'}</Text></View> : null}
              </View>
              <Text style={[styles.specialty, { color: colors.mutedForeground }]}>{isArabic ? provider.specialtyAr : provider.specialty} · {provider.city}</Text>
            </View>
          </View>
          <View style={[styles.statsRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View><Rating value={rate.data?.rating ?? (persistedRating.data?.rating ? persistedRating.data.rating : provider.rating)} reviews={provider.reviews} /><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{isArabic ? 'تقييم العملاء' : 'Customer rating'}</Text></View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View><Text style={[styles.statValue, { color: colors.foreground }]}>{provider.projects}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{isArabic ? 'المشاريع' : 'Projects'}</Text></View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View><Text style={[styles.statValue, { color: colors.foreground }]}>{provider.distance}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{isArabic ? 'المسافة' : 'Away'}</Text></View>
          </View>
           <StarRatingInput value={selectedRating} onChange={(value) => {
             if (!isSignedIn) {
               promptSignIn(isArabic ? 'يلزم تسجيل الدخول لتقييم مقدم الخدمة.' : 'Sign in before rating this provider.');
               return;
             }
             rate.mutate(
               { id, data: { rating: value } },
               {
                 onSuccess: () => setSelectedRating(value),
                 onError: () => Alert.alert(
                   isArabic ? 'تعذر إرسال التقييم' : 'Could not submit rating',
                   isArabic ? 'لم يتم حفظ تقييمك. تحقق من الاتصال ثم حاول مرة أخرى.' : 'Your rating was not saved. Check your connection and try again.',
                 ),
               },
             );
           }} disabled={rate.isPending} label={isArabic ? 'قيّم مقدم الخدمة من نجمة إلى خمس' : 'Rate this provider from one to five stars'} />
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{isArabic ? 'عن مقدم الخدمة' : 'About this provider'}</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{isArabic ? provider.descriptionAr : provider.description}</Text>
           {contractor.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 14 }} /> : null}
            {contractor.data?.services.length ? <><Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 28 }]}>{isArabic ? 'الخدمات' : 'Services'}</Text><Text style={[styles.description, { color: colors.mutedForeground }]}>{contractor.data.services.map((service) => localizedServiceName(service.name, service.category, isArabic)).join(' • ')}</Text></> : null}
             {contractor.data?.projects.length ? <><Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 28 }]}>{isArabic ? 'المشاريع' : 'Projects'}</Text>{contractor.data.projects.map((project) => <View key={project.id} style={[styles.projectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.projectTitle, { color: colors.foreground }]}>{project.title}</Text>{project.description ? <Text style={[styles.projectDescription, { color: colors.mutedForeground }]}>{project.description}</Text> : null}<View style={styles.projectActions}><Pressable accessibilityRole="button" onPress={() => { if (!provider.phone.trim() || requireContactSignIn()) return; void openContactUrl(`tel:${provider.phone.replace(/\s/g, '')}`, 'call', { id: project.id, kind: 'project', name: project.title }); }} style={[styles.projectAction, { backgroundColor: colors.primarySoft }]}><Feather name="phone" size={14} color={colors.primary} /><Text style={[styles.projectActionText, { color: colors.primary }]}>{isArabic ? 'اتصال' : 'Call'}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { if (!provider.phone.trim() || requireContactSignIn()) return; const url = getWhatsAppUrl(provider.phone, getContactMessage(contactCategory, project.title, isArabic, getProviderUrl(provider.id))); if (!url) return; void openContactUrl(url, 'whatsapp', { id: project.id, kind: 'project', name: project.title }); }} style={[styles.projectAction, { backgroundColor: colors.primarySoft }]}><Feather name="message-circle" size={14} color={colors.primary} /><Text style={[styles.projectActionText, { color: colors.primary }]}>{isArabic ? 'واتساب' : 'WhatsApp'}</Text></Pressable></View></View>)}</> : null}
            {contractor.data?.reviews.length ? <><Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 28 }]}>{isArabic ? 'المراجعات' : 'Reviews'}</Text>{contractor.data.reviews.slice(0, 3).map((review) => <Text key={review.id} style={[styles.description, { color: colors.mutedForeground }]}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)} {review.comment ?? ''}</Text>)}</> : null}
          <Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 28 }]}>{isArabic ? 'لماذا تختاره' : 'Why customers choose them'}</Text>
          <View style={styles.benefitList}>
            {(isArabic ? ['ملف تجاري موثّق', 'تواصل واضح حول المشروع', 'تقييمات من عملاء محليين'] : ['Verified business profile', 'Clear project communication', 'Reviews from local customers']).map((item) => (
              <View key={item} style={styles.benefitRow}><View style={[styles.checkCircle, { backgroundColor: colors.primarySoft }]}><Feather name="check" size={13} color={colors.primary} /></View><Text style={[styles.benefitText, { color: colors.foreground }]}>{item}</Text></View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <ActionButton label={provider.phone.trim() ? (isArabic ? 'اتصال' : 'Call provider') : (isArabic ? 'رقم الهاتف غير متوفر' : 'Phone unavailable')} icon={provider.phone.trim() ? 'phone' : 'phone-off'} onPress={openCall} disabled={!provider.phone.trim()} secondary={!provider.phone.trim()} style={{ flex: 1 }} />
        <ActionButton label={provider.phone.trim() ? (isArabic ? 'واتساب' : 'WhatsApp') : (isArabic ? 'واتساب غير متوفر' : 'WhatsApp unavailable')} icon="message-circle" onPress={openWhatsApp} disabled={!provider.phone.trim()} secondary style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  unavailable: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  unavailableTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  unavailableText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  topBar: { height: 88, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroImage: { width: '100%', height: 245 },
  content: { padding: 20 },
  titleRow: { marginTop: 2 },
  titleBlock: { gap: 7 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  providerTitle: { fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  verifiedPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', gap: 4, alignItems: 'center' },
  verifiedText: { fontSize: 10, fontWeight: '800' },
  specialty: { fontSize: 13 },
  statsRow: { borderWidth: 1, borderRadius: 18, padding: 17, marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statDivider: { width: 1, height: 30 },
  statLabel: { fontSize: 10, marginTop: 6 },
  statValue: { fontSize: 16, fontWeight: '800' },
  sectionLabel: { fontSize: 17, fontWeight: '800' },
  description: { fontSize: 14, lineHeight: 22, marginTop: 8 },
  benefitList: { gap: 13, marginTop: 15 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkCircle: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  benefitText: { fontSize: 13, fontWeight: '600' },
  projectCard: { borderWidth: 1, borderRadius: 16, padding: 13, gap: 7, marginTop: 10 },
  projectTitle: { fontSize: 14, fontWeight: '800' },
  projectDescription: { fontSize: 12, lineHeight: 18 },
  projectActions: { flexDirection: 'row', gap: 8, marginTop: 3 },
  projectAction: { minHeight: 36, flex: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  projectActionText: { fontSize: 11, fontWeight: '800' },
  bottomActions: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 13, borderTopWidth: 1, flexDirection: 'row', gap: 10 },
});