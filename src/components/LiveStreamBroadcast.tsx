import { useEffect, useRef, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Square, AlertTriangle } from 'lucide-react';

interface DetectedObject {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

interface LiveStreamBroadcastProps {
  streamId: string;
  isAdmin: boolean;
  onStop: () => void;
  quality: 'SD' | 'HD' | '4K';
}

export const LiveStreamBroadcast = ({ streamId, isAdmin, onStop, quality }: LiveStreamBroadcastProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [detections, setDetections] = useState<DetectedObject[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number>();

  useEffect(() => {
    loadModel();
    startStream();

    return () => {
      stopStream();
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  const loadModel = async () => {
    try {
      console.log('Loading COCO-SSD model...');
      const loadedModel = await cocoSsd.load();
      setModel(loadedModel);
      console.log('Model loaded successfully');
    } catch (error) {
      console.error('Error loading detection model:', error);
    }
  };

  const startStream = async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: quality === '4K' ? 3840 : (quality === 'HD' ? 1920 : 1280) },
          height: { ideal: quality === '4K' ? 2160 : (quality === 'HD' ? 1080 : 720) },
          facingMode: 'environment'
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);

        // Start object detection for admin only
        if (isAdmin && model) {
          startObjectDetection();
        }
      }
    } catch (error) {
      console.error('Error starting stream:', error);
    }
  };

  const startObjectDetection = () => {
    if (!model || !videoRef.current || !canvasRef.current) return;

    detectionIntervalRef.current = window.setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        const predictions = await model.detect(videoRef.current);
        setDetections(predictions as DetectedObject[]);
        drawDetections(predictions as DetectedObject[]);
      }
    }, 100);
  };

  const drawDetections = (predictions: DetectedObject[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    predictions.forEach((prediction) => {
      const [x, y, width, height] = prediction.bbox;
      
      // Draw bounding box
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // Draw label background
      ctx.fillStyle = '#FF0000';
      const text = `${prediction.class} ${Math.round(prediction.score * 100)}%`;
      const textWidth = ctx.measureText(text).width;
      ctx.fillRect(x, y - 25, textWidth + 10, 25);

      // Draw label text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px Arial';
      ctx.fillText(text, x + 5, y - 7);
    });
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
  };

  const handleStop = () => {
    stopStream();
    onStop();
  };

  return (
    <Card className="border-sky-100">
      <CardContent className="p-4">
        <div className="relative">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            {isAdmin && (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            )}

            {/* Live indicator */}
            <div className="absolute top-4 left-4 flex gap-2">
              <Badge className="bg-red-500 text-white">
                <span className="animate-pulse mr-1">●</span>
                LIVE
              </Badge>
              {isAdmin && model && (
                <Badge className="bg-green-500 text-white">
                  <Eye className="h-3 w-3 mr-1" />
                  AI Detection
                </Badge>
              )}
            </div>

            {/* Detection alerts (admin only) */}
            {isAdmin && detections.length > 0 && (
              <div className="absolute top-4 right-4 space-y-1">
                {Array.from(new Set(detections.map(d => d.class))).slice(0, 5).map((cls, idx) => (
                  <Badge key={idx} className="bg-orange-500 text-white block">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {cls} detected
                  </Badge>
                ))}
              </div>
            )}

            {/* Stop button */}
            <div className="absolute bottom-4 left-4">
              <Button
                onClick={handleStop}
                variant="destructive"
                size="sm"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Stream
              </Button>
            </div>

            {/* Object count (admin only) */}
            {isAdmin && (
              <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-sm">
                Objects: {detections.length}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
