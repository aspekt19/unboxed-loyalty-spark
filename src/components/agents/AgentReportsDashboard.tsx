import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { FileText, CheckCircle, Clock, AlertTriangle, Eye, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface AgentReport {
  id: string;
  agent_name: string;
  agent_role: string;
  report_type: string;
  title: string;
  content: string;
  priority: string | null;
  status: string | null;
  action_items: Json | null;
  metadata: Json | null;
  created_at: string | null;
  reviewed_at: string | null;
}

const priorityConfig: Record<string, { color: string; icon: typeof AlertTriangle }> = {
  critical: { color: 'destructive', icon: AlertTriangle },
  high: { color: 'destructive', icon: AlertTriangle },
  medium: { color: 'default', icon: Clock },
  low: { color: 'secondary', icon: Clock },
};

const statusConfig: Record<string, string> = {
  new: 'default',
  reviewed: 'secondary',
  in_progress: 'outline',
  done: 'default',
  dismissed: 'secondary',
};

export function AgentReportsDashboard() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['agent-reports', statusFilter],
    queryFn: async () => {
      const query = supabase
        .from('agent_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (statusFilter !== 'all') {
        query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AgentReport[];
    },
  });

  const updateStatus = async (reportId: string, newStatus: string) => {
    try {
      const { error } = await supabase.functions.invoke('agent-reports', {
        method: 'PATCH',
        body: { report_id: reportId, status: newStatus },
      });
      if (error) throw error;
      toast.success(`Status updated to "${newStatus}"`);
      queryClient.invalidateQueries({ queryKey: ['agent-reports'] });
    } catch {
      toast.error('Failed to update status');
    }
  };

  const roleColors: Record<string, string> = {
    ceo: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    seo: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    growth: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    analyst: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Agent Reports</CardTitle>
              <CardDescription>Reports from your AI agent team</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
          </TabsList>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading reports...</p>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No reports yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Reports will appear here after your agents run their first workflow
                </p>
              </div>
            ) : (
              reports.map((report) => {
                const isExpanded = expandedId === report.id;
                const actionItems = Array.isArray(report.action_items) ? report.action_items as string[] : [];

                return (
                  <div
                    key={report.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : report.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[report.agent_role.toLowerCase()] || 'bg-muted text-muted-foreground'}`}>
                            {report.agent_role}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {report.report_type.replace(/_/g, ' ')}
                          </Badge>
                          {report.priority && (
                            <Badge variant={report.priority === 'critical' || report.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                              {report.priority}
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium text-sm truncate">{report.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {report.agent_name} · {report.created_at ? format(new Date(report.created_at), 'MMM d, HH:mm') : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge variant={(statusConfig[report.status || 'new'] || 'default') as any} className="text-xs">
                          {report.status || 'new'}
                        </Badge>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-3 border-t pt-3">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <p className="text-sm whitespace-pre-wrap">{report.content}</p>
                        </div>

                        {actionItems.length > 0 && (
                          <div>
                            <h5 className="text-xs font-medium mb-1">Action Items:</h5>
                            <ul className="list-disc list-inside text-xs space-y-0.5 text-muted-foreground">
                              {actionItems.map((item, i) => (
                                <li key={i}>{String(item)}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          {report.status !== 'reviewed' && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(report.id, 'reviewed')}>
                              <Eye className="h-3 w-3 mr-1" /> Mark Reviewed
                            </Button>
                          )}
                          {report.status !== 'in_progress' && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(report.id, 'in_progress')}>
                              <Clock className="h-3 w-3 mr-1" /> In Progress
                            </Button>
                          )}
                          {report.status !== 'done' && (
                            <Button size="sm" variant="default" onClick={() => updateStatus(report.id, 'done')}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Done
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
