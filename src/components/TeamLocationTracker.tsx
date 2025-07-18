
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TeamLocationTrackerProps {
  teamId?: string;
}

const TeamLocationTracker = ({ teamId }: TeamLocationTrackerProps) => {
  const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [tracking, setTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (teamId && tracking) {
      const interval = setInterval(() => {
        getCurrentLocation();
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [teamId, tracking]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Location not supported",
        description: "Geolocation is not supported by this browser.",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocation(newLocation);
        updateTeamLocation(newLocation);
        setLastUpdate(new Date().toLocaleTimeString());
      },
      (error) => {
        toast({
          title: "Location error",
          description: "Unable to retrieve your location.",
          variant: "destructive",
        });
      }
    );
  };

  const updateTeamLocation = async (location: {latitude: number, longitude: number}) => {
    if (!teamId) return;

    try {
      const { error } = await supabase
        .from('rescue_teams')
        .update({
          current_latitude: location.latitude,
          current_longitude: location.longitude,
          updated_at: new Date().toISOString(),
        })
        .eq('id', teamId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const startTracking = () => {
    setTracking(true);
    getCurrentLocation();
    toast({
      title: "Location tracking started",
      description: "Your location will be updated every 30 seconds.",
    });
  };

  const stopTracking = () => {
    setTracking(false);
    toast({
      title: "Location tracking stopped",
      description: "Location updates have been disabled.",
    });
  };

  return (
    <Card className="border-sky-100">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MapPin className="h-5 w-5 text-sky-500" />
          <span>Location Tracker</span>
        </CardTitle>
        <CardDescription>
          Track and share your team's current location for emergency coordination
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge className={tracking ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
              <Navigation className="h-3 w-3 mr-1" />
              {tracking ? "Tracking Active" : "Tracking Inactive"}
            </Badge>
          </div>
          <div className="space-x-2">
            {!tracking ? (
              <Button onClick={startTracking} className="bg-green-500 hover:bg-green-600">
                Start Tracking
              </Button>
            ) : (
              <Button onClick={stopTracking} variant="outline">
                Stop Tracking
              </Button>
            )}
          </div>
        </div>

        {location && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Latitude</label>
                <p className="text-lg font-mono">{location.latitude.toFixed(6)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Longitude</label>
                <p className="text-lg font-mono">{location.longitude.toFixed(6)}</p>
              </div>
            </div>
            
            {lastUpdate && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>Last updated: {lastUpdate}</span>
              </div>
            )}
          </div>
        )}

        {!location && tracking && (
          <div className="flex items-center space-x-2 text-orange-600">
            <AlertTriangle className="h-4 w-4" />
            <span>Waiting for location data...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamLocationTracker;
