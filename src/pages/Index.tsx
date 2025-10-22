import { LandingPage } from '@/components/LandingPage';
import { FarcasterSplash } from '@/components/FarcasterSplash';
import { RoleSelector } from '@/components/RoleSelector';
import { useNavigate } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

const Index = () => {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(false);
  const [isFarcaster, setIsFarcaster] = useState(false);

  useEffect(() => {
    // Check if running in Farcaster miniapp context
    const checkFarcasterContext = async () => {
      try {
        const context = await sdk.context;
        if (context) {
          setIsFarcaster(true);
          setShowSplash(true);
        }
      } catch (error) {
        // Not in Farcaster context, show landing page
        setIsFarcaster(false);
      }
    };

    checkFarcasterContext();
  }, []);

  const handleLaunch = () => {
    setShowSplash(false);
  };

  const handleRoleSelect = (role: 'merchant' | 'customer') => {
    if (role === 'customer') {
      navigate('/customer');
    } else {
      navigate('/merchant');
    }
  };

  // In Farcaster: show splash -> role selector
  if (isFarcaster) {
    if (showSplash) {
      return (
        <PageTransition>
          <FarcasterSplash onLaunch={handleLaunch} />
        </PageTransition>
      );
    }
    return (
      <PageTransition>
        <div className="min-h-screen bg-white">
          <RoleSelector onRoleSelect={handleRoleSelect} />
        </div>
      </PageTransition>
    );
  }

  // In web: show landing page
  return (
    <PageTransition>
      <LandingPage />
    </PageTransition>
  );
};

export default Index;
