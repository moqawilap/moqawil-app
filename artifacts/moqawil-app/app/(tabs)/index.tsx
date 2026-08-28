import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, IconButton, PropertyCard, ProviderCard, SearchBar, SectionHeading, ServiceIcon } from '@/components/MoqawilUI';
import { listings, maintenanceItems, serviceItems } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isArabic, location, refreshLocation, savedIds, toggleSaved, setActiveService, managedProviders } = useApp();

  const openService = (id: string) => {
    setActiveService(id);
    router.push('/explore');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 120 }}>
        <View style={styles.content}>
          <View style={styles.header}>
            <BrandMark />
            <IconButton icon="bell" onPress={() => router.push('/profile')} accessibilityLabel="Open notifications" />
          </View>
          <Pressable onPress={refreshLocation} style={styles.locationButton}>
            <View style={[styles.locationPin, { backgroundColor: colors.primarySoft }]}><Feather name="map-pin" size={15} color={colors.primary} /></View>
            <View style={styles.locationText}><Text style={[styles.locationEyebrow, { color: colors.mutedForeground }]}>{isArabic ? 'تبحث في' : 'You are browsing in'}</Text><Text style={[styles.locationName, { color: colors.foreground }]}>{location.area}, {location.city}</Text></View>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </Pressable>
          <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.heroRule, { backgroundColor: colors.accentForeground }]} />
            <View style={styles.greeting}><Text style={[styles.eyebrow, { color: colors.primary }]}>{isArabic ? 'كل ما يخص العقار' : 'EVERYTHING PROPERTY'}</Text><Text style={[styles.title, { color: colors.foreground }]}>{isArabic ? 'ابنِ، اعثر، واعتنِ بمكانك.' : 'Build, find, and care for your place.'}</Text><Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{isArabic ? 'خدمات موثوقة في عمان، بالقرب منك.' : 'Trusted services in Oman, right around you.'}</Text></View>
            <SearchBar placeholder={isArabic ? 'ماذا تحتاج اليوم؟' : 'What do you need today?'} onPress={() => router.push('/explore')} />
          </View>
          <View style={styles.sectionBlock}>
            <SectionHeading title={isArabic ? 'ماذا تحتاج؟' : 'What do you need?'} subtitle={isArabic ? 'اختر خدمة للبدء' : 'Choose a service to get started'} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceRow}>
               {serviceItems.map((service) => <Pressable accessibilityRole="button" key={service.id} onPress={() => openService(service.id)} style={({ pressed }) => [styles.serviceCard, { backgroundColor: service.color }, pressed && styles.pressed]}><View style={styles.serviceIcon}><ServiceIcon icon={service.icon} color="#FFFFFF" size={24} /></View><Text style={styles.serviceLabel}>{isArabic ? service.labelAr : service.label}</Text><Text style={styles.serviceSubtitle}>{isArabic ? service.subtitleAr : service.subtitle}</Text><Feather name="arrow-up-right" size={16} color="rgba(255,255,255,0.75)" style={styles.serviceArrow} /></Pressable>)}
            </ScrollView>
          </View>
          <View style={[styles.locationBanner, { backgroundColor: colors.navy }]}>
            <View style={styles.bannerCopy}><View style={styles.liveDot}><View style={styles.liveDotInner} /></View><Text style={styles.bannerEyebrow}>{isArabic ? 'مصمم حولك' : 'MADE FOR YOUR AREA'}</Text><Text style={styles.bannerTitle}>{isArabic ? `أفضل الخيارات حول ${location.city}` : `The best options around ${location.city}`}</Text><Text style={styles.bannerSubtitle}>{isArabic ? 'نرتب النتائج حسب الموقع والتقييم.' : 'Ranked by distance and trusted reviews.'}</Text></View>
            <View style={styles.bannerShape}><Feather name="navigation" size={34} color="#21D8B7" /></View>
          </View>
          <View style={styles.sectionBlock}>
            <SectionHeading title={isArabic ? 'مزودون موصى بهم' : 'Recommended providers'} subtitle={isArabic ? 'قريبون منك في مسقط' : 'Trusted teams near you'} action={isArabic ? 'عرض الكل' : 'View all'} onAction={() => router.push('/explore')} />
            {managedProviders.slice(0, 2).map((provider) => <ProviderCard key={provider.id} image={provider.image} name={isArabic ? provider.nameAr : provider.name} specialty={isArabic ? provider.specialtyAr : provider.specialty} rating={provider.rating} reviews={provider.reviews} distance={provider.distance} verified={provider.verified} saved={savedIds.includes(provider.id)} onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })} onSave={() => toggleSaved(provider.id)} />)}
          </View>
          <View style={styles.sectionBlock}>
            <SectionHeading title={isArabic ? 'عقارات مختارة' : 'Featured properties'} subtitle={isArabic ? 'أماكن تستحق الزيارة' : 'Places worth seeing'} action={isArabic ? 'كل العقارات' : 'See all'} onAction={() => openService('real-estate')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propertyRow}>{listings.slice(0, 2).map((listing) => <PropertyCard key={listing.id} listing={{ ...listing, title: isArabic ? listing.titleAr : listing.title, location: isArabic ? listing.locationAr : listing.location, type: isArabic ? listing.typeAr : listing.type }} featured={listing.featured} saved={savedIds.includes(listing.id)} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: listing.id } })} onSave={() => toggleSaved(listing.id)} />)}</ScrollView>
          </View>
          <View style={styles.sectionBlock}>
            <SectionHeading title={isArabic ? 'صيانة سريعة' : 'Quick maintenance'} subtitle={isArabic ? 'حل المشكلة قبل أن تكبر' : 'Fix the small things before they grow'} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.maintenanceRow}>{maintenanceItems.map((item) => <Pressable key={item.id} onPress={() => openService('maintenance')} style={[styles.maintenanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.maintenanceIcon, { backgroundColor: `${item.color}18` }]}><ServiceIcon icon={item.icon} color={item.color} size={21} /></View><Text style={[styles.maintenanceLabel, { color: colors.foreground }]}>{isArabic ? item.labelAr : item.label}</Text></Pressable>)}</ScrollView>
          </View>
          <View style={styles.footer}><Image source={require('@/assets/images/moqawil-logo.png')} style={styles.footerMark} /><Text style={[styles.footerText, { color: colors.mutedForeground }]}>Moqawil · مقاول</Text></View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 17 },
  locationButton: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 23 },
  locationPin: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  locationText: { flex: 1, gap: 2 },
  locationEyebrow: { fontSize: 10 },
  locationName: { fontSize: 13, fontWeight: '800' },
   heroCard: { borderRadius: 24, borderWidth: 1, padding: 18, marginBottom: 2, shadowColor: '#08284A', shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
   heroRule: { width: 34, height: 4, borderRadius: 4, marginBottom: 17 },
   greeting: { gap: 7, marginBottom: 18 },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, fontWeight: '800' },
  title: { fontSize: 28, lineHeight: 33, fontWeight: '800', letterSpacing: -0.8, maxWidth: 345 },
  subtitle: { fontSize: 13, lineHeight: 19 },
  serviceRow: { gap: 11, paddingBottom: 5 },
  serviceCard: { width: 152, height: 150, borderRadius: 22, padding: 15, overflow: 'hidden', shadowColor: '#08284A', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  serviceIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  serviceLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  serviceSubtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 10, marginTop: 4 },
  serviceArrow: { position: 'absolute', right: 14, bottom: 14 },
  sectionBlock: { marginTop: 28 },
  locationBanner: { minHeight: 142, borderRadius: 23, padding: 20, marginTop: 28, flexDirection: 'row', overflow: 'hidden' },
  bannerCopy: { flex: 1, gap: 7, zIndex: 1 },
  liveDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(33,216,183,0.18)', alignItems: 'center', justifyContent: 'center' },
  liveDotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#21D8B7' },
  bannerEyebrow: { color: '#21D8B7', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  bannerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', maxWidth: 235, lineHeight: 22 },
  bannerSubtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  bannerShape: { position: 'absolute', right: -15, bottom: -18, width: 135, height: 135, borderRadius: 70, backgroundColor: 'rgba(15,111,183,0.58)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-25deg' }] },
  propertyRow: { paddingBottom: 4 },
  maintenanceRow: { gap: 10 },
  maintenanceCard: { width: 112, padding: 12, borderRadius: 17, borderWidth: 1, gap: 10 },
  maintenanceIcon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  maintenanceLabel: { fontSize: 11, fontWeight: '700' },
  footer: { alignItems: 'center', gap: 6, marginTop: 40, marginBottom: 8 },
  footerMark: { width: 31, height: 31, borderRadius: 9 },
  footerText: { fontSize: 10, fontWeight: '600' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
