import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useRecordAdEvent, type AdCampaign } from '@workspace/api-client-react';

export function AdBanner({ campaign }: { campaign: AdCampaign }) {
  const colors = useColors();
  const { isArabic } = useApp();
  const router = useRouter();
  const [mediaIndex, setMediaIndex] = useState(0);
  const impressionCampaignId = useRef<string | null>(null);
  const event = useRecordAdEvent();
  const actorKey = useApp().engagementClientId;
  const media = campaign.media?.length ? campaign.media : [{ url: campaign.mediaUrl, type: campaign.mediaType }];
  const currentMedia = media[Math.min(mediaIndex, media.length - 1)];

  useEffect(() => {
    setMediaIndex(0);
    if (impressionCampaignId.current === campaign.id || !actorKey) return;
    impressionCampaignId.current = campaign.id;
    event.mutate({ id: campaign.id, data: { eventType: 'impression', eventKey: `imp-${Date.now()}-${Math.random().toString(36).slice(2)}`, actorKey } });
  }, [actorKey, campaign.id]);

  const openAd = () => {
    if (actorKey) event.mutate({ id: campaign.id, data: { eventType: 'click', eventKey: `clk-${Date.now()}-${Math.random().toString(36).slice(2)}`, actorKey } });
    if (campaign.ctaUrl) {
      if (campaign.ctaUrl.startsWith('/')) router.push(campaign.ctaUrl as never);
      else void Linking.openURL(campaign.ctaUrl);
    }
  };

  return (
    <View testID="sponsored-ad" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.sponsored, { backgroundColor: `${colors.primary}18` }]}>
          <Text style={[styles.sponsoredText, { color: colors.primary }]}>{isArabic ? 'إعلان مدفوع' : 'Sponsored'}</Text>
        </View>
        <Text style={[styles.advertiser, { color: colors.mutedForeground }]} numberOfLines={1}>{isArabic ? campaign.advertiserNameArabic || campaign.advertiserName : campaign.advertiserName}</Text>
      </View>
      <View style={styles.gallery}>
        {currentMedia.type === 'image'
          ? <Image source={{ uri: currentMedia.url }} style={styles.media} resizeMode="cover" />
          : <Pressable onPress={() => void Linking.openURL(currentMedia.url)} style={[styles.videoPlaceholder, { backgroundColor: colors.surfaceMuted }]}>
              <Feather name="play-circle" size={36} color={colors.primary} />
              <Text style={{ color: colors.mutedForeground, fontWeight: '700' }}>{isArabic ? 'تشغيل الفيديو الإعلاني' : 'Play video ad'}</Text>
            </Pressable>}
        {media.length > 1 ? (
          <View style={styles.galleryControls}>
            <Pressable accessibilityLabel={isArabic ? 'الوسائط السابقة' : 'Previous media'} onPress={() => setMediaIndex((current) => (current - 1 + media.length) % media.length)} style={[styles.galleryButton, { backgroundColor: colors.card }]}>
              <Feather name={isArabic ? 'chevron-right' : 'chevron-left'} size={18} color={colors.foreground} />
            </Pressable>
            <View style={[styles.galleryCount, { backgroundColor: colors.card }]}>
              <Text style={[styles.galleryCountText, { color: colors.foreground }]}>{mediaIndex + 1} / {media.length}</Text>
            </View>
            <Pressable accessibilityLabel={isArabic ? 'الوسائط التالية' : 'Next media'} onPress={() => setMediaIndex((current) => (current + 1) % media.length)} style={[styles.galleryButton, { backgroundColor: colors.card }]}>
              <Feather name={isArabic ? 'chevron-left' : 'chevron-right'} size={18} color={colors.foreground} />
            </Pressable>
          </View>
        ) : null}
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground }]}>{campaign.title}</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>{campaign.description}</Text>
        <Pressable onPress={openAd} style={[styles.cta, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>{campaign.ctaLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden', marginTop: 18, marginBottom: 2 },
  header: { paddingHorizontal: 13, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sponsored: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  sponsoredText: { fontSize: 10, fontWeight: '800' },
  advertiser: { fontSize: 11, flex: 1, textAlign: 'right' },
  gallery: { marginTop: 10, position: 'relative' },
  media: { width: '100%', height: 170 },
  videoPlaceholder: { height: 170, alignItems: 'center', justifyContent: 'center', gap: 7 },
  galleryControls: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  galleryButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 5, elevation: 3 },
  galleryCount: { minWidth: 48, height: 28, paddingHorizontal: 9, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  galleryCountText: { fontSize: 11, fontWeight: '800' },
  copy: { padding: 13, gap: 7 },
  title: { fontSize: 16, fontWeight: '800' },
  description: { fontSize: 12, lineHeight: 18 },
  cta: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginTop: 3 },
});