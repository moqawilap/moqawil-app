import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProviderCard, PropertyCard, ScreenHeader, SegmentedControl, ServiceIcon } from '@/components/MoqawilUI';
import { images, listings, serviceItems } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useListContractors } from '@workspace/api-client-react';

export default function ExploreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isArabic, location, savedIds, toggleSaved, activeService, setActiveService, managedProviders } = useApp();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('Providers');
  const [city, setCity] = useState('');
  const [minimumRating, setMinimumRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const selectedService = activeService ?? 'contractors';
  const selectedServiceInfo = serviceItems.find((service) => service.id === selectedService) ?? serviceItems[0];
  const visibleMode = selectedService === 'real-estate' ? 'Properties' : mode;
  const directory = useListContractors({
    search: query.trim() || undefined,
    category: selectedService === 'contractors' ? undefined : selectedService,
    city: city || undefined,
    verified: verifiedOnly || undefined,
    limit: 50,
  });

  const selectService = (serviceId: typeof selectedService) => {
    setActiveService(serviceId);
    setMode(serviceId === 'real-estate' ? 'Properties' : 'Providers');
  };

  const filteredProviders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const apiProviders = directory.data?.items.map((contractor) => ({
      id: contractor.id, name: contractor.businessName, nameAr: contractor.businessName, specialty: contractor.bio || 'Contractor',
      specialtyAr: contractor.bio || 'مقاول', rating: contractor.rating, reviews: contractor.reviewCount, distance: contractor.city,
      city: contractor.city, verified: contractor.isVerified,
      image: contractor.avatarUrl ? { uri: contractor.avatarUrl } : selectedService === 'consultants' ? images.interior : selectedService === 'maintenance' ? images.villa : images.contractor,
      rankingScore: contractor.rankingScore,
    }));
    const fallbackProviders = managedProviders.filter((provider) =>
      selectedService === 'contractors' ? provider.role === 'contractor' :
      selectedService === 'consultants' ? provider.role === 'consultant' :
      selectedService === 'maintenance' ? provider.role === 'maintenance' : true,
    );
    const source = apiProviders?.length ? apiProviders : fallbackProviders;
    return source
      .filter((provider) => (!normalized || `${provider.name} ${provider.specialty}`.toLowerCase().includes(normalized)) && provider.rating >= minimumRating)
      .sort((a, b) => ('rankingScore' in b ? Number(b.rankingScore ?? 0) : 0) - ('rankingScore' in a ? Number(a.rankingScore ?? 0) : 0));
  }, [query, managedProviders, directory.data, minimumRating, selectedService]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <ScreenHeader title={isArabic ? 'اكتشف الخدمات' : 'Explore services'} subtitle={`${isArabic ? 'حول' : 'Around'} ${location.city}`} />
          {directory.isError ? <Text style={[styles.apiHint, { color: colors.mutedForeground }]}>الخدمة غير متاحة مؤقتًا — showing offline directory.</Text> : null}
          <View style={[styles.searchInputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <TextInput testID="contractor-search" value={query} onChangeText={setQuery} placeholder={isArabic ? 'ابحث عن خدمة أو مزود' : 'Search a service or provider'} placeholderTextColor={colors.mutedForeground} textAlign={isArabic ? 'right' : 'left'} style={[styles.searchInput, { color: colors.foreground }]} />
            {query ? <Pressable onPress={() => setQuery('')}><Feather name="x-circle" size={17} color={colors.mutedForeground} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
             {serviceItems.map((service) => {
              const selected = selectedService === service.id;
               return <Pressable key={service.id} onPress={() => selectService(service.id)} style={[styles.chip, { borderColor: selected ? service.color : colors.border, backgroundColor: selected ? service.color : colors.surface }]}>
                <ServiceIcon icon={service.icon} color={selected ? '#FFFFFF' : service.color} size={17} />
                <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.foreground }]}>{isArabic ? service.labelAr : service.label}</Text>
              </Pressable>;
            })}
          </ScrollView>
          <View style={styles.filters}>
            <TextInput testID="city-filter" value={city} onChangeText={setCity} placeholder={isArabic ? 'الولاية / المدينة' : 'Wilayat / city'} placeholderTextColor={colors.mutedForeground} textAlign={isArabic ? 'right' : 'left'} style={[styles.filterInput, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
            {[0, 3, 4].map((rating) => <Pressable testID={`rating-filter-${rating}`} key={rating} onPress={() => setMinimumRating(rating)} style={[styles.filterChip, { borderColor: minimumRating === rating ? colors.primary : colors.border, backgroundColor: minimumRating === rating ? colors.primarySoft : colors.surface }]}><Text style={{ color: colors.foreground }}>{rating ? `★ ${rating}+` : (isArabic ? 'كل التقييمات' : 'Any rating')}</Text></Pressable>)}
            <Pressable testID="verified-filter" onPress={() => setVerifiedOnly((value) => !value)} style={[styles.filterChip, { borderColor: verifiedOnly ? colors.primary : colors.border, backgroundColor: verifiedOnly ? colors.primarySoft : colors.surface }]}><Text style={{ color: colors.foreground }}>{isArabic ? 'موثّق' : 'Verified'}</Text></Pressable>
          </View>
           <SegmentedControl value={visibleMode} onChange={(nextMode) => {
             setMode(nextMode);
             setActiveService(nextMode === 'Properties' ? 'real-estate' : 'contractors');
           }} options={['Providers', 'Properties']} />
           {visibleMode === 'Providers' ? (
            <View>
               <View style={styles.resultsHeader}><Text style={[styles.resultTitle, { color: colors.foreground }]}>{isArabic ? `${selectedServiceInfo.labelAr} قريبون منك` : `${selectedServiceInfo.label} near you`}</Text><View style={styles.sortRow}><Feather name="sliders" size={14} color={colors.primary} /><Text style={[styles.sortText, { color: colors.primary }]}>Best match</Text></View></View>
               {directory.isLoading ? <ActivityIndicator testID="contractors-loading" color={colors.primary} /> : null}
               {filteredProviders.map((provider) => <ProviderCard key={provider.id} image={provider.image ?? require('@/assets/images/contractor-project.jpg')} name={isArabic ? provider.nameAr : provider.name} specialty={isArabic ? provider.specialtyAr : provider.specialty} rating={provider.rating} reviews={provider.reviews} distance={provider.distance} verified={provider.verified} saved={savedIds.includes(provider.id)} onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })} onSave={() => toggleSaved(provider.id)} />)}
               {!directory.isLoading && !filteredProviders.length ? <Text style={[styles.apiHint, { color: colors.mutedForeground }]}>{isArabic ? 'لا توجد نتائج مطابقة.' : 'No matching contractors.'}</Text> : null}
            </View>
          ) : (
            <View>
              <View style={styles.resultsHeader}><Text style={[styles.resultTitle, { color: colors.foreground }]}>{isArabic ? 'عقارات قريبة' : 'Properties nearby'}</Text><View style={styles.sortRow}><Feather name="sliders" size={14} color={colors.primary} /><Text style={[styles.sortText, { color: colors.primary }]}>Newest</Text></View></View>
              <View style={styles.propertyGrid}>{listings.map((listing) => <PropertyCard key={listing.id} listing={{ ...listing, title: isArabic ? listing.titleAr : listing.title, location: isArabic ? listing.locationAr : listing.location, type: isArabic ? listing.typeAr : listing.type }} saved={savedIds.includes(listing.id)} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: listing.id } })} onSave={() => toggleSaved(listing.id)} />)}</View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  searchInputWrap: { height: 52, borderRadius: 17, borderWidth: 1, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  chips: { gap: 9, paddingVertical: 16 },
  chip: { height: 39, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  chipText: { fontSize: 12, fontWeight: '700' },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 },
  resultTitle: { fontSize: 17, fontWeight: '800' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { fontSize: 11, fontWeight: '700' },
  propertyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterInput: { width: 145, height: 38, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, fontSize: 12 },
  filterChip: { height: 38, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  apiHint: { fontSize: 12, marginBottom: 10, lineHeight: 18 },
});