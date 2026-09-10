import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, BrandMark, FixedBackButton, IconButton, ListingEngagementMetrics, PropertyCard, Rating, StarRatingInput } from '@/components/MoqawilUI';
import { listings, marketplaceListingToLocal, mergeMarketplaceListings } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getContactMessage, getListingUrl, getWhatsAppUrl } from '@/constants/contactMessages';
import { getGetListingQueryKey, getGetListingRatingQueryKey, getListListingsQueryKey, useGetListing, useGetListingRating, useListListings, useRateListing, useRecordContactEvent, useRecordListingEngagement } from '@workspace/api-client-react';

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
  const { isSignedIn } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isArabic, isSaved, toggleSaved, engagementClientId } = useApp();
  const localListing = listings.find((item) => item.id === id);
  const liveListing = useGetListing(id ?? '', { query: { queryKey: getGetListingQueryKey(id ?? ''), enabled: Boolean(id && !localListing) } });
  const allListings = useListListings({ query: { queryKey: getListListingsQueryKey() } });
  const persistedRating = useGetListingRating(id ?? '', { query: { queryKey: getGetListingRatingQueryKey(id ?? ''), enabled: Boolean(id) } });
  const listing = liveListing.data ? marketplaceListingToLocal(liveListing.data) : localListing;
  const gallery = listing?.imageUrls?.length ? listing.imageUrls : listing ? [listing.image] : [];
  const relatedListings = React.useMemo(() => {
    if (!listing) return [];
    const currentLocation = listing.location.toLowerCase();
    return mergeMarketplaceListings(allListings.data)
      .filter((item) => item.id !== listing.id)
      .map((item) => {
        const sameType = item.type === listing.type;
        const sameLocation = item.location.toLowerCase() === currentLocation;
        return { item, score: (sameType ? 4 : 0) + (sameLocation ? 3 : 0) + (Date.parse(item.createdAt ?? '') || 0) / 1_000_000_000_000 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ item }) => item);
  }, [allListings.data, listing]);
  const contact = useRecordListingEngagement();
  const contactEvent = useRecordContactEvent({ mutation: { retry: 2, onError: () => Alert.alert(isArabic ? 'تعذر تسجيل التواصل' : 'Could not record contact', isArabic ? 'تم فتح وسيلة التواصل، لكن تعذر إشعار صاحب الإعلان.' : 'The contact app was opened, but the advertiser could not be notified.') } });
  const [selectedRating, setSelectedRating] = React.useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);
  const rate = useRateListing({ mutation: { onSuccess: () => {
    if (listing) queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(listing.id) });
    if (listing) queryClient.invalidateQueries({ queryKey: getGetListingRatingQueryKey(listing.id) });
    queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() });
  } } });
  if (!listing) {
    return <View style={[styles.container, styles.unavailable, { backgroundColor: colors.background }]}>{liveListing.isLoading ? <><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.mutedForeground }}>{isArabic ? 'جارٍ تحميل الإعلان…' : 'Loading listing…'}</Text></> : liveListing.isError ? <><Feather name="alert-circle" size={28} color={colors.primary} /><Text style={[styles.unavailableTitle, { color: colors.foreground }]}>{isArabic ? 'تعذر تحميل الإعلان' : 'Could not load listing'}</Text><Text style={[styles.unavailableText, { color: colors.mutedForeground }]}>{isArabic ? 'تحقق من الاتصال ثم حاول مرة أخرى.' : 'Check your connection and try again.'}</Text><ActionButton testID="listing-retry" label={isArabic ? 'إعادة المحاولة' : 'Retry'} icon="refresh-cw" onPress={() => void liveListing.refetch()} /><ActionButton label={isArabic ? 'رجوع' : 'Go back'} secondary onPress={() => router.back()} /></> : <><Text style={[styles.unavailableTitle, { color: colors.foreground }]}>{isArabic ? 'الإعلان غير متوفر.' : 'Listing unavailable.'}</Text><ActionButton label={isArabic ? 'رجوع' : 'Go back'} secondary onPress={() => router.back()} /></>}</View>;
  }
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
  const submitRating = (value: number) => {
    if (!isSignedIn) {
      promptSignIn(isArabic ? 'يلزم تسجيل الدخول لتقييم هذا العقار.' : 'Sign in before rating this property.');
      return;
    }
    rate.mutate(
      { listingId: listing.id, data: { rating: value } },
      {
        onSuccess: () => setSelectedRating(value),
        onError: () => Alert.alert(
          isArabic ? 'تعذر إرسال التقييم' : 'Could not submit rating',
          isArabic ? 'لم يتم حفظ تقييمك. تحقق من الاتصال ثم حاول مرة أخرى.' : 'Your rating was not saved. Check your connection and try again.',
        ),
      },
    );
  };
  const recordContact = (channel: 'call' | 'whatsapp') => {
    if (engagementClientId) {
      contact.mutate({ listingId: listing.id, data: { action: 'contact', clientId: engagementClientId } });
    }
    contactEvent.mutate({ data: {
      category: 'property',
      channel,
      eventId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${listing.id}`,
      subjectId: listing.id,
      subjectKind: 'property',
      subjectName: isArabic ? listing.titleAr : listing.title,
    } });
  };
  const requireContactSignIn = () => {
    if (isSignedIn) return false;
    promptSignIn(isArabic ? 'يلزم تسجيل الدخول للاتصال بصاحب الإعلان أو مراسلته.' : 'Sign in before calling or messaging the advertiser.');
    return true;
  };
  const openContactUrl = async (url: string, channel: 'call' | 'whatsapp') => {
    try {
      await Linking.openURL(url);
      recordContact(channel);
    } catch {
      Alert.alert(
        isArabic ? 'تعذر فتح وسيلة التواصل' : 'Could not open contact app',
        isArabic ? 'تحقق من توفر تطبيق مناسب على جهازك ثم حاول مرة أخرى.' : 'Check that a suitable app is available on your device, then try again.',
      );
    }
  };
  const openContact = () => {
    if (!listing.phone?.trim() || requireContactSignIn()) return;
    void openContactUrl(`tel:${listing.phone.replace(/\s/g, '')}`, 'call');
  };
  const openWhatsApp = () => {
    if (!listing.phone?.trim() || requireContactSignIn()) return;
    const message = getContactMessage('property', isArabic ? listing.titleAr : listing.title, isArabic, getListingUrl(listing.id));
    const url = getWhatsAppUrl(listing.phone, message);
    if (!url) return;
    void openContactUrl(url, 'whatsapp');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FixedBackButton testID="listing-back" onPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <View style={{ width: 44 }} />
          <BrandMark compact />
          <IconButton icon="bookmark" active={isSaved(listing.id)} onPress={() => toggleSaved(listing.id, { subjectKind: 'property', subjectName: isArabic ? listing.titleAr : listing.title })} accessibilityLabel={isArabic ? 'حفظ الإعلان' : 'Save property'} />
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
          <ListingEngagementMetrics listingId={listing.id} saved={isSaved(listing.id)} onSave={() => toggleSaved(listing.id, { subjectKind: 'property', subjectName: isArabic ? listing.titleAr : listing.title })} trackView />
           <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{isArabic ? 'تفاصيل الإعلان' : 'Listing details'}</Text>
           <Text style={[styles.description, { color: colors.mutedForeground }]}>{isArabic ? 'اطّلع على تفاصيل العقار، وتواصل مع المعلن مباشرة لترتيب موعد للمعاينة.' : 'Review the property details and contact the advertiser directly to arrange a viewing.'}</Text>
          <View style={[styles.tip, { backgroundColor: colors.primarySoft }]}>
            <Feather name="shield" size={18} color={colors.primary} />
             <Text style={[styles.tipText, { color: colors.foreground }]}>{isArabic ? 'احرص على أن يكون اللقاء الأول في مكان عام، وتحقق من مستندات العقار قبل الدفع.' : 'Meet in a public place first and verify the property documents before making a payment.'}</Text>
          </View>
           {relatedListings.length ? <View style={styles.relatedSection}>
             <View style={styles.relatedHeader}>
               <Text style={[styles.sectionLabel, styles.relatedTitle, { color: colors.foreground }]}>{isArabic ? 'إعلانات ذات صلة' : 'Related listings'}</Text>
               <Feather name="chevron-right" size={18} color={colors.primary} />
             </View>
             <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedList}>
               {relatedListings.map((related) => <View key={related.id} style={styles.relatedCard}>
                 <PropertyCard
                   listing={{ ...related, title: isArabic ? related.titleAr : related.title, location: isArabic ? related.locationAr : related.location, type: isArabic ? related.typeAr : related.type }}
                   saved={isSaved(related.id)}
                   onPress={() => router.push({ pathname: '/listing/[id]', params: { id: related.id } })}
                    onSave={() => toggleSaved(related.id, { subjectKind: 'property', subjectName: isArabic ? related.titleAr : related.title })}
                 />
               </View>)}
             </ScrollView>
           </View> : null}
        </View>
      </ScrollView>
      <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.background, borderTopColor: colors.border }]}>
         <ActionButton label={listing.phone?.trim() ? (isArabic ? 'اتصل بالمعلن' : 'Contact agent') : (isArabic ? 'رقم الهاتف غير متوفر' : 'Phone unavailable')} icon={listing.phone?.trim() ? 'phone' : 'phone-off'} onPress={openContact} disabled={!listing.phone?.trim()} style={{ flex: 1 }} />
         <ActionButton label={listing.phone?.trim() ? (isArabic ? 'واتساب' : 'WhatsApp') : (isArabic ? 'واتساب غير متوفر' : 'WhatsApp unavailable')} icon="message-circle" onPress={openWhatsApp} disabled={!listing.phone?.trim()} secondary style={{ flex: 1 }} />
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
  relatedSection: { marginTop: 4 },
  relatedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  relatedTitle: { marginTop: 28 },
  relatedList: { gap: 12, paddingTop: 12, paddingBottom: 4 },
  relatedCard: { width: 286 },
  bottomActions: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 13, borderTopWidth: 1, flexDirection: 'row', gap: 10 },
});