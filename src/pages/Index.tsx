import { RoleSelector } from '@/components/RoleSelector';
import { FarcasterSplash } from '@/components/FarcasterSplash';
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
        // Not in Farcaster context, show normal flow
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

  // Show splash only in Farcaster and only initially
  if (isFarcaster && showSplash) {
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
};

export default Index;
