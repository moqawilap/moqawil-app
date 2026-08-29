import React, { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider } from '@/context/AppContext';
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

function RootLayoutNav() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const isAuthRoute = segments[0] === '(auth)';

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn && !isAuthRoute) router.replace('/sign-in');
    if (isSignedIn && isAuthRoute) router.replace('/');
  }, [isAuthRoute, isLoaded, isSignedIn]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
        <Stack.Screen name="admin" options={{ presentation: 'modal' }} />
        <Stack.Screen name="subscription" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
        <Stack.Screen name="contractor-profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="service-request" options={{ presentation: 'modal' }} />
        <Stack.Screen name="requests" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workshop-requests" options={{ presentation: 'modal' }} />
      </Stack>
      {(!isLoaded || (!isSignedIn && !isAuthRoute) || (isSignedIn && isAuthRoute)) ? <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7FAFC' }}><ActivityIndicator color="#0E5A70" /></View> : null}
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
            <AppProvider>
              <QueryClientProvider client={queryClient}>
                <AuthUserSync />
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </QueryClientProvider>
            </AppProvider>
          </ApiAuthBridge>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
