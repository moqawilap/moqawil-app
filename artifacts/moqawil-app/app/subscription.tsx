import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, ScreenHeader } from '@/components/MoqawilUI';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getGetMySubscriptionQueryKey, getListMyPaymentsQueryKey, useCancelMySubscription, useGetMySubscription, useListMyPayments, useStartDevelopmentPayment } from '@workspace/api-client-react';

const dateText = (date?: string | null) => date ? new Date(date).toLocaleDateString() : '—';
const billingLabel = (months: number, isArabic: boolean) => months === 12 ? (isArabic ? 'سنة' : 'year') : `${months} ${isArabic ? 'شهرًا' : months === 1 ? 'month' : 'months'}`;
export default function SubscriptionScreen() {
  const colors = useColors(); const insets = useSafeAreaInsets(); const { isArabic } = useApp(); const { isSignedIn } = useAuth();
  const subscription = useGetMySubscription({ query: { queryKey: getGetMySubscriptionQueryKey(), enabled: !!isSignedIn } }); const client = useQueryClient();
  const payments = useListMyPayments({ query: { queryKey: getListMyPaymentsQueryKey(), enabled: !!isSignedIn } });
  const payment = useStartDevelopmentPayment({ mutation: { onSuccess: () => { client.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() }); client.invalidateQueries({ queryKey: getListMyPaymentsQueryKey() }); } } });
  const cancel = useCancelMySubscription({ mutation: { onSuccess: () => { client.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() }); client.invalidateQueries({ queryKey: getListMyPaymentsQueryKey() }); } } });
  const item = subscription.data;
  const trialDays = item ? Math.max(0, Math.ceil((new Date(item.trialEndsAt).getTime() - Date.now()) / 86400000)) : 0;
  return <View style={[styles.page, { backgroundColor: colors.background }]}><ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 45 }}><View style={styles.content}>
    <Pressable testID="subscription-back" onPress={() => router.back()}><Feather name="arrow-left" size={20} color={colors.foreground} /></Pressable>
    <ScreenHeader title={isArabic ? 'اشتراك المقاول' : 'Contractor subscription'} subtitle={isArabic ? 'إدارة خطتك وفواتيرك' : 'Manage your plan and billing'} />
    {!isSignedIn ? <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.note, { color: colors.foreground }]}>{isArabic ? 'سجّل الدخول لعرض اشتراكك ومدفوعاتك.' : 'Sign in to view your subscription and payments.'}</Text><ActionButton label={isArabic ? 'تسجيل الدخول' : 'Sign in'} onPress={() => router.push('/sign-in')} /></View> : null}
    {isSignedIn ? <React.Fragment>
    {subscription.isLoading ? <ActivityIndicator testID="subscription-loading" color={colors.primary} /> : null}
    {subscription.isError ? <Text style={[styles.note, { color: colors.mutedForeground }]}>Subscription details are temporarily unavailable. Please try again later.</Text> : null}
    {item ? <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.status, { color: colors.primary }]}>{item.planName} · {item.status.replace('_', ' ').toUpperCase()}</Text><Text style={[styles.price, { color: colors.foreground }]}>{item.priceOmaniRial} OMR <Text style={styles.period}>/ {billingLabel(item.billingMonths, isArabic)}</Text></Text><Text style={[styles.note, { color: colors.mutedForeground }]}>{isArabic ? `تجربة مجانية لمدة ${item.trialMonths} أشهر` : `${item.trialMonths}-month free trial`}</Text><View style={[styles.divider, { backgroundColor: colors.border }]} /><Text style={[styles.line, { color: colors.foreground }]}>{isArabic ? 'بدأت التجربة:' : 'Trial started:'} {dateText(item.trialStartedAt)}</Text><Text style={[styles.line, { color: colors.foreground }]}>{isArabic ? 'تنتهي التجربة:' : 'Trial ends:'} {dateText(item.trialEndsAt)} ({trialDays} {isArabic ? 'يومًا' : 'days'})</Text><Text style={[styles.line, { color: colors.foreground }]}>{isArabic ? 'الفترة الحالية:' : 'Current period:'} {dateText(item.currentPeriodStartsAt)} — {dateText(item.currentPeriodEndsAt)}</Text>{item.cancelledAt ? <Text style={[styles.line, { color: colors.foreground }]}>{isArabic ? 'أُلغي في:' : 'Cancelled:'} {dateText(item.cancelledAt)}</Text> : null}</View> : null}
    <Text style={[styles.status, { color: colors.foreground }]}>{isArabic ? 'سجل المدفوعات' : 'Payment history'}</Text>
    {payments.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
    {payments.data?.length ? payments.data.map((record) => <View key={record.id} style={[styles.payment, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={{ color: colors.foreground, fontWeight: '700' }}>{record.amountOmaniRial} OMR · {record.status}</Text><Text style={[styles.note, { color: colors.mutedForeground }]}>{record.provider}{record.providerReference ? ` · ${record.providerReference}` : ''} · {dateText(record.createdAt)}</Text></View>) : <Text style={[styles.note, { color: colors.mutedForeground }]}>{isArabic ? 'لا توجد مدفوعات مسجلة.' : 'No payments recorded.'}</Text>}
    <Text style={[styles.note, { color: colors.mutedForeground }]}>Payments are handled securely outside this app. No real payment is collected here.</Text>
    {__DEV__ ? <View testID="development-payment"><ActionButton label={payment.isPending ? 'Processing…' : 'Development-only: simulate successful payment'} icon="tool" onPress={() => payment.mutate({ data: { outcome: 'succeed' } })} /></View> : null}
    <View testID="manage-subscription"><ActionButton label={cancel.isPending ? 'Cancelling…' : (isArabic ? 'إلغاء الاشتراك' : 'Cancel subscription')} secondary onPress={() => Alert.alert(isArabic ? 'تأكيد الإلغاء' : 'Confirm cancellation', isArabic ? 'هل تريد إلغاء اشتراكك؟' : 'Do you want to cancel your subscription?', [{ text: isArabic ? 'رجوع' : 'Keep plan', style: 'cancel' }, { text: isArabic ? 'إلغاء الاشتراك' : 'Cancel subscription', style: 'destructive', onPress: () => cancel.mutate() }])} style={{ marginTop: 10 }} /></View>
    </React.Fragment> : null}</View></ScrollView></View>;
}
const styles = StyleSheet.create({ page:{flex:1},content:{paddingHorizontal:20,gap:16},card:{borderWidth:1,borderRadius:20,padding:18,gap:10},payment:{borderWidth:1,borderRadius:14,padding:12,gap:4},status:{fontWeight:'800',fontSize:12},price:{fontSize:28,fontWeight:'800'},period:{fontSize:13,fontWeight:'500'},note:{fontSize:13,lineHeight:19},divider:{height:1,marginVertical:3},line:{fontSize:13,fontWeight:'600'} });