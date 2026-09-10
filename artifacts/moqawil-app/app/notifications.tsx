import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, FixedBackButton, ScreenHeader, SegmentedControl } from '@/components/MoqawilUI';
import { getPushDeviceRegistration } from '@/constants/pushNotifications';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import {
  getGetMeQueryKey,
  getListMyNotificationsQueryKey,
  useGetMe,
  useListMyNotifications,
  useMarkNotificationRead,
  useRegisterPushDevice,
  type Notification,
} from '@workspace/api-client-react';

type AdMetadata = {
  eventType?: string;
  action?: 'like' | 'save' | 'call' | 'whatsapp';
  subjectId?: string;
  subjectKind?: 'property' | 'provider' | 'project';
  subjectName?: string;
};

function metadataOf(notification: Notification): AdMetadata {
  return (notification.deliveryMetadata ?? {}) as AdMetadata;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const { isArabic } = useApp();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [tab, setTab] = React.useState<'ads' | 'all'>('ads');
  const baseKey = getListMyNotificationsQueryKey();
  const accountKey = [...baseKey, userId ?? 'signed-out'];
  const meKey = [...getGetMeQueryKey(), userId ?? 'signed-out'];
  const me = useGetMe({
    query: {
      queryKey: meKey,
      enabled: !!isSignedIn && !!userId,
      staleTime: 0,
      refetchInterval: 30_000,
      retry: 1,
    },
  });
  const isAdmin = me.data?.role === 'admin';
  const visibleTab: 'ads' | 'all' = isAdmin && tab === 'all' ? 'all' : 'ads';
  const notices = useListMyNotifications({
    query: {
      queryKey: accountKey,
      enabled: !!isSignedIn && !!userId,
      refetchInterval: 30_000,
      staleTime: 10_000,
      retry: 2,
    },
  });
  const mark = useMarkNotificationRead({
    mutation: {
      onSuccess: () => client.invalidateQueries({ queryKey: accountKey }),
      onError: () => Alert.alert(isArabic ? 'تعذر تحديث الإشعار' : 'Could not update notification', isArabic ? 'حاول مرة أخرى.' : 'Please try again.'),
    },
  });
  const registerDevice = useRegisterPushDevice();
  const [pushMessage, setPushMessage] = React.useState('');

  React.useEffect(() => {
    client.removeQueries({ queryKey: baseKey, predicate: (query) => !userId || !query.queryKey.includes(userId) });
  }, [client, userId]);
  React.useEffect(() => {
    if (!isAdmin) setTab('ads');
  }, [isAdmin]);

  useFocusEffect(React.useCallback(() => {
    if (isSignedIn && userId) {
      void notices.refetch();
      void me.refetch();
    }
  }, [isSignedIn, userId, notices.refetch, me.refetch]));

  const enablePush = async () => {
    setPushMessage('');
    try {
      const registration = await getPushDeviceRegistration(true);
      if (!registration) {
        setPushMessage(isArabic ? 'لم يتم منح إذن إشعارات الهاتف.' : 'Phone notification permission was not granted.');
        return;
      }
      await registerDevice.mutateAsync({ data: registration });
      setPushMessage(isArabic ? 'تم تفعيل إشعارات الهاتف.' : 'Phone notifications enabled.');
    } catch {
      setPushMessage(isArabic ? 'تعذر تفعيل إشعارات الهاتف. حاول مرة أخرى.' : 'Could not enable phone notifications. Try again.');
    }
  };

  const items = (notices.data ?? []).filter((notification) => visibleTab === 'all' || metadataOf(notification).eventType === 'ad_engagement');
  const actionLabel = (action?: AdMetadata['action']) => {
    if (isArabic) return action === 'like' ? 'إعجاب' : action === 'save' ? 'حفظ' : action === 'call' ? 'اتصال' : action === 'whatsapp' ? 'واتساب' : 'تفاعل';
    return action === 'like' ? 'Like' : action === 'save' ? 'Save' : action === 'call' ? 'Call' : action === 'whatsapp' ? 'WhatsApp' : 'Engagement';
  };
  const actionIcon = (action?: AdMetadata['action']): keyof typeof Feather.glyphMap =>
    action === 'like' ? 'heart' : action === 'save' ? 'bookmark' : action === 'call' ? 'phone' : 'message-circle';
  const localizedNotice = (notification: Notification, metadata: AdMetadata) => {
    if (metadata.eventType !== 'ad_engagement' || !metadata.action || !metadata.subjectName) {
      return { title: notification.title, body: notification.body };
    }
    const titleEn = metadata.action === 'like' ? 'New like' : metadata.action === 'save' ? 'New save' : metadata.action === 'call' ? 'New call attempt' : 'New WhatsApp contact';
    const titleAr = metadata.action === 'like' ? 'إعجاب جديد' : metadata.action === 'save' ? 'حفظ جديد' : metadata.action === 'call' ? 'محاولة اتصال جديدة' : 'تواصل جديد عبر واتساب';
    const bodyEn = metadata.action === 'like'
      ? `Someone liked ${metadata.subjectName}.`
      : metadata.action === 'save'
        ? `Someone saved ${metadata.subjectName}.`
        : metadata.action === 'call'
          ? `Someone pressed call for ${metadata.subjectName}.`
          : `Someone pressed WhatsApp for ${metadata.subjectName}.`;
    const bodyAr = metadata.action === 'like'
      ? `أعجب أحد العملاء بـ ${metadata.subjectName}.`
      : metadata.action === 'save'
        ? `حفظ أحد العملاء ${metadata.subjectName}.`
        : metadata.action === 'call'
          ? `ضغط أحد العملاء على الاتصال بخصوص ${metadata.subjectName}.`
          : `ضغط أحد العملاء على واتساب بخصوص ${metadata.subjectName}.`;
    return { title: isArabic ? titleAr : titleEn, body: isArabic ? bodyAr : bodyEn };
  };
  const openNotification = (notification: Notification, metadata: AdMetadata) => {
    if (!notification.readAt) mark.mutate({ id: notification.id });
    if (!metadata.subjectId) return;
    if (metadata.subjectKind === 'property') {
      router.push(`/listing/${metadata.subjectId}` as never);
    } else if (metadata.subjectKind === 'provider') {
      router.push(`/provider/${metadata.subjectId}` as never);
    } else if (metadata.subjectKind === 'project') {
      router.push('/my-submissions' as never);
    }
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background, direction: isArabic ? 'rtl' : 'ltr' }]}>
      <FixedBackButton testID="notifications-back" onPress={() => router.back()} />
      <ScrollView
        refreshControl={isSignedIn ? <RefreshControl refreshing={notices.isRefetching && !notices.isLoading} onRefresh={() => void notices.refetch()} tintColor={colors.primary} /> : undefined}
        contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 24) }}
      >
        <View style={styles.content}>
          <ScreenHeader title={isArabic ? 'الإشعارات' : 'Notifications'} subtitle={isArabic ? 'تابع تفاعل العملاء مع إعلاناتك' : 'Keep up with activity on your ads'} />
          {!isLoaded ? <ActivityIndicator color={colors.primary} /> : null}
          {isLoaded && !isSignedIn ? (
            <View>
              <EmptyState icon="lock" title={isArabic ? 'سجّل الدخول لعرض الإشعارات' : 'Sign in to view notifications'} description={isArabic ? 'ستجد هنا الإعجابات والحفظ ومحاولات التواصل على إعلاناتك.' : 'Likes, saves, and contact attempts on your ads will appear here.'} />
              <Pressable testID="notifications-sign-in" onPress={() => router.push('/sign-in')} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
                <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{isArabic ? 'تسجيل الدخول' : 'Sign in'}</Text>
              </Pressable>
            </View>
          ) : null}
          {isSignedIn ? (
            <>
              {isAdmin ? <SegmentedControl value={visibleTab} onChange={(value) => setTab(value as 'ads' | 'all')} options={['ads', 'all']} labels={{ ads: isArabic ? 'إعلاناتي' : 'My ads', all: isArabic ? 'الكل' : 'All' }} /> : null}
              <Pressable testID="enable-push-notifications" disabled={registerDevice.isPending} onPress={() => void enablePush()} style={[styles.pushButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Feather name="bell" size={17} color={colors.primary} />
                <Text style={[styles.pushButtonText, { color: colors.foreground }]}>{registerDevice.isPending ? (isArabic ? 'جارٍ التفعيل…' : 'Enabling…') : (isArabic ? 'تفعيل إشعارات الهاتف' : 'Enable phone notifications')}</Text>
              </Pressable>
              {pushMessage ? <Text style={[styles.message, { color: colors.mutedForeground }]}>{pushMessage}</Text> : null}
              {notices.isLoading ? <View style={styles.centerState}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.mutedForeground }}>{isArabic ? 'جارٍ تحميل الإشعارات…' : 'Loading notifications…'}</Text></View> : null}
              {notices.isError ? <View style={[styles.errorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Feather name="alert-circle" size={22} color={colors.primary} /><Text style={[styles.errorTitle, { color: colors.foreground }]}>{isArabic ? 'تعذر تحميل الإشعارات' : 'Could not load notifications'}</Text><Text style={[styles.message, { color: colors.mutedForeground }]}>{isArabic ? 'تحقق من الاتصال ثم حاول مرة أخرى.' : 'Check your connection and try again.'}</Text><Pressable testID="notifications-retry" onPress={() => void notices.refetch()} style={[styles.retryButton, { backgroundColor: colors.primary }]}><Feather name="refresh-cw" size={14} color={colors.primaryForeground} /><Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>{isArabic ? 'إعادة المحاولة' : 'Retry'}</Text></Pressable></View> : null}
              {!notices.isLoading && !notices.isError ? items.map((notification) => {
                const metadata = metadataOf(notification);
                const copy = localizedNotice(notification, metadata);
                const unread = !notification.readAt;
                return (
                  <Pressable
                    testID={`notification-${notification.id}`}
                    key={notification.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: unread }}
                    onPress={() => openNotification(notification, metadata)}
                    style={[styles.item, { backgroundColor: unread ? colors.primarySoft : colors.surface, borderColor: unread ? colors.primary : colors.border }]}
                  >
                    <View style={[styles.noticeIcon, { backgroundColor: colors.surface }]}>
                      {metadata.action === 'whatsapp' ? <MaterialCommunityIcons name="whatsapp" size={19} color={colors.primary} /> : <Feather name={actionIcon(metadata.action)} size={18} color={colors.primary} />}
                    </View>
                    <View style={styles.noticeCopy}>
                      <View style={styles.noticeHeading}><Text numberOfLines={1} style={[styles.title, { color: colors.foreground }]}>{copy.title}</Text>{unread ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}</View>
                      <Text style={[styles.body, { color: colors.mutedForeground }]}>{copy.body}</Text>
                      <Text style={[styles.meta, { color: colors.mutedForeground }]}>{metadata.subjectName ? `${actionLabel(metadata.action)} · ${metadata.subjectName} · ` : ''}{new Intl.DateTimeFormat(isArabic ? 'ar-OM' : 'en-OM', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.deliveredAt ?? notification.createdAt))}</Text>
                    </View>
                  </Pressable>
                );
              }) : null}
              {!notices.isLoading && !notices.isError && !items.length ? <EmptyState icon="bell" title={visibleTab === 'ads' ? (isArabic ? 'لا يوجد تفاعل على إعلاناتك بعد' : 'No ad activity yet') : (isArabic ? 'لا توجد إشعارات' : 'No notifications')} description={visibleTab === 'ads' ? (isArabic ? 'ستظهر هنا الإعجابات والحفظ والاتصالات ورسائل واتساب.' : 'Likes, saves, calls, and WhatsApp presses will appear here.') : (isArabic ? 'أنت على اطلاع بكل شيء.' : 'You are all caught up.')} /> : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 12 },
  primaryButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryButtonText: { fontSize: 13, fontWeight: '800' },
  pushButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pushButtonText: { fontWeight: '800', fontSize: 13 },
  message: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  centerState: { paddingVertical: 32, alignItems: 'center', gap: 10 },
  errorCard: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', gap: 8 },
  errorTitle: { fontSize: 15, fontWeight: '800' },
  retryButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  item: { borderWidth: 1, borderRadius: 17, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  noticeIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  noticeCopy: { flex: 1, gap: 5 },
  noticeHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { flex: 1, fontWeight: '800', fontSize: 14 },
  body: { fontSize: 13, lineHeight: 19 },
  meta: { fontSize: 10, lineHeight: 15 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
});