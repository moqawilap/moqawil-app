import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { ActionButton, FixedBackButton, ScreenHeader } from '@/components/MoqawilUI';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getListMyServiceReviewsQueryKey, useListMyServiceReviews, useResubmitMyServiceReview, type MyServiceReview } from '@workspace/api-client-react';

const categoryLabels: Record<string, { en: string; ar: string }> = {
  contractors: { en: 'Contractors', ar: 'المقاولون' },
  consultants: { en: 'Consultants', ar: 'الاستشاريون' },
  design: { en: 'Design', ar: 'التصميم' },
  building: { en: 'Building workshops', ar: 'البناء والورش' },
  'real-estate': { en: 'Real estate', ar: 'العقارات' },
  maintenance: { en: 'Maintenance', ar: 'الصيانة' },
};

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid file'));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.readAsDataURL(blob);
  });
}

export default function MySubmissionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isArabic } = useApp();
  const client = useQueryClient();
  const submissions = useListMyServiceReviews();
  const [editing, setEditing] = useState<MyServiceReview | null>(null);
  const [form, setForm] = useState({ title: '', specialty: '', city: '', description: '' });
  const [media, setMedia] = useState<string[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const resubmit = useResubmitMyServiceReview({ mutation: {
    onSuccess: () => {
      client.invalidateQueries({ queryKey: getListMyServiceReviewsQueryKey() });
      setEditing(null);
      Alert.alert(isArabic ? 'تمت إعادة الإرسال' : 'Resubmitted', isArabic ? 'عاد إعلانك إلى قائمة انتظار المراجعة.' : 'Your submission is back in the review queue.');
    },
    onError: () => Alert.alert(isArabic ? 'تعذر إعادة الإرسال' : 'Could not resubmit'),
  } });

  const beginEdit = (item: MyServiceReview) => {
    setEditing(item);
    setForm({ title: item.title, specialty: item.specialty ?? '', city: item.city ?? '', description: item.description });
    setMedia(item.mediaUrls);
  };
  const pickMedia = async () => {
    if (media.length >= 15 || mediaLoading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert(isArabic ? 'نحتاج إذن الصور والفيديو' : 'Media access needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 15 - media.length, quality: 0.6, videoMaxDuration: 60 });
    if (result.canceled) return;
    setMediaLoading(true);
    try {
      const additions: string[] = [];
      for (const asset of result.assets) {
        const blob = await (await fetch(asset.uri)).blob();
        if (blob.size > 5 * 1024 * 1024) continue;
        const value = await blobToDataUrl(blob);
        if (value.length <= 8_000_000) additions.push(value);
      }
      setMedia((current) => [...current, ...additions].slice(0, 15));
      if (additions.length !== result.assets.length) Alert.alert(isArabic ? 'لم تتم إضافة بعض الملفات' : 'Some files were not added', isArabic ? 'الحد الأقصى 5 ميجابايت لكل ملف.' : 'Each file must be 5 MB or smaller.');
    } finally {
      setMediaLoading(false);
    }
  };

  const statusLabel = (status: string) => ({
    pending_review: isArabic ? 'بانتظار المراجعة' : 'Pending review',
    approved: isArabic ? 'معتمد' : 'Approved',
    changes_requested: isArabic ? 'يحتاج تعديل' : 'Changes requested',
    rejected: isArabic ? 'ملغى' : 'Cancelled',
  }[status] ?? status);

  return (
    <View style={[styles.page, { backgroundColor: colors.background, direction: isArabic ? 'rtl' : 'ltr' }]}>
      <FixedBackButton testID="my-submissions-back" onPress={() => editing ? setEditing(null) : router.back()} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <ScreenHeader title={editing ? (isArabic ? 'تعديل الإعلان' : 'Edit submission') : (isArabic ? 'إعلاناتي وخدماتي' : 'My ads & services')} subtitle={editing ? (isArabic ? 'عدّل المطلوب ثم أعد الإرسال' : 'Make the requested changes and resubmit') : (isArabic ? 'تابع حالة المراجعة وتعليقات الإدارة' : 'Track review status and administrator comments')} />
          {submissions.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
          {submissions.isError ? <View style={[styles.empty, { borderColor: colors.border }]}><Feather name="alert-circle" size={28} color={colors.primary} /><Text style={{ color: colors.mutedForeground }}>{isArabic ? 'تعذر تحميل إعلاناتك وخدماتك.' : 'Could not load your ads and services.'}</Text><ActionButton label={isArabic ? 'إعادة المحاولة' : 'Retry'} onPress={() => void submissions.refetch()} /></View> : null}
          {!editing && submissions.data?.length === 0 ? <View style={[styles.empty, { borderColor: colors.border }]}><Feather name="file-text" size={28} color={colors.primary} /><Text style={{ color: colors.mutedForeground }}>{isArabic ? 'لم تضف أي إعلان أو خدمة بعد.' : 'You have not added an ad or service yet.'}</Text><ActionButton label={isArabic ? 'أضف خدمة' : 'Add a service'} onPress={() => router.push('/add-service' as never)} /></View> : null}
          {!editing ? submissions.data?.map((item) => {
            const statusColor = item.status === 'approved' ? colors.primary : item.status === 'changes_requested' || item.status === 'rejected' ? colors.destructive : colors.mutedForeground;
            return <View key={`${item.kind}-${item.id}`} testID={`my-submission-${item.id}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.cardTop}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{isArabic ? categoryLabels[item.category]?.ar : categoryLabels[item.category]?.en} · {item.city}</Text></View><View style={[styles.status, { borderColor: statusColor }]}><Text style={[styles.statusText, { color: statusColor }]}>{statusLabel(item.status)}</Text></View></View><Text numberOfLines={3} style={[styles.description, { color: colors.foreground }]}>{item.description}</Text>{item.reviewNote ? <View testID={`review-comment-${item.id}`} style={[styles.note, { backgroundColor: item.status === 'changes_requested' ? '#FFF4E5' : colors.primarySoft }]}><Feather name="message-square" size={17} color={item.status === 'changes_requested' ? '#A45A00' : colors.primary} /><View style={{ flex: 1 }}><Text style={[styles.noteTitle, { color: colors.foreground }]}>{isArabic ? 'تعليق الإدارة' : 'Administrator comment'}</Text><Text style={[styles.noteText, { color: colors.foreground }]}>{item.reviewNote}</Text></View></View> : null}{item.status === 'changes_requested' ? <ActionButton label={isArabic ? 'تعديل وإعادة الإرسال' : 'Edit and resubmit'} onPress={() => beginEdit(item)} /> : null}</View>;
          }) : null}
          {editing ? <>
            {editing.reviewNote ? <View style={[styles.note, { backgroundColor: '#FFF4E5' }]}><Feather name="alert-circle" size={18} color="#A45A00" /><View style={{ flex: 1 }}><Text style={[styles.noteTitle, { color: colors.foreground }]}>{isArabic ? 'التعديل المطلوب' : 'Requested change'}</Text><Text style={[styles.noteText, { color: colors.foreground }]}>{editing.reviewNote}</Text></View></View> : null}
            <Field label={isArabic ? 'العنوان' : 'Title'} value={form.title} onChangeText={(value) => setForm((current) => ({ ...current, title: value }))} colors={colors} isArabic={isArabic} />
            {editing.kind === 'registration' ? <Field label={isArabic ? 'التخصص أو النوع' : 'Specialty or type'} value={form.specialty} onChangeText={(value) => setForm((current) => ({ ...current, specialty: value }))} colors={colors} isArabic={isArabic} /> : null}
            <Field label={isArabic ? 'الموقع' : 'Location'} value={form.city} onChangeText={(value) => setForm((current) => ({ ...current, city: value }))} colors={colors} isArabic={isArabic} />
            <View><Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? 'نبذة عن الأعمال والخدمات' : 'About the work and services'}</Text><TextInput value={form.description} onChangeText={(value) => setForm((current) => ({ ...current, description: value }))} multiline textAlign={isArabic ? 'right' : 'left'} style={[styles.input, styles.multiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /></View>
            <Text style={[styles.label, { color: colors.foreground }]}>{isArabic ? `الصور والفيديوهات (${media.length}/15)` : `Photos and videos (${media.length}/15)`}</Text>
            <View style={styles.mediaGrid}>{media.map((url, index) => <View key={`${url.slice(0, 20)}-${index}`} style={[styles.mediaCard, { borderColor: colors.border }]}>{/^data:video\//.test(url) ? <View style={[styles.video, { backgroundColor: colors.primarySoft }]}><Feather name="video" size={23} color={colors.primary} /></View> : <Image source={{ uri: url }} style={styles.image} />}<Pressable onPress={() => setMedia((current) => current.filter((_, mediaIndex) => mediaIndex !== index))} style={[styles.remove, { backgroundColor: colors.navy }]}><Feather name="x" size={13} color="#FFFFFF" /></Pressable></View>)}{media.length < 15 ? <Pressable testID="resubmit-add-media" onPress={pickMedia} style={[styles.addMedia, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>{mediaLoading ? <ActivityIndicator color={colors.primary} /> : <><Feather name="plus" size={22} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>{isArabic ? 'إضافة' : 'Add'}</Text></>}</Pressable> : null}</View>
            <ActionButton testID="resubmit-review" label={resubmit.isPending ? (isArabic ? 'جارٍ الإرسال…' : 'Resubmitting…') : (isArabic ? 'إعادة الإرسال للمراجعة' : 'Resubmit for review')} onPress={() => { if (resubmit.isPending) return; if (form.title.trim().length < 2 || form.city.trim().length < 2 || form.description.trim().length < 20 || (editing.kind === 'registration' && form.specialty.trim().length < 2) || media.length === 0) { Alert.alert(isArabic ? 'أكمل البيانات' : 'Complete the details'); return; } resubmit.mutate({ kind: editing.kind, id: editing.id, data: { title: form.title.trim(), specialty: editing.kind === 'registration' ? form.specialty.trim() : null, city: form.city.trim(), description: form.description.trim(), mediaUrls: media } }); }} />
          </> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChangeText, colors, isArabic }: { label: string; value: string; onChangeText: (value: string) => void; colors: ReturnType<typeof useColors>; isArabic: boolean }) {
  return <View><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} textAlign={isArabic ? 'right' : 'left'} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 28, alignItems: 'center', gap: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 11 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 11, marginTop: 4 },
  status: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 9, fontWeight: '800' },
  description: { fontSize: 12, lineHeight: 19 },
  note: { borderRadius: 13, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  noteTitle: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  noteText: { fontSize: 12, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, fontSize: 14 },
  multiline: { minHeight: 115, paddingTop: 11, textAlignVertical: 'top' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  mediaCard: { width: 82, height: 82, borderWidth: 1, borderRadius: 13 },
  image: { width: '100%', height: '100%', borderRadius: 12 },
  video: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  remove: { position: 'absolute', right: -5, top: -5, width: 21, height: 21, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  addMedia: { width: 82, height: 82, borderWidth: 1, borderStyle: 'dashed', borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 5 },
});