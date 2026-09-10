import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/expo';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, BrandMark, ScreenHeader } from '@/components/MoqawilUI';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { locale, setLocale, location, refreshLocation, isArabic, savedIds } = useApp();
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const metadata = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const isAdmin = metadata.role === 'admin' || metadata.isAdmin === true || user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() === 'moqawil.ap@gmail.com';
  const menu = [
     { icon: 'map-pin' as const, title: isArabic ? 'موقعك الحالي' : 'Current location', value: location.source === 'default' ? (isArabic ? 'اضغط للسماح بتحديد موقعك' : 'Tap to allow location access') : `${location.area}, ${location.city}`, onPress: refreshLocation },
    { icon: 'bell' as const, title: isArabic ? 'الإشعارات' : 'Notifications', value: isArabic ? 'مفعّلة' : 'On', onPress: () => router.push('/notifications' as never) },
      ...(isSignedIn ? [{ icon: 'edit-3' as const, title: isArabic ? 'أحتاج خدمة' : 'I need a service', value: isArabic ? 'أرسل طلبًا لعدة ورش' : 'Ask multiple workshops', onPress: () => router.push('/service-request' as never) }, { icon: 'plus-circle' as const, title: isArabic ? 'أضف خدمة' : 'Add a service', value: isArabic ? 'اختر الفئة المناسبة' : 'Choose a category', onPress: () => router.push('/add-service' as never) }, { icon: 'file-text' as const, title: isArabic ? 'إعلاناتي وخدماتي' : 'My ads & services', value: isArabic ? 'تابع حالة مراجعة إعلاناتك' : 'Track your submission reviews', onPress: () => router.push('/my-submissions' as never) }, { icon: 'clipboard' as const, title: isArabic ? 'طلباتي وعروضي' : 'My requests & quotes', value: isArabic ? 'قارن واختر العرض المناسب' : 'Compare and choose a quote', onPress: () => router.push('/requests' as never) }] : []),
    ...(isSignedIn && isAdmin ? [{ icon: 'shield' as const, title: isArabic ? 'لوحة الإدارة' : 'Admin console', value: isArabic ? 'المقاولون والتقييمات' : 'Contractors & evaluations', onPress: () => router.push('/admin') }] : []),
  ];
    const openSocialLink = (url: string) => {
      if (Platform.OS === 'web') {
        window.open(url, url.startsWith('mailto:') ? '_self' : '_blank', 'noopener,noreferrer');
        return;
      }
      void Linking.openURL(url).catch(() => Alert.alert(isArabic ? 'تعذر فتح الرابط' : 'Unable to open link'));
    };
    const socialLinks = [
      { icon: 'whatsapp' as const, title: isArabic ? 'واتساب' : 'WhatsApp', onPress: () => openSocialLink('https://wa.me/96877224535') },
      { icon: 'mail' as const, title: isArabic ? 'البريد الإلكتروني' : 'Email', onPress: () => openSocialLink('mailto:moqawil.ap@gmail.com') },
      { icon: 'instagram' as const, title: 'Instagram', onPress: () => openSocialLink('https://instagram.com/moqawil.om') },
   ];
  const profileName = user?.fullName || (isSignedIn ? user?.primaryEmailAddress?.emailAddress : null) || (isArabic ? 'مستخدم مقاول' : 'Moqawil user');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <ScreenHeader title={isArabic ? 'الحساب' : 'Profile'} subtitle={isArabic ? 'إعداداتك وتفضيلاتك' : 'Your settings and preferences'} />
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? 'تعديل الحساب' : 'Edit account'} disabled={!isSignedIn} onPress={() => router.push('/account-settings' as never)} style={({ pressed }) => [styles.profileCard, { backgroundColor: colors.navy }, pressed && styles.pressed]}>
            <View style={styles.avatar}>{user?.imageUrl ? <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{profileName.charAt(0).toUpperCase()}</Text>}</View>
            <View style={styles.profileText}><Text style={styles.profileName}>{profileName}</Text><Text style={styles.profileSub}>{isAdmin ? 'Administrator account' : isArabic ? 'استكشف خدمات عمان بثقة' : 'Explore Oman with confidence'}</Text></View>
            <Feather name="edit-2" size={17} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <View style={styles.languageHeading}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{isArabic ? 'اللغة' : 'Language'}</Text><Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{isArabic ? 'اختر لغة التطبيق' : 'Choose your app language'}</Text></View>
          <View style={[styles.languageRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(['en', 'ar'] as const).map((item) => <Pressable key={item} onPress={() => setLocale(item)} style={[styles.languageOption, locale === item && { backgroundColor: colors.primarySoft }]}><Text style={[styles.languageCode, { color: locale === item ? colors.primary : colors.mutedForeground }]}>{item === 'en' ? 'EN' : 'عربي'}</Text><Text style={[styles.languageLabel, { color: locale === item ? colors.foreground : colors.mutedForeground }]}>{item === 'en' ? 'English' : 'العربية'}</Text>{locale === item ? <Feather name="check-circle" size={16} color={colors.primary} /> : null}</Pressable>)}
          </View>
           <View style={styles.socialHeading}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{isArabic ? 'روابط التواصل' : 'Social Links'}</Text><Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{isArabic ? 'تواصل معنا مباشرة' : 'Connect with us directly'}</Text></View>
           <View style={styles.socialLinksRow}>
             {socialLinks.map((item) => (
               <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={item.title} hitSlop={8} onPress={item.onPress} style={({ pressed }) => [styles.socialLink, { backgroundColor: colors.surface, borderColor: colors.primary }, pressed && styles.pressed]}>
                  <View style={[styles.socialIcon, { backgroundColor: colors.primarySoft }]}>
                    {item.icon === 'mail' ? <Feather name="mail" size={20} color={colors.primary} /> : <MaterialCommunityIcons name={item.icon} size={20} color={colors.primary} />}
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
  avatarImage: { width: '100%', height: '100%', borderRadius: 17 },
  avatarText: { color: '#06213B', fontSize: 21, fontWeight: '800' },
  profileText: { flex: 1, gap: 4 },
  profileName: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  profileSub: { fontSize: 11, color: 'rgba(255,255,255,0.68)' },
  languageHeading: { marginTop: 27, marginBottom: 11 },
  socialHeading: { marginTop: 27, marginBottom: 11 },
  socialLinksRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-start' },
  socialLink: { flex: 1, minHeight: 112, borderWidth: 1.5, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 5 },
  socialIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  socialLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
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