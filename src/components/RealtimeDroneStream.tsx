import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from 'react-router-dom';
import {
  Camera, Zap, Users, MapPin, Signal,
  Monitor, AlertTriangle, Loader2, Eye, History, Shield, Trash2, Wifi
} from "lucide-react";
import { useDroneStreaming } from '@/hooks/useDroneStreaming';
import type { DroneStream } from '@/types/streaming';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Type definitions
type StreamFrame = {
  id?: string;
  stream_id?: string;
  frame_data?: string;
  frame_number?: number;
  created_at?: string;
  updated_at?: string;
};

type RekognitionLabel = {
  Name: string;
  Confidence?: number;
  Instances?: Array<{
    BoundingBox: {
      Width: number;
      Height: number;
      Left: number;
      Top: number;
    };
    Confidence?: number;
  }>;
};

interface RealtimeDroneStreamProps {
  fullSize?: boolean;
}

export const RealtimeDroneStream = ({ fullSize = false }: RealtimeDroneStreamProps) => {
  const navigate = useNavigate();
  const { activeStreams, currentStream, loading, joinStream, leaveStream, setCurrentStream, isAdmin } = useDroneStreaming();
  const { toast } = useToast();
  
  // Refs
  const imgRef = useRef<HTMLImageElement>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);
  const frameBufferRef = useRef<string[]>([]);
  const renderIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // State
  const [receivedFrame, setReceivedFrame] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [imageError, setImageError] = useState(false);
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);

  // Detection state (admin only)
  const [detectionLabels, setDetectionLabels] = useState<RekognitionLabel[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      stopRealtimeSubscription();
      stopDetection();
      stopFrameRendering();
    };
  }, []);

  useEffect(() => {
    const streamId = currentStream?.id;
    
    if (streamId) {
      startRealtimeSubscription(streamId);
      
      if (isAdmin) {
        startDetectionPolling();
      } else {
        stopDetection();
      }
    } else {
      stopRealtimeSubscription();
      stopDetection();
    }
    
    return () => {
      stopRealtimeSubscription();
      stopDetection();
    };
    // eslint-disable-next-line
  }, [currentStream?.id, isAdmin]);

  // --- REALTIME SUBSCRIPTION (Smooth Streaming) ---
  const startRealtimeSubscription = useCallback((streamId: string) => {
    stopRealtimeSubscription();
    
    setConnectionStatus('connecting');
    setReceivedFrame(null);
    setImageError(false);
    frameBufferRef.current = [];
    
    console.log(`🎬 Starting realtime subscription for stream: ${streamId}`);

    // Subscribe to frame updates via Supabase Realtime
    const channel = supabase.channel(`stream:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_frames',
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => {
          if (!mountedRef.current) return;
          
          const newFrame = payload.new as StreamFrame;
          
          if (newFrame?.frame_data) {
            // Add to buffer for smooth playback
            frameBufferRef.current.push(newFrame.frame_data);
            
            // Keep buffer size manageable (max 10 frames)
            if (frameBufferRef.current.length > 10) {
              frameBufferRef.current.shift();
            }
            
            setConnectionStatus('connected');
            setFrameCount(newFrame.frame_number || 0);
            
            // Calculate latency
            if (newFrame.created_at) {
              const now = Date.now();
              const frameTime = new Date(newFrame.created_at).getTime();
              setLatency(now - frameTime);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          startFrameRendering();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('error');
          console.error('Realtime subscription error');
        }
      });
    
    realtimeChannelRef.current = channel;

    // Fetch latest frame immediately
    fetchInitialFrame(streamId);
  }, []);

  const fetchInitialFrame = async (streamId: string) => {
    try {
      const { data } = await supabase
        .from('stream_frames')
        .select('frame_data, frame_number')
        .eq('stream_id', streamId)
        .order('frame_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data?.frame_data) {
        setReceivedFrame(data.frame_data);
        setFrameCount(data.frame_number || 0);
      }
    } catch (err) {
      console.error('Initial frame fetch error:', err);
    }
  };

  const startFrameRendering = () => {
    if (renderIntervalRef.current) return;
    
    let frameCounter = 0;
    let lastTime = Date.now();
    
    // Render frames from buffer at ~30 FPS
    renderIntervalRef.current = setInterval(() => {
      if (frameBufferRef.current.length > 0) {
        const frame = frameBufferRef.current.shift();
        if (frame) {
          setReceivedFrame(frame);
          frameCounter++;
        }
      }
      
      // Calculate FPS every second
      const now = Date.now();
      if (now - lastTime >= 1000) {
        setFps(frameCounter);
        frameCounter = 0;
        lastTime = now;
      }
    }, 33); // ~30 FPS
  };

  const stopFrameRendering = () => {
    if (renderIntervalRef.current) {
      clearInterval(renderIntervalRef.current);
      renderIntervalRef.current = null;
    }
  };

  const stopRealtimeSubscription = useCallback(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    stopFrameRendering();
    frameBufferRef.current = [];
  }, []);

  // --- STREAM SWITCHING ---
  const switchStream = (stream: DroneStream) => {
    if (currentStream) leaveStream(currentStream.id);
    
    stopRealtimeSubscription();
    stopDetection();
    setReceivedFrame(null);
    setFrameCount(0);
    setConnectionStatus('connecting');
    setImageError(false);
    setDetectionLabels([]);
    setFps(0);
    setLatency(0);
    
    setCurrentStream(stream);
    joinStream(stream.id);
  };

  const containerHeight = fullSize ? "h-96" : "h-64";

  // --- ADMIN: DETECTION ---
  const startDetectionPolling = () => {
    if (!isAdmin) return;
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    
    setIsDetecting(true);
    detectionIntervalRef.current = setInterval(() => {
      if (receivedFrame) {
        requestDetection(receivedFrame);
      }
    }, 3000);
  };

  const stopDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setIsDetecting(false);
    setDetectionLabels([]);
  };

  const REKOGNITION_BACKEND_URL = "http://localhost:8001/api/rekognition/detect";

  const requestDetection = async (base64Frame: string) => {
    if (!isAdmin) return;
    
    try {
      const res = await fetch(REKOGNITION_BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64Frame })
      });
      
      if (!res.ok) return;
      
      const json = await res.json();
      setDetectionLabels(json.labels || []);
      
      const criticalDetection = json.labels?.some((l: RekognitionLabel) =>
        l.Name === 'Person' || l.Name === 'Human' || l.Name === 'Emergency'
      );
      
      if (criticalDetection) {
        console.log('🚨 Critical detection: Person/Emergency detected!');
      }
    } catch (e) {
      console.error('Detection request error:', e);
    }
  };

  // --- ADMIN: DELETE STREAM ---
  const deleteStream = async (streamId: string) => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can delete streams.",
        variant: "destructive"
      });
      return;
    }
    
    if (!window.confirm("Are you sure you want to delete this stream?")) return;
    
    const { error } = await supabase.from('drone_streams').delete().eq('id', streamId);
    
    if (!error) {
      setCurrentStream(null);
      toast({
        title: "Stream Deleted",
        description: "Stream was successfully deleted."
      });
      navigate("/dashboard");
    } else {
      toast({
        title: "Delete Failed",
        description: error.message || "Error deleting stream.",
        variant: "destructive"
      });
    }
  };

  // --- RENDER ---
  if (loading) {
    return (
      <Card className="border-sky-100">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Signal className="h-12 w-12 text-sky-500 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-600">Loading drone streams...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeStreams.length === 0) {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <History className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700">
          <div className="space-y-3">
            <p className="font-semibold text-lg">No Active Live Streams</p>
            <p>There are no emergency response teams broadcasting at the moment.</p>
            <Button onClick={() => navigate('/past-streams')} variant="outline" className="mt-2">
              <History className="h-4 w-4 mr-2" />
              View Past Streams
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stream Selector */}
      {activeStreams.length > 1 && (
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {activeStreams.map((stream) => (
            <Button
              key={stream.id}
              onClick={() => switchStream(stream)}
              variant={currentStream?.id === stream.id ? "default" : "outline"}
              className="flex-shrink-0"
            >
              <Camera className="h-4 w-4 mr-2" />
              {stream.stream_name}
            </Button>
          ))}
        </div>
      )}

      {/* Stream Info Card */}
      {currentStream && (
        <Card className="border-sky-100">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center flex-wrap gap-3">
                <CardTitle className="text-lg">{currentStream.stream_name}</CardTitle>
                <Badge className="bg-red-100 text-red-700">
                  <Zap className="h-3 w-3 mr-1" />
                  LIVE
                </Badge>
                <Badge className="bg-blue-100 text-blue-700">
                  {currentStream.stream_quality}
                </Badge>
                {connectionStatus === 'connected' && (
                  <Badge className="bg-green-100 text-green-700">
                    <Wifi className="h-3 w-3 mr-1" />
                    {fps} FPS
                  </Badge>
                )}
                
                {/* ADMIN ONLY BADGES */}
                {isAdmin && (
                  <>
                    <Badge className="bg-purple-100 text-purple-700">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                    {isDetecting && (
                      <Badge className="bg-green-500 text-white animate-pulse">
                        Detection ON
                      </Badge>
                    )}
                    {latency > 0 && (
                      <Badge className="bg-gray-100 text-gray-700">
                        {latency}ms
                      </Badge>
                    )}
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="h-4 w-4 mr-1" />
                  {currentStream.viewer_count}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mr-1" />
                  {currentStream.location}
                </div>
                
                {/* ADMIN ONLY: DELETE BUTTON */}
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteStream(currentStream.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Live Video Feed */}
      <div className={`relative ${containerHeight} bg-black rounded-lg overflow-hidden`}>
        {receivedFrame ? (
          <>
            <img
              ref={imgRef}
              src={receivedFrame}
              alt="Live stream"
              className="w-full h-full object-cover"
              onLoad={() => setImageError(false)}
              onError={() => setImageError(true)}
            />

            {/* ADMIN ONLY: Detection Overlays */}
            {isAdmin && detectionLabels.map((label, idx) => (
              <div
                key={`${label.Name}-${idx}`}
                className="absolute z-20 pointer-events-none"
                style={{
                  left: label.Instances?.[0]?.BoundingBox?.Left
                    ? `${label.Instances[0].BoundingBox.Left * 100}%`
                    : '8px',
                  top: label.Instances?.[0]?.BoundingBox?.Top
                    ? `${label.Instances[0].BoundingBox.Top * 100}%`
                    : `${32 + idx * 32}px`,
                  width: label.Instances?.[0]?.BoundingBox?.Width
                    ? `${label.Instances[0].BoundingBox.Width * 100}%`
                    : 'auto',
                  height: label.Instances?.[0]?.BoundingBox?.Height
                    ? `${label.Instances[0].BoundingBox.Height * 100}%`
                    : 'auto',
                  border: label.Instances?.length ? '2px solid #ffb703' : 'none',
                  background: label.Instances?.length ? 'rgba(255,183,3,0.1)' : 'rgba(0,0,0,0.7)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                }}
              >
                <span className="font-semibold text-xs text-white whitespace-nowrap">
                  {label.Name} {label.Confidence && `${Math.round(label.Confidence)}%`}
                </span>
              </div>
            ))}

            {/* Status Overlays */}
            <div className="absolute top-4 left-4 flex gap-2 z-10">
              <Badge className="bg-red-500 text-white">
                <span className="animate-pulse mr-1">●</span>
                LIVE
              </Badge>
              {isAdmin && isDetecting && (
                <Badge className="bg-purple-500 text-white animate-pulse">
                  Detecting...
                </Badge>
              )}
            </div>

            {/* ADMIN ONLY: Frame Counter */}
            {isAdmin && (
              <div className="absolute bottom-4 right-4 flex gap-2 z-10">
                <div className="bg-black/70 text-white px-3 py-1 rounded text-sm font-mono">
                  Frame: {frameCount}
                </div>
                <div className="bg-black/70 text-white px-3 py-1 rounded text-sm">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
            <div className="text-center text-white p-8">
              <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-sky-400" />
              <h3 className="text-xl font-semibold mb-2">
                {connectionStatus === 'connecting' ? 'Connecting to Stream' : 'Waiting for Stream'}
              </h3>
              <p className="text-sm opacity-75">
                {connectionStatus === 'error'
                  ? 'Connection error. Retrying...'
                  : 'Waiting for live broadcast to start...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-green-100">
          <CardContent className="p-3 text-center">
            <Users className="h-6 w-6 text-green-500 mx-auto mb-1" />
            <div className="text-sm font-medium">Live Viewers</div>
            <div className="text-lg font-bold text-green-600">
              {currentStream?.viewer_count || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-100">
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-6 w-6 text-orange-500 mx-auto mb-1" />
            <div className="text-sm font-medium">Emergency Level</div>
            <div className="text-lg font-bold text-orange-600">
              {currentStream?.emergency_level?.toUpperCase() || "MEDIUM"}
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-100">
          <CardContent className="p-3 text-center">
            <Monitor className="h-6 w-6 text-blue-500 mx-auto mb-1" />
            <div className="text-sm font-medium">Stream Quality</div>
            <div className="text-lg font-bold text-blue-600">
              {currentStream?.stream_quality || "HD"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ADMIN ONLY: Detection Results */}
      {isAdmin && detectionLabels.length > 0 && (
        <Card className="border-purple-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-500" />
              AI Detected Objects (Admin Only)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {detectionLabels.map((label, idx) => (
                <Badge key={`badge-${label.Name}-${idx}`} className="bg-orange-200 text-orange-900 text-xs">
                  {label.Name}
                  {label.Confidence && (
                    <span className="ml-1 font-mono text-orange-700">
                      {Math.round(label.Confidence)}%
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
