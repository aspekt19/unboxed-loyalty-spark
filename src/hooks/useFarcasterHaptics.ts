import { useCallback, useEffect, useState } from 'react';
import sdk from '@farcaster/miniapp-sdk';

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
type NotificationStyle = 'success' | 'warning' | 'error';

export function useFarcasterHaptics() {
  const [isInMiniApp, setIsInMiniApp] = useState(false);

  useEffect(() => {
    const checkContext = async () => {
      try {
        const inMiniApp = await sdk.isInMiniApp();
        setIsInMiniApp(inMiniApp);
      } catch {
        setIsInMiniApp(false);
      }
    };
    checkContext();
  }, []);

  const impactOccurred = useCallback((style: ImpactStyle = 'light') => {
    try {
      if (isInMiniApp && sdk.haptics?.impactOccurred) {
        sdk.haptics.impactOccurred(style);
      }
    } catch {
      // Haptic feedback not available
    }
  }, [isInMiniApp]);

  const notificationOccurred = useCallback((type: NotificationStyle = 'success') => {
    try {
      if (isInMiniApp && sdk.haptics?.notificationOccurred) {
        sdk.haptics.notificationOccurred(type);
      }
    } catch {
      // Haptic notification not available
    }
  }, [isInMiniApp]);

  const selectionChanged = useCallback(() => {
    try {
      if (isInMiniApp && sdk.haptics?.selectionChanged) {
        sdk.haptics.selectionChanged();
      }
    } catch {
      // Haptic selection not available
    }
  }, [isInMiniApp]);

  return {
    isInMiniApp,
    impactOccurred,
    notificationOccurred,
    selectionChanged,
  };
}
