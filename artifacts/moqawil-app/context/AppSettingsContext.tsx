import React, { createContext, type ReactNode, useContext } from 'react';
import { getGetAppSettingsQueryKey, useGetAppSettings, type PublicAppSettings } from '@workspace/api-client-react';

const AppSettingsContext = createContext<PublicAppSettings | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const query = useGetAppSettings({
    query: {
      queryKey: getGetAppSettingsQueryKey(),
      staleTime: 30_000,
      refetchOnMount: 'always',
      refetchInterval: 30_000,
      retry: 2,
    },
  });
  return <AppSettingsContext.Provider value={query.data ?? null}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}