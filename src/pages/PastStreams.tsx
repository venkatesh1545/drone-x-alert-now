import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Clock, AlertTriangle, Loader2, Play, X, Video } from 'lucide-react';
import { DroneStream } from '@/types/streaming';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const PastStreams = () => {
  const navigate = useNavigate();
  const [pastStreams, setPastStreams] = useState<DroneStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStream, setSelectedStream] = useState<DroneStream | null>(null);
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);

  useEffect(() => {
    loadPastStreams();
  }, []);

  const loadPastStreams = async () => {
    try {
      console.log('📜 Loading past (inactive) streams...');
      
      const { data, error } = await supabase
        .from('drone_streams')
        .select('*')
        .eq('is_active', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const typedStreams = (data || []).map(stream => ({
        ...stream,
        stream_quality: stream.stream_quality as 'SD' | 'HD' | '4K',
        emergency_level: stream.emergency_level as 'low' | 'medium' | 'high' | 'critical',
        viewer_count: stream.viewer_count || 0
      })) as DroneStream[];

      console.log(`✅ Loaded ${typedStreams.length} past streams`);
      setPastStreams(typedStreams);
    } catch (error) {
      console.error('Error loading past streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEmergencyColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const openVideoPlayer = (stream: DroneStream) => {
    setSelectedStream(stream);
    setIsVideoDialogOpen(true);
  };

  const closeVideoPlayer = () => {
    setSelectedStream(null);
    setIsVideoDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-sky-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Loading past streams...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button onClick={() => navigate(-1)} variant="outline" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Live Streams
        </Button>
        <h1 className="text-3xl font-bold">Past Emergency Streams</h1>
        <p className="text-gray-600 mt-2">
          View historical emergency response broadcasts ({pastStreams.length} total)
        </p>
      </div>

      {pastStreams.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No past streams found</p>
            <p className="text-gray-400 text-sm mt-2">
              Past emergency broadcasts will appear here after they end
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pastStreams.map((stream) => (
            <Card key={stream.id} className="hover:shadow-lg transition-shadow border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-start justify-between">
                  <span className="line-clamp-1">{stream.stream_name}</span>
                  <Badge variant="outline" className="bg-gray-100 text-gray-600 ml-2 flex-shrink-0">
                    Ended
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span className="line-clamp-1">{stream.location}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span>{formatDate(stream.created_at)}</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${getEmergencyColor(stream.emergency_level)} border`}>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {stream.emergency_level?.toUpperCase()}
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
                    {stream.stream_quality}
                  </Badge>
                  {stream.is_recorded && (
                    <Badge className="bg-green-100 text-green-700 border border-green-200">
                      <Video className="h-3 w-3 mr-1" />
                      Recorded
                    </Badge>
                  )}
                </div>

                {stream.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 pt-2 border-t">
                    {stream.description}
                  </p>
                )}

                <div className="pt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>Peak viewers: {stream.viewer_count}</span>
                  <span>{stream.device_type || 'Unknown device'}</span>
                </div>

                {/* Watch Recording Button */}
                {stream.recording_url ? (
                  <Button 
                    onClick={() => openVideoPlayer(stream)}
                    className="w-full mt-2"
                    variant="default"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Watch Recording
                  </Button>
                ) : (
                  <Button 
                    className="w-full mt-2"
                    variant="outline"
                    disabled
                  >
                    <Video className="h-4 w-4 mr-2" />
                    No Recording Available
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Video Player Dialog */}
      <Dialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">{selectedStream?.stream_name}</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeVideoPlayer}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          
          {selectedStream?.recording_url && (
            <div className="space-y-4">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={selectedStream.recording_url}
                  controls
                  autoPlay
                  className="w-full h-full"
                >
                  Your browser does not support video playback.
                </video>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Location</p>
                  <p className="font-medium">{selectedStream.location}</p>
                </div>
                <div>
                  <p className="text-gray-600">Date</p>
                  <p className="font-medium">{formatDate(selectedStream.created_at)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Emergency Level</p>
                  <Badge className={`${getEmergencyColor(selectedStream.emergency_level)} border mt-1`}>
                    {selectedStream.emergency_level?.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-600">Peak Viewers</p>
                  <p className="font-medium">{selectedStream.viewer_count}</p>
                </div>
              </div>

              {selectedStream.description && (
                <div>
                  <p className="text-gray-600 text-sm">Description</p>
                  <p className="mt-1">{selectedStream.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
