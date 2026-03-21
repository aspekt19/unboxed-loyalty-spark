import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface ActivityRow {
  id: string;
  action: string;
  response_status: number | null;
  created_at: string;
}

export function AgentActivityLog({ agentId }: { agentId: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['agent-activity', agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_activity_log')
        .select('id, action, response_status, created_at')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as ActivityRow[];
    },
  });

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading activity...</p>;
  if (logs.length === 0) return <p className="text-xs text-muted-foreground">No activity yet</p>;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Recent Activity</h4>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {logs.map((log) => (
          <div key={log.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{log.action}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {log.response_status && (
                <Badge variant={log.response_status < 400 ? 'default' : 'destructive'} className="text-xs">
                  {log.response_status}
                </Badge>
              )}
              <span className="text-muted-foreground">
                {format(new Date(log.created_at), 'MMM d, HH:mm')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
