import { RoundUpDashboard } from '@/components/roundup/RoundUpDashboard';
import PageTransition from '@/components/PageTransition';

export default function CustomerPage() {
  return (
    <PageTransition>
      <div className="min-h-screen bg-white">
        <RoundUpDashboard />
      </div>
    </PageTransition>
  );
}
