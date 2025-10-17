import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, Calendar } from 'lucide-react';
import { usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';

interface LoyaltyProgram {
  name: string;
  symbol: string;
  timestamp: number;
  tokenAddress?: string;
}

export function CreatedPrograms({ onSelectProgram }: { onSelectProgram: (program: LoyaltyProgram & { tokenAddress: string }) => void }) {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const publicClient = usePublicClient();

  useEffect(() => {
    const loadPrograms = async () => {
      const savedPrograms = JSON.parse(localStorage.getItem('loyaltyPrograms') || '[]');
      
      // Try to fetch token addresses from events
      if (publicClient && savedPrograms.length > 0) {
        try {
          const logs = await publicClient.getLogs({
            address: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
            event: {
              type: 'event',
              name: 'LoyaltyTokenCreated',
              inputs: [
                { name: 'tokenAddress', type: 'address', indexed: true },
                { name: 'merchantAddress', type: 'address', indexed: true },
                { name: 'name', type: 'string', indexed: false },
                { name: 'symbol', type: 'string', indexed: false },
              ],
            },
            fromBlock: 'earliest',
            toBlock: 'latest',
          });

          // Match programs with their token addresses
          const updatedPrograms = savedPrograms.map((prog: LoyaltyProgram) => {
            const matchingLog = logs.find(log => 
              log.args.name === prog.name && log.args.symbol === prog.symbol
            );
            return {
              ...prog,
              tokenAddress: matchingLog?.args.tokenAddress || undefined,
            };
          });

          setPrograms(updatedPrograms);
        } catch (error) {
          console.error('Error fetching token addresses:', error);
          setPrograms(savedPrograms);
        }
      } else {
        setPrograms(savedPrograms);
      }
    };

    loadPrograms();
  }, [publicClient]);

  const handleSelectProgram = (program: LoyaltyProgram, index: number) => {
    if (program.tokenAddress) {
      setSelectedProgram(index.toString());
      onSelectProgram(program as LoyaltyProgram & { tokenAddress: string });
    }
  };

  if (programs.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          Your Loyalty Programs
        </CardTitle>
        <CardDescription>Select a program to issue rewards</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {programs.map((program, index) => (
            <div
              key={index}
              onClick={() => handleSelectProgram(program, index)}
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                selectedProgram === index.toString()
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              } ${!program.tokenAddress ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{program.name}</h3>
                  <p className="text-sm text-muted-foreground">Symbol: {program.symbol}</p>
                  {program.tokenAddress && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {program.tokenAddress.slice(0, 6)}...{program.tokenAddress.slice(-4)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={program.tokenAddress ? "default" : "secondary"}>
                    {program.tokenAddress ? "Active" : "Pending"}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(program.timestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
