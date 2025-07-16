
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Camera, Play, Pause, Maximize, Settings, 
  Eye, AlertTriangle, Zap, Users
} from "lucide-react";

interface DroneCameraProps {
  fullSize?: boolean;
}

export const DroneCamera = ({ fullSize = false }: DroneCameraProps) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Start camera when component mounts
    startCamera();
    
    // Simulate object detection
    const detectionInterval = setInterval(() => {
      const objects = ["Person", "Vehicle", "Building", "Debris"];
      const randomObjects = objects.filter(() => Math.random() > 0.7);
      setDetectedObjects(randomObjects);
    }, 3000);

    return () => {
      clearInterval(detectionInterval);
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: fullSize ? 1280 : 640, 
          height: fullSize ? 720 : 480 
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const containerHeight = fullSize ? "h-96" : "h-64";

  return (
    <div className="space-y-4">
      {/* Camera Feed */}
      <div className={`relative ${containerHeight} bg-black rounded-lg overflow-hidden`}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        
        {/* Overlay Controls */}
        <div className="absolute top-4 left-4 flex space-x-2">
          <Badge className="bg-red-500/90 text-white">
            <Zap className="h-3 w-3 mr-1" />
            LIVE
          </Badge>
          <Badge className="bg-green-500/90 text-white">
            <Eye className="h-3 w-3 mr-1" />
            AI Detection Active
          </Badge>
        </div>

        {/* Object Detection Alerts */}
        {detectedObjects.length > 0 && (
          <div className="absolute top-4 right-4 space-y-1">
            {detectedObjects.map((object, index) => (
              <Badge key={index} className="bg-orange-500/90 text-white block">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {object} Detected
              </Badge>
            ))}
          </div>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={togglePlayPause}
              className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-white text-sm bg-black/50 px-2 py-1 rounded">
            {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* Simulated Bounding Boxes */}
        <div className="absolute inset-0 pointer-events-none">
          {detectedObjects.includes("Person") && (
            <div className="absolute top-1/3 left-1/4 w-20 h-32 border-2 border-red-500 rounded">
              <div className="bg-red-500 text-white text-xs px-1 -mt-5">Person</div>
            </div>
          )}
          {detectedObjects.includes("Vehicle") && (
            <div className="absolute top-1/2 right-1/4 w-32 h-20 border-2 border-blue-500 rounded">
              <div className="bg-blue-500 text-white text-xs px-1 -mt-5">Vehicle</div>
            </div>
          )}
        </div>
      </div>

      {/* Detection Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-sky-100">
          <CardContent className="p-3 text-center">
            <Eye className="h-6 w-6 text-sky-500 mx-auto mb-1" />
            <div className="text-sm font-medium">Objects Detected</div>
            <div className="text-lg font-bold text-sky-600">{detectedObjects.length}</div>
          </CardContent>
        </Card>
        <Card className="border-green-100">
          <CardContent className="p-3 text-center">
            <Users className="h-6 w-6 text-green-500 mx-auto mb-1" />
            <div className="text-sm font-medium">People Count</div>
            <div className="text-lg font-bold text-green-600">
              {detectedObjects.includes("Person") ? "1" : "0"}
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-100">
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-6 w-6 text-orange-500 mx-auto mb-1" />
            <div className="text-sm font-medium">Alert Level</div>
            <div className="text-lg font-bold text-orange-600">
              {detectedObjects.length > 0 ? "Medium" : "Low"}
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-100">
          <CardContent className="p-3 text-center">
            <Camera className="h-6 w-6 text-blue-500 mx-auto mb-1" />
            <div className="text-sm font-medium">Feed Quality</div>
            <div className="text-lg font-bold text-blue-600">HD</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
