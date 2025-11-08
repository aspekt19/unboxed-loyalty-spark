import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, SwitchCamera, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const FrameSnapPage = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Get post_url from URL params (for returning to Frame)
  const postUrl = new URLSearchParams(window.location.search).get('post_url');

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Ошибка доступа к камере',
        description: 'Не удалось получить доступ к камере. Проверьте разрешения.',
        variant: 'destructive',
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/png');
        setCapturedImage(imageData);
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const uploadToIPFS = async () => {
    if (!capturedImage) return;

    setIsUploading(true);
    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      // Create form data
      const formData = new FormData();
      formData.append('file', blob, 'framesnap.png');

      // Upload to IPFS via edge function
      const { data, error } = await supabase.functions.invoke('upload-to-ipfs', {
        body: formData,
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Успешно загружено!',
          description: 'Изображение загружено на IPFS',
        });

        // Redirect back to Frame with image URL
        if (postUrl) {
          const redirectUrl = `${postUrl}?imageUrl=${encodeURIComponent(data.gatewayUrl)}`;
          window.location.href = redirectUrl;
        } else {
          console.log('IPFS URL:', data.gatewayUrl);
        }
      }
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить изображение на IPFS',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-4xl font-bold text-center mb-8 text-foreground">
          FrameSnap 📸
        </h1>

        <div className="relative bg-card rounded-lg overflow-hidden shadow-xl">
          {!capturedImage ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex justify-center gap-4">
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={switchCamera}
                    className="rounded-full"
                  >
                    <SwitchCamera className="h-6 w-6" />
                  </Button>
                  
                  <Button
                    size="lg"
                    onClick={capturePhoto}
                    className="rounded-full w-16 h-16"
                  >
                    <Camera className="h-8 w-8" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <img src={capturedImage} alt="Captured" className="w-full h-auto" />
              
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex justify-center gap-4">
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={retakePhoto}
                  >
                    Переснять
                  </Button>
                  
                  <Button
                    size="lg"
                    onClick={uploadToIPFS}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Upload className="h-5 w-5 mr-2 animate-spin" />
                        Загрузка...
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 mr-2" />
                        Загрузить на IPFS
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-muted-foreground mt-4 text-sm">
          Сделайте снимок и загрузите его на IPFS для минтинга NFT
        </p>
      </div>
    </div>
  );
};

export default FrameSnapPage;
