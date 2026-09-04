import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PushNotificationsBridge } from '@/components/PushNotificationsBridge';
import colors from '@/constants/colors';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider, useApp } from '@/context/AppContext';
import { AppSettingsProvider } from '@/context/AppSettingsContext';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { getGetMeQueryKey, setAuthTokenGetter, setBaseUrl, useGetMe } from '@workspace/api-client-react';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const apiDomain = process.env.EXPO_PUBLIC_DOMAIN;
setBaseUrl(apiDomain ? `https://${apiDomain}` : null);

function ApiAuthBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setAuthTokenGetter(async () => (await getToken()) ?? null);
    setReady(true);
  }, [getToken]);
  return isLoaded && ready ? children : null;
}

function AuthUserSync() {
  const { isSignedIn } = useAuth();
  useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled: !!isSignedIn, retry: 1 } });
  return null;
}

function LoadingLogo() {
  const entrance = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const reveal = Animated.timing(entrance, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    reveal.start();
    breathing.start();
    return () => {
      reveal.stop();
      breathing.stop();
    };
  }, [breathe, entrance]);

  const logoOpacity = entrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const logoScale = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const logoTranslateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const ringScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.08] });
  const ringOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.08] });

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.background, zIndex: 100 }}>
      <Animated.View style={{ position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 1.5, borderColor: colors.light.accentForeground, opacity: ringOpacity, transform: [{ scale: ringScale }] }} />
      <View style={{ width: 174, height: 174, borderRadius: 87, borderWidth: 1, borderColor: colors.light.border, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }, { translateY: logoTranslateY }] }}>
          <Image source={require('@/assets/images/moqawil-logo.png')} style={{ width: 128, height: 128, resizeMode: 'contain' }} />
        </Animated.View>
      </View>
      <Animated.View style={{ position: 'absolute', top: '63%', opacity: logoOpacity, transform: [{ translateY: logoTranslateY }] }}>
        <Text style={{ color: colors.light.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>MOQAWIL · مقاول</Text>
      </Animated.View>
    </View>
  );
}

function RootLayoutNav() {
  const { isLoaded, isSignedIn } = useAuth();
  const { preferencesLoaded } = useApp();
  const segments = useSegments();
  const isAuthRoute = segments[0] === '(auth)';
  const [introFinished, setIntroFinished] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn && !isAuthRoute) router.replace('/sign-in');
    if (isSignedIn && isAuthRoute) router.replace('/');
  }, [isAuthRoute, isLoaded, isSignedIn]);

  useEffect(() => {
    const timer = setTimeout(() => setIntroFinished(true), 1550);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
        <Stack.Screen name="admin" options={{ presentation: 'modal' }} />
        <Stack.Screen name="subscription" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
        <Stack.Screen name="contractor-profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="contractor-project" options={{ presentation: 'modal' }} />
        <Stack.Screen name="service-registration" options={{ presentation: 'modal' }} />
        <Stack.Screen name="my-submissions" options={{ presentation: 'modal' }} />
        <Stack.Screen name="service-request" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-service" options={{ presentation: 'modal' }} />
        <Stack.Screen name="requests" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workshop-requests" options={{ presentation: 'modal' }} />
      </Stack>
      {(!introFinished || !isLoaded || !preferencesLoaded || (!isSignedIn && !isAuthRoute) || (isSignedIn && isAuthRoute)) ? <LoadingLogo /> : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''} tokenCache={tokenCache}>
          <ApiAuthBridge>
            <QueryClientProvider client={queryClient}>
              <AppSettingsProvider>
                <AppProvider>
                <AuthUserSync />
                <PushNotificationsBridge />
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
                </AppProvider>
              </AppSettingsProvider>
            </QueryClientProvider>
          </ApiAuthBridge>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
