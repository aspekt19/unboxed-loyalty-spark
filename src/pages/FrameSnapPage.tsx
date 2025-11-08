import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, SwitchCamera, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import PhotoEditor from '@/components/framesnap/PhotoEditor';

const FrameSnapPage = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isUploading, setIsUploading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [userTokens, setUserTokens] = useState<string[]>([]);
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
        title: 'Camera Access Error',
        description: 'Failed to access camera. Please check permissions.',
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
        setShowEditor(true);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setShowEditor(false);
    startCamera();
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const uploadToIPFS = async (imageBlob: Blob) => {
    setIsUploading(true);
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', imageBlob, 'framesnap.png');

      // Upload to IPFS via edge function
      const { data, error } = await supabase.functions.invoke('upload-to-ipfs', {
        body: formData,
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Upload Successful!',
          description: 'Image uploaded to IPFS',
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
        title: 'Upload Error',
        description: 'Failed to upload image to IPFS',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (showEditor && capturedImage) {
    return (
      <PhotoEditor
        imageUrl={capturedImage}
        onSave={uploadToIPFS}
        onCancel={retakePhoto}
        userTokens={userTokens}
      />
    );
  }

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
          ) : null}
        </div>

        <p className="text-center text-muted-foreground mt-4 text-sm">
          Take a snap and upload it to IPFS for NFT minting
        </p>
      </div>
    </div>
  );
};

export default FrameSnapPage;
