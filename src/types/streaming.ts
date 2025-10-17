export interface DroneStream {
  id: string;
  admin_id: string;
  stream_name: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
  stream_quality: 'SD' | 'HD' | '4K';
  emergency_level: 'low' | 'medium' | 'high' | 'critical';
  description?: string | null;
  created_at: string;
  updated_at: string;
  viewer_count: number;
  device_type?: string;
  connection_mode?: string;
  recording_url?: string | null; // NEW
  is_recorded?: boolean;         // NEW
}
