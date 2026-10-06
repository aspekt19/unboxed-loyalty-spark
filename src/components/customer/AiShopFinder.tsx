import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wand2, Loader2, Store, ChevronRight, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

export interface FinderMerchant {
  merchant_address: string;
  business_name: string;
  logo_url: string | null;
}

interface Match {
  id: string;
  reason: string;
  program: string | null;
}

const EXAMPLES = ['Coffee near me with good cashback', 'Online clothing store', 'Gym rewards'];

export function AiShopFinder({ merchants }: { merchants: FinderMerchant[] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ summary: string; matches: Match[] } | null>(null);

  const byId = new Map(merchants.map((m) => [m.merchant_address.toLowerCase(), m]));

  const run = async (q = query) => {
    const text = q.trim();
    if (text.length < 2 || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('discover-ai-match', {
        body: { query: text },
      });
      if (fnError) {
        let msg = 'AI search is temporarily unavailable.';
        try {
          const body = await (fnError as { context?: Response }).context?.json();
          if (body?.error) msg = body.error;
        } catch { /* keep default */ }
        setError(msg);
        return;
      }
      if (data?.error) setError(data.error);
      else setResult({ summary: data?.summary ?? '', matches: data?.matches ?? [] });
    } catch {
      setError('AI search is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Ask AI to find a shop</span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                run();
              }
            }}
            maxLength={400}
            rows={1}
            placeholder="Describe what you're looking for…"
            className="min-h-[40px] resize-none"
          />
          <Button type="submit" disabled={loading || query.trim().length < 2} className="sm:w-28">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
          </Button>
        </form>

        {!result && !error && !loading && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQuery(ex);
                  run(ex);
                }}
                className="text-[11px] rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:bg-secondary"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {result && (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">{result.summary}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                aria-label="Clear AI results"
                onClick={() => setResult(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {result.matches.length > 0 && (
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {result.matches.map((m) => {
                  const merchant = byId.get(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => navigate(`/shop/${merchant?.merchant_address ?? m.id}`)}
                      className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-accent/40 transition-colors"
                    >
                      {merchant?.logo_url ? (
                        <img src={merchant.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Store className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">
                            {merchant?.business_name ?? 'Shop'}
                          </span>
                          {m.program && (
                            <Badge variant="outline" className="text-[10px] truncate max-w-[50%]">
                              {m.program}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{m.reason}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
