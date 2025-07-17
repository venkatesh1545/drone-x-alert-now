
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, MapPin, Clock, Users, Settings, LogOut, 
  Navigation, Phone, AlertTriangle, CheckCircle, 
  Play, Pause, RotateCcw, Activity, Eye
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { RescueMissions } from "@/components/RescueMissions";
import { TeamLocationTracker } from "@/components/TeamLocationTracker";
import { EmergencyMap } from "@/components/EmergencyMap";

const RescueTeam = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRescueTeam, setIsRescueTeam] = useState(false);
  const [teamInfo, setTeamInfo] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) {
          navigate("/auth");
        } else {
          checkRescueTeamRole(session.user.id);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      } else {
        checkRescueTeamRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkRescueTeamRole = async (userId: string) => {
    try {
      // Check if user has rescue_team role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const hasRescueTeamRole = roles?.some(r => r.role === 'rescue_team');
      
      // Also check if user is part of a rescue team
      const { data: teamData } = await supabase
        .from('rescue_teams')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (hasRescueTeamRole || teamData) {
        setIsRescueTeam(true);
        setTeamInfo(teamData);
      } else {
        toast({
          title: "Access Denied",
          description: "You are not part of a rescue team.",
          variant: "destructive",
        });
        navigate("/dashboard");
      }
    } catch (error) {
      console.error('Error checking rescue team role:', error);
      navigate("/dashboard");
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
      navigate("/");
    }
  };

  const updateTeamStatus = async (status: string) => {
    if (!teamInfo) return;
    
    try {
      const { error } = await supabase
        .from('rescue_teams')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', teamInfo.id);

      if (error) throw error;

      setTeamInfo({ ...teamInfo, status });
      toast({
        title: "Status Updated",
        description: `Team status changed to ${status}`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-sky-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-sky-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading rescue team dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || !isRescueTeam) {
    return null;
  }

  const statusColor = {
    available: "bg-green-100 text-green-700",
    deployed: "bg-orange-100 text-orange-700",
    busy: "bg-red-100 text-red-700",
    off_duty: "bg-gray-100 text-gray-700"
  }[teamInfo?.status] || "bg-gray-100 text-gray-700";

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-sky-50 to-white">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-sky-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Link to="/" className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-sky-500" />
                <span className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-sky-400 bg-clip-text text-transparent">
                  DroneX Rescue
                </span>
              </Link>
              <Badge className={`ml-4 ${statusColor}`}>
                <Activity className="h-3 w-3 mr-1" />
                {teamInfo?.status || 'Unknown'}
              </Badge>
              {teamInfo && (
                <Badge className="bg-blue-100 text-blue-700">
                  <Users className="h-3 w-3 mr-1" />
                  {teamInfo.team_name}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/dashboard">
                <Button variant="outline" className="border-sky-300 text-sky-600 hover:bg-sky-50">
                  <Eye className="h-4 w-4 mr-2" />
                  User Dashboard
                </Button>
              </Link>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Rescue Team Operations
          </h1>
          <p className="text-gray-600">
            Manage missions, track locations, and coordinate emergency responses
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Button 
            onClick={() => updateTeamStatus('available')}
            className="h-20 flex-col bg-green-500 hover:bg-green-600"
            disabled={teamInfo?.status === 'available'}
          >
            <CheckCircle className="h-6 w-6 mb-2" />
            Available
          </Button>
          <Button 
            onClick={() => updateTeamStatus('deployed')}
            className="h-20 flex-col bg-orange-500 hover:bg-orange-600"
            disabled={teamInfo?.status === 'deployed'}
          >
            <Play className="h-6 w-6 mb-2" />
            Deployed
          </Button>
          <Button 
            onClick={() => updateTeamStatus('busy')}
            className="h-20 flex-col bg-red-500 hover:bg-red-600"
            disabled={teamInfo?.status === 'busy'}
          >
            <Pause className="h-6 w-6 mb-2" />
            Busy
          </Button>
          <Button 
            onClick={() => updateTeamStatus('off_duty')}
            className="h-20 flex-col bg-gray-500 hover:bg-gray-600"
            disabled={teamInfo?.status === 'off_duty'}
          >
            <RotateCcw className="h-6 w-6 mb-2" />
            Off Duty
          </Button>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="missions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="missions">Active Missions</TabsTrigger>
            <TabsTrigger value="map">Emergency Map</TabsTrigger>
            <TabsTrigger value="location">Location Tracker</TabsTrigger>
            <TabsTrigger value="team">Team Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="missions">
            <RescueMissions teamId={teamInfo?.id} />
          </TabsContent>

          <TabsContent value="map">
            <EmergencyMap teamLocation={teamInfo} />
          </TabsContent>

          <TabsContent value="location">
            <TeamLocationTracker teamId={teamInfo?.id} />
          </TabsContent>

          <TabsContent value="team">
            <Card className="border-sky-100">
              <CardHeader>
                <CardTitle>Team Profile</CardTitle>
                <CardDescription>Manage your rescue team information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Team Name</label>
                      <p className="text-lg font-semibold">{teamInfo?.team_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Specialization</label>
                      <p className="text-lg">{teamInfo?.specialization || 'General Rescue'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Current Status</label>
                      <Badge className={statusColor}>
                        {teamInfo?.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Contact Phone</label>
                      <p className="text-lg">{teamInfo?.contact_phone}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Contact Email</label>
                      <p className="text-lg">{teamInfo?.contact_email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Last Updated</label>
                      <p className="text-sm text-gray-500">
                        {teamInfo?.updated_at ? new Date(teamInfo.updated_at).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-4 pt-4 border-t">
                  <Button variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                  <Button variant="outline">
                    <Phone className="h-4 w-4 mr-2" />
                    Emergency Contacts
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RescueTeam;
