import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FixedBackButton, ScreenHeader, ServiceIcon } from '@/components/MoqawilUI';
import { serviceItems, type ServiceId } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function AddServiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isArabic, activeService, setActiveService } = useApp();
  const [selectedService, setSelectedService] = useState<ServiceId | null>(activeService as ServiceId | null);

  const chooseService = (serviceId: ServiceId) => {
    setSelectedService(serviceId);
    setActiveService(serviceId);
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background, direction: isArabic ? 'rtl' : 'ltr' }]}>
      <FixedBackButton testID="add-service-back" onPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 45 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <ScreenHeader
            title={isArabic ? 'أضف خدمة' : 'Add a service'}
            subtitle={isArabic ? 'اختر فئة واحدة للمتابعة لاحقًا' : 'Choose one category to continue later'}
          />
          <View style={[styles.introCard, { backgroundColor: colors.navy }]}>
            <View style={[styles.introIcon, { backgroundColor: colors.primarySoft }]}>
              <Feather name="plus" size={21} color={colors.primary} />
            </View>
            <View style={styles.introCopy}>
              <Text style={[styles.introTitle, { color: '#FFFFFF' }]}>{isArabic ? 'ما الخدمة التي تبحث عنها؟' : 'What service are you looking for?'}</Text>
              <Text style={[styles.introText, { color: '#D9E3EC' }]}>{isArabic ? 'اختر الفئة المناسبة من القائمة، وسنضيف تفاصيلها في الخطوة التالية.' : 'Choose the right category. We will add its details in the next step.'}</Text>
            </View>
          </View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{isArabic ? 'جميع الفئات' : 'All categories'}</Text>
          <View style={styles.categoryGrid}>
            {serviceItems.map((service) => {
              const selected = selectedService === service.id;
              return (
                <Pressable
                  key={service.id}
                  testID={`add-service-${service.id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => chooseService(service.id)}
                  style={({ pressed }) => [
                    styles.categoryCard,
                    { backgroundColor: colors.surface, borderColor: selected ? service.color : colors.border },
                    selected && { backgroundColor: `${service.color}14` },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: selected ? service.color : `${service.color}18` }]}>
                    <ServiceIcon icon={service.icon} color={selected ? '#FFFFFF' : service.color} size={23} />
                  </View>
                  <View style={styles.categoryCopy}>
                    <Text style={[styles.categoryTitle, { color: colors.foreground }]}>{isArabic ? service.labelAr : service.label}</Text>
                    <Text style={[styles.categorySubtitle, { color: colors.mutedForeground }]}>{isArabic ? service.subtitleAr : service.subtitle}</Text>
                  </View>
                  <View style={[styles.radio, { borderColor: selected ? service.color : colors.border }]}>
                    {selected ? <View style={[styles.radioDot, { backgroundColor: service.color }]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {selectedService ? (
            <View style={[styles.selectedHint, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
              <Feather name="check-circle" size={17} color={colors.primary} />
              <Text style={[styles.selectedHintText, { color: colors.foreground }]}>{isArabic ? 'تم اختيار الفئة. سيتم تجهيز الخطوة التالية لاحقًا.' : 'Category selected. The next step will be added later.'}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  introCard: { borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 13 },
  introIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1, gap: 5 },
  introTitle: { fontSize: 16, fontWeight: '800' },
  introText: { fontSize: 12, lineHeight: 18 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginTop: 5 },
  categoryGrid: { gap: 11 },
  categoryCard: { minHeight: 86, borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  categoryIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  categoryCopy: { flex: 1, gap: 4 },
  categoryTitle: { fontSize: 14, fontWeight: '800' },
  categorySubtitle: { fontSize: 11 },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  selectedHint: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  selectedHintText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});