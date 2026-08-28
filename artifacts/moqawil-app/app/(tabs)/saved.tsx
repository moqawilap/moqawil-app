import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, PropertyCard, ProviderCard, ScreenHeader, SegmentedControl } from '@/components/MoqawilUI';
import { listings, providers } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function SavedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isArabic, savedIds, toggleSaved, managedProviders } = useApp();
  const [mode, setMode] = React.useState('All');
  const savedProviders = managedProviders.filter((provider) => savedIds.includes(provider.id));
  const savedListings = listings.filter((listing) => savedIds.includes(listing.id));
  const hasSaved = savedProviders.length > 0 || savedListings.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <ScreenHeader title={isArabic ? 'المحفوظات' : 'Saved'} subtitle={isArabic ? 'خياراتك المفضلة في مكان واحد' : 'Your shortlist, all in one place'} />
          <SegmentedControl value={mode} onChange={setMode} options={['All', 'Providers', 'Properties']} />
          {!hasSaved ? <EmptyState icon="heart" title={isArabic ? 'لا توجد محفوظات بعد' : 'Nothing saved yet'} description={isArabic ? 'احفظ مزودي الخدمة والعقارات للعودة إليها بسهولة.' : 'Save providers and properties to build your shortlist.'} /> : null}
          {mode !== 'Properties' && savedProviders.length > 0 ? (
            <View style={styles.section}><View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Providers <Text style={[styles.count, { color: colors.mutedForeground }]}>({savedProviders.length})</Text></Text><Feather name="arrow-up-right" size={16} color={colors.primary} /></View>{savedProviders.map((provider) => <ProviderCard key={provider.id} image={provider.image} name={isArabic ? provider.nameAr : provider.name} specialty={isArabic ? provider.specialtyAr : provider.specialty} rating={provider.rating} reviews={provider.reviews} distance={provider.distance} verified={provider.verified} saved onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })} onSave={() => toggleSaved(provider.id)} />)}</View>
          ) : null}
          {mode !== 'Providers' && savedListings.length > 0 ? (
            <View style={styles.section}><View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Properties <Text style={[styles.count, { color: colors.mutedForeground }]}>({savedListings.length})</Text></Text><Feather name="arrow-up-right" size={16} color={colors.primary} /></View><View style={styles.propertyGrid}>{savedListings.map((listing) => <PropertyCard key={listing.id} listing={{ ...listing, title: isArabic ? listing.titleAr : listing.title, location: isArabic ? listing.locationAr : listing.location, type: isArabic ? listing.typeAr : listing.type }} saved onPress={() => router.push({ pathname: '/listing/[id]', params: { id: listing.id } })} onSave={() => toggleSaved(listing.id)} />)}</View></View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  section: { marginTop: 8, marginBottom: 14 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  count: { fontWeight: '500', fontSize: 13 },
  propertyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});