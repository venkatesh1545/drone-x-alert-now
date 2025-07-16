
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Navigation, AlertTriangle, Users, 
  Crosshair, Layers, RotateCcw
} from "lucide-react";

interface LiveMapProps {
  fullSize?: boolean;
}

interface LocationMarker {
  id: string;
  lat: number;
  lng: number;
  type: 'user' | 'emergency' | 'rescue' | 'disaster';
  label: string;
}

export const LiveMap = ({ fullSize = false }: LiveMapProps) => {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [markers, setMarkers] = useState<LocationMarker[]>([]);
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 }); // Default to NYC

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setMapCenter(location);
          
          // Add user marker
          setMarkers(prev => [...prev, {
            id: 'user',
            lat: location.lat,
            lng: location.lng,
            type: 'user',
            label: 'Your Location'
          }]);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }

    // Simulate emergency markers
    const emergencyMarkers: LocationMarker[] = [
      {
        id: 'emergency-1',
        lat: 40.7589,
        lng: -73.9851,
        type: 'emergency',
        label: 'Medical Emergency'
      },
      {
        id: 'rescue-1',
        lat: 40.7505,
        lng: -73.9934,
        type: 'rescue',
        label: 'Rescue Team Alpha'
      },
      {
        id: 'disaster-1',
        lat: 40.7282,
        lng: -74.0776,
        type: 'disaster',
        label: 'Flood Zone'
      }
    ];

    setMarkers(prev => [...prev, ...emergencyMarkers]);
  }, []);

  const centerOnUser = () => {
    if (userLocation) {
      setMapCenter(userLocation);
    }
  };

  const containerHeight = fullSize ? "h-96" : "h-64";

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'user': return 'bg-blue-500';
      case 'emergency': return 'bg-red-500';
      case 'rescue': return 'bg-green-500';
      case 'disaster': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getMarkerIcon = (type: string) => {
    switch (type) {
      case 'user': return <MapPin className="h-4 w-4 text-white" />;
      case 'emergency': return <AlertTriangle className="h-4 w-4 text-white" />;
      case 'rescue': return <Users className="h-4 w-4 text-white" />;
      case 'disaster': return <AlertTriangle className="h-4 w-4 text-white" />;
      default: return <MapPin className="h-4 w-4 text-white" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Map Container */}
      <div className={`relative ${containerHeight} bg-gradient-to-br from-green-100 to-blue-100 rounded-lg overflow-hidden border-2 border-sky-200`}>
        {/* Map Background (Simulated) */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-200/50 to-blue-200/50">
          <div className="absolute inset-0 opacity-20"
               style={{
                 backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
               }}>
          </div>
        </div>

        {/* Control Overlay */}
        <div className="absolute top-4 left-4 flex flex-col space-y-2 z-10">
          <Button
            size="sm"
            variant="secondary"
            onClick={centerOnUser}
            className="bg-white/90 backdrop-blur-sm hover:bg-white"
          >
            <Crosshair className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/90 backdrop-blur-sm hover:bg-white"
          >
            <Layers className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/90 backdrop-blur-sm hover:bg-white"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Status Badges */}
        <div className="absolute top-4 right-4 flex flex-col space-y-1 z-10">
          <Badge className="bg-green-500/90 text-white">
            <Navigation className="h-3 w-3 mr-1" />
            GPS Active
          </Badge>
          {userLocation && (
            <Badge className="bg-blue-500/90 text-white">
              <MapPin className="h-3 w-3 mr-1" />
              Location Locked
            </Badge>
          )}
        </div>

        {/* Map Markers */}
        {markers.map((marker) => (
          <div
            key={marker.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
            style={{
              left: `${50 + (marker.lng - mapCenter.lng) * 1000}%`,
              top: `${50 - (marker.lat - mapCenter.lat) * 1000}%`,
            }}
          >
            <div className={`${getMarkerColor(marker.type)} rounded-full p-2 shadow-lg animate-pulse`}>
              {getMarkerIcon(marker.type)}
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 bg-black/75 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              {marker.label}
            </div>
          </div>
        ))}

        {/* Current Location Indicator */}
        {userLocation && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
            <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg">
              <div className="w-8 h-8 bg-blue-500/30 rounded-full animate-ping absolute -top-2 -left-2"></div>
            </div>
          </div>
        )}

        {/* Coordinates Display */}
        <div className="absolute bottom-4 left-4 bg-black/75 text-white text-xs px-2 py-1 rounded">
          {userLocation 
            ? `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`
            : 'Acquiring location...'
          }
        </div>
      </div>

      {/* Map Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-100">
          <CardContent className="p-3 text-center">
            <MapPin className="h-6 w-6 text-blue-500 mx-auto mb-1" />
            <div className="text-sm font-medium">Accuracy</div>
            <div className="text-lg font-bold text-blue-600">±3m</div>
          </CardContent>
        </Card>
        <Card className="border-red-100">
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-1" />
            <div className="text-sm font-medium">Emergency Zones</div>
            <div className="text-lg font-bold text-red-600">
              {markers.filter(m => m.type === 'emergency' || m.type === 'disaster').length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-100">
          <CardContent className="p-3 text-center">
            <Users className="h-6 w-6 text-green-500 mx-auto mb-1" />
            <div className="text-sm font-medium">Rescue Teams</div>
            <div className="text-lg font-bold text-green-600">
              {markers.filter(m => m.type === 'rescue').length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-100">
          <CardContent className="p-3 text-center">
            <Navigation className="h-6 w-6 text-purple-500 mx-auto mb-1" />
            <div className="text-sm font-medium">Signal Strength</div>
            <div className="text-lg font-bold text-purple-600">Strong</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
