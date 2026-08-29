import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, IconButton, PropertyCard, ProviderCard, SearchBar, SectionHeading, ServiceIcon } from '@/components/MoqawilUI';
import { listings, maintenanceItems, mergeMarketplaceListings, serviceItems } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getListListingsQueryKey, useListListings } from '@workspace/api-client-react';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isArabic, location, locationLoading, refreshLocation, savedIds, toggleSaved, setActiveService, managedProviders } = useApp();
  const remoteListings = useListListings({ query: { queryKey: getListListingsQueryKey() } });
  const availableListings = React.useMemo(() => mergeMarketplaceListings(remoteListings.data), [remoteListings.data]);

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
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? 'تحديد موقعي الحالي' : 'Detect my current location'} onPress={() => { refreshLocation().catch(() => undefined); }} style={[styles.locationButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.locationPin, { backgroundColor: colors.primarySoft }]}><Feather name="map-pin" size={15} color={colors.primary} /></View>
            <View style={styles.locationText}><Text style={[styles.locationEyebrow, { color: colors.mutedForeground }]}>{locationLoading ? (isArabic ? 'جارٍ تحديد موقعك…' : 'Detecting your location…') : location.source === 'default' ? (isArabic ? 'اضغط لتحديد موقعك الحالي' : 'Tap to detect your location') : (isArabic ? 'تبحث في موقعك الحالي' : 'You are browsing in your location')}</Text><Text style={[styles.locationName, { color: colors.foreground }]}>{location.area}, {location.city}</Text></View>
            <View style={[styles.locationAction, { backgroundColor: colors.primarySoft }]}><Feather name={locationLoading ? 'loader' : 'navigation'} size={13} color={colors.primary} /><Text style={[styles.locationActionText, { color: colors.primary }]}>{locationLoading ? (isArabic ? 'انتظر' : 'Wait') : location.source === 'default' ? (isArabic ? 'حدد موقعي' : 'Detect') : (isArabic ? 'تحديث' : 'Update')}</Text></View>
          </Pressable>
          <View style={[styles.heroCard, { backgroundColor: colors.navy, borderColor: '#C8A66A' }]}>
            <View style={[styles.heroRule, { backgroundColor: '#C8A66A' }]} />
            <View style={styles.greeting}>
              <Text style={[styles.eyebrow, { color: '#E0BD7A' }]}>{isArabic ? 'منظومة متكاملة للخدمات العقارية' : 'INTEGRATED PROPERTY SERVICES'}</Text>
              <Text style={[styles.title, isArabic && styles.arabicTitle, { color: '#FFFFFF' }]}>{isArabic ? 'حلول متكاملة لبناء وإدارة عقارك.' : 'Complete solutions to build and manage your property.'}</Text>
              <Text style={[styles.subtitle, isArabic && styles.arabicSubtitle, { color: '#D9E3EC' }]}>{isArabic ? 'نصل بك إلى نخبة المقاولين والاستشاريين ومقدمي الخدمات الموثوقين في سلطنة عُمان.' : 'Connect with trusted contractors, consultants, and service providers across Oman.'}</Text>
            </View>
            <SearchBar placeholder={isArabic ? 'ماذا تحتاج اليوم؟' : 'What do you need today?'} onPress={() => router.push('/explore')} />
          </View>
          <View style={styles.sectionBlock}>
            <SectionHeading title={isArabic ? 'ماذا تحتاج؟' : 'What do you need?'} subtitle={isArabic ? 'اختر خدمة للبدء' : 'Choose a service to get started'} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceRow}>
               {serviceItems.map((service) => <Pressable accessibilityRole="button" key={service.id} onPress={() => openService(service.id)} style={({ pressed }) => [styles.serviceCard, { backgroundColor: service.color }, pressed && styles.pressed]}><View style={styles.serviceIcon}><ServiceIcon icon={service.icon} color="#FFFFFF" size={24} /></View><Text style={styles.serviceLabel}>{isArabic ? service.labelAr : service.label}</Text><Text style={styles.serviceSubtitle}>{isArabic ? service.subtitleAr : service.subtitle}</Text><Feather name="arrow-up-right" size={16} color="rgba(255,255,255,0.75)" style={styles.serviceArrow} /></Pressable>)}
            </ScrollView>
          </View>
          <View style={[styles.locationBanner, { backgroundColor: colors.navy, borderColor: `${colors.primary}66` }, isArabic && styles.locationBannerArabic]}>
            <View style={styles.bannerTopline}>
              <View style={[styles.bannerToplineRule, { backgroundColor: colors.accentForeground }]} />
              <Text style={[styles.bannerEyebrow, { color: colors.accentForeground }]}>{isArabic ? 'الدليل المحلي الرسمي' : 'OFFICIAL LOCAL DIRECTORY'}</Text>
              <View style={[styles.bannerToplineRule, { backgroundColor: colors.accentForeground }]} />
            </View>
            <View style={styles.bannerMain}>
              <View style={[styles.bannerCopy, isArabic && styles.bannerCopyArabic]}>
                <View style={[styles.bannerStatus, isArabic && styles.bannerStatusArabic]}>
                  <View style={[styles.liveDot, { backgroundColor: `${colors.accentForeground}2E` }]}><View style={[styles.liveDotInner, { backgroundColor: colors.accentForeground }]} /></View>
                  <Text style={[styles.bannerStatusText, { color: colors.surfaceMuted }]}>{isArabic ? 'الموقع الحالي' : 'CURRENT LOCATION'}</Text>
                </View>
                <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86} style={styles.bannerTitle}>{isArabic ? `خدمات موثوقة بالقرب من ${location.area}` : `Trusted services near ${location.area}`}</Text>
                <Text numberOfLines={2} style={styles.bannerSubtitle}>{isArabic ? `مزودون معتمدون وخدمات مختارة في ${location.city}.` : `Verified professionals and selected services in ${location.city}.`}</Text>
              </View>
              <View style={[styles.bannerEmblem, { borderColor: `${colors.accentForeground}70`, backgroundColor: `${colors.primary}26` }]}>
                <View style={[styles.bannerEmblemInner, { borderColor: `${colors.accentForeground}45` }]}>
                  <Feather name="navigation" size={25} color={colors.accentForeground} />
                </View>
              </View>
            </View>
          </View>
          <View style={styles.sectionBlock}>
            <SectionHeading title={isArabic ? 'مزودون موصى بهم' : 'Recommended providers'} subtitle={isArabic ? 'قريبون منك في مسقط' : 'Trusted teams near you'} action={isArabic ? 'عرض الكل' : 'View all'} onAction={() => router.push('/explore')} />
            {managedProviders.slice(0, 2).map((provider) => <ProviderCard key={provider.id} image={provider.image} name={isArabic ? provider.nameAr : provider.name} specialty={isArabic ? provider.specialtyAr : provider.specialty} rating={provider.rating} reviews={provider.reviews} distance={provider.distance} verified={provider.verified} saved={savedIds.includes(provider.id)} onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })} onSave={() => toggleSaved(provider.id)} />)}
          </View>
          <View style={styles.sectionBlock}>
            <SectionHeading title={isArabic ? 'عقارات مختارة' : 'Featured properties'} subtitle={isArabic ? 'أماكن تستحق الزيارة' : 'Places worth seeing'} action={isArabic ? 'كل العقارات' : 'See all'} onAction={() => openService('real-estate')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propertyRow}>{availableListings.slice(0, 2).map((listing) => <PropertyCard key={listing.id} listing={{ ...listing, title: isArabic ? listing.titleAr : listing.title, location: isArabic ? listing.locationAr : listing.location, type: isArabic ? listing.typeAr : listing.type }} featured={listing.featured} saved={savedIds.includes(listing.id)} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: listing.id } })} onSave={() => toggleSaved(listing.id)} />)}</ScrollView>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  locationButton: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24, borderWidth: 1, borderRadius: 17, padding: 8 },
  locationPin: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  locationText: { flex: 1, gap: 2 },
  locationEyebrow: { fontSize: 10 },
  locationName: { fontSize: 13, fontWeight: '800' },
  locationAction: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  locationActionText: { fontSize: 10, fontWeight: '800' },
   heroCard: { borderRadius: 28, borderWidth: 1, padding: 21, marginBottom: 2, shadowColor: '#092A45', shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
   heroRule: { width: 52, height: 4, borderRadius: 4, marginBottom: 19 },
   greeting: { gap: 9, marginBottom: 21 },
   eyebrow: { fontSize: 10, letterSpacing: 1.6, fontWeight: '800' },
  title: { fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }), fontSize: 30, lineHeight: 37, fontWeight: '700', letterSpacing: -0.25, maxWidth: 345 },
  arabicTitle: { fontFamily: Platform.select({ android: 'sans-serif', ios: 'System', default: 'sans-serif' }), fontWeight: '700', letterSpacing: 0, lineHeight: 37, textAlign: 'right' },
  subtitle: { fontSize: 14, lineHeight: 21 },
  arabicSubtitle: { fontFamily: Platform.select({ android: 'sans-serif', ios: 'System', default: 'sans-serif' }), fontWeight: '500', lineHeight: 22, textAlign: 'right' },
  serviceRow: { gap: 13, paddingBottom: 7 },
  serviceCard: { width: 158, height: 158, borderRadius: 24, padding: 17, overflow: 'hidden', shadowColor: '#092A45', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  serviceIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  serviceLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },
  serviceSubtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 10, marginTop: 4 },
  serviceArrow: { position: 'absolute', right: 14, bottom: 14 },
  sectionBlock: { marginTop: 32 },
  locationBanner: { minHeight: 174, borderRadius: 26, borderWidth: 1, paddingHorizontal: 19, paddingTop: 17, paddingBottom: 19, marginTop: 32, overflow: 'hidden', shadowColor: '#092A45', shadowOpacity: 0.19, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 4 },
  locationBannerArabic: { paddingHorizontal: 17 },
  bannerTopline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  bannerToplineRule: { width: 20, height: 1 },
  bannerEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.05 },
  bannerMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  bannerCopy: { flex: 1, gap: 7, zIndex: 1, paddingRight: 13 },
  bannerCopyArabic: { paddingRight: 0, paddingLeft: 13, alignItems: 'flex-end' },
  bannerStatus: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bannerStatusArabic: { flexDirection: 'row-reverse' },
  liveDot: { width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  liveDotInner: { width: 6, height: 6, borderRadius: 3 },
  bannerStatusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.85 },
  bannerTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', maxWidth: 245, lineHeight: 24, letterSpacing: -0.25 },
  bannerSubtitle: { color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 16 },
  bannerEmblem: { width: 69, height: 69, borderRadius: 35, borderWidth: 1, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }] },
  bannerEmblemInner: { width: 51, height: 51, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '12deg' }] },
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
