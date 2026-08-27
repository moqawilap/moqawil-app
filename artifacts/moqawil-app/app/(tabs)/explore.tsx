import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProviderCard, PropertyCard, ScreenHeader, SegmentedControl, ServiceIcon } from '@/components/MoqawilUI';
import { listings, providers, serviceItems } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function ExploreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isArabic, location, savedIds, toggleSaved, activeService, setActiveService } = useApp();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('Providers');
  const selectedService = activeService ?? 'contractors';

  const filteredProviders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return providers.filter((provider) => !normalized || `${provider.name} ${provider.specialty}`.toLowerCase().includes(normalized));
  }, [query]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <ScreenHeader title={isArabic ? 'اكتشف الخدمات' : 'Explore services'} subtitle={`${isArabic ? 'حول' : 'Around'} ${location.city}`} />
          <View style={[styles.searchInputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <TextInput value={query} onChangeText={setQuery} placeholder={isArabic ? 'ابحث عن خدمة أو مزود' : 'Search a service or provider'} placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} />
            {query ? <Pressable onPress={() => setQuery('')}><Feather name="x-circle" size={17} color={colors.mutedForeground} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {serviceItems.map((service) => {
              const selected = selectedService === service.id;
              return <Pressable key={service.id} onPress={() => setActiveService(service.id)} style={[styles.chip, { borderColor: selected ? service.color : colors.border, backgroundColor: selected ? service.color : colors.surface }]}>
                <ServiceIcon icon={service.icon} color={selected ? '#FFFFFF' : service.color} size={17} />
                <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.foreground }]}>{isArabic ? service.labelAr : service.label}</Text>
              </Pressable>;
            })}
          </ScrollView>
          <SegmentedControl value={mode} onChange={setMode} options={['Providers', 'Properties']} />
          {mode === 'Providers' ? (
            <View>
              <View style={styles.resultsHeader}><Text style={[styles.resultTitle, { color: colors.foreground }]}>{isArabic ? 'مزودون موصى بهم' : 'Recommended providers'}</Text><View style={styles.sortRow}><Feather name="sliders" size={14} color={colors.primary} /><Text style={[styles.sortText, { color: colors.primary }]}>Best match</Text></View></View>
              {filteredProviders.map((provider) => <ProviderCard key={provider.id} image={provider.image} name={isArabic ? provider.nameAr : provider.name} specialty={isArabic ? provider.specialtyAr : provider.specialty} rating={provider.rating} reviews={provider.reviews} distance={provider.distance} verified={provider.verified} saved={savedIds.includes(provider.id)} onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })} onSave={() => toggleSaved(provider.id)} />)}
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
});