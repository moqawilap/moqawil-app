import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/expo';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, BrandMark, ScreenHeader } from '@/components/MoqawilUI';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getGetMeQueryKey, getGetMySubscriptionQueryKey, useGetMe, useGetMySubscription } from '@workspace/api-client-react';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { locale, setLocale, location, refreshLocation, isArabic, savedIds } = useApp();
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const me = useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled: !!isSignedIn, retry: false } });
  const metadata = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const isAdmin = metadata.role === 'admin' || metadata.isAdmin === true || user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() === 'moqawil.ap@gmail.com';
  const isContractor = metadata.role === 'contractor' || metadata.isContractor === true || me.data?.role === 'contractor';
  const subscription = useGetMySubscription({ query: { queryKey: getGetMySubscriptionQueryKey(), enabled: !!isSignedIn && isContractor } });
  const menu = [
     { icon: 'map-pin' as const, title: isArabic ? 'موقعك الحالي' : 'Current location', value: location.source === 'default' ? (isArabic ? 'اضغط للسماح بتحديد موقعك' : 'Tap to allow location access') : `${location.area}, ${location.city}`, onPress: refreshLocation },
    { icon: 'bell' as const, title: isArabic ? 'الإشعارات' : 'Notifications', value: isArabic ? 'مفعّلة' : 'On', onPress: () => router.push('/notifications' as never) },
     ...(isSignedIn ? [{ icon: 'edit-3' as const, title: isArabic ? 'أحتاج خدمة' : 'I need a service', value: isArabic ? 'أرسل طلبًا لعدة ورش' : 'Ask multiple workshops', onPress: () => router.push('/service-request' as never) }, { icon: 'clipboard' as const, title: isArabic ? 'طلباتي وعروضي' : 'My requests & quotes', value: isArabic ? 'قارن واختر العرض المناسب' : 'Compare and choose a quote', onPress: () => router.push('/requests' as never) }] : []),
    ...(isSignedIn && isAdmin ? [{ icon: 'shield' as const, title: isArabic ? 'لوحة الإدارة' : 'Admin console', value: isArabic ? 'المقاولون والتقييمات' : 'Contractors & evaluations', onPress: () => router.push('/admin') }] : []),
    ...(isContractor ? [{ icon: 'credit-card' as const, title: isArabic ? 'اشتراكي' : 'My subscription', value: subscription.data ? `${subscription.data.planName} · ${subscription.data.priceOmaniRial} OMR / ${subscription.data.billingMonths === 12 ? (isArabic ? 'سنة' : 'year') : `${subscription.data.billingMonths} ${isArabic ? 'أشهر' : 'months'}`}` : (isArabic ? 'جاري تحميل الخطة…' : 'Plan details loading…'), onPress: () => router.push('/subscription' as never) }] : []),
    ...(isSignedIn && !isAdmin ? [{ icon: 'briefcase' as const, title: isContractor ? (isArabic ? 'إدارة ملف المقاول' : 'Manage contractor profile') : (isArabic ? 'انضم كمقاول' : 'Join as contractor'), value: '', onPress: () => router.push('/contractor-profile' as never) }] : []),
     ...(isSignedIn && isContractor ? [{ icon: 'inbox' as const, title: isArabic ? 'طلبات الورشة' : 'Workshop requests', value: isArabic ? 'استقبل وأرسل عروض الأسعار' : 'Review requests and send quotes', onPress: () => router.push('/workshop-requests' as never) }] : []),
  ];
   const socialLinks = [
     { icon: 'whatsapp' as const, title: isArabic ? 'واتساب' : 'WhatsApp', onPress: () => Linking.openURL('https://wa.me/96877224535') },
     { icon: 'email-outline' as const, title: isArabic ? 'البريد الإلكتروني' : 'Email', onPress: () => Linking.openURL('mailto:moqawil.ap@gmail.com') },
     { icon: 'instagram' as const, title: 'Instagram', onPress: () => Linking.openURL('https://instagram.com/moqawil.om') },
   ];
  const profileName = user?.fullName || (isSignedIn ? user?.primaryEmailAddress?.emailAddress : null) || (isArabic ? 'مستخدم مقاول' : 'Moqawil user');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <ScreenHeader title={isArabic ? 'الحساب' : 'Profile'} subtitle={isArabic ? 'إعداداتك وتفضيلاتك' : 'Your settings and preferences'} />
          <View style={[styles.profileCard, { backgroundColor: colors.navy }]}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{profileName.charAt(0).toUpperCase()}</Text></View>
            <View style={styles.profileText}><Text style={styles.profileName}>{profileName}</Text><Text style={styles.profileSub}>{isAdmin ? 'Administrator account' : isArabic ? 'استكشف خدمات عمان بثقة' : 'Explore Oman with confidence'}</Text></View>
            <Feather name="edit-2" size={17} color="rgba(255,255,255,0.7)" />
          </View>
          <View style={styles.languageHeading}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{isArabic ? 'اللغة' : 'Language'}</Text><Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{isArabic ? 'اختر لغة التطبيق' : 'Choose your app language'}</Text></View>
          <View style={[styles.languageRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(['en', 'ar'] as const).map((item) => <Pressable key={item} onPress={() => setLocale(item)} style={[styles.languageOption, locale === item && { backgroundColor: colors.primarySoft }]}><Text style={[styles.languageCode, { color: locale === item ? colors.primary : colors.mutedForeground }]}>{item === 'en' ? 'EN' : 'عربي'}</Text><Text style={[styles.languageLabel, { color: locale === item ? colors.foreground : colors.mutedForeground }]}>{item === 'en' ? 'English' : 'العربية'}</Text>{locale === item ? <Feather name="check-circle" size={16} color={colors.primary} /> : null}</Pressable>)}
          </View>
           <View style={styles.socialHeading}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{isArabic ? 'روابط التواصل' : 'Social Links'}</Text><Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{isArabic ? 'تواصل معنا مباشرة' : 'Connect with us directly'}</Text></View>
           <View style={styles.socialLinksRow}>
             {socialLinks.map((item) => (
               <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={item.title} onPress={item.onPress} style={({ pressed }) => [styles.socialLink, { backgroundColor: colors.surface, borderColor: colors.primary }, pressed && styles.pressed]}>
                 <View style={[styles.socialIcon, { backgroundColor: colors.primarySoft }]}>
                   <MaterialCommunityIcons name={item.icon} size={29} color={colors.primary} />
                 </View>
                 <Text style={[styles.socialLabel, { color: colors.foreground }]}>{item.title}</Text>
               </Pressable>
             ))}
           </View>
          <View style={styles.preferencesHeading}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{isArabic ? 'التفضيلات' : 'Preferences'}</Text><Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{savedIds.length} {isArabic ? 'محفوظ' : 'saved'}</Text></View>
          <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
             {menu.map((item, index) => <Pressable key={item.title} onPress={() => { item.onPress(); }} style={[styles.menuItem, index < menu.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}><View style={[styles.menuIcon, { backgroundColor: colors.primarySoft }]}><Feather name={item.icon} size={17} color={colors.primary} /></View><View style={styles.menuText}><Text style={[styles.menuTitle, { color: colors.foreground }]}>{item.title}</Text>{item.value ? <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>{item.value}</Text> : null}</View><Feather name="chevron-right" size={17} color={colors.mutedForeground} /></Pressable>)}
          </View>
           <ActionButton label={isSignedIn ? (isArabic ? 'تسجيل الخروج' : 'Sign out') : (isArabic ? 'تسجيل الدخول' : 'Sign in')} onPress={() => isSignedIn ? signOut() : router.push('/sign-in')} secondary style={{ marginTop: 22 }} />
          <View style={styles.footer}><BrandMark compact /><Text style={[styles.footerText, { color: colors.mutedForeground }]}>Everything property. One platform.</Text></View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  profileCard: { borderRadius: 22, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: { width: 50, height: 50, borderRadius: 17, backgroundColor: '#21D8B7', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#06213B', fontSize: 21, fontWeight: '800' },
  profileText: { flex: 1, gap: 4 },
  profileName: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  profileSub: { fontSize: 11, color: 'rgba(255,255,255,0.68)' },
  languageHeading: { marginTop: 27, marginBottom: 11 },
  socialHeading: { marginTop: 27, marginBottom: 11 },
  socialLinksRow: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  socialLink: { width: 78, height: 78, borderWidth: 1.5, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4 },
  socialIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  socialLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.78 },
  preferencesHeading: { marginTop: 27, marginBottom: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionHint: { fontSize: 12, marginTop: 3 },
  languageRow: { borderWidth: 1, borderRadius: 17, padding: 5, gap: 4 },
  languageOption: { borderRadius: 12, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  languageCode: { width: 39, fontSize: 12, fontWeight: '800' },
  languageLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  menuCard: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  menuItem: { padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIcon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  menuText: { flex: 1, gap: 3 },
  menuTitle: { fontSize: 13, fontWeight: '700' },
  menuValue: { fontSize: 11 },
  footer: { alignItems: 'center', gap: 9, marginTop: 35 },
  footerText: { fontSize: 11 },
});