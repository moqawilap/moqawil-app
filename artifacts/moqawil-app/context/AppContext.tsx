import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { recordListingEngagement } from '@workspace/api-client-react';
import { images, listings, providers as seedProviders, type Provider } from '@/data/mockData';

type Locale = 'en' | 'ar';
type LocationState = {
  city: string;
  area: string;
  source: 'default' | 'device' | 'manual';
};

type AppContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isArabic: boolean;
  preferencesLoaded: boolean;
  location: LocationState;
  locationLoading: boolean;
  refreshLocation: (options?: { silent?: boolean }) => Promise<void>;
  selectLocation: (location: { city: string; area: string }) => void;
  savedIds: string[];
  toggleSaved: (id: string, options?: { subjectKind?: 'property' | 'provider' | 'project'; subjectName?: string }) => void;
  isSaved: (id: string) => boolean;
  engagementClientId: string | null;
  activeService: string | null;
  setActiveService: (service: string | null) => void;
  managedProviders: Provider[];
  addContractor: (input: {
    name: string;
    specialty: string;
    city: string;
    contractAmount: string;
    phone: string;
  }) => void;
  updateProvider: (id: string, patch: Partial<Provider>) => void;
  removeProvider: (id: string) => void;
};

const STORAGE_KEY = '@moqawil/preferences-v2';
const defaultLocation: LocationState = { city: 'Muscat', area: 'Al Khuwair', source: 'default' };
function createEngagementClientId() {
  return `moqawil-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const savedAccountKey = userId ? `user:${userId}` : 'guest';
  const initialSavedAccountKey = useRef(savedAccountKey).current;
  const [locale, setLocaleState] = useState<Locale>('en');
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [location, setLocation] = useState<LocationState>(defaultLocation);
  const [locationLoading, setLocationLoading] = useState(false);
  const [savedIdsByAccount, setSavedIdsByAccount] = useState<Record<string, string[]>>({});
  const [legacySavedIds, setLegacySavedIds] = useState<string[]>([]);
  const [legacySavedIdsOwner, setLegacySavedIdsOwner] = useState(initialSavedAccountKey);
  const [engagementClientId, setEngagementClientId] = useState<string | null>(null);
  const [activeService, setActiveService] = useState<string | null>(null);
  const [managedProviders, setManagedProviders] = useState<Provider[]>(seedProviders);
  const locationRequestId = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) {
          const parsed = JSON.parse(value) as { locale?: Locale; location?: LocationState; savedIds?: string[]; savedIdsByAccount?: Record<string, string[]>; savedIdsLegacyOwner?: string; managedProviders?: Provider[]; engagementClientId?: string };
          if (parsed.locale) setLocaleState(parsed.locale);
          if (parsed.location) setLocation(parsed.location);
          const legacy = parsed.savedIds ?? [];
          setLegacySavedIds(legacy);
          const migratedOwner = parsed.savedIdsLegacyOwner ?? initialSavedAccountKey;
          setLegacySavedIdsOwner(migratedOwner);
          setSavedIdsByAccount({
            ...(legacy.length ? { [migratedOwner]: legacy } : {}),
            ...(parsed.savedIdsByAccount ?? {}),
          });
          if (parsed.managedProviders) setManagedProviders(parsed.managedProviders);
          setEngagementClientId(parsed.engagementClientId ?? createEngagementClientId());
        } else {
          setEngagementClientId(createEngagementClientId());
        }
      })
      .catch(() => setEngagementClientId(createEngagementClientId()))
      .finally(() => setPreferencesLoaded(true));
  }, [initialSavedAccountKey]);

  useEffect(() => {
     if (engagementClientId) {
       AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
         locale,
         location,
         savedIds: legacySavedIds,
         savedIdsByAccount,
         savedIdsLegacyOwner: legacySavedIdsOwner,
         managedProviders,
         engagementClientId,
       })).catch(() => undefined);
     }
    }, [locale, location, legacySavedIds, legacySavedIdsOwner, savedIdsByAccount, managedProviders, engagementClientId]);

  const savedIds = savedIdsByAccount[savedAccountKey] ?? [];

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    Haptics.selectionAsync().catch(() => undefined);
  };

  const toggleSaved = (id: string, options?: { subjectKind?: 'property' | 'provider' | 'project'; subjectName?: string }) => {
    const willSave = !savedIds.includes(id);
    setSavedIdsByAccount((current) => {
      const accountSaved = current[savedAccountKey] ?? [];
      return {
        ...current,
        [savedAccountKey]: accountSaved.includes(id) ? accountSaved.filter((item) => item !== id) : [...accountSaved, id],
      };
    });
    const listing = listings.find((item) => item.id === id);
    const subjectKind = options?.subjectKind ?? (listing ? 'property' : 'provider');
    if (engagementClientId) {
      const send = async () => {
        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            await recordListingEngagement(id, {
              action: 'save',
              clientId: engagementClientId,
              active: willSave,
              subjectKind,
            });
            return;
          } catch (error) {
            lastError = error;
            if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
          }
        }
        throw lastError;
      };
      send().catch(() => {
        Alert.alert(
          locale === 'ar' ? 'تعذر تحديث الحفظ' : 'Could not update saved item',
          locale === 'ar' ? 'تم حفظ اختيارك على هذا الجهاز، لكن تعذر إبلاغ صاحب الإعلان.' : 'Your choice was saved on this device, but the advertiser could not be notified.',
        );
      });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  const refreshLocation = async ({ silent = false }: { silent?: boolean } = {}) => {
    const requestId = ++locationRequestId.current;
    setLocationLoading(true);
    try {
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) throw new Error('Geolocation unavailable');
        const coordinates = await new Promise<GeolocationCoordinates>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve(position.coords),
            reject,
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
          );
        });
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&lat=${coordinates.latitude}&lon=${coordinates.longitude}`, { headers: { Accept: 'application/json' } });
          if (!response.ok) throw new Error('Reverse geocoding failed');
          const result = await response.json() as { address?: Record<string, string> };
          const address = result.address ?? {};
          if (requestId === locationRequestId.current) {
            setLocation({
              city: address.city || address.town || address.municipality || address.state || 'Oman',
              area: address.suburb || address.neighbourhood || address.village || address.city || 'Near you',
              source: 'device',
            });
          }
        } catch {
          if (requestId === locationRequestId.current) {
            setLocation({ city: 'Oman', area: 'Near your location', source: 'device' });
          }
        }
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        Alert.alert(
          locale === 'ar' ? 'السماح بالوصول إلى الموقع' : 'Location access needed',
          locale === 'ar' ? 'اسمح للتطبيق بالوصول إلى موقعك الحالي من نافذة الهاتف، أو يمكنك المتابعة باستخدام مسقط.' : 'Allow the app to access your current location from the phone prompt, or continue using Muscat.',
        );
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const places = await Location.reverseGeocodeAsync({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
      const place = places[0];
      if (requestId === locationRequestId.current) {
        setLocation({
          city: place?.city || place?.district || 'Muscat',
          area: place?.district || place?.subregion || 'Near you',
          source: 'device',
        });
      }
    } catch {
      if (!silent) Alert.alert(locale === 'ar' ? 'تعذر تحديد الموقع' : 'Could not update location', locale === 'ar' ? 'اسمح للمتصفح بالوصول إلى موقعك ثم اضغط مرة أخرى.' : 'Allow location access in your browser, then try again.');
    } finally {
      if (requestId === locationRequestId.current) {
        setLocationLoading(false);
      }
    }
  };

  const selectLocation = ({ city, area }: { city: string; area: string }) => {
    locationRequestId.current += 1;
    setLocationLoading(false);
    setLocation({ city, area, source: 'manual' });
    Haptics.selectionAsync().catch(() => undefined);
  };

  const addContractor = (input: { name: string; specialty: string; city: string; contractAmount: string; phone: string }) => {
    const id = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const contractor: Provider = {
      id,
      role: 'contractor',
      name: input.name,
      nameAr: input.name,
      specialty: input.specialty || 'General contracting',
      specialtyAr: input.specialty || 'مقاولات عامة',
      rating: 0,
      reviews: 0,
      distance: 'New',
      city: input.city || 'Muscat',
      verified: false,
      image: images.contractor,
      accent: '#0F6FB7',
      description: `Contract amount: ${input.contractAmount || 'Not set'} · Contact: ${input.phone || 'Not set'}`,
      descriptionAr: `قيمة العقد: ${input.contractAmount || 'غير محدد'} · التواصل: ${input.phone || 'غير محدد'}`,
      projects: 0,
      startingPrice: input.contractAmount || 'Not set',
      contractAmount: input.contractAmount || 'Not set',
      phone: input.phone || 'Not set',
    };
    setManagedProviders((current) => [contractor, ...current]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  const updateProvider = (id: string, patch: Partial<Provider>) => {
    setManagedProviders((current) => current.map((provider) => provider.id === id ? { ...provider, ...patch } : provider));
    Haptics.selectionAsync().catch(() => undefined);
  };

  const removeProvider = (id: string) => {
    setManagedProviders((current) => current.filter((provider) => provider.id !== id));
    setSavedIdsByAccount((current) => ({
      ...current,
      [savedAccountKey]: (current[savedAccountKey] ?? []).filter((savedId) => savedId !== id),
    }));
  };

  const value = useMemo<AppContextValue>(
    () => ({
      locale,
      setLocale,
      isArabic: locale === 'ar',
      preferencesLoaded,
      location,
      locationLoading,
      refreshLocation,
      selectLocation,
      savedIds,
      toggleSaved,
      isSaved: (id: string) => savedIds.includes(id),
       engagementClientId,
      activeService,
      setActiveService,
      managedProviders,
      addContractor,
      updateProvider,
      removeProvider,
    }),
     [locale, location, locationLoading, savedIds, savedAccountKey, engagementClientId, activeService, managedProviders, preferencesLoaded],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}