
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TeamLocationTrackerProps {
  teamId: string;
}

export const TeamLocationTracker = ({ teamId }: TeamLocationTrackerProps) => {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadCurrentLocation();
    
    // Set up location tracking
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setLocation(newLocation);
          if (isTracking) {
            updateTeamLocation(newLocation);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast({
            title: "Location Error",
            description: "Unable to access your location",
            variant: "destructive",
          });
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 27000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [teamId, isTracking]);

  const loadCurrentLocation = async () => {
    try {
      const { data, error } = await supabase
        .from('rescue_teams')
        .select('current_latitude, current_longitude, updated_at')
        .eq('id', teamId)
        .single();

      if (error) throw error;

      if (data?.current_latitude && data?.current_longitude) {
        setLocation({
          latitude: data.current_latitude,
          longitude: data.current_longitude
        });
        setLastUpdate(data.updated_at);
      }
    } catch (error) {
      console.error('Error loading location:', error);
    }
  };

  const updateTeamLocation = async (newLocation: { latitude: number; longitude: number }) => {
    try {
      const { error } = await supabase
        .from('rescue_teams')
        .update({
          current_latitude: newLocation.latitude,
          current_longitude: newLocation.longitude,
          updated_at: new Date().toISOString()
        })
        .eq('id', teamId);

      if (error) throw error;

      setLastUpdate(new Date().toISOString());
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const toggleTracking = async () => {
    if (!isTracking && location) {
      await updateTeamLocation(location);
      toast({
        title: "Location Tracking Started",
        description: "Your location is now being shared with the command center",
      });
    } else if (isTracking) {
      toast({
        title: "Location Tracking Stopped",
        description: "Your location is no longer being shared",
      });
    }
    setIsTracking(!isTracking);
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setLocation(newLocation);
          if (isTracking) {
            updateTeamLocation(newLocation);
          }
          toast({
            title: "Location Updated",
            description: "Your current location has been retrieved",
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast({
            title: "Location Error",
            description: "Unable to get your current location",
            variant: "destructive",
          });
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-sky-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-sky-500" />
            Location Tracking
          </CardTitle>
          <CardDescription>
            Share your location with the command center for coordination
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Tracking Status</p>
              <Badge className={isTracking ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                {isTracking ? "Active" : "Inactive"}
              </Badge>
            </div>
            <Button onClick={toggleTracking} variant={isTracking ? "destructive" : "default"}>
              {isTracking ? "Stop Tracking" : "Start Tracking"}
            </Button>
          </div>

          {location && (
            <div className="space-y-3">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-gray-600" />
                  <span className="font-medium">Current Location</span>
                </div>
                <p className="text-sm text-gray-600 font-mono">
                  Lat: {location.latitude.toFixed(6)}
                </p>
                <p className="text-sm text-gray-600 font-mono">
                  Lng: {location.longitude.toFixed(6)}
                </p>
                {lastUpdate && (
                  <p className="text-xs text-gray-500 mt-2">
                    Last updated: {new Date(lastUpdate).toLocaleString()}
                  </p>
                )}
              </div>
              
              <Button variant="outline" onClick={getCurrentLocation} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Location
              </Button>
            </div>
          )}

          <div className="text-sm text-gray-500 bg-yellow-50 p-3 rounded-lg">
            <p className="font-medium text-yellow-700 mb-1">Privacy Notice:</p>
            <p>Your location is only shared when tracking is active and is used solely for emergency coordination purposes.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
