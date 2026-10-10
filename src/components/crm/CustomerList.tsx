import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Users } from 'lucide-react';
import { useMerchantCustomerIndex } from '@/hooks/useMerchantCustomerIndex';

interface Customer {
  id: string;
  wallet_address: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  total_purchases: number;
  total_spent: number;
  last_purchase_date: string | null;
  rfm_score: string | null;
  created_at: string;
}

const RFM_LABELS = {
  champions: { label: 'Champions', variant: 'default' as const, color: 'bg-green-500' },
  loyal: { label: 'Loyal', variant: 'secondary' as const, color: 'bg-blue-500' },
  at_risk: { label: 'At Risk', variant: 'destructive' as const, color: 'bg-yellow-500' },
  lost: { label: 'Lost', variant: 'outline' as const, color: 'bg-gray-500' },
  new: { label: 'New', variant: 'outline' as const, color: 'bg-purple-500' },
};

export function CustomerList() {
  const { address } = useAccount();
  const { data: index, isLoading: loading, error: queryError } = useMerchantCustomerIndex(address);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [rfmFilter, setRfmFilter] = useState<string>('all');
  const error = queryError ? 'Failed to load customers' : null;

  const customers = useMemo<Customer[]>(() => {
    if (!index) return [];
    const existingAddresses = new Set(index.profiles.map((c) => c.wallet_address));
    const missingAddresses = index.customerAddresses.filter((addr) => !existingAddresses.has(addr));

    const fromProfiles: Customer[] = index.profiles.map((c) => ({
      id: c.id,
      wallet_address: c.wallet_address,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      total_purchases: c.total_purchases || 0,
      total_spent: c.total_spent || 0,
      last_purchase_date: c.last_purchase_date,
      rfm_score: c.rfm_score,
      created_at: c.created_at || new Date().toISOString(),
    }));

    const placeholders: Customer[] = missingAddresses.map((addr) => ({
      id: '',
      wallet_address: addr,
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      total_purchases: 0,
      total_spent: 0,
      last_purchase_date: null,
      rfm_score: 'new',
      created_at: new Date().toISOString(),
    }));

    return [...fromProfiles, ...placeholders];
  }, [index]);

  useEffect(() => {
    let filtered = customers;

    // Фильтр по RFM
    if (rfmFilter !== 'all') {
      filtered = filtered.filter((c) => c.rfm_score === rfmFilter);
    }

    // Поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.wallet_address.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.first_name?.toLowerCase().includes(query) ||
          c.last_name?.toLowerCase().includes(query)
      );
    }

    setFilteredCustomers(filtered);
  }, [customers, searchQuery, rfmFilter]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Customer Management</h2>
        <p className="text-muted-foreground">View and manage your loyalty program customers</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by wallet, email, or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={rfmFilter} onValueChange={setRfmFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            <SelectItem value="champions">Champions</SelectItem>
            <SelectItem value="loyal">Loyal</SelectItem>
            <SelectItem value="at_risk">At Risk</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            <SelectItem value="new">New</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredCustomers.length === 0 ? (
        <Alert>
          <Users className="h-4 w-4" />
          <AlertDescription>
            {customers.length === 0
              ? 'No customers yet. Start issuing tokens to build your customer base!'
              : 'No customers match your filters.'}
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Customers ({filteredCustomers.length})</CardTitle>
            <CardDescription>RFM segmentation based on purchase behavior</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredCustomers.map((customer) => {
                const rfmInfo = customer.rfm_score
                  ? RFM_LABELS[customer.rfm_score as keyof typeof RFM_LABELS]
                  : RFM_LABELS.new;

                return (
                  <div
                    key={customer.wallet_address}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {customer.first_name && customer.last_name
                            ? `${customer.first_name} ${customer.last_name}`
                            : 'Anonymous Customer'}
                        </p>
                        <Badge variant={rfmInfo.variant}>{rfmInfo.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        {customer.wallet_address.slice(0, 6)}...{customer.wallet_address.slice(-4)}
                      </p>
                      {customer.email && (
                        <p className="text-sm text-muted-foreground">{customer.email}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-6 text-sm text-right">
                      <div>
                        <p className="text-muted-foreground">Purchases</p>
                        <p className="font-semibold">{customer.total_purchases}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Spent</p>
                        <p className="font-semibold">{Number(customer.total_spent).toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
