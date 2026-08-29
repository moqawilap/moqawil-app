import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useGetListingEngagement, useRecordListingEngagement, getGetListingEngagementQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.brandRow}>
      <Image source={require('@/assets/images/moqawil-logo.png')} style={[styles.brandLogo, compact && styles.brandLogoCompact]} />
      {!compact && (
        <View>
          <Text style={[styles.brandName, { color: colors.foreground }]}>MOQAWIL</Text>
          <Text style={[styles.brandArabic, { color: colors.primary }]}>مقــاول</Text>
        </View>
      )}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  active = false,
  accessibilityLabel,
  style,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  active?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: active ? colors.primarySoft : colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Feather name={icon} size={19} color={active ? colors.primary : colors.foreground} />
    </Pressable>
  );
}

export function SearchBar({ placeholder, onPress }: { placeholder: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={placeholder} onPress={onPress} style={({ pressed }) => [styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
      <View style={[styles.searchIcon, { backgroundColor: colors.primarySoft }]}>
        <Feather name="search" size={16} color={colors.primary} />
      </View>
      <Text style={[styles.searchPlaceholder, { color: colors.mutedForeground }]}>{placeholder}</Text>
      <View style={[styles.searchFilter, { backgroundColor: colors.primarySoft }]}>
        <Feather name="sliders" size={15} color={colors.primary} />
      </View>
    </Pressable>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingText}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={12}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Rating({ value, reviews, light = false }: { value: number; reviews?: number; light?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.ratingRow}>
      <Feather name="star" size={14} color={light ? '#FFD166' : colors.star} fill={light ? '#FFD166' : colors.star} />
      <Text style={[styles.ratingValue, { color: light ? '#FFFFFF' : colors.foreground }]}>{value.toFixed(1)}</Text>
      {reviews !== undefined ? <Text style={[styles.reviewCount, { color: light ? 'rgba(255,255,255,0.72)' : colors.mutedForeground }]}>({reviews})</Text> : null}
    </View>
  );
}

export function ServiceIcon({ icon, color, size = 22 }: { icon: 'hard-hat' | 'compass' | 'home' | 'tool' | 'zap' | 'droplet' | 'wind' | 'sparkles'; color: string; size?: number }) {
  const names = {
    'hard-hat': 'hard-hat',
    compass: 'compass-outline',
    home: 'home-variant-outline',
    tool: 'tools',
    zap: 'flash-outline',
    droplet: 'water-outline',
    wind: 'weather-windy',
    sparkles: 'shimmer',
  } as const;
  return <MaterialCommunityIcons name={names[icon]} size={size} color={color} />;
}

export function ProviderCard({
  image,
  name,
  specialty,
  rating,
  reviews,
  distance,
  verified,
  saved,
  onPress,
  onSave,
}: {
  image: ImageSourcePropType;
  name: string;
  specialty: string;
  rating: number;
  reviews: number;
  distance: string;
  verified?: boolean;
  saved?: boolean;
  onPress: () => void;
  onSave: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.providerCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.cardPressed]}>
      <Image source={image} style={styles.providerImage} />
      <View style={styles.providerInfo}>
        <View style={styles.providerNameRow}>
          <Text numberOfLines={1} style={[styles.providerName, { color: colors.foreground }]}>{name}</Text>
          {verified ? <Feather name="check-circle" size={15} color={colors.primary} /> : null}
        </View>
        <Text style={[styles.providerSpecialty, { color: colors.mutedForeground }]}>{specialty}</Text>
        <View style={styles.providerMeta}>
          <Rating value={rating} reviews={reviews} />
          <View style={styles.distanceRow}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text style={[styles.distanceText, { color: colors.mutedForeground }]}>{distance}</Text>
          </View>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved' : 'Save provider'} onPress={onSave} hitSlop={8} style={({ pressed }) => [styles.providerSave, { backgroundColor: saved ? colors.primarySoft : colors.surfaceMuted }, pressed && styles.pressed]}>
        <Feather name="heart" size={16} color={saved ? colors.primary : colors.mutedForeground} fill={saved ? colors.primary : 'transparent'} />
      </Pressable>
    </Pressable>
  );
}

export function PropertyCard({
  listing,
  saved,
  onPress,
  onSave,
  featured = false,
}: {
  listing: { id: string; title: string; price: string; location: string; beds: number; baths: number; area: string; image: ImageSourcePropType; type: string };
  saved?: boolean;
  onPress: () => void;
  onSave: () => void;
  featured?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.propertyCard, featured && styles.propertyCardFeatured, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.cardPressed]}>
      <View style={styles.propertyImageWrap}>
        <Image source={listing.image} style={styles.propertyImage} />
        <View style={styles.propertyTypePill}><Text style={styles.propertyTypeText}>{listing.type}</Text></View>
      </View>
      <View style={styles.propertyInfo}>
        <Text numberOfLines={1} style={[styles.propertyTitle, { color: colors.foreground }]}>{listing.title}</Text>
        <Text style={[styles.propertyPrice, { color: colors.primary }]}>{listing.price}</Text>
        <View style={styles.propertyLocation}>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text numberOfLines={1} style={[styles.propertyLocationText, { color: colors.mutedForeground }]}>{listing.location}</Text>
        </View>
        <View style={[styles.propertySpecs, { borderTopColor: colors.border }]}>
          <Text style={[styles.propertySpec, { color: colors.mutedForeground }]}>{listing.beds} beds</Text>
          <Text style={[styles.propertyDot, { color: colors.border }]}>•</Text>
          <Text style={[styles.propertySpec, { color: colors.mutedForeground }]}>{listing.baths} baths</Text>
          <Text style={[styles.propertyDot, { color: colors.border }]}>•</Text>
          <Text style={[styles.propertySpec, { color: colors.mutedForeground }]}>{listing.area}</Text>
        </View>
          <ListingEngagementMetrics listingId={listing.id} saved={saved} onSave={onSave} compact />
      </View>
    </Pressable>
  );
}

function EngagementStat({ icon, value, label, compact = false }: { icon: keyof typeof Feather.glyphMap; value: number; label: string; compact?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.engagementStat, compact && styles.engagementStatCompact]}>
      <Feather name={icon} size={compact ? 12 : 14} color={colors.mutedForeground} />
      <Text style={[styles.engagementValue, { color: colors.foreground }, compact && styles.engagementValueCompact]}>{value}</Text>
      {!compact ? <Text numberOfLines={1} style={[styles.engagementLabel, { color: colors.mutedForeground }]}>{label}</Text> : null}
    </View>
  );
}

export function ListingEngagementMetrics({ listingId, saved = false, onSave, compact = false }: { listingId: string; saved?: boolean; onSave?: () => void; compact?: boolean }) {
  const colors = useColors();
  const { isArabic, engagementClientId } = useApp();
  const queryClient = useQueryClient();
  const params = engagementClientId ? { clientId: engagementClientId } : undefined;
  const query = useGetListingEngagement(listingId, params, { query: { enabled: Boolean(engagementClientId) } });
  const record = useRecordListingEngagement({
    mutation: {
      onSuccess: (next) => {
        queryClient.setQueryData(getGetListingEngagementQueryKey(listingId, params), next);
        queryClient.invalidateQueries({ queryKey: ['/api/listings/engagement'] });
      },
    },
  });
  const viewed = React.useRef(false);
  React.useEffect(() => {
    if (!engagementClientId || viewed.current) return;
    viewed.current = true;
    record.mutate({ listingId, data: { action: 'view', clientId: engagementClientId } });
  }, [engagementClientId, listingId]);

  const data = query.data;
  const submit = (action: 'like' | 'save', active: boolean) => {
    if (!engagementClientId || record.isPending) return;
    record.mutate({ listingId, data: { action, clientId: engagementClientId, active } });
  };
  const liked = data?.liked ?? false;

  return (
    <View style={[styles.engagementPanel, { borderTopColor: colors.border }, compact && styles.engagementPanelCompact]}>
      <View style={[styles.engagementStats, compact && styles.engagementStatsCompact]}>
        <EngagementStat icon="eye" value={data?.views ?? 0} label={isArabic ? 'مشاهدة' : 'Views'} compact={compact} />
        <EngagementStat icon="heart" value={data?.likes ?? 0} label={isArabic ? 'إعجاب' : 'Likes'} compact={compact} />
        <EngagementStat icon="bookmark" value={data?.saves ?? 0} label={isArabic ? 'حفظ' : 'Saves'} compact={compact} />
        <EngagementStat icon="phone" value={data?.contacts ?? 0} label={isArabic ? 'تواصل' : 'Contacts'} compact={compact} />
      </View>
      <View style={[styles.engagementActions, compact && styles.engagementActionsCompact]}>
        <Pressable accessibilityRole="button" accessibilityLabel={liked ? (isArabic ? 'إلغاء الإعجاب' : 'Unlike listing') : (isArabic ? 'أعجبني الإعلان' : 'Like listing')} onPress={() => submit('like', !liked)} style={({ pressed }) => [styles.engagementAction, { backgroundColor: liked ? colors.primarySoft : colors.surfaceMuted }, pressed && styles.pressed]}>
          <Feather name="heart" size={compact ? 13 : 15} color={liked ? colors.primary : colors.mutedForeground} fill={liked ? colors.primary : 'transparent'} />
          <Text style={[styles.engagementActionText, { color: liked ? colors.primary : colors.mutedForeground }]}>{isArabic ? 'أعجبني' : 'Like'}</Text>
        </Pressable>
        {onSave ? (
          <Pressable accessibilityRole="button" accessibilityLabel={saved ? (isArabic ? 'إزالة الإعلان من المحفوظات' : 'Remove listing from saved') : (isArabic ? 'حفظ الإعلان' : 'Save listing')} onPress={() => { onSave(); submit('save', !saved); }} style={({ pressed }) => [styles.engagementAction, { backgroundColor: saved ? colors.primarySoft : colors.surfaceMuted }, pressed && styles.pressed]}>
            <Feather name="bookmark" size={compact ? 13 : 15} color={saved ? colors.primary : colors.mutedForeground} fill={saved ? colors.primary : 'transparent'} />
            <Text style={[styles.engagementActionText, { color: saved ? colors.primary : colors.mutedForeground }]}>{isArabic ? 'حفظ' : 'Save'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function EmptyState({ title, description, icon = 'bookmark' }: { title: string; description: string; icon?: keyof typeof Feather.glyphMap }) {
  const colors = useColors();
  return (
    <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Feather name={icon} size={24} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: colors.mutedForeground }]}>{description}</Text>
    </View>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  secondary = false,
  style,
}: {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
  secondary?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.actionButton,
      { backgroundColor: secondary ? colors.surface : colors.primary, borderColor: secondary ? colors.border : colors.primary },
      pressed && styles.pressed,
      style,
    ]}>
      {icon ? <Feather name={icon} size={16} color={secondary ? colors.foreground : colors.primaryForeground} /> : null}
      <Text style={[styles.actionButtonText, { color: secondary ? colors.foreground : colors.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.screenHeader}>
      <View>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.screenSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SegmentedControl({ value, onChange, options, labels }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  const colors = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceMuted }]}>
      {options.map((option) => (
        <Pressable key={option} onPress={() => onChange(option)} style={({ pressed }) => [styles.segment, value === option && { backgroundColor: colors.surface }, pressed && styles.pressed]}>
          <Text style={[styles.segmentText, { color: value === option ? colors.foreground : colors.mutedForeground }]}>{labels?.[option] ?? option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandLogo: { width: 40, height: 40, borderRadius: 13 },
  brandLogoCompact: { width: 34, height: 34, borderRadius: 11 },
  brandIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  brandIconCompact: { width: 34, height: 34, borderRadius: 11 },
  brandName: { fontSize: 15, fontWeight: '800', letterSpacing: 1.7 },
  brandArabic: { fontSize: 11, fontWeight: '700', marginTop: -1 },
  iconButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  searchBar: { height: 56, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 11, shadowColor: '#08284A', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  searchIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchPlaceholder: { fontSize: 14, flex: 1 },
  searchFilter: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  sectionHeadingText: { gap: 3 },
  sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12 },
  sectionAction: { fontSize: 13, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingValue: { fontSize: 12, fontWeight: '700' },
  reviewCount: { fontSize: 11 },
  providerCard: { minHeight: 102, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 11, marginBottom: 10, shadowColor: '#08284A', shadowOpacity: 0.045, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  providerImage: { width: 78, height: 78, borderRadius: 16 },
  providerInfo: { flex: 1, marginLeft: 12, gap: 5 },
  providerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 26 },
  providerName: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  providerSpecialty: { fontSize: 12 },
  providerMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  distanceRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  distanceText: { fontSize: 11 },
  providerSave: { position: 'absolute', right: 11, top: 11, width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  propertyCard: { width: 236, borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginRight: 12, shadowColor: '#08284A', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  propertyCardFeatured: { width: 280 },
  propertyImageWrap: { height: 158, position: 'relative' },
  propertyImage: { width: '100%', height: '100%' },
  propertyTypePill: { position: 'absolute', left: 12, top: 12, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.93)' },
  propertyTypeText: { fontSize: 10, fontWeight: '800', color: '#153457' },
  propertyInfo: { padding: 14, gap: 6 },
  propertyTitle: { fontSize: 14, fontWeight: '800' },
  propertyPrice: { fontSize: 15, fontWeight: '800' },
  propertyLocation: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  propertyLocationText: { fontSize: 11, flex: 1 },
  propertySpecs: { flexDirection: 'row', gap: 7, alignItems: 'center', borderTopWidth: 1, paddingTop: 9, marginTop: 3 },
  propertySpec: { fontSize: 10 },
  propertyDot: { fontSize: 12 },
  engagementPanel: { borderTopWidth: 1, paddingTop: 12, marginTop: 5, gap: 10 },
  engagementPanelCompact: { paddingTop: 9, marginTop: 2, gap: 8 },
  engagementStats: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  engagementStatsCompact: { gap: 2 },
  engagementStat: { flex: 1, alignItems: 'center', gap: 3 },
  engagementStatCompact: { gap: 2 },
  engagementValue: { fontSize: 12, fontWeight: '800' },
  engagementValueCompact: { fontSize: 11 },
  engagementLabel: { fontSize: 9 },
  engagementActions: { flexDirection: 'row', gap: 8 },
  engagementActionsCompact: { gap: 6 },
  engagementAction: { flex: 1, minHeight: 32, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  engagementActionText: { fontSize: 10, fontWeight: '800' },
  emptyState: { borderRadius: 22, borderWidth: 1, alignItems: 'center', padding: 30, gap: 8, marginTop: 16, shadowColor: '#08284A', shadowOpacity: 0.035, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  emptyIcon: { width: 55, height: 55, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyDescription: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  actionButton: { minHeight: 52, paddingHorizontal: 18, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionButtonText: { fontSize: 13, fontWeight: '800' },
  screenHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 },
  screenTitle: { fontSize: 29, fontWeight: '800', letterSpacing: -0.8 },
  screenSubtitle: { fontSize: 13, marginTop: 5 },
  segmented: { flexDirection: 'row', borderRadius: 16, padding: 4, marginBottom: 20 },
  segment: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 12, fontWeight: '700' },
});