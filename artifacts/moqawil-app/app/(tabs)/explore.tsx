import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ProviderCard, PropertyCard, ScreenHeader, SegmentedControl, ServiceIcon } from '@/components/MoqawilUI';
import { images, listings, mergeMarketplaceListings, serviceItems } from '@/data/mockData';
import { buildingServices } from '@/data/buildingServices';
import { designServices } from '@/data/designServices';
import { omanGovernorates } from '@/data/omanLocations';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { AdBanner } from '@/components/AdBanner';
import { getListAdsQueryKey, getListListingsQueryKey, useListAds, useListContractors, useListListings } from '@workspace/api-client-react';

type SortOption = 'relevance' | 'rating_desc' | 'price_asc' | 'price_desc' | 'oldest' | 'newest';

function amountFromText(value?: string | number | null) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function dateFromText(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function budgetFromInput(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export default function ExploreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isArabic, location, savedIds, toggleSaved, activeService, setActiveService, managedProviders, engagementClientId } = useApp();
  const remoteListings = useListListings({ query: { queryKey: getListListingsQueryKey() } });
  const availableListings = useMemo(() => mergeMarketplaceListings(remoteListings.data), [remoteListings.data]);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('Providers');
  const [selectedGovernorate, setSelectedGovernorate] = useState('');
  const [selectedWilayat, setSelectedWilayat] = useState('');
  const [locationMenu, setLocationMenu] = useState<'governorate' | 'wilayat' | null>(null);
  const [selectedBuildingService, setSelectedBuildingService] = useState('');
  const [selectedDesignService, setSelectedDesignService] = useState('');
  const [minimumRating, setMinimumRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [minimumBudget, setMinimumBudget] = useState('');
  const [maximumBudget, setMaximumBudget] = useState('');
  const [sort, setSort] = useState<SortOption>('relevance');
  const minimumBudgetValue = budgetFromInput(minimumBudget);
  const maximumBudgetValue = budgetFromInput(maximumBudget);
  const hasInvalidBudget = (!!minimumBudget.trim() && minimumBudgetValue === undefined) || (!!maximumBudget.trim() && maximumBudgetValue === undefined);
  const budgetRangeValid = !hasInvalidBudget && (minimumBudgetValue === undefined || maximumBudgetValue === undefined || minimumBudgetValue <= maximumBudgetValue);
  const selectedService = activeService ?? 'contractors';
  const ads = useListAds({ city: location.city, wilayat: selectedWilayat || undefined, service: selectedService, limit: 1 }, { query: { queryKey: getListAdsQueryKey({ city: location.city, wilayat: selectedWilayat || undefined, service: selectedService, limit: 1 }) } });
  const selectedServiceInfo = serviceItems.find((service) => service.id === selectedService) ?? serviceItems[0];
  const visibleMode = selectedService === 'real-estate' ? 'Properties' : mode;
  const directoryCategory = selectedService === 'design' ? 'consultants' : selectedService;
  const directory = useListContractors({
    search: query.trim() || undefined,
    category: directoryCategory === 'contractors' ? undefined : directoryCategory,
    service: selectedService === 'building' ? selectedBuildingService || undefined : selectedService === 'design' ? selectedDesignService || undefined : undefined,
    city: selectedGovernorate || undefined,
    wilayat: selectedWilayat || undefined,
    verified: verifiedOnly || undefined,
    sort: sort === 'price_asc' || sort === 'price_desc' ? 'relevance' : sort,
    limit: 50,
  });

  const selectService = (serviceId: typeof selectedService) => {
    setActiveService(serviceId);
    setMode(serviceId === 'real-estate' ? 'Properties' : 'Providers');
    setSelectedBuildingService('');
    setSelectedDesignService('');
  };
  const selectedGovernorateInfo = omanGovernorates.find((item) => item.name === selectedGovernorate);
  const selectedWilayatInfo = selectedGovernorateInfo?.wilayats.find((item) => item.name === selectedWilayat);
  const locationOptions = locationMenu === 'governorate' ? omanGovernorates : selectedGovernorateInfo?.wilayats ?? [];

  const filteredProviders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const apiProviders = directory.data?.items.map((contractor) => ({
      id: contractor.id, name: contractor.businessName, nameAr: contractor.businessName, specialty: contractor.bio || 'Contractor',
      specialtyAr: contractor.bio || 'مقاول', rating: contractor.rating, reviews: contractor.reviewCount, distance: contractor.city,
      city: contractor.city, wilayat: contractor.wilayat ?? undefined, verified: contractor.isVerified,
      image: contractor.avatarUrl ? { uri: contractor.avatarUrl } : selectedService === 'consultants' || selectedService === 'design' ? images.interior : selectedService === 'maintenance' ? images.villa : images.contractor,
      rankingScore: contractor.rankingScore, priceOmaniRial: contractor.priceOmaniRial, createdAt: contractor.createdAt,
    }));
    const fallbackProviders = managedProviders.filter((provider) =>
      selectedService === 'contractors' ? provider.role === 'contractor' :
      selectedService === 'consultants' ? provider.role === 'consultant' :
      selectedService === 'design' ? provider.role === 'consultant' :
      selectedService === 'building' ? provider.role === 'contractor' :
      selectedService === 'maintenance' ? provider.role === 'maintenance' : true,
    ).filter((provider) => !selectedGovernorate || provider.city === selectedGovernorate)
      .filter((provider) => !selectedWilayat || provider.wilayat === selectedWilayat)
      .filter((provider) => selectedService !== 'building' || !selectedBuildingService || provider.buildingServices?.includes(selectedBuildingService));
    const source = apiProviders?.length ? apiProviders : fallbackProviders;
    return source
      .filter((provider) => {
        return (!normalized || `${provider.name} ${provider.specialty}`.toLowerCase().includes(normalized))
          && provider.rating >= minimumRating;
      })
      .sort((a, b) => {
        if (sort === 'oldest') return dateFromText(a.createdAt) - dateFromText(b.createdAt);
        if (sort === 'newest') return dateFromText(b.createdAt) - dateFromText(a.createdAt);
        return ('rankingScore' in b ? Number(b.rankingScore ?? 0) : 0) - ('rankingScore' in a ? Number(a.rankingScore ?? 0) : 0);
      });
  }, [query, managedProviders, directory.data, minimumRating, selectedService, selectedGovernorate, selectedWilayat, selectedBuildingService, selectedDesignService, sort]);

  const filteredListings = useMemo(() => availableListings
    .filter((listing) => {
      const price = amountFromText(listing.price);
      const haystack = `${listing.title} ${listing.titleAr} ${listing.location} ${listing.locationAr}`.toLowerCase();
      return (!query.trim() || haystack.includes(query.trim().toLowerCase()))
        && (!selectedGovernorate || haystack.includes(selectedGovernorate.toLowerCase()))
        && (!selectedWilayat || haystack.includes(selectedWilayat.toLowerCase()))
        && (listing.rating ?? 0) >= minimumRating
        && (minimumBudgetValue === undefined || (price !== null && price >= minimumBudgetValue))
        && (maximumBudgetValue === undefined || (price !== null && price <= maximumBudgetValue));
    })
    .sort((a, b) => {
      const aPrice = amountFromText(a.price);
      const bPrice = amountFromText(b.price);
      if (sort === 'price_asc') return (aPrice ?? Number.MAX_SAFE_INTEGER) - (bPrice ?? Number.MAX_SAFE_INTEGER);
      if (sort === 'price_desc') return (bPrice ?? -1) - (aPrice ?? -1);
      if (sort === 'rating_desc') return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === 'oldest') return dateFromText(a.createdAt) - dateFromText(b.createdAt);
      return dateFromText(b.createdAt) - dateFromText(a.createdAt);
    }), [availableListings, maximumBudgetValue, minimumBudgetValue, minimumRating, query, selectedGovernorate, selectedWilayat, sort]);

  const sortOptions: Array<{ value: SortOption; label: string; labelAr: string }> = [
    { value: 'relevance', label: 'Best match', labelAr: 'الأفضل تطابقًا' },
    { value: 'rating_desc', label: 'Highest rated', labelAr: 'الأعلى تقييمًا' },
    ...(visibleMode === 'Properties' ? [
      { value: 'price_asc' as const, label: 'Lowest price', labelAr: 'السعر الأقل' },
      { value: 'price_desc' as const, label: 'Highest price', labelAr: 'السعر الأعلى' },
    ] : []),
    { value: 'newest', label: 'Newest', labelAr: 'الأحدث' },
    { value: 'oldest', label: 'Oldest', labelAr: 'الأقدم' },
  ];
  const selectedSortLabel = sortOptions.find((option) => option.value === sort);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <ScreenHeader title={isArabic ? 'اكتشف الخدمات' : 'Explore services'} subtitle={`${isArabic ? 'حول' : 'Around'} ${location.city}`} />
      {ads.data?.[0] && engagementClientId ? <AdBanner campaign={ads.data[0]} /> : null}
           {directory.isError ? <Text style={[styles.apiHint, { color: colors.mutedForeground }]}>{isArabic ? 'الخدمة غير متاحة مؤقتًا — نعرض الدليل المحفوظ.' : 'The live directory is unavailable — showing the saved directory.'}</Text> : null}
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
             <Pressable testID="governorate-filter" onPress={() => setLocationMenu(locationMenu === 'governorate' ? null : 'governorate')} style={[styles.locationFilter, { backgroundColor: colors.surface, borderColor: colors.border }]}>
               <Text numberOfLines={1} style={[styles.locationFilterText, { color: selectedGovernorate ? colors.foreground : colors.mutedForeground }]}>{selectedGovernorateInfo ? (isArabic ? selectedGovernorateInfo.nameAr : selectedGovernorateInfo.name) : (isArabic ? 'اختر المحافظة' : 'Governorate')}</Text>
               <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
             </Pressable>
             <Pressable testID="wilayat-filter" disabled={!selectedGovernorate} onPress={() => setLocationMenu(locationMenu === 'wilayat' ? null : 'wilayat')} style={[styles.locationFilter, { backgroundColor: colors.surface, borderColor: colors.border, opacity: selectedGovernorate ? 1 : 0.55 }]}>
                <Text numberOfLines={1} style={[styles.locationFilterText, { color: selectedWilayat ? colors.foreground : colors.mutedForeground }]}>{selectedWilayatInfo ? (isArabic ? selectedWilayatInfo.nameAr : selectedWilayatInfo.name) : (isArabic ? 'اختر الولاية' : 'Wilayat')}</Text>
               <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
             </Pressable>
             {[0, 3, 4].map((rating) => <Pressable testID={`rating-filter-${rating}`} key={rating} onPress={() => setMinimumRating(rating)} style={({ pressed }) => [styles.filterChip, { borderColor: minimumRating === rating ? colors.primary : colors.border, backgroundColor: minimumRating === rating ? colors.primarySoft : colors.surface }, pressed && styles.filterPressed]}>{rating ? <><Feather name="star" size={12} color={colors.star} fill={colors.star} /><Text style={{ color: colors.foreground }}>{rating}+</Text></> : <Text style={{ color: colors.foreground }}>{isArabic ? 'كل التقييمات' : 'Any rating'}</Text>}</Pressable>)}
             <Pressable testID="verified-filter" onPress={() => setVerifiedOnly((value) => !value)} style={({ pressed }) => [styles.filterChip, { borderColor: verifiedOnly ? colors.primary : colors.border, backgroundColor: verifiedOnly ? colors.primarySoft : colors.surface }, pressed && styles.filterPressed]}><Feather name="check-circle" size={13} color={verifiedOnly ? colors.primary : colors.mutedForeground} /><Text style={{ color: colors.foreground }}>{isArabic ? 'موثّق' : 'Verified'}</Text></Pressable>
          </View>
          {visibleMode === 'Properties' ? <View style={[styles.budgetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.budgetTitle, { color: colors.foreground }]}>{isArabic ? 'الميزانية (ر.ع.)' : 'Budget (OMR)'}</Text>
            <View style={styles.budgetInputs}>
              <TextInput testID="minimum-budget" value={minimumBudget} onChangeText={setMinimumBudget} keyboardType="decimal-pad" placeholder={isArabic ? 'الحد الأدنى' : 'Minimum'} placeholderTextColor={colors.mutedForeground} style={[styles.budgetInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              <Text style={{ color: colors.mutedForeground }}>—</Text>
              <TextInput testID="maximum-budget" value={maximumBudget} onChangeText={setMaximumBudget} keyboardType="decimal-pad" placeholder={isArabic ? 'الحد الأعلى' : 'Maximum'} placeholderTextColor={colors.mutedForeground} style={[styles.budgetInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
            </View>
            {!budgetRangeValid ? <Text style={styles.budgetError}>{isArabic ? 'يجب أن يكون الحد الأدنى أقل من الحد الأعلى.' : 'Minimum budget must not exceed maximum budget.'}</Text> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortOptions}>
              {sortOptions.map((option) => {
                const selected = sort === option.value;
                return <Pressable key={option.value} testID={`sort-${option.value}`} onPress={() => setSort(option.value)} style={({ pressed }) => [styles.sortChip, { backgroundColor: selected ? colors.primary : colors.background, borderColor: selected ? colors.primary : colors.border }, pressed && styles.filterPressed]}><Text style={[styles.sortChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{isArabic ? option.labelAr : option.label}</Text></Pressable>;
              })}
            </ScrollView>
          </View> : null}
          {visibleMode !== 'Properties' ? <View style={[styles.budgetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.budgetTitle, { color: colors.foreground }]}>{isArabic ? 'الترتيب' : 'Sort results'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortOptions}>
              {sortOptions.map((option) => {
                const selected = sort === option.value;
                return <Pressable key={option.value} testID={`sort-${option.value}`} onPress={() => setSort(option.value)} style={({ pressed }) => [styles.sortChip, { backgroundColor: selected ? colors.primary : colors.background, borderColor: selected ? colors.primary : colors.border }, pressed && styles.filterPressed]}><Text style={[styles.sortChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{isArabic ? option.labelAr : option.label}</Text></Pressable>;
              })}
            </ScrollView>
          </View> : null}
           {locationMenu ? <View style={[styles.locationMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
             <ScrollView nestedScrollEnabled style={styles.locationMenuScroll}>
               <Pressable testID="location-all" onPress={() => { setSelectedGovernorate(''); setSelectedWilayat(''); setLocationMenu(null); }} style={styles.locationOption}><Text style={{ color: colors.foreground }}>{isArabic ? 'كل عُمان' : 'All Oman'}</Text></Pressable>
               {locationOptions.map((item) => {
                 const value = 'wilayats' in item ? item.name : item.name;
                 const label = isArabic ? ('wilayats' in item ? item.nameAr : item.nameAr) : value;
                 return <Pressable key={value} testID={`location-option-${value}`} onPress={() => {
                   if ('wilayats' in item) {
                     setSelectedGovernorate(item.name);
                     setSelectedWilayat('');
                     setLocationMenu('wilayat');
                   } else {
                     setSelectedWilayat(item.name);
                     setLocationMenu(null);
                   }
                 }} style={styles.locationOption}><Text style={{ color: colors.foreground }}>{label}</Text></Pressable>;
               })}
             </ScrollView>
           </View> : null}
           {selectedService === 'building' ? <View style={styles.buildingSection}>
             <View style={styles.buildingHeading}>
               <View>
                 <Text style={[styles.buildingTitle, { color: colors.foreground }]}>{isArabic ? 'نوع ورشة البناء' : 'Building workshop type'}</Text>
                 <Text style={[styles.buildingSubtitle, { color: colors.mutedForeground }]}>{isArabic ? 'اختر الخدمة التي تحتاجها' : 'Choose the service you need'}</Text>
               </View>
               {selectedBuildingService ? <Pressable testID="clear-building-service" onPress={() => setSelectedBuildingService('')}><Text style={[styles.clearText, { color: colors.primary }]}>{isArabic ? 'مسح' : 'Clear'}</Text></Pressable> : null}
             </View>
             <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.buildingChips}>
               {buildingServices.map((service) => {
                 const selected = selectedBuildingService === service.name;
                 return <Pressable key={service.name} testID={`building-service-${service.name}`} onPress={() => setSelectedBuildingService(selected ? '' : service.name)} style={({ pressed }) => [styles.buildingChip, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }, pressed && styles.filterPressed]}>
                   <Text style={{ color: selected ? colors.primaryForeground : colors.foreground }}>{isArabic ? service.nameAr : service.name}</Text>
                 </Pressable>;
               })}
             </ScrollView>
           </View> : selectedService === 'design' ? <View style={styles.buildingSection}>
             <View style={styles.buildingHeading}>
               <View>
                 <Text style={[styles.buildingTitle, { color: colors.foreground }]}>{isArabic ? 'نوع المصمم' : 'Designer type'}</Text>
                 <Text style={[styles.buildingSubtitle, { color: colors.mutedForeground }]}>{isArabic ? 'اختر تخصص التصميم الذي تحتاجه' : 'Choose the design specialty you need'}</Text>
               </View>
               {selectedDesignService ? <Pressable testID="clear-design-service" onPress={() => setSelectedDesignService('')}><Text style={[styles.clearText, { color: colors.primary }]}>{isArabic ? 'مسح' : 'Clear'}</Text></Pressable> : null}
             </View>
             <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.buildingChips}>
               {designServices.map((service) => {
                 const selected = selectedDesignService === service.name;
                 return <Pressable key={service.name} testID={`design-service-${service.name}`} onPress={() => setSelectedDesignService(selected ? '' : service.name)} style={({ pressed }) => [styles.buildingChip, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }, pressed && styles.filterPressed]}>
                   <Text style={{ color: selected ? colors.primaryForeground : colors.foreground }}>{isArabic ? service.nameAr : service.name}</Text>
                 </Pressable>;
               })}
             </ScrollView>
           </View> : null}
            <SegmentedControl value={visibleMode} onChange={(nextMode) => {
             setMode(nextMode);
             setActiveService(nextMode === 'Properties' ? 'real-estate' : 'contractors');
            }} options={['Providers', 'Properties']} labels={{ Providers: isArabic ? 'المزودون' : 'Providers', Properties: isArabic ? 'العقارات' : 'Properties' }} />
           {visibleMode === 'Providers' ? (
            <View>
                <View style={styles.resultsHeader}><Text style={[styles.resultTitle, { color: colors.foreground }]}>{isArabic ? `${selectedServiceInfo.labelAr} قريبون منك` : `${selectedServiceInfo.label} near you`}</Text><View style={styles.sortRow}><Feather name="sliders" size={14} color={colors.primary} /><Text style={[styles.sortText, { color: colors.primary }]}>{isArabic ? selectedSortLabel?.labelAr : selectedSortLabel?.label}</Text></View></View>
                {directory.isLoading && !directory.data ? <View testID="contractors-loading">{[1, 2, 3].map((item) => <View key={item} style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.skeletonImage, { backgroundColor: colors.surfaceMuted }]} /><View style={styles.skeletonCopy}><View style={[styles.skeletonLine, { backgroundColor: colors.surfaceMuted, width: '72%' }]} /><View style={[styles.skeletonLine, { backgroundColor: colors.surfaceMuted, width: '52%' }]} /><View style={[styles.skeletonLine, { backgroundColor: colors.surfaceMuted, width: '38%' }]} /></View></View>)}</View> : null}
                {(!directory.isLoading || directory.data) ? filteredProviders.map((provider) => <ProviderCard key={provider.id} image={provider.image ?? require('@/assets/images/contractor-project.jpg')} name={isArabic ? provider.nameAr : provider.name} specialty={isArabic ? provider.specialtyAr : provider.specialty} rating={provider.rating} reviews={provider.reviews} distance={provider.distance} verified={provider.verified} saved={savedIds.includes(provider.id)} onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })} onSave={() => toggleSaved(provider.id)} />) : null}
                {!directory.isLoading && !filteredProviders.length ? <EmptyState icon="search" title={isArabic ? 'لم نجد ما يطابق بحثك' : 'Nothing matched your search'} description={isArabic ? 'جرّب تغيير الخدمة أو إزالة أحد الفلاتر.' : 'Try another service, location, or remove a filter.'} /> : null}
            </View>
          ) : (
            <View>
               <View style={styles.resultsHeader}><Text style={[styles.resultTitle, { color: colors.foreground }]}>{isArabic ? 'عقارات قريبة' : 'Properties nearby'}</Text><View style={styles.sortRow}><Feather name="sliders" size={14} color={colors.primary} /><Text style={[styles.sortText, { color: colors.primary }]}>{isArabic ? selectedSortLabel?.labelAr : selectedSortLabel?.label}</Text></View></View>
               <View style={styles.propertyGrid}>{filteredListings.map((listing) => <PropertyCard key={listing.id} listing={{ ...listing, title: isArabic ? listing.titleAr : listing.title, location: isArabic ? listing.locationAr : listing.location, type: isArabic ? listing.typeAr : listing.type }} saved={savedIds.includes(listing.id)} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: listing.id } })} onSave={() => toggleSaved(listing.id, { listing: true })} />)}</View>
               {!filteredListings.length ? <EmptyState icon="home" title={isArabic ? 'لا توجد عقارات ضمن الميزانية' : 'No properties in this budget'} description={isArabic ? 'جرّب تعديل الحد الأدنى أو الأعلى.' : 'Try changing the minimum or maximum budget.'} /> : null}
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
  searchInputWrap: { height: 56, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#08284A', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14 },
  chips: { gap: 9, paddingVertical: 16 },
  chip: { height: 42, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  chipText: { fontSize: 12, fontWeight: '700' },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 },
  resultTitle: { fontSize: 17, fontWeight: '800' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { fontSize: 11, fontWeight: '700' },
  propertyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  budgetCard: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 16, gap: 10 },
  budgetTitle: { fontSize: 13, fontWeight: '800' },
  budgetInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  budgetInput: { flex: 1, height: 42, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, fontSize: 13 },
  budgetError: { color: '#C83A4A', fontSize: 11, fontWeight: '600' },
  sortOptions: { gap: 8, paddingRight: 4 },
  sortChip: { minHeight: 36, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, justifyContent: 'center' },
  sortChipText: { fontSize: 11, fontWeight: '700' },
   locationFilter: { minWidth: 145, maxWidth: 175, height: 38, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
   locationFilterText: { flex: 1, fontSize: 12 },
   locationMenu: { borderWidth: 1, borderRadius: 16, marginTop: -8, marginBottom: 10, overflow: 'hidden', shadowColor: '#08284A', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
   locationMenuScroll: { maxHeight: 220 },
   locationOption: { minHeight: 42, paddingHorizontal: 14, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
   buildingSection: { marginBottom: 14 },
   buildingHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
   buildingTitle: { fontSize: 13, fontWeight: '800' },
   buildingSubtitle: { fontSize: 11, marginTop: 2 },
   clearText: { fontSize: 12, fontWeight: '800' },
   buildingChips: { gap: 8, paddingRight: 4 },
   buildingChip: { minHeight: 38, maxWidth: 250, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, justifyContent: 'center' },
   filterChip: { height: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
   filterPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
   skeletonCard: { minHeight: 102, borderRadius: 20, borderWidth: 1, padding: 11, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
   skeletonImage: { width: 78, height: 78, borderRadius: 16 },
   skeletonCopy: { flex: 1, gap: 10, marginLeft: 12 },
   skeletonLine: { height: 10, borderRadius: 5 },
  apiHint: { fontSize: 12, marginBottom: 10, lineHeight: 18 },
});