import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, BrandMark, FixedBackButton, IconButton, ListingEngagementMetrics, Rating, StarRatingInput } from '@/components/MoqawilUI';
import { listings, marketplaceListingToLocal } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getContactMessage, getListingUrl, getWhatsAppUrl } from '@/constants/contactMessages';
import { getGetListingQueryKey, getGetListingRatingQueryKey, getListListingsQueryKey, useGetListing, useGetListingRating, useRateListing, useRecordContactEvent, useRecordListingEngagement } from '@workspace/api-client-react';

function formatListingDate(value: string | undefined, isArabic: boolean) {
  if (!value) return isArabic ? 'غير متوفر' : 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return isArabic ? 'غير متوفر' : 'Unavailable';
  return new Intl.DateTimeFormat(isArabic ? 'ar-OM' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export default function ListingDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isArabic, isSaved, toggleSaved, engagementClientId } = useApp();
  const localListing = listings.find((item) => item.id === id);
  const liveListing = useGetListing(id ?? '', { query: { queryKey: getGetListingQueryKey(id ?? ''), enabled: Boolean(id && !localListing) } });
  const persistedRating = useGetListingRating(id ?? '', { query: { queryKey: getGetListingRatingQueryKey(id ?? ''), enabled: Boolean(id) } });
  const listing = liveListing.data ? marketplaceListingToLocal(liveListing.data) : (localListing ?? listings[0]);
  const gallery = listing.imageUrls?.length ? listing.imageUrls : [listing.image];
  const contact = useRecordListingEngagement();
  const contactEvent = useRecordContactEvent();
  const [selectedRating, setSelectedRating] = React.useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);
  const rate = useRateListing({ mutation: { onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(listing.id) });
    queryClient.invalidateQueries({ queryKey: getGetListingRatingQueryKey(listing.id) });
    queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() });
  } } });
  const submitRating = (value: number) => {
    setSelectedRating(value);
    rate.mutate({ listingId: listing.id, data: { rating: value } });
  };
  const recordContact = (channel: 'call' | 'whatsapp') => {
    if (engagementClientId) {
      contact.mutate({ listingId: listing.id, data: { action: 'contact', clientId: engagementClientId } });
    }
    contactEvent.mutate({ data: {
      category: 'property',
      channel,
      subjectId: listing.id,
      subjectName: isArabic ? listing.titleAr : listing.title,
    } });
  };
  const openContact = () => {
    const phone = listing.phone ?? '+96877224535';
    recordContact('call');
    void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };
  const openWhatsApp = () => {
    const phone = listing.phone ?? '+96877224535';
    const message = getContactMessage('property', isArabic ? listing.titleAr : listing.title, isArabic, getListingUrl(listing.id));
    const url = getWhatsAppUrl(phone, message);
    if (!url) return;
    recordContact('whatsapp');
    void Linking.openURL(url);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FixedBackButton testID="listing-back" onPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <View style={{ width: 44 }} />
          <BrandMark compact />
          <IconButton icon="bookmark" active={isSaved(listing.id)} onPress={() => toggleSaved(listing.id, { listing: true })} accessibilityLabel={isArabic ? 'حفظ الإعلان' : 'Save property'} />
        </View>
        <View style={styles.heroWrap}>
           <Image source={gallery[selectedImageIndex] ?? gallery[0]} style={styles.heroImage} />
          <View style={styles.heroTag}><Text style={styles.heroTagText}>{isArabic ? listing.typeAr : listing.type}</Text></View>
        </View>
         {gallery.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryStrip}>
           {gallery.map((image, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={isArabic ? `الصورة ${index + 1}` : `Photo ${index + 1}`} onPress={() => setSelectedImageIndex(index)} style={[styles.thumbnail, index === selectedImageIndex && { borderColor: colors.primary }]}>
             <Image source={image} style={styles.thumbnailImage} />
           </Pressable>)}
         </ScrollView> : null}
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.foreground }]}>{isArabic ? listing.titleAr : listing.title}</Text>
          <Text style={[styles.price, { color: colors.primary }]}>{listing.price}</Text>
          <Rating value={rate.data?.rating ?? (persistedRating.data?.rating ? persistedRating.data.rating : listing.rating ?? 0)} />
          <StarRatingInput value={selectedRating} onChange={submitRating} disabled={rate.isPending} label={isArabic ? 'قيّم هذا العقار من نجمة إلى خمس' : 'Rate this property from one to five stars'} />
          <View style={styles.locationRow}><Feather name="map-pin" size={15} color={colors.mutedForeground} /><Text style={[styles.location, { color: colors.mutedForeground }]}>{isArabic ? listing.locationAr : listing.location}</Text></View>
           <View style={[styles.metaCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
             <View style={styles.metaRow}>
               <Feather name="calendar" size={16} color={colors.primary} />
               <View style={styles.metaCopy}><Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{isArabic ? 'تاريخ الإعلان' : 'Listed on'}</Text><Text style={[styles.metaValue, { color: colors.foreground }]}>{formatListingDate(listing.createdAt, isArabic)}</Text></View>
             </View>
             <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
             <View style={styles.metaRow}>
               <Feather name="refresh-cw" size={16} color={colors.primary} />
               <View style={styles.metaCopy}><Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{isArabic ? 'آخر تحديث' : 'Last updated'}</Text><Text style={[styles.metaValue, { color: colors.foreground }]}>{formatListingDate(listing.updatedAt, isArabic)}</Text></View>
             </View>
             <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
             <View style={styles.metaRow}>
               <Feather name="hash" size={16} color={colors.primary} />
               <View style={styles.metaCopy}><Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{isArabic ? 'رقم الإعلان' : 'Listing ID'}</Text><Text selectable style={[styles.metaValue, { color: colors.foreground }]}>{listing.id}</Text></View>
             </View>
           </View>
          <View style={[styles.specs, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {[[String(listing.beds), 'Bedrooms'], [String(listing.baths), 'Bathrooms'], [listing.area, 'Total area']].map(([value, label]) => (
              <View key={label} style={styles.spec}><Text style={[styles.specValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.specLabel, { color: colors.mutedForeground }]}>{label}</Text></View>
            ))}
          </View>
          <ListingEngagementMetrics listingId={listing.id} saved={isSaved(listing.id)} onSave={() => toggleSaved(listing.id, { listing: true })} trackView />
           <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{isArabic ? 'تفاصيل الإعلان' : 'Listing details'}</Text>
           <Text style={[styles.description, { color: colors.mutedForeground }]}>{isArabic ? 'اطّلع على تفاصيل العقار، وتواصل مع المعلن مباشرة لترتيب موعد للمعاينة.' : 'Review the property details and contact the advertiser directly to arrange a viewing.'}</Text>
          <View style={[styles.tip, { backgroundColor: colors.primarySoft }]}>
            <Feather name="shield" size={18} color={colors.primary} />
             <Text style={[styles.tipText, { color: colors.foreground }]}>{isArabic ? 'احرص على أن يكون اللقاء الأول في مكان عام، وتحقق من مستندات العقار قبل الدفع.' : 'Meet in a public place first and verify the property documents before making a payment.'}</Text>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <ActionButton label={isArabic ? 'اتصل بالمعلن' : 'Contact agent'} icon="phone" onPress={openContact} style={{ flex: 1 }} />
        <ActionButton label={isArabic ? 'واتساب' : 'WhatsApp'} icon="message-circle" onPress={openWhatsApp} secondary style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { height: 88, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroWrap: { height: 270, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroTag: { position: 'absolute', top: 18, left: 18, backgroundColor: 'rgba(255,255,255,0.94)', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 },
  heroTagText: { color: '#153457', fontWeight: '800', fontSize: 11 },
  galleryStrip: { paddingHorizontal: 18, paddingTop: 10, gap: 8 },
  thumbnail: { width: 64, height: 54, borderWidth: 2, borderColor: 'transparent', borderRadius: 10, overflow: 'hidden' },
  thumbnailImage: { width: '100%', height: '100%' },
  content: { padding: 20 },
  title: { fontSize: 27, fontWeight: '800', letterSpacing: -0.7 },
  price: { fontSize: 20, fontWeight: '800', marginTop: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
  location: { fontSize: 13 },
  metaCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 18, gap: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaCopy: { flex: 1, gap: 2 },
  metaLabel: { fontSize: 11 },
  metaValue: { fontSize: 13, fontWeight: '800' },
  metaDivider: { height: 1, marginLeft: 26 },
  specs: { borderWidth: 1, borderRadius: 18, padding: 17, marginTop: 22, flexDirection: 'row', justifyContent: 'space-between' },
  spec: { flex: 1, alignItems: 'center', gap: 4 },
  specValue: { fontSize: 16, fontWeight: '800' },
  specLabel: { fontSize: 10 },
  sectionLabel: { fontSize: 17, fontWeight: '800', marginTop: 28 },
  description: { fontSize: 14, lineHeight: 22, marginTop: 8 },
  tip: { marginTop: 24, padding: 14, borderRadius: 15, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 12, lineHeight: 18 },
  bottomActions: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 13, borderTopWidth: 1, flexDirection: 'row', gap: 10 },
});