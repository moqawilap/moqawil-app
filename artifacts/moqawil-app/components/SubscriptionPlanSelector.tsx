import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useListSubscriptionPlans } from '@workspace/api-client-react';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export type SubscriptionPlanCode = 'service-monthly' | 'service-annual' | 'real-estate-monthly' | 'real-estate-annual';
export type ServiceSubscriptionPlanCode = 'service-monthly' | 'service-annual';

export function SubscriptionPlanSelector({ category, value, onChange }: {
  category: 'service' | 'real-estate';
  value: string;
  onChange: (code: SubscriptionPlanCode) => void;
}) {
  const colors = useColors();
  const { isArabic } = useApp();
  const plans = useListSubscriptionPlans();
  const options = plans.data?.filter((plan) => plan.category === category) ?? [];

  return (
    <View testID="subscription-plan-selector" style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}><Feather name="credit-card" size={18} color={colors.primary} /></View>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>{isArabic ? 'اختر باقة الاشتراك' : 'Choose a subscription plan'}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{isArabic ? 'الشهر الأول مجاني، ويبدأ احتساب الباقة بعد انتهاء الفترة المجانية.' : 'The first month is free. Billing starts after the trial.'}</Text>
        </View>
      </View>
      {plans.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {plans.isError ? <Text style={[styles.error, { color: colors.destructive }]}>{isArabic ? 'تعذر تحميل الباقات. حاول مرة أخرى.' : 'Plans could not be loaded. Please try again.'}</Text> : null}
      <View style={styles.planGrid}>
        {options.map((plan) => {
          const selected = value === plan.code;
          const period = plan.billingMonths === 12 ? (isArabic ? 'سنويًا' : 'yearly') : (isArabic ? 'شهريًا' : 'monthly');
          return (
            <Pressable
              key={plan.code}
              testID={`subscription-plan-${plan.code}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(plan.code)}
              style={[styles.plan, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.background }]}
            >
              <View style={styles.planTop}>
                <Text style={[styles.period, { color: colors.foreground }]}>{period}</Text>
                <Feather name={selected ? 'check-circle' : 'circle'} size={19} color={selected ? colors.primary : colors.mutedForeground} />
              </View>
              <Text style={[styles.price, { color: colors.primary }]}>${plan.priceUsd}</Text>
              <Text style={[styles.omr, { color: colors.foreground }]}>{plan.priceOmaniRial.toFixed(3)} {isArabic ? 'ر.ع' : 'OMR'}</Text>
              <Text style={[styles.free, { color: colors.mutedForeground }]}>{isArabic ? 'أول شهر مجانًا' : 'First month free'}</Text>
            </Pressable>
          );
        })}
      </View>
      <View testID="payment-methods" style={[styles.paymentCard, { borderTopColor: colors.border }]}>
        <View style={styles.paymentHeading}>
          <Feather name="lock" size={15} color={colors.primary} />
          <Text style={[styles.paymentTitle, { color: colors.foreground }]}>{isArabic ? 'طرق الدفع' : 'Payment methods'}</Text>
        </View>
        <Text style={[styles.paymentHint, { color: colors.mutedForeground }]}>{isArabic ? 'تُستخدم بعد اعتماد الطلب وانتهاء الشهر المجاني.' : 'Used after approval and the free first month.'}</Text>
        <View style={styles.paymentGrid}>
          <View style={[styles.paymentMethod, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.visa, { color: colors.primary }]}>VISA</Text>
            <Text style={[styles.paymentLabel, { color: colors.foreground }]}>{isArabic ? 'بطاقة بنكية' : 'Bank card'}</Text>
          </View>
          <View style={[styles.paymentMethod, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.mastercard, { color: colors.foreground }]}>●●</Text>
            <Text style={[styles.paymentLabel, { color: colors.foreground }]}>Mastercard</Text>
          </View>
          <View style={[styles.paymentMethod, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Feather name="smartphone" size={17} color={colors.foreground} />
            <Text style={[styles.paymentLabel, { color: colors.foreground }]}>Apple Pay</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '900' },
  subtitle: { fontSize: 10, lineHeight: 16 },
  planGrid: { flexDirection: 'row', gap: 9 },
  plan: { flex: 1, minHeight: 138, borderWidth: 1.5, borderRadius: 15, padding: 12, gap: 5 },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  period: { fontSize: 12, fontWeight: '800' },
  price: { fontSize: 23, fontWeight: '900' },
  omr: { fontSize: 12, fontWeight: '800' },
  free: { fontSize: 10, marginTop: 2 },
  error: { fontSize: 11, fontWeight: '700' },
  paymentCard: { borderTopWidth: 1, paddingTop: 12, gap: 5 },
  paymentHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paymentTitle: { fontSize: 12, fontWeight: '900' },
  paymentHint: { fontSize: 10, lineHeight: 15 },
  paymentGrid: { flexDirection: 'row', gap: 7, marginTop: 3 },
  paymentMethod: { flex: 1, minHeight: 57, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
  visa: { fontSize: 14, fontWeight: '900', fontStyle: 'italic' },
  mastercard: { fontSize: 13, fontWeight: '900', letterSpacing: -2 },
  paymentLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
});