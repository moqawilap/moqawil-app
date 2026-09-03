import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, IconButton, PropertyCard, ProviderCard, SearchBar, SectionHeading, ServiceIcon } from '@/components/MoqawilUI';
import { AdBanner } from '@/components/AdBanner';
import { listings, maintenanceItems, mergeMarketplaceListings, serviceItems } from '@/data/mockData';
import { omanGovernorates } from '@/data/omanLocations';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getGetHomepageSettingsQueryKey, getListAdsQueryKey, getListListingsQueryKey, useGetHomepageSettings, useListAds, useListListings, type HomepageSettings } from '@workspace/api-client-react';

type HomepageSectionId = HomepageSettings['sectionOrder'][number];

const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  showSponsoredAds: true,
  hero: {
    visible: true,
    eyebrowEn: 'INTEGRATED PROPERTY SERVICES',
    eyebrowAr: 'منظومة متكاملة للخدمات العقارية',
    titleEn: 'Complete solutions to build and manage your property.',
    titleAr: 'حلول متكاملة لبناء وإدارة عقارك.',
    subtitleEn: 'Connect with trusted contractors, consultants, and service providers across Oman.',
    subtitleAr: 'نصل بك إلى نخبة المقاولين والاستشاريين ومقدمي الخدمات الموثوقين في سلطنة عُمان.',
    searchPlaceholderEn: 'What do you need today?',
    searchPlaceholderAr: 'ماذا تحتاج اليوم؟',
  },
  sectionOrder: ['services', 'location', 'providers', 'properties', 'maintenance'],
  sections: {
    services: { visible: true, titleEn: 'What do you need?', titleAr: 'ماذا تحتاج؟', subtitleEn: 'Choose a service to get started', subtitleAr: 'اختر خدمة للبدء', detailEn: '', detailAr: '', actionEn: '', actionAr: '', limit: 6 },
    location: { visible: true, titleEn: 'OFFICIAL LOCAL DIRECTORY', titleAr: 'الدليل المحلي الرسمي', subtitleEn: 'Trusted services near {area}', subtitleAr: 'خدمات موثوقة بالقرب من {area}', detailEn: 'Verified professionals and selected services in {city}.', detailAr: 'مزودون معتمدون وخدمات مختارة في {city}.', actionEn: 'CURRENT LOCATION', actionAr: 'الموقع الحالي', limit: 1 },
    providers: { visible: true, titleEn: 'Recommended providers', titleAr: 'مزودون موصى بهم', subtitleEn: 'Trusted teams near you', subtitleAr: 'قريبون منك في مسقط', detailEn: '', detailAr: '', actionEn: 'View all', actionAr: 'عرض الكل', limit: 2 },
    properties: { visible: true, titleEn: 'Featured properties', titleAr: 'عقارات مختارة', subtitleEn: 'Places worth seeing', subtitleAr: 'أماكن تستحق الزيارة', detailEn: '', detailAr: '', actionEn: 'See all', actionAr: 'كل العقارات', limit: 2 },
    maintenance: { visible: true, titleEn: 'Quick maintenance', titleAr: 'صيانة سريعة', subtitleEn: 'Fix the small things before they grow', subtitleAr: 'حل المشكلة قبل أن تكبر', detailEn: '', detailAr: '', actionEn: '', actionAr: '', limit: 4 },
  },
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isArabic, location, locationLoading, refreshLocation, selectLocation, savedIds, toggleSaved, setActiveService, managedProviders, engagementClientId } = useApp();
  const [locationPickerVisible, setLocationPickerVisible] = React.useState(false);
  const remoteListings = useListListings({ query: { queryKey: getListListingsQueryKey() } });
  const homepageSettingsQuery = useGetHomepageSettings({ query: { queryKey: getGetHomepageSettingsQueryKey(), staleTime: 30_000 } });
  const homepage = homepageSettingsQuery.data ?? DEFAULT_HOMEPAGE_SETTINGS;
  const locationWilayats = location.city === 'Muscat' && location.area === 'Al Khuwair' ? [location.area, 'Bawshar'] : [location.area];
  const adQuery = { city: location.city, wilayat: locationWilayats.filter(Boolean).join(','), limit: 5 };
  const ads = useListAds(adQuery, { query: { queryKey: getListAdsQueryKey(adQuery), refetchInterval: 30_000 } });
  const [activeAdIndex, setActiveAdIndex] = React.useState(0);
  const availableListings = React.useMemo(() => mergeMarketplaceListings(remoteListings.data), [remoteListings.data]);
  React.useEffect(() => {
    setActiveAdIndex(0);
  }, [location.city, ads.data?.length]);
  React.useEffect(() => {
    if (!ads.data || ads.data.length < 2) return;
    const timer = setInterval(() => setActiveAdIndex((current) => (current + 1) % ads.data!.length), 5000);
    return () => clearInterval(timer);
  }, [ads.data]);

  const openService = (id: string) => {
    setActiveService(id);
    router.push('/explore');
  };
  const localized = (english: string, arabic: string) => isArabic ? arabic : english;
  const withLocation = (value: string) => value.replaceAll('{area}', location.area).replaceAll('{city}', location.city);
  const openSocialLink = (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, url.startsWith('mailto:') ? '_self' : '_blank', 'noopener,noreferrer');
      return;
    }
    void Linking.openURL(url);
  };
  const chooseLocation = (city: string, area: string) => {
    selectLocation({ city, area });
    setLocationPickerVisible(false);
  };
  const useCurrentLocation = async () => {
    setLocationPickerVisible(false);
    await refreshLocation();
  };
  const renderSection = (id: HomepageSectionId) => {
    const section = homepage.sections[id];
    if (!section?.visible) return null;
    if (id === 'services') {
      return (
        <View key={id} style={styles.sectionBlock}>
          <SectionHeading title={localized(section.titleEn, section.titleAr)} subtitle={localized(section.subtitleEn, section.subtitleAr)} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceRow}>
            {serviceItems.slice(0, section.limit).map((service) => <Pressable accessibilityRole="button" key={service.id} onPress={() => openService(service.id)} style={({ pressed }) => [styles.serviceCard, { backgroundColor: service.color }, pressed && styles.pressed]}><View style={styles.serviceIcon}><ServiceIcon icon={service.icon} color="#FFFFFF" size={24} /></View><Text style={styles.serviceLabel}>{isArabic ? service.labelAr : service.label}</Text><Text style={styles.serviceSubtitle}>{isArabic ? service.subtitleAr : service.subtitle}</Text><Feather name="arrow-up-right" size={16} color="rgba(255,255,255,0.75)" style={styles.serviceArrow} /></Pressable>)}
          </ScrollView>
        </View>
      );
    }
    if (id === 'location') {
      return (
        <View key={id} style={[styles.locationBanner, { backgroundColor: colors.navy, borderColor: `${colors.primary}66` }, isArabic && styles.locationBannerArabic]}>
          <View style={styles.bannerTopline}>
            <View style={[styles.bannerToplineRule, { backgroundColor: colors.accentForeground }]} />
            <Text style={[styles.bannerEyebrow, { color: colors.accentForeground }]}>{localized(section.titleEn, section.titleAr)}</Text>
            <View style={[styles.bannerToplineRule, { backgroundColor: colors.accentForeground }]} />
          </View>
          <View style={styles.bannerMain}>
            <View style={[styles.bannerCopy, isArabic && styles.bannerCopyArabic]}>
              <View style={[styles.bannerStatus, isArabic && styles.bannerStatusArabic]}>
                <View style={[styles.liveDot, { backgroundColor: `${colors.accentForeground}2E` }]}><View style={[styles.liveDotInner, { backgroundColor: colors.accentForeground }]} /></View>
                <Text style={[styles.bannerStatusText, { color: colors.surfaceMuted }]}>{localized(section.actionEn, section.actionAr)}</Text>
              </View>
              <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86} style={styles.bannerTitle}>{withLocation(localized(section.subtitleEn, section.subtitleAr))}</Text>
              <Text numberOfLines={2} style={styles.bannerSubtitle}>{withLocation(localized(section.detailEn, section.detailAr))}</Text>
            </View>
            <View style={[styles.bannerEmblem, { borderColor: `${colors.accentForeground}70`, backgroundColor: `${colors.primary}26` }]}>
              <View style={[styles.bannerEmblemInner, { borderColor: `${colors.accentForeground}45` }]}><Feather name="navigation" size={25} color={colors.accentForeground} /></View>
            </View>
          </View>
        </View>
      );
    }
    if (id === 'providers') {
      return (
        <View key={id} style={styles.sectionBlock}>
          <SectionHeading title={localized(section.titleEn, section.titleAr)} subtitle={localized(section.subtitleEn, section.subtitleAr)} action={localized(section.actionEn, section.actionAr) || undefined} onAction={() => router.push('/explore')} />
          {managedProviders.slice(0, section.limit).map((provider) => <ProviderCard key={provider.id} image={provider.image} name={isArabic ? provider.nameAr : provider.name} specialty={isArabic ? provider.specialtyAr : provider.specialty} rating={provider.rating} reviews={provider.reviews} distance={provider.distance} verified={provider.verified} saved={savedIds.includes(provider.id)} onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })} onSave={() => toggleSaved(provider.id)} />)}
        </View>
      );
    }
    if (id === 'properties') {
      return (
        <View key={id} style={styles.sectionBlock}>
          <SectionHeading title={localized(section.titleEn, section.titleAr)} subtitle={localized(section.subtitleEn, section.subtitleAr)} action={localized(section.actionEn, section.actionAr) || undefined} onAction={() => openService('real-estate')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propertyRow}>{availableListings.slice(0, section.limit).map((listing) => <PropertyCard key={listing.id} listing={{ ...listing, title: isArabic ? listing.titleAr : listing.title, location: isArabic ? listing.locationAr : listing.location, type: isArabic ? listing.typeAr : listing.type }} featured={listing.featured} saved={savedIds.includes(listing.id)} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: listing.id } })} onSave={() => toggleSaved(listing.id, { listing: true })} />)}</ScrollView>
        </View>
      );
    }
    return (
      <View key={id} style={styles.sectionBlock}>
        <SectionHeading title={localized(section.titleEn, section.titleAr)} subtitle={localized(section.subtitleEn, section.subtitleAr)} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.maintenanceRow}>{maintenanceItems.slice(0, section.limit).map((item) => <Pressable key={item.id} onPress={() => openService('maintenance')} style={[styles.maintenanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.maintenanceIcon, { backgroundColor: `${item.color}18` }]}><ServiceIcon icon={item.icon} color={item.color} size={21} /></View><Text style={[styles.maintenanceLabel, { color: colors.foreground }]}>{isArabic ? item.labelAr : item.label}</Text></Pressable>)}</ScrollView>
      </View>
    );
  };
  const socialLinks = [
    { icon: 'whatsapp' as const, label: isArabic ? 'واتساب' : 'WhatsApp', url: 'https://wa.me/96877224535' },
    { icon: 'mail' as const, label: isArabic ? 'البريد' : 'Email', url: 'mailto:moqawil.ap@gmail.com' },
    { icon: 'instagram' as const, label: 'Instagram', url: 'https://instagram.com/moqawil.om' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 120 }}>
        <View style={styles.content}>
          <View style={styles.header}>
            <BrandMark />
            <IconButton icon="bell" onPress={() => router.push('/profile')} accessibilityLabel="Open notifications" />
          </View>
          <Pressable accessibilityRole="button" testID="home-location-picker" accessibilityLabel={isArabic ? 'تغيير أو تحديد موقعك' : 'Change or detect your location'} onPress={() => setLocationPickerVisible(true)} style={[styles.locationButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.locationPin, { backgroundColor: colors.primarySoft }]}><Feather name="map-pin" size={15} color={colors.primary} /></View>
            <View style={styles.locationText}><Text style={[styles.locationEyebrow, { color: colors.mutedForeground }]}>{locationLoading ? (isArabic ? 'جارٍ تحديد موقعك…' : 'Detecting your location…') : location.source === 'default' ? (isArabic ? 'اضغط لاختيار موقعك' : 'Tap to choose your location') : location.source === 'manual' ? (isArabic ? 'تتصفح الموقع المختار' : 'Browsing selected location') : (isArabic ? 'تتصفح موقعك الحالي' : 'Browsing your current location')}</Text><Text style={[styles.locationName, { color: colors.foreground }]}>{location.area}, {location.city}</Text></View>
            <View style={[styles.locationAction, { backgroundColor: colors.primarySoft }]}><Feather name={locationLoading ? 'loader' : 'chevron-down'} size={13} color={colors.primary} /><Text style={[styles.locationActionText, { color: colors.primary }]}>{locationLoading ? (isArabic ? 'انتظر' : 'Wait') : (isArabic ? 'تغيير' : 'Change')}</Text></View>
          </Pressable>
          <Modal visible={locationPickerVisible} transparent animationType="slide" onRequestClose={() => setLocationPickerVisible(false)}>
            <View style={styles.locationModalBackdrop}>
              <View style={[styles.locationModal, { backgroundColor: colors.background }]}>
                <View style={styles.locationModalHeader}>
                  <View style={styles.locationModalHeading}>
                    <Text style={[styles.locationModalTitle, { color: colors.foreground }]}>{isArabic ? 'اختر موقع التصفح' : 'Choose browsing location'}</Text>
                    <Text style={[styles.locationModalSubtitle, { color: colors.mutedForeground }]}>{isArabic ? 'يمكنك تغيير الموقع في أي وقت' : 'You can change this anytime'}</Text>
                  </View>
                  <Pressable testID="close-location-picker" accessibilityRole="button" accessibilityLabel={isArabic ? 'إغلاق' : 'Close'} onPress={() => setLocationPickerVisible(false)} style={[styles.locationClose, { backgroundColor: colors.surface, borderColor: colors.border }]}><Feather name="x" size={18} color={colors.foreground} /></Pressable>
                </View>
                <Pressable testID="detect-current-location" accessibilityRole="button" accessibilityLabel={isArabic ? 'السماح للتطبيق بالوصول إلى موقعك الحالي' : 'Allow the app to access your current location'} onPress={() => { useCurrentLocation().catch(() => undefined); }} style={[styles.detectLocationButton, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
                  <View style={[styles.detectLocationIcon, { backgroundColor: colors.primary }]}><Feather name="navigation" size={15} color={colors.primaryForeground} /></View>
                  <View style={styles.detectLocationCopy}><Text style={[styles.detectLocationTitle, { color: colors.foreground }]}>{isArabic ? 'استخدم موقعي الحالي' : 'Use my current location'}</Text><Text style={[styles.detectLocationSubtitle, { color: colors.mutedForeground }]}>{isArabic ? 'تحديد الموقع تلقائيًا عبر GPS' : 'Detect automatically with GPS'}</Text></View>
                  <Feather name="chevron-right" size={17} color={colors.primary} />
                </Pressable>
                <Text style={[styles.locationListTitle, { color: colors.foreground }]}>{isArabic ? 'كل الولايات' : 'All wilayats'}</Text>
                <ScrollView style={styles.locationList} contentContainerStyle={styles.locationListContent} showsVerticalScrollIndicator={false}>
                  {omanGovernorates.map((governorate) => (
                    <View key={governorate.name} style={styles.locationGroup}>
                      <Text style={[styles.locationGovernorate, { color: colors.primary }]}>{isArabic ? governorate.nameAr : governorate.name}</Text>
                      <View style={styles.wilayatGrid}>
                        {governorate.wilayats.map((wilayat) => {
                          const selected = location.city === governorate.name && location.area === wilayat.name;
                          return <Pressable key={wilayat.name} testID={`home-location-${wilayat.name}`} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => chooseLocation(governorate.name, wilayat.name)} style={[styles.wilayatOption, { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border }, selected && { backgroundColor: colors.primarySoft }]}><Text style={[styles.wilayatText, { color: colors.foreground }]}>{isArabic ? wilayat.nameAr : wilayat.name}</Text>{selected ? <Feather name="check" size={15} color={colors.primary} /> : null}</Pressable>;
                        })}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
          {homepage.hero.visible ? <View style={[styles.heroCard, { backgroundColor: colors.navy, borderColor: '#C8A66A' }]}>
            <View style={[styles.heroRule, { backgroundColor: '#C8A66A' }]} />
            <View style={styles.greeting}>
              <Text style={[styles.eyebrow, { color: '#E0BD7A' }]}>{localized(homepage.hero.eyebrowEn, homepage.hero.eyebrowAr)}</Text>
              <Text style={[styles.title, isArabic && styles.arabicTitle, { color: '#FFFFFF' }]}>{localized(homepage.hero.titleEn, homepage.hero.titleAr)}</Text>
              <Text style={[styles.subtitle, isArabic && styles.arabicSubtitle, { color: '#D9E3EC' }]}>{localized(homepage.hero.subtitleEn, homepage.hero.subtitleAr)}</Text>
            </View>
            <SearchBar placeholder={localized(homepage.hero.searchPlaceholderEn, homepage.hero.searchPlaceholderAr)} onPress={() => router.push('/explore')} />
          </View> : null}
          {homepage.showSponsoredAds && ads.data?.[activeAdIndex] && engagementClientId ? <AdBanner campaign={ads.data[activeAdIndex]} /> : null}
          {homepage.sectionOrder.map(renderSection)}
           <View style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
             <Text style={[styles.aboutEyebrow, { color: colors.primary }]}>{isArabic ? 'عن مقاول' : 'ABOUT MOQAWIL'}</Text>
             <Text style={[styles.aboutTitle, { color: colors.foreground }]}>{isArabic ? 'منصة واحدة لكل احتياجات البناء والعقارات.' : 'One platform for all your building and property needs.'}</Text>
             <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>{isArabic ? 'مقاول منصة عُمانية تجمع العملاء بالمقاولين والورش ومقدمي خدمات الصيانة والعقارات، وتساعدك على العثور على الخدمة المناسبة والتواصل مع مقدمي الخدمة الموثوقين بسهولة.' : 'Moqawil is an Omani marketplace that connects customers with trusted contractors, workshops, maintenance providers, and property listings. Discover the right service, compare providers, and get in touch with confidence.'}</Text>
             <View style={styles.homeSocialLinks}>
               {socialLinks.map((item) => (
                  <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} hitSlop={8} onPress={() => openSocialLink(item.url)} style={({ pressed }) => [styles.homeSocialLink, { backgroundColor: colors.surface, borderColor: colors.primary }, pressed && styles.pressed]}>
                    {item.icon === 'mail' ? <Feather name="mail" size={19} color={colors.primary} /> : <MaterialCommunityIcons name={item.icon} size={19} color={colors.primary} />}
                 </Pressable>
               ))}
             </View>
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
  locationModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9,42,69,0.48)' },
  locationModal: { maxHeight: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18, paddingBottom: Platform.OS === 'web' ? 34 : 22 },
  locationModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  locationModalHeading: { flex: 1, gap: 3 },
  locationModalTitle: { fontSize: 21, fontWeight: '800' },
  locationModalSubtitle: { fontSize: 12 },
  locationClose: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  detectLocationButton: { minHeight: 68, borderRadius: 18, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  detectLocationIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  detectLocationCopy: { flex: 1, gap: 3 },
  detectLocationTitle: { fontSize: 14, fontWeight: '800' },
  detectLocationSubtitle: { fontSize: 11 },
  locationListTitle: { fontSize: 15, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  locationList: { flexGrow: 0 },
  locationListContent: { paddingBottom: 18 },
  locationGroup: { marginBottom: 18, gap: 9 },
  locationGovernorate: { fontSize: 12, fontWeight: '800' },
  wilayatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wilayatOption: { minHeight: 42, borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: '47%', flexGrow: 1, flexBasis: '47%' },
  wilayatText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
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
  aboutCard: { marginTop: 34, borderWidth: 1, borderRadius: 20, padding: 18, gap: 8 },
  aboutEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  aboutTitle: { fontSize: 18, lineHeight: 25, fontWeight: '800' },
  aboutText: { fontSize: 13, lineHeight: 21 },
  homeSocialLinks: { flexDirection: 'row', gap: 5, marginTop: 7, justifyContent: 'flex-start' },
  homeSocialLink: { width: 40, height: 40, borderWidth: 1.5, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: 6, marginTop: 40, marginBottom: 8 },
  footerMark: { width: 31, height: 31, borderRadius: 9 },
  footerText: { fontSize: 10, fontWeight: '600' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
