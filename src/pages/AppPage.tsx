import { RoleSelector } from '@/components/RoleSelector';
import { useNavigate } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';

export default function AppPage() {
  const navigate = useNavigate();

  const handleRoleSelect = (role: 'merchant' | 'customer') => {
    if (role === 'customer') {
      navigate('/customer');
    } else {
      navigate('/merchant');
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-white">
        <RoleSelector onRoleSelect={handleRoleSelect} />
      </div>
    </PageTransition>
  );
}
