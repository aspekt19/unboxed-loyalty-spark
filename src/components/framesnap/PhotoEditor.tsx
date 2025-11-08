import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Type, Sticker, Frame, Upload } from 'lucide-react';

interface PhotoEditorProps {
  imageUrl: string;
  onSave: (editedImageBlob: Blob) => void;
  onCancel: () => void;
  userTokens?: string[]; // Array of token addresses user owns
}

interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

interface StickerElement {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
  scale: number;
}

const PhotoEditor = ({ imageUrl, onSave, onCancel, userTokens = [] }: PhotoEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [texts, setTexts] = useState<TextElement[]>([]);
  const [stickers, setStickers] = useState<StickerElement[]>([]);
  const [newText, setNewText] = useState('');
  const [fontSize, setFontSize] = useState(32);
  const [textColor, setTextColor] = useState('#ffffff');
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);

  // Basic stickers available to all users
  const basicStickers = [
    '❤️', '⭐', '🎉', '🔥', '💯', '✨', '🎨', '📸'
  ];

  // Premium stickers for token holders
  const premiumStickers = userTokens.length > 0 ? [
    '💎', '👑', '🏆', '🎯', '🚀', '⚡', '🌟', '💫'
  ] : [];

  useEffect(() => {
    drawCanvas();
  }, [texts, stickers, selectedFrame, imageUrl]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Draw frame if selected
      if (selectedFrame) {
        ctx.strokeStyle = selectedFrame;
        ctx.lineWidth = 20;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      }

      // Draw stickers
      stickers.forEach(sticker => {
        ctx.font = `${48 * sticker.scale}px Arial`;
        ctx.fillText(sticker.imageUrl, sticker.x, sticker.y);
      });

      // Draw texts
      texts.forEach(text => {
        ctx.font = `${text.fontSize}px Arial`;
        ctx.fillStyle = text.color;
        ctx.fillText(text.text, text.x, text.y);
      });
    };
    img.src = imageUrl;
  };

  const addText = () => {
    if (!newText.trim()) return;

    const newTextElement: TextElement = {
      id: Date.now().toString(),
      text: newText,
      x: 50,
      y: 100,
      fontSize,
      color: textColor,
    };

    setTexts([...texts, newTextElement]);
    setNewText('');
  };

  const addSticker = (emoji: string) => {
    const newSticker: StickerElement = {
      id: Date.now().toString(),
      imageUrl: emoji,
      x: 100,
      y: 100,
      scale: 1,
    };

    setStickers([...stickers, newSticker]);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        onSave(blob);
      }
    }, 'image/png');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <h2 className="text-2xl font-bold text-center">Edit Your Snap</h2>

        {/* Canvas Preview */}
        <div className="relative bg-card rounded-lg overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-auto" />
        </div>

        {/* Editor Controls */}
        <Tabs defaultValue="stickers" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="stickers">
              <Sticker className="h-4 w-4 mr-2" />
              Stickers
            </TabsTrigger>
            <TabsTrigger value="text">
              <Type className="h-4 w-4 mr-2" />
              Text
            </TabsTrigger>
            <TabsTrigger value="frames">
              <Frame className="h-4 w-4 mr-2" />
              Frames
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stickers" className="space-y-4">
            <div>
              <Label>Basic Stickers</Label>
              <div className="grid grid-cols-8 gap-2 mt-2">
                {basicStickers.map((sticker, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="lg"
                    onClick={() => addSticker(sticker)}
                    className="text-2xl"
                  >
                    {sticker}
                  </Button>
                ))}
              </div>
            </div>

            {premiumStickers.length > 0 && (
              <div>
                <Label className="text-primary">Premium Stickers (Token Holders)</Label>
                <div className="grid grid-cols-8 gap-2 mt-2">
                  {premiumStickers.map((sticker, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="lg"
                      onClick={() => addSticker(sticker)}
                      className="text-2xl border-primary"
                    >
                      {sticker}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="text-input">Add Text</Label>
              <Input
                id="text-input"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Enter text..."
              />
            </div>

            <div className="space-y-2">
              <Label>Font Size: {fontSize}px</Label>
              <Slider
                value={[fontSize]}
                onValueChange={(value) => setFontSize(value[0])}
                min={16}
                max={72}
                step={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="text-color">Text Color</Label>
              <Input
                id="text-color"
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
              />
            </div>

            <Button onClick={addText} className="w-full">
              Add Text
            </Button>
          </TabsContent>

          <TabsContent value="frames" className="space-y-4">
            <Label>Select Frame</Label>
            <div className="grid grid-cols-4 gap-2">
              {['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'].map((color) => (
                <Button
                  key={color}
                  variant={selectedFrame === color ? 'default' : 'outline'}
                  onClick={() => setSelectedFrame(selectedFrame === color ? null : color)}
                  className="h-12"
                  style={{ backgroundColor: selectedFrame === color ? color : 'transparent' }}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1">
            <Upload className="h-4 w-4 mr-2" />
            Save & Upload
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PhotoEditor;
