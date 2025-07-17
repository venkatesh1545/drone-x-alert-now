
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, MapPin, Clock, Users, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmergencyRequest {
  id: string;
  user_id: string;
  emergency_type: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string };
  missions?: {
    id: string;
    rescue_teams: { team_name: string };
  }[];
}

export const EmergencyRequestsAdmin = () => {
  const [emergencies, setEmergencies] = useState<EmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    loadEmergencies();
  }, []);

  const loadEmergencies = async () => {
    try {
      const { data, error } = await supabase
        .from('emergency_requests')
        .select(`
          *,
          profiles!emergency_requests_user_id_fkey(full_name),
          missions:rescue_missions(
            id,
            rescue_teams(team_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmergencies(data || []);
    } catch (error) {
      console.error('Error loading emergencies:', error);
      toast({
        title: "Error",
        description: "Failed to load emergency requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateEmergencyStatus = async (emergencyId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('emergency_requests')
        .update({ 
          status, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', emergencyId);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Emergency status updated to ${status}`,
      });
      
      loadEmergencies();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update emergency status",
        variant: "destructive",
      });
    }
  };

  const assignRescueTeam = async (emergencyId: string) => {
    try {
      const { data, error } = await supabase.rpc('auto_assign_rescue_team', {
        emergency_id: emergencyId
      });

      if (error) throw error;

      if (data) {
        toast({
          title: "Team Assigned",
          description: "Rescue team has been automatically assigned",
        });
        loadEmergencies();
      } else {
        toast({
          title: "No Available Teams",
          description: "No rescue teams are currently available",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error assigning rescue team:', error);
      toast({
        title: "Error",
        description: "Failed to assign rescue team",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'assigned': return 'bg-blue-100 text-blue-700';
      case 'in_progress': return 'bg-orange-100 text-orange-700';
      case 'resolved': return 'bg-green-100 text-green-700';
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

  const filteredEmergencies = emergencies.filter(emergency => 
    selectedStatus === 'all' || emergency.status === selectedStatus
  );

  if (loading) {
    return <div className="text-center py-8">Loading emergency requests...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Emergency Requests</h2>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {filteredEmergencies.map((emergency) => (
          <Card key={emergency.id} className="border-sky-100">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    {emergency.emergency_type}
                  </CardTitle>
                  <CardDescription>
                    Reported by {emergency.profiles?.full_name || 'Unknown'} • 
                    {new Date(emergency.created_at).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getPriorityColor(emergency.priority)}>
                    {emergency.priority}
                  </Badge>
                  <Badge className={getStatusColor(emergency.status)}>
                    {emergency.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {emergency.description && (
                <p className="text-gray-700">{emergency.description}</p>
              )}
              
              {emergency.latitude && emergency.longitude && (
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mr-2" />
                  Location: {emergency.latitude.toFixed(6)}, {emergency.longitude.toFixed(6)}
                </div>
              )}

              {emergency.missions && emergency.missions.length > 0 && (
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="h-4 w-4 mr-2" />
                  Assigned to: {emergency.missions[0].rescue_teams.team_name}
                </div>
              )}

              <div className="flex space-x-2">
                {emergency.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => assignRescueTeam(emergency.id)}>
                      <Users className="h-4 w-4 mr-2" />
                      Assign Team
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateEmergencyStatus(emergency.id, 'assigned')}>
                      Mark Assigned
                    </Button>
                  </>
                )}
                
                {emergency.status === 'assigned' && (
                  <Button size="sm" onClick={() => updateEmergencyStatus(emergency.id, 'in_progress')}>
                    <Clock className="h-4 w-4 mr-2" />
                    Start Progress
                  </Button>
                )}
                
                {emergency.status === 'in_progress' && (
                  <Button size="sm" onClick={() => updateEmergencyStatus(emergency.id, 'resolved')}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Resolved
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredEmergencies.length === 0 && (
        <Card className="border-sky-100">
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No emergency requests</h3>
            <p className="text-gray-500">
              {selectedStatus !== 'all' 
                ? `No ${selectedStatus} emergency requests found.`
                : 'No emergency requests have been submitted yet.'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
