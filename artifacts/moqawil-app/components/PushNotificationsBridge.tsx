import React, { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@clerk/expo';
import { useRegisterPushDevice } from '@workspace/api-client-react';
import { getPushDeviceRegistration } from '@/constants/pushNotifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function PushNotificationsBridge() {
  const { isSignedIn } = useAuth();
  const registerDevice = useRegisterPushDevice();

  useEffect(() => {
    if (!isSignedIn || Platform.OS === 'web') return;
    void getPushDeviceRegistration(false)
      .then((registration) => {
        if (registration) registerDevice.mutate({ data: registration });
      })
      .catch(() => undefined);
  }, [isSignedIn]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && url.length > 0) void Linking.openURL(url);
    });
    return () => subscription.remove();
  }, []);

  return null;
}
