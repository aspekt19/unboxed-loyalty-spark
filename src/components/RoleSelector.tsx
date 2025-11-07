import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Store, ShoppingBag, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RoleSelectorProps {
  onRoleSelect: (role: 'merchant' | 'customer') => void;
  currentRole?: 'merchant' | 'customer';
}

export function RoleSelector({ onRoleSelect, currentRole }: RoleSelectorProps) {
  const handleRoleSelect = (role: 'merchant' | 'customer') => {
    onRoleSelect(role);
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Welcome to Loyal Spark</h1>
        <p className="text-muted-foreground mb-4">Choose your role to get started</p>
        <Link to="/guide">
          <Button variant="outline" size="sm" className="gap-2">
            <BookOpen className="w-4 h-4" />
            How to Use Guide
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-lg ${currentRole === 'customer' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleRoleSelect('customer')}
        >
          <CardHeader>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ShoppingBag className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Customer</CardTitle>
            <CardDescription>
              Collect loyalty tokens, exchange them for rewards, and trade on the DEX
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full pointer-events-none"
              variant={currentRole === 'customer' ? 'default' : 'outline'}
            >
              {currentRole === 'customer' ? 'Current Role' : 'Enter as Customer'}
            </Button>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-lg ${currentRole === 'merchant' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleRoleSelect('merchant')}
        >
          <CardHeader>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Store className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Merchant</CardTitle>
            <CardDescription>
              Create loyalty programs, issue tokens, and manage rewards for your customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full pointer-events-none"
              variant={currentRole === 'merchant' ? 'default' : 'outline'}
            >
              {currentRole === 'merchant' ? 'Current Role' : 'Enter as Merchant'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
