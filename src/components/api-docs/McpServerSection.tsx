import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Cpu, Wrench } from 'lucide-react';
import { MCP_TOOL_COUNT, MCP_TOOL_NAMES } from '@/constants/mcpToolNames';

const MCP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loyalty-mcp`;

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-muted/50 border rounded-lg p-4 overflow-x-auto text-xs font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={copy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export default function McpServerSection() {
  const claudeConfig = `{
  "mcpServers": {
    "loyal-spark": {
      "url": "${MCP_URL}",
      "headers": {
        "x-api-key": "lsk_YOUR_API_KEY"
      }
    }
  }
}`;

  const cursorConfig = `{
  "mcpServers": {
    "loyal-spark": {
      "url": "${MCP_URL}",
      "headers": {
        "x-api-key": "lsk_YOUR_API_KEY"
      }
    }
  }
}`;

  const httpExample = `# Initialize session
curl -X POST "${MCP_URL}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "x-api-key: lsk_YOUR_API_KEY" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "clientInfo": { "name": "my-agent", "version": "1.0" },
      "capabilities": {}
    }
  }'

# Call a tool
curl -X POST "${MCP_URL}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "x-api-key: lsk_YOUR_API_KEY" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_platform_info",
      "arguments": {}
    }
  }'`;

  const pythonExample = `from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async def main():
    async with streamablehttp_client(
        "${MCP_URL}",
        headers={"x-api-key": "lsk_YOUR_API_KEY"}
    ) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # List available tools
            tools = await session.list_tools()
            print(tools)
            
            # Get platform info
            result = await session.call_tool(
                "get_platform_info", {}
            )
            print(result)
            
            # Mint tokens
            mint = await session.call_tool(
                "mint_loyalty_tokens",
                {
                    "token_address": "0x...",
                    "recipient": "0x...",
                    "amount": 100
                }
            )
            print(mint)`;

  return (
    <Card className="mb-8 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Cpu className="h-5 w-5 text-primary" />
          MCP Server (Model Context Protocol)
        </CardTitle>
        <CardDescription>
          Connect LLM agents (Claude, GPT, Cursor) directly to Loyal Spark via the standard MCP protocol.
          No custom code needed — just configure the server URL.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* MCP URL */}
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">MCP Server URL</h4>
          <CodeBlock code={MCP_URL} />
        </div>

        {/* Transport */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Transport:</span>
          <Badge variant="outline" className="text-xs">Streamable HTTP</Badge>
          <span className="text-sm text-muted-foreground">Protocol:</span>
          <Badge variant="outline" className="text-xs">JSON-RPC 2.0</Badge>
        </div>

        {/* Setup instructions */}
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Setup Instructions</h4>
          <Tabs defaultValue="claude">
            <TabsList>
              <TabsTrigger value="claude">Claude Desktop</TabsTrigger>
              <TabsTrigger value="cursor">Cursor / VS Code</TabsTrigger>
              <TabsTrigger value="http">Raw HTTP</TabsTrigger>
              <TabsTrigger value="python">Python SDK</TabsTrigger>
            </TabsList>
            <TabsContent value="claude" className="mt-4 space-y-3">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Add to <code className="text-xs bg-muted px-1.5 py-0.5 rounded">claude_desktop_config.json</code>:
                </p>
                <CodeBlock code={claudeConfig} />
                <p className="text-xs text-muted-foreground">
                  File location: <code className="bg-muted px-1 py-0.5 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS)
                  or <code className="bg-muted px-1 py-0.5 rounded">%APPDATA%\Claude\claude_desktop_config.json</code> (Windows)
                </p>
              </div>
            </TabsContent>
            <TabsContent value="cursor" className="mt-4 space-y-3">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Add to <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.cursor/mcp.json</code> in your project root:
                </p>
                <CodeBlock code={cursorConfig} />
              </div>
            </TabsContent>
            <TabsContent value="http" className="mt-4">
              <CodeBlock code={httpExample} />
            </TabsContent>
            <TabsContent value="python" className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Install: <code className="bg-muted px-1.5 py-0.5 rounded">pip install mcp</code>
              </p>
              <CodeBlock code={pythonExample} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Available Tools */}
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Tool ids ({MCP_TOOL_COUNT})
          </h4>
          <p className="text-xs text-muted-foreground mb-2">
            Descriptions ship with each tool from the server. Human onboarding:{' '}
            <Link to="/for-agents" className="text-primary underline underline-offset-2 font-medium">
              /for-agents
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto p-2 rounded-md border bg-muted/20">
            {MCP_TOOL_NAMES.map((name) => (
              <code key={name} className="text-[10px] sm:text-xs bg-background border rounded px-1.5 py-0.5 font-mono">
                {name}
              </code>
            ))}
          </div>
        </div>

        {/* Discovery */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-sm font-medium mb-1">🔍 Auto-Discovery</p>
          <p className="text-xs text-muted-foreground">
            AI agents can discover this MCP server automatically via{' '}
            <code className="bg-muted px-1 py-0.5 rounded">/.well-known/agent.json</code>{' '}
            which includes the MCP endpoint URL, transport type, and list of available tools.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
