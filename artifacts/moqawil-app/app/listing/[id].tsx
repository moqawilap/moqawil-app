import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, BrandMark, IconButton, ListingEngagementMetrics } from '@/components/MoqawilUI';
import { listings, marketplaceListingToLocal } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getGetListingQueryKey, useGetListing, useRecordListingEngagement } from '@workspace/api-client-react';

export default function ListingDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isArabic, isSaved, toggleSaved, engagementClientId } = useApp();
  const localListing = listings.find((item) => item.id === id);
  const liveListing = useGetListing(id ?? '', { query: { queryKey: getGetListingQueryKey(id ?? ''), enabled: Boolean(id && !localListing) } });
  const listing = liveListing.data ? marketplaceListingToLocal(liveListing.data) : (localListing ?? listings[0]);
  const contact = useRecordListingEngagement();
  const openContact = () => {
    if (engagementClientId) {
      contact.mutate({ listingId: listing.id, data: { action: 'contact', clientId: engagementClientId } });
    }
    Linking.openURL(`tel:${listing.phone ?? '+96877224535'}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <IconButton icon="arrow-left" onPress={() => router.back()} accessibilityLabel="Go back" />
          <BrandMark compact />
          <IconButton icon="bookmark" active={isSaved(listing.id)} onPress={() => toggleSaved(listing.id, { listing: true })} accessibilityLabel={isArabic ? 'حفظ الإعلان' : 'Save property'} />
        </View>
        <View style={styles.heroWrap}>
          <Image source={listing.image} style={styles.heroImage} />
          <View style={styles.heroTag}><Text style={styles.heroTagText}>{isArabic ? listing.typeAr : listing.type}</Text></View>
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.foreground }]}>{isArabic ? listing.titleAr : listing.title}</Text>
          <Text style={[styles.price, { color: colors.primary }]}>{listing.price}</Text>
          <View style={styles.locationRow}><Feather name="map-pin" size={15} color={colors.mutedForeground} /><Text style={[styles.location, { color: colors.mutedForeground }]}>{isArabic ? listing.locationAr : listing.location}</Text></View>
          <View style={[styles.specs, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {[[String(listing.beds), 'Bedrooms'], [String(listing.baths), 'Bathrooms'], [listing.area, 'Total area']].map(([value, label]) => (
              <View key={label} style={styles.spec}><Text style={[styles.specValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.specLabel, { color: colors.mutedForeground }]}>{label}</Text></View>
            ))}
          </View>
          <ListingEngagementMetrics listingId={listing.id} saved={isSaved(listing.id)} onSave={() => toggleSaved(listing.id, { listing: true })} trackView />
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>A home with room to grow</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>Explore the full property details, ask questions directly, and arrange a visit with the listing contact.</Text>
          <View style={[styles.tip, { backgroundColor: colors.primarySoft }]}>
            <Feather name="shield" size={18} color={colors.primary} />
            <Text style={[styles.tipText, { color: colors.foreground }]}>Keep your first meeting in a public place and verify property documents before paying.</Text>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <ActionButton label={isArabic ? 'اتصل بالمعلن' : 'Contact agent'} icon="phone" onPress={openContact} style={{ flex: 1 }} />
        <ActionButton label="Arrange visit" icon="calendar" onPress={() => Linking.openURL('mailto:moqawil.om@gmail.com')} secondary style={{ flex: 1 }} />
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
  content: { padding: 20 },
  title: { fontSize: 27, fontWeight: '800', letterSpacing: -0.7 },
  price: { fontSize: 20, fontWeight: '800', marginTop: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
  location: { fontSize: 13 },
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