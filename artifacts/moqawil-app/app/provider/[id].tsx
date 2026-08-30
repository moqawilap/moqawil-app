import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, BrandMark, FixedBackButton, IconButton, Rating, StarRatingInput } from '@/components/MoqawilUI';
import { providers } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getContactMessage, getWhatsAppUrl, type ContactCategory } from '@/constants/contactMessages';
import { getGetContractorQueryKey, getGetContractorRatingQueryKey, getListContractorsQueryKey, useGetContractor, useGetContractorRating, useRateContractor, useRecordContactEvent } from '@workspace/api-client-react';

export default function ProviderDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isArabic, isSaved, toggleSaved, managedProviders, activeService } = useApp();
  const contractor = useGetContractor(id);
  const persistedRating = useGetContractorRating(id, { query: { queryKey: getGetContractorRatingQueryKey(id), enabled: Boolean(id) } });
  const [selectedRating, setSelectedRating] = React.useState(0);
  const contactEvent = useRecordContactEvent();
  const rate = useRateContractor({ mutation: { onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: getGetContractorQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetContractorRatingQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListContractorsQueryKey() });
  } } });
  const fallback = managedProviders.find((item) => item.id === id);
  const provider = contractor.data ? {
    id: contractor.data.id, name: contractor.data.businessName, nameAr: contractor.data.businessName,
    specialty: contractor.data.services.map((service) => service.name).join(' · ') || 'Contractor',
    specialtyAr: contractor.data.services.map((service) => service.name).join(' · ') || 'مقاول',
    city: contractor.data.city, rating: contractor.data.rating, reviews: contractor.data.reviewCount,
    verified: contractor.data.isVerified, projects: contractor.data.projects.length,
    image: contractor.data.avatarUrl ? { uri: contractor.data.avatarUrl } : require('@/assets/images/contractor-project.jpg'),
    description: contractor.data.bio || '', descriptionAr: contractor.data.bio || '', distance: contractor.data.city,
    phone: contractor.data.phone ?? '', contractAmount: '', startingPrice: '', role: 'contractor' as const, accent: '',
  } : fallback;
  if (!provider) return <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }]}><Text style={{ color: colors.foreground }}>Provider unavailable.</Text><ActionButton label="Go back" secondary onPress={() => router.back()} /></View>;
  const contactCategory: ContactCategory =
    activeService === 'design' || provider.role === 'consultant' ? 'design'
      : activeService === 'maintenance' || provider.role === 'maintenance' ? 'maintenance'
        : activeService === 'building' ? 'workshop'
          : 'contractor';
  const subjectName = isArabic ? provider.nameAr : provider.name;
  const recordContact = (channel: 'call' | 'whatsapp') => {
    contactEvent.mutate({ data: {
      category: contactCategory,
      channel,
      subjectId: provider.id,
      subjectName,
    } });
  };
  const openCall = () => {
    if (!provider.phone.trim()) return;
    recordContact('call');
    void Linking.openURL(`tel:${provider.phone.replace(/\s/g, '')}`);
  };
  const openWhatsApp = () => {
    const url = getWhatsAppUrl(provider.phone, getContactMessage(contactCategory, subjectName, isArabic));
    if (!url) return;
    recordContact('whatsapp');
    void Linking.openURL(url);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FixedBackButton testID="provider-back" onPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <View style={{ width: 44 }} />
          <BrandMark compact />
          <IconButton icon="heart" active={isSaved(provider.id)} onPress={() => toggleSaved(provider.id)} accessibilityLabel="Save provider" />
        </View>
         <Image source={provider.image} style={styles.heroImage} />
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <View style={styles.verifiedRow}>
                <Text style={[styles.providerTitle, { color: colors.foreground }]}>{isArabic ? provider.nameAr : provider.name}</Text>
                {provider.verified ? <View style={[styles.verifiedPill, { backgroundColor: colors.primarySoft }]}><Feather name="check" size={12} color={colors.primary} /><Text style={[styles.verifiedText, { color: colors.primary }]}>Verified</Text></View> : null}
              </View>
              <Text style={[styles.specialty, { color: colors.mutedForeground }]}>{isArabic ? provider.specialtyAr : provider.specialty} · {provider.city}</Text>
            </View>
          </View>
          <View style={[styles.statsRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View><Rating value={rate.data?.rating ?? (persistedRating.data?.rating ? persistedRating.data.rating : provider.rating)} reviews={provider.reviews} /><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Customer rating</Text></View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View><Text style={[styles.statValue, { color: colors.foreground }]}>{provider.projects}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Projects</Text></View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View><Text style={[styles.statValue, { color: colors.foreground }]}>{provider.distance}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Away</Text></View>
          </View>
          <StarRatingInput value={selectedRating} onChange={(value) => { setSelectedRating(value); rate.mutate({ id, data: { rating: value } }); }} disabled={rate.isPending} label={isArabic ? 'قيّم مقدم الخدمة من نجمة إلى خمس' : 'Rate this provider from one to five stars'} />
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{isArabic ? 'عن مقدم الخدمة' : 'About this provider'}</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{isArabic ? provider.descriptionAr : provider.description}</Text>
           {contractor.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 14 }} /> : null}
           {contractor.data?.services.length ? <><Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 28 }]}>{isArabic ? 'الخدمات' : 'Services'}</Text><Text style={[styles.description, { color: colors.mutedForeground }]}>{contractor.data.services.map((service) => service.name).join(' • ')}</Text></> : null}
           {contractor.data?.projects.length ? <><Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 28 }]}>{isArabic ? 'المشاريع' : 'Projects'}</Text><Text style={[styles.description, { color: colors.mutedForeground }]}>{contractor.data.projects.map((project) => project.title).join(' • ')}</Text></> : null}
           {contractor.data?.reviews.length ? <><Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 28 }]}>{isArabic ? 'المراجعات' : 'Reviews'}</Text>{contractor.data.reviews.slice(0, 3).map((review) => <Text key={review.id} style={[styles.description, { color: colors.mutedForeground }]}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)} {review.comment ?? ''}</Text>)}</> : null}
          <Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 28 }]}>{isArabic ? 'لماذا تختاره' : 'Why customers choose them'}</Text>
          <View style={styles.benefitList}>
            {['Verified business profile', 'Clear project communication', 'Reviews from local customers'].map((item) => (
              <View key={item} style={styles.benefitRow}><View style={[styles.checkCircle, { backgroundColor: colors.primarySoft }]}><Feather name="check" size={13} color={colors.primary} /></View><Text style={[styles.benefitText, { color: colors.foreground }]}>{item}</Text></View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.background, borderTopColor: colors.border }]}>
         {!provider.phone.trim() ? <View style={{ flex: 1 }}><ActionButton label={isArabic ? 'رقم الهاتف غير متوفر' : 'Phone unavailable'} icon="phone-off" secondary onPress={() => undefined} /></View> : <ActionButton label={isArabic ? 'اتصال' : 'Call provider'} icon="phone" onPress={openCall} style={{ flex: 1 }} />}
        {!provider.phone.trim() ? <View style={{ flex: 1 }}><ActionButton label={isArabic ? 'واتساب غير متوفر' : 'WhatsApp unavailable'} icon="message-circle" secondary onPress={() => undefined} /></View> : <ActionButton label={isArabic ? 'واتساب' : 'WhatsApp'} icon="message-circle" onPress={openWhatsApp} secondary style={{ flex: 1 }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  bottomActions: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 13, borderTopWidth: 1, flexDirection: 'row', gap: 10 },
});