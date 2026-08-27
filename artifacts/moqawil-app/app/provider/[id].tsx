import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, BrandMark, IconButton, Rating } from '@/components/MoqawilUI';
import { providers } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function ProviderDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isArabic, isSaved, toggleSaved } = useApp();
  const provider = providers.find((item) => item.id === id) ?? providers[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <IconButton icon="arrow-left" onPress={() => router.back()} accessibilityLabel="Go back" />
          <BrandMark compact />
          <IconButton icon="heart" active={isSaved(provider.id)} onPress={() => toggleSaved(provider.id)} accessibilityLabel="Save provider" />
        </View>
        <Image source={provider.image} style={styles.heroImage} />
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <View style={styles.verifiedRow}>
                <Text style={[styles.providerTitle, { color: colors.foreground }]}>{isArabic ? provider.nameAr : provider.name}</Text>
                {provider.verified ? <View style={[styles.verifiedPill, { backgroundColor: colors.primarySoft }]}><Feather name="check" size={12} color={colors.primary} /><Text style={[styles.verifiedText, { color: colors.primary }]}>Verified</Text></View> : null}
              </View>
              <Text style={[styles.specialty, { color: colors.mutedForeground }]}>{isArabic ? provider.specialtyAr : provider.specialty} · {provider.city}</Text>
            </View>
          </View>
          <View style={[styles.statsRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View><Rating value={provider.rating} reviews={provider.reviews} /><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Customer rating</Text></View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View><Text style={[styles.statValue, { color: colors.foreground }]}>{provider.projects}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Projects</Text></View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View><Text style={[styles.statValue, { color: colors.foreground }]}>{provider.distance}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Away</Text></View>
          </View>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{isArabic ? 'عن مقدم الخدمة' : 'About this provider'}</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{isArabic ? provider.descriptionAr : provider.description}</Text>
          <Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 28 }]}>{isArabic ? 'لماذا تختاره' : 'Why customers choose them'}</Text>
          <View style={styles.benefitList}>
            {['Verified business profile', 'Clear project communication', 'Reviews from local customers'].map((item) => (
              <View key={item} style={styles.benefitRow}><View style={[styles.checkCircle, { backgroundColor: colors.primarySoft }]}><Feather name="check" size={13} color={colors.primary} /></View><Text style={[styles.benefitText, { color: colors.foreground }]}>{item}</Text></View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <ActionButton label="Call provider" icon="phone" onPress={() => Linking.openURL('tel:+96877224535')} style={{ flex: 1 }} />
        <ActionButton label="Message" icon="message-circle" onPress={() => Linking.openURL('mailto:moqawil.om@gmail.com')} secondary style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { height: 88, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroImage: { width: '100%', height: 245 },
  content: { padding: 20 },
  titleRow: { marginTop: 2 },
  titleBlock: { gap: 7 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  providerTitle: { fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  verifiedPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', gap: 4, alignItems: 'center' },
  verifiedText: { fontSize: 10, fontWeight: '800' },
  specialty: { fontSize: 13 },
  statsRow: { borderWidth: 1, borderRadius: 18, padding: 17, marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statDivider: { width: 1, height: 30 },
  statLabel: { fontSize: 10, marginTop: 6 },
  statValue: { fontSize: 16, fontWeight: '800' },
  sectionLabel: { fontSize: 17, fontWeight: '800' },
  description: { fontSize: 14, lineHeight: 22, marginTop: 8 },
  benefitList: { gap: 13, marginTop: 15 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkCircle: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  benefitText: { fontSize: 13, fontWeight: '600' },
  bottomActions: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 13, borderTopWidth: 1, flexDirection: 'row', gap: 10 },
});