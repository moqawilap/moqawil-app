import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

type Locale = 'en' | 'ar';
type LocationState = {
  city: string;
  area: string;
  source: 'default' | 'device';
};

type AppContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isArabic: boolean;
  location: LocationState;
  refreshLocation: () => Promise<void>;
  savedIds: string[];
  toggleSaved: (id: string) => void;
  isSaved: (id: string) => boolean;
  activeService: string | null;
  setActiveService: (service: string | null) => void;
};

const STORAGE_KEY = '@moqawil/preferences';
const defaultLocation: LocationState = { city: 'Muscat', area: 'Al Khuwair', source: 'default' };

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [location, setLocation] = useState<LocationState>(defaultLocation);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeService, setActiveService] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        const parsed = JSON.parse(value) as { locale?: Locale; location?: LocationState; savedIds?: string[] };
        if (parsed.locale) setLocaleState(parsed.locale);
        if (parsed.location) setLocation(parsed.location);
        if (parsed.savedIds) setSavedIds(parsed.savedIds);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ locale, location, savedIds })).catch(() => undefined);
  }, [locale, location, savedIds]);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    Haptics.selectionAsync().catch(() => undefined);
  };

  const toggleSaved = (id: string) => {
    setSavedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  const refreshLocation = async () => {
    try {
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) throw new Error('Geolocation unavailable');
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              setLocation({ city: 'Muscat', area: 'Near you', source: 'device' });
              resolve();
            },
            reject,
            { enableHighAccuracy: false, timeout: 8000 },
          );
        });
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        Alert.alert('Location access needed', 'You can continue with Muscat, or allow location to see nearby providers.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const places = await Location.reverseGeocodeAsync({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
      const place = places[0];
      setLocation({
        city: place?.city || place?.district || 'Muscat',
        area: place?.district || place?.subregion || 'Near you',
        source: 'device',
      });
    } catch {
      Alert.alert('Could not update location', 'Showing providers around Muscat for now.');
    }
  };

  const value = useMemo<AppContextValue>(
    () => ({
      locale,
      setLocale,
      isArabic: locale === 'ar',
      location,
      refreshLocation,
      savedIds,
      toggleSaved,
      isSaved: (id: string) => savedIds.includes(id),
      activeService,
      setActiveService,
    }),
    [locale, location, savedIds, activeService],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}