import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Bot, Plus, Key, Copy, Check, RefreshCw, Power, PowerOff, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AgentActivityLog } from './AgentActivityLog';

const AVAILABLE_SCOPES = [
  { value: 'read', label: 'Read', description: 'View programs, rewards, balances' },
  { value: 'create_program', label: 'Create Programs', description: 'Deploy new loyalty programs' },
  { value: 'mint', label: 'Mint Tokens', description: 'Issue loyalty tokens' },
  { value: 'trade', label: 'Trade', description: 'Create/accept marketplace offers' },
  { value: 'manage_rewards', label: 'Manage Rewards', description: 'Create and manage rewards' },
];

interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  api_key_prefix: string;
  scopes: string[];
  is_active: boolean;
  total_requests: number;
  last_request_at: string | null;
  created_at: string;
}

export function AgentManagement() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read']);
  const [isCreating, setIsCreating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents', address],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_registry')
        .select('id, name, description, api_key_prefix, scopes, is_active, total_requests, last_request_at, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AgentRow[];
    },
    enabled: !!address,
  });

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter an agent name');
      return;
    }
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-api-key', {
        body: { action: 'generate', name, description, scopes: selectedScopes },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setNewApiKey(data.api_key);
      toast.success(`Agent "${data.agent.name}" created!`);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setName('');
      setDescription('');
      setSelectedScopes(['read']);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create agent');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (agentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('agent-api-key', {
        body: { action: 'revoke', agent_id: agentId },
      });
      if (error) throw error;
      toast.success('Agent deactivated');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch {
      toast.error('Failed to deactivate agent');
    }
  };

  const handleRegenerate = async (agentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('agent-api-key', {
        body: { action: 'regenerate', agent_id: agentId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setNewApiKey(data.api_key);
      toast.success('New API key generated');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch {
      toast.error('Failed to regenerate key');
    }
  };

  const copyKey = () => {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('API key copied to clipboard');
    }
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  return (
    <div className="space-y-6">
      {/* New API Key Alert */}
      {newApiKey && (
        <Alert className="border-primary bg-primary/5">
          <Key className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <p className="font-semibold">⚠️ Save your API key now — it won't be shown again!</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs break-all font-mono">
                {newApiKey}
              </code>
              <Button variant="outline" size="icon" onClick={copyKey}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setNewApiKey(null)}>
              I've saved it
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Create Agent */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                AI Agents
              </CardTitle>
              <CardDescription>Register AI agents that can interact with your loyalty programs via API</CardDescription>
            </div>
            <Button onClick={() => setShowCreate(!showCreate)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Agent
            </Button>
          </div>
        </CardHeader>

        {showCreate && (
          <CardContent className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Agent Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CoffeeBot Agent"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this agent do?"
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <label
                    key={scope.value}
                    className="flex items-start gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedScopes.includes(scope.value)}
                      onCheckedChange={() => toggleScope(scope.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{scope.label}</p>
                      <p className="text-xs text-muted-foreground">{scope.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={isCreating || !name.trim()} className="w-full">
              {isCreating ? 'Creating...' : 'Create Agent & Generate API Key'}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Agent List */}
      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading agents...</CardContent></Card>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No agents registered yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <Card key={agent.id} className={!agent.is_active ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{agent.name}</h3>
                      <Badge variant={agent.is_active ? 'default' : 'secondary'} className="text-xs">
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {agent.description && (
                      <p className="text-xs text-muted-foreground mt-1">{agent.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {agent.scopes?.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Key: <code>{agent.api_key_prefix}...</code></span>
                      <span>Requests: {agent.total_requests}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSelectedAgentId(selectedAgentId === agent.id ? null : agent.id)}
                      title="View activity"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRegenerate(agent.id)}
                      title="Regenerate API key"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRevoke(agent.id)}
                      disabled={!agent.is_active}
                      title="Deactivate"
                    >
                      <PowerOff className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {selectedAgentId === agent.id && (
                  <div className="mt-4 border-t pt-4">
                    <AgentActivityLog agentId={agent.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
