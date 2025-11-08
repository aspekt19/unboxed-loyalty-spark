import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  getAllNetworks, 
  saveSelectedNetwork, 
  getSelectedNetwork,
  addCustomNetwork,
  removeCustomNetwork,
  CustomChain 
} from "@/lib/evmNetworks";
import { Network, Plus, Trash2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function NetworkSelector() {
  const { toast } = useToast();
  const [networks, setNetworks] = useState<CustomChain[]>(getAllNetworks());
  const [selectedNetwork, setSelectedNetworkState] = useState<number>(getSelectedNetwork());
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form states for adding custom network
  const [customName, setCustomName] = useState("");
  const [customChainId, setCustomChainId] = useState("");
  const [customRpcUrl, setCustomRpcUrl] = useState("");
  const [customCurrency, setCustomCurrency] = useState("");
  const [customExplorer, setCustomExplorer] = useState("");

  const handleSelectNetwork = (chainId: number) => {
    setSelectedNetworkState(chainId);
    saveSelectedNetwork(chainId);
    toast({
      title: "Network Changed",
      description: `Switched to ${networks.find(n => n.id === chainId)?.name}`,
    });
  };

  const handleAddCustomNetwork = () => {
    if (!customName || !customChainId || !customRpcUrl || !customCurrency) {
      toast({
        title: "Missing Fields",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const newNetwork: CustomChain = {
        id: parseInt(customChainId),
        name: customName,
        nativeCurrency: {
          name: customCurrency,
          symbol: customCurrency,
          decimals: 18,
        },
        rpcUrls: {
          default: { http: [customRpcUrl] },
          public: { http: [customRpcUrl] },
        },
        blockExplorers: customExplorer ? {
          default: { name: "Explorer", url: customExplorer },
        } : undefined,
      };

      addCustomNetwork(newNetwork);
      setNetworks(getAllNetworks());
      
      // Reset form
      setCustomName("");
      setCustomChainId("");
      setCustomRpcUrl("");
      setCustomCurrency("");
      setCustomExplorer("");
      setIsDialogOpen(false);

      toast({
        title: "Network Added",
        description: `${customName} has been added successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add network",
        variant: "destructive",
      });
    }
  };

  const handleRemoveNetwork = (chainId: number) => {
    try {
      removeCustomNetwork(chainId);
      setNetworks(getAllNetworks());
      if (selectedNetwork === chainId) {
        handleSelectNetwork(8453); // Switch to Base if current network is removed
      }
      toast({
        title: "Network Removed",
        description: "Custom network has been removed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove network",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5" />
              Network Settings
            </CardTitle>
            <CardDescription>
              Select or add custom EVM networks
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Network
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Custom Network</DialogTitle>
                <DialogDescription>
                  Add a custom EVM-compatible network
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="network-name">Network Name *</Label>
                  <Input
                    id="network-name"
                    placeholder="e.g., Polygon"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chain-id">Chain ID *</Label>
                  <Input
                    id="chain-id"
                    type="number"
                    placeholder="e.g., 137"
                    value={customChainId}
                    onChange={(e) => setCustomChainId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rpc-url">RPC URL *</Label>
                  <Input
                    id="rpc-url"
                    placeholder="https://..."
                    value={customRpcUrl}
                    onChange={(e) => setCustomRpcUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency Symbol *</Label>
                  <Input
                    id="currency"
                    placeholder="e.g., MATIC"
                    value={customCurrency}
                    onChange={(e) => setCustomCurrency(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="explorer">Block Explorer (Optional)</Label>
                  <Input
                    id="explorer"
                    placeholder="https://..."
                    value={customExplorer}
                    onChange={(e) => setCustomExplorer(e.target.value)}
                  />
                </div>
                <Button onClick={handleAddCustomNetwork} className="w-full">
                  Add Network
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {networks.map((network) => {
              const isSelected = network.id === selectedNetwork;
              const isCustom = !network.iconUrl; // Custom networks don't have icons by default

              return (
                <div
                  key={network.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => handleSelectNetwork(network.id)}
                >
                  <div className="flex items-center gap-3">
                    {network.iconUrl ? (
                      <img
                        src={network.iconUrl}
                        alt={network.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Network className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{network.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Chain ID: {network.id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSelected && <Check className="w-5 h-5 text-primary" />}
                    {isCustom && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveNetwork(network.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
