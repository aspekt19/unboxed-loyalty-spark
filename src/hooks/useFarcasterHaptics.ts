import { useCallback, useEffect, useState } from 'react';
import sdk from '@farcaster/miniapp-sdk';

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
type NotificationStyle = 'success' | 'warning' | 'error';

export function useFarcasterHaptics() {
  const [isInMiniApp, setIsInMiniApp] = useState(false);

  useEffect(() => {
    // Check if we're in Farcaster miniapp context
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
    } catch (error) {
      console.log('Haptic feedback not available:', error);
    }
  }, [isInMiniApp]);

  const notificationOccurred = useCallback((type: NotificationStyle = 'success') => {
    try {
      if (isInMiniApp && sdk.haptics?.notificationOccurred) {
        sdk.haptics.notificationOccurred(type);
      }
    } catch (error) {
      console.log('Haptic notification not available:', error);
    }
  }, [isInMiniApp]);

  const selectionChanged = useCallback(() => {
    try {
      if (isInMiniApp && sdk.haptics?.selectionChanged) {
        sdk.haptics.selectionChanged();
      }
    } catch (error) {
      console.log('Haptic selection not available:', error);
    }
  }, [isInMiniApp]);

  return {
    isInMiniApp,
    impactOccurred,
    notificationOccurred,
    selectionChanged,
  };
}
