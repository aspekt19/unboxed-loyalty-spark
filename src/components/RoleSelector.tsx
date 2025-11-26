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
    <div className="container max-w-4xl mx-auto py-6 sm:py-8 px-3 sm:px-4">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Welcome to Loyal Spark</h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">Choose your role to get started</p>
        <Link to="/guide">
          <Button variant="outline" size="sm" className="gap-1.5 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm">
            <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
            How to Use Guide
          </Button>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-lg ${currentRole === 'customer' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleRoleSelect('customer')}
        >
          <CardHeader className="p-4 sm:p-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <CardTitle className="text-lg sm:text-xl">Customer</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Collect loyalty tokens, exchange them for rewards, and trade on the DEX
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <Button 
              className="w-full pointer-events-none text-xs sm:text-sm h-9 sm:h-10"
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
          <CardHeader className="p-4 sm:p-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
              <Store className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <CardTitle className="text-lg sm:text-xl">Merchant</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Create loyalty programs, issue tokens, and manage rewards for your customers
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <Button 
              className="w-full pointer-events-none text-xs sm:text-sm h-9 sm:h-10"
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
