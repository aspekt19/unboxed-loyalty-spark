import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Copy, Download, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "react-qr-code";

export default function ReceiveTokens() {
  const { address } = useAccount();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast({
      title: "Address Copied",
      description: "Your wallet address has been copied to clipboard",
    });
    
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById("qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = "wallet-qr-code.png";
      downloadLink.href = pngFile;
      downloadLink.click();

      toast({
        title: "QR Code Downloaded",
        description: "Your QR code has been saved",
      });
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  if (!address) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Receive Tokens
        </CardTitle>
        <CardDescription>
          Share your address or QR code to receive tokens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center p-6 bg-white rounded-lg">
          <div id="qr-code">
            <QRCode
              value={address}
              size={200}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground mb-2">Your Wallet Address</p>
            <p className="font-mono text-sm break-all">{address}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleCopy}
              className="w-full"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Address
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleDownloadQR}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Save QR Code
            </Button>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Note:</strong> Only send Base network (Ethereum L2) tokens to this address. 
            Sending tokens from other networks may result in permanent loss.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
