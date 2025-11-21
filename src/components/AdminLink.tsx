import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { useAdminStatus } from '@/hooks/useAdminStatus';

export const AdminLink = () => {
  const { isAdmin, isLoading } = useAdminStatus();

  if (isLoading || !isAdmin) {
    return null;
  }

  return (
    <Link to="/admin">
      <Button variant="outline" size="sm" className="gap-2">
        <Shield className="h-4 w-4" />
        <span className="hidden sm:inline">Admin</span>
      </Button>
    </Link>
  );
};
