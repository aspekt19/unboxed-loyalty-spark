import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Bot, Plus, Key, Copy, Check, RefreshCw, Power, PowerOff, Eye, FileText, ExternalLink, Cpu, Wallet, Loader2, BookOpen, Trash2, Pencil } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AgentActivityLog } from './AgentActivityLog';
import { PUBLIC_MCP_URL } from '@/config/publicApi';

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
  agent_wallet_address: string | null;
  plan_id: string | null;
}

interface AgentWalletRow {
  wallet_type: string;
  wallet_address: string;
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
  const [creatingWalletFor, setCreatingWalletFor] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  const { data: agents = [], isLoading, isError: agentsError } = useQuery({
    queryKey: ['agents', address],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_registry')
        .select('id, name, description, api_key_prefix, scopes, is_active, total_requests, last_request_at, created_at, agent_wallet_address, plan_id')
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
      setShowCreate(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create agent';
      toast.error(message);
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
      if (data?.error) throw new Error(data.error);
      toast.success('Agent deactivated');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate agent');
    }
  };

  const handleDelete = async (agentId: string, agentName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('agent-api-key', {
        body: { action: 'delete', agent_id: agentId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Agent "${agentName}" deleted`);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete agent');
    }
  };

  const copyWalletAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Wallet address copied!');
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

  const handleCreateWallet = async (agentId: string) => {
    setCreatingWalletFor(agentId);
    try {
      const { data, error } = await supabase.functions.invoke('agent-wallet', {
        body: { action: 'create_wallet', agent_id: agentId, chain_id: 8453 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Server wallet created (${data?.wallet?.wallet_type || 'mock'} mode)`);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create wallet';
      toast.error(message);
    } finally {
      setCreatingWalletFor(null);
    }
  };

  const handleRename = async (agentId: string) => {
    if (!editNameValue.trim()) return;
    try {
      const { data, error } = await supabase.functions.invoke('agent-api-key', {
        body: { action: 'rename', agent_id: agentId, new_name: editNameValue.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Agent renamed');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setEditingNameId(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to rename';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      {/* API Key Dialog - impossible to miss */}
      <Dialog open={!!newApiKey} onOpenChange={(open) => { if (!open) setNewApiKey(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Save Your API Key
            </DialogTitle>
            <DialogDescription>
              This key will only be shown once. Copy it now and store it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded-md text-xs break-all font-mono border">
                {newApiKey}
              </code>
              <Button variant="outline" size="icon" onClick={copyKey}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button className="w-full" onClick={() => setNewApiKey(null)}>
              I've saved the key
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* API Docs & Agent Card Links */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="text-sm font-medium">Agent Resources:</span>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <Link to="/api-docs">
              <Button variant="outline" size="sm" className="gap-1 w-full sm:w-auto text-xs sm:text-sm">
                <FileText className="h-3.5 w-3.5 flex-shrink-0" /> <span className="truncate">API Docs</span> <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </Button>
            </Link>
            <a href="/.well-known/agent.json" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1 w-full sm:w-auto text-xs sm:text-sm">
                <Bot className="h-3.5 w-3.5 flex-shrink-0" /> <span className="truncate">Agent Card</span> <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </Button>
            </a>
            <a href={PUBLIC_MCP_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1 w-full sm:w-auto text-xs sm:text-sm">
                <Cpu className="h-3.5 w-3.5 flex-shrink-0" /> <span className="truncate">MCP Server</span> <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </Button>
            </a>
            <a href="/.well-known/skills/index.md" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1 w-full sm:w-auto text-xs sm:text-sm">
                <BookOpen className="h-3.5 w-3.5 flex-shrink-0" /> <span className="truncate">Skills</span> <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Create Agent */}
      <Card>
        <CardHeader>
          <div className="flex items-start sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Bot className="h-5 w-5 text-primary flex-shrink-0" />
                AI Agents
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">Register AI agents for API access</CardDescription>
            </div>
            <Button onClick={() => setShowCreate(!showCreate)} size="sm" className="flex-shrink-0">
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">New Agent</span>
              <span className="sm:hidden">New</span>
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
                      {editingNameId === agent.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            className="h-7 text-sm w-40"
                            maxLength={100}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(agent.id); if (e.key === 'Escape') setEditingNameId(null); }}
                            autoFocus
                          />
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRename(agent.id)}>
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          </Button>
                        </div>
                      ) : (
                        <h3 className="font-semibold text-sm cursor-pointer hover:text-primary transition-colors" onClick={() => { setEditingNameId(agent.id); setEditNameValue(agent.name); }} title="Click to rename">
                          {agent.name}
                        </h3>
                      )}
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
                    {/* Server Wallet */}
                    <div className="flex items-center gap-2 mt-2">
                      {agent.agent_wallet_address ? (
                        <Badge
                          variant="outline"
                          className="text-xs gap-1 cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => copyWalletAddress(agent.agent_wallet_address!)}
                          title="Click to copy full address"
                        >
                          <Wallet className="h-3 w-3" />
                          {agent.agent_wallet_address.slice(0, 6)}...{agent.agent_wallet_address.slice(-4)}
                          <Copy className="h-2.5 w-2.5 ml-0.5" />
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs gap-1"
                          disabled={creatingWalletFor === agent.id}
                          onClick={() => handleCreateWallet(agent.id)}
                        >
                          {creatingWalletFor === agent.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Wallet className="h-3 w-3" />
                          )}
                          Create Server Wallet
                        </Button>
                      )}
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
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Delete agent"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete agent "{agent.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the agent, its API key, server wallet, and all activity logs. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(agent.id, agent.name)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
