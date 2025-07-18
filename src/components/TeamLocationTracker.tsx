
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TeamLocationTrackerProps {
  teamId: string;
}

const TeamLocationTracker = ({ teamId }: TeamLocationTrackerProps) => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [tracking, setTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (tracking) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(newLocation);
          setLastUpdate(new Date());
          updateLocationInDatabase(newLocation);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setError(error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [tracking, teamId]);

  const updateLocationInDatabase = async (newLocation: { lat: number; lng: number }) => {
    if (!teamId) return;

    try {
      const { error } = await supabase
        .from('rescue_teams')
        .update({
          current_latitude: newLocation.lat,
          current_longitude: newLocation.lng,
          updated_at: new Date().toISOString()
        })
        .eq('id', teamId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation Not Supported",
        description: "Your browser doesn't support geolocation.",
        variant: "destructive",
      });
      return;
    }

    setTracking(true);
    setError(null);
    toast({
      title: "Location Tracking Started",
      description: "Your team's location is now being tracked.",
    });
  };

  const stopTracking = () => {
    setTracking(false);
    toast({
      title: "Location Tracking Stopped",
      description: "Your team's location tracking has been disabled.",
    });
  };

  return (
    <Card className="border-sky-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-sky-500" />
          Team Location Tracker
        </CardTitle>
        <CardDescription>
          Track and share your team's real-time location for emergency coordination
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-4">
          <Badge className={tracking ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
            <Navigation className="h-3 w-3 mr-1" />
            {tracking ? "Tracking Active" : "Tracking Inactive"}
          </Badge>
          {lastUpdate && (
            <Badge className="bg-blue-100 text-blue-700">
              <Clock className="h-3 w-3 mr-1" />
              Updated: {lastUpdate.toLocaleTimeString()}
            </Badge>
          )}
        </div>

        {location && (
          <div className="bg-sky-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Current Location</h3>
            <p className="text-sm text-gray-600">
              Latitude: {location.lat.toFixed(6)}
            </p>
            <p className="text-sm text-gray-600">
              Longitude: {location.lng.toFixed(6)}
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 p-4 rounded-lg flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-700">Location Error</h3>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        <div className="flex space-x-4">
          {!tracking ? (
            <Button onClick={startTracking} className="bg-green-500 hover:bg-green-600">
              <Navigation className="h-4 w-4 mr-2" />
              Start Tracking
            </Button>
          ) : (
            <Button onClick={stopTracking} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
              <MapPin className="h-4 w-4 mr-2" />
              Stop Tracking
            </Button>
          )}
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Privacy Notice</h3>
          <p className="text-sm text-yellow-700">
            Your location data is only shared with authorized emergency coordinators and 
            is used solely for rescue mission coordination. You can stop tracking at any time.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamLocationTracker;
