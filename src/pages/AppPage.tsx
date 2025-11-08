import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import PageTransition from '@/components/PageTransition';

export default function AppPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect directly to customer dashboard (Round-Up investing)
    navigate('/customer');
  }, [navigate]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    </PageTransition>
  );
}
