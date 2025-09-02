import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MapPin, Users, AlertTriangle, Crosshair } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface GoogleMapProps {
  fullSize?: boolean;
  showEmergencies?: boolean;
  showSharedLocations?: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
}

interface EmergencyLocation {
  id: string;
  latitude: number;
  longitude: number;
  emergency_type: string;
  status: string;
  priority: string;
  created_at: string;
}

interface SharedLocation {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  expires_at?: string;
  created_at: string;
}

export const GoogleMap: React.FC<GoogleMapProps> = ({
  fullSize = false,
  showEmergencies = true,
  showSharedLocations = true,
  onLocationChange
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [emergencies, setEmergencies] = useState<EmergencyLocation[]>([]);
  const [sharedLocations, setSharedLocations] = useState<SharedLocation[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const { toast } = useToast();

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      try {
        const loader = new Loader({
          apiKey: await getGoogleMapsApiKey(),
          version: 'weekly',
          libraries: ['places']
        });

        await loader.load();
        
        if (!mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 40.7128, lng: -74.0060 }, // Default to NYC
          zoom: 13,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ],
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });

        googleMapRef.current = map;
        setIsLoaded(true);
        
        // Get user location
        getUserLocation();
        
      } catch (error) {
        console.error('Failed to load Google Maps:', error);
        setLocationError('Failed to load map');
      }
    };

    initMap();
  }, []);

  // Get Google Maps API key from Supabase secrets
  const getGoogleMapsApiKey = async (): Promise<string> => {
    // In production, this would be fetched from Supabase Edge Function
    // For now, return a placeholder - user will need to replace with actual key
    return 'YOUR_GOOGLE_MAPS_API_KEY';
  };

  // Get user location
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation = { lat: latitude, lng: longitude };
          
          setUserLocation(newLocation);
          setLocationError(null);
          
          if (googleMapRef.current) {
            googleMapRef.current.setCenter(newLocation);
            addUserMarker(newLocation);
          }
          
          onLocationChange?.(latitude, longitude);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationError('Location access denied');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      setLocationError('Geolocation not supported');
    }
  };

  // Add user location marker
  const addUserMarker = (location: { lat: number; lng: number }) => {
    if (!googleMapRef.current) return;

    const marker = new google.maps.Marker({
      position: location,
      map: googleMapRef.current,
      title: 'Your Location',
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="8" fill="#3B82F6" stroke="#FFFFFF" stroke-width="2"/>
            <circle cx="12" cy="12" r="3" fill="#FFFFFF"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(24, 24),
        anchor: new google.maps.Point(12, 12)
      }
    });

    markersRef.current.push(marker);
  };

  // Load emergencies
  useEffect(() => {
    if (!showEmergencies) return;

    const loadEmergencies = async () => {
      try {
        const { data, error } = await supabase
          .from('emergency_requests')
          .select('*')
          .eq('status', 'pending');

        if (error) throw error;
        setEmergencies(data || []);
      } catch (error) {
        console.error('Error loading emergencies:', error);
      }
    };

    loadEmergencies();
  }, [showEmergencies]);

  // Load shared locations
  useEffect(() => {
    if (!showSharedLocations) return;

    const loadSharedLocations = async () => {
      try {
        const { data, error } = await supabase
          .from('shared_locations')
          .select('*')
          .eq('is_active', true)
          .or('expires_at.is.null,expires_at.gt.now()');

        if (error) throw error;
        setSharedLocations(data || []);
      } catch (error) {
        console.error('Error loading shared locations:', error);
      }
    };

    loadSharedLocations();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('shared-locations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_locations'
        },
        () => loadSharedLocations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showSharedLocations]);

  // Add emergency markers
  useEffect(() => {
    if (!googleMapRef.current || !isLoaded) return;

    // Clear existing markers (except user marker)
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Re-add user marker if available
    if (userLocation) {
      addUserMarker(userLocation);
    }

    // Add emergency markers
    emergencies.forEach(emergency => {
      const marker = new google.maps.Marker({
        position: { lat: emergency.latitude, lng: emergency.longitude },
        map: googleMapRef.current,
        title: `${emergency.emergency_type} Emergency`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="8" fill="#EF4444" stroke="#FFFFFF" stroke-width="2"/>
              <path d="M12 8v4l2 2" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(24, 24),
          anchor: new google.maps.Point(12, 12)
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h3 style="margin: 0 0 4px 0; font-weight: bold;">${emergency.emergency_type}</h3>
            <p style="margin: 0; font-size: 12px;">Priority: ${emergency.priority}</p>
            <p style="margin: 0; font-size: 12px;">Status: ${emergency.status}</p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(googleMapRef.current, marker);
      });

      markersRef.current.push(marker);
    });

    // Add shared location markers
    sharedLocations.forEach(location => {
      const marker = new google.maps.Marker({
        position: { lat: location.latitude, lng: location.longitude },
        map: googleMapRef.current,
        title: 'Shared Location',
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="8" fill="#10B981" stroke="#FFFFFF" stroke-width="2"/>
              <path d="M8 12l2 2 4-4" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(24, 24),
          anchor: new google.maps.Point(12, 12)
        }
      });

      markersRef.current.push(marker);
    });
  }, [emergencies, sharedLocations, userLocation, isLoaded]);

  const centerOnUser = () => {
    if (userLocation && googleMapRef.current) {
      googleMapRef.current.setCenter(userLocation);
      googleMapRef.current.setZoom(15);
    }
  };

  if (!isLoaded) {
    return (
      <Card className={`${fullSize ? 'h-screen' : 'h-96'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className={`relative ${fullSize ? 'h-screen' : 'h-96'} w-full`}>
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      
      {/* Map Controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <Badge variant={userLocation ? "default" : "destructive"}>
          <MapPin className="w-3 h-3 mr-1" />
          GPS {userLocation ? 'Active' : 'Inactive'}
        </Badge>
        
        {locationError && (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {locationError}
          </Badge>
        )}
      </div>

      {/* Center on User Button */}
      <div className="absolute top-4 right-4">
        <Button
          size="sm"
          variant="outline"
          onClick={centerOnUser}
          disabled={!userLocation}
          className="bg-background/90 backdrop-blur-sm"
        >
          <Crosshair className="w-4 h-4" />
        </Button>
      </div>

      {/* Location Info */}
      {userLocation && (
        <Card className="absolute bottom-4 left-4 p-3 bg-background/90 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-primary" />
            <div>
              <p className="font-medium">Your Location</p>
              <p className="text-xs text-muted-foreground">
                {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Map Statistics */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        {showEmergencies && (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {emergencies.length} Emergencies
          </Badge>
        )}
        
        {showSharedLocations && (
          <Badge variant="default">
            <Users className="w-3 h-3 mr-1" />
            {sharedLocations.length} Shared
          </Badge>
        )}
      </div>
    </div>
  );
};

export default GoogleMap;