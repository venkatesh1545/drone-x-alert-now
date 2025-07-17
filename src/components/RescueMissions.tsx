
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, MapPin, Clock, Play, CheckCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RescueMission {
  id: string;
  emergency_request_id: string;
  status: string;
  priority: string;
  estimated_arrival?: string;
  actual_arrival?: string;
  completion_time?: string;
  notes?: string;
  created_at: string;
  emergency_requests: {
    emergency_type: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    profiles: { full_name: string };
  };
}

interface RescueMissionsProps {
  teamId: string;
}

export const RescueMissions = ({ teamId }: RescueMissionsProps) => {
  const [missions, setMissions] = useState<RescueMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (teamId) {
      loadMissions();
    }
  }, [teamId]);

  const loadMissions = async () => {
    try {
      const { data, error } = await supabase
        .from('rescue_missions')
        .select(`
          *,
          emergency_requests(
            emergency_type,
            description,
            latitude,
            longitude,
            profiles(full_name)
          )
        `)
        .eq('rescue_team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMissions(data || []);
    } catch (error) {
      console.error('Error loading missions:', error);
      toast({
        title: "Error",
        description: "Failed to load missions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateMissionStatus = async (missionId: string, status: string) => {
    try {
      const updates: any = { 
        status, 
        updated_at: new Date().toISOString() 
      };

      if (status === 'in_progress' && !missions.find(m => m.id === missionId)?.actual_arrival) {
        updates.actual_arrival = new Date().toISOString();
      }

      if (status === 'completed') {
        updates.completion_time = new Date().toISOString();
      }

      const { error } = await supabase
        .from('rescue_missions')
        .update(updates)
        .eq('id', missionId);

      if (error) throw error;

      toast({
        title: "Mission Updated",
        description: `Mission status updated to ${status}`,
      });
      
      loadMissions();
    } catch (error) {
      console.error('Error updating mission:', error);
      toast({
        title: "Error",
        description: "Failed to update mission status",
        variant: "destructive",
      });
    }
  };

  const addNotes = async (missionId: string) => {
    try {
      const { error } = await supabase
        .from('rescue_missions')
        .update({ 
          notes, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', missionId);

      if (error) throw error;

      toast({
        title: "Notes Added",
        description: "Mission notes have been updated",
      });
      
      setSelectedMission(null);
      setNotes('');
      loadMissions();
    } catch (error) {
      console.error('Error adding notes:', error);
      toast({
        title: "Error",
        description: "Failed to add notes",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-blue-100 text-blue-700';
      case 'in_progress': return 'bg-orange-100 text-orange-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-blue-100 text-blue-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'critical': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading missions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Active Missions</h2>
        <Badge className="bg-blue-100 text-blue-700">
          {missions.filter(m => m.status !== 'completed').length} Active
        </Badge>
      </div>

      <div className="grid gap-4">
        {missions.map((mission) => (
          <Card key={mission.id} className="border-sky-100">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    {mission.emergency_requests.emergency_type}
                  </CardTitle>
                  <CardDescription>
                    Requested by {mission.emergency_requests.profiles.full_name} • 
                    {new Date(mission.created_at).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getPriorityColor(mission.priority)}>
                    {mission.priority}
                  </Badge>
                  <Badge className={getStatusColor(mission.status)}>
                    {mission.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {mission.emergency_requests.description && (
                <p className="text-gray-700">{mission.emergency_requests.description}</p>
              )}
              
              {mission.emergency_requests.latitude && mission.emergency_requests.longitude && (
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mr-2" />
                  Location: {mission.emergency_requests.latitude.toFixed(6)}, {mission.emergency_requests.longitude.toFixed(6)}
                </div>
              )}

              {mission.estimated_arrival && (
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="h-4 w-4 mr-2" />
                  ETA: {new Date(mission.estimated_arrival).toLocaleString()}
                </div>
              )}

              {mission.notes && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                  <p className="text-sm text-gray-600">{mission.notes}</p>
                </div>
              )}

              {selectedMission === mission.id && (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Add mission notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={() => addNotes(mission.id)}>
                      Save Notes
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSelectedMission(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                {mission.status === 'assigned' && (
                  <Button size="sm" onClick={() => updateMissionStatus(mission.id, 'in_progress')}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Mission
                  </Button>
                )}
                
                {mission.status === 'in_progress' && (
                  <Button size="sm" onClick={() => updateMissionStatus(mission.id, 'completed')}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Mission
                  </Button>
                )}
                
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setSelectedMission(selectedMission === mission.id ? null : mission.id)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {selectedMission === mission.id ? 'Cancel' : 'Add Notes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {missions.length === 0 && (
        <Card className="border-sky-100">
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No missions assigned</h3>
            <p className="text-gray-500">
              No rescue missions have been assigned to your team yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
