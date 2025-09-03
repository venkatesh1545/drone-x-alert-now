import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { 
  MessageCircle, 
  Send, 
  Paperclip, 
  MapPin, 
  Users, 
  X,
  Clock,
  FileText,
  Image,
  Download
} from 'lucide-react';

interface GroupChat {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  emergency_contact_id?: string;
  joined_at: string;
  is_active: boolean;
}

interface ChatMessage {
  id: string;
  group_id: string;
  sender_id: string;
  message_type: 'text' | 'file' | 'location';
  content?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  location_latitude?: number;
  location_longitude?: number;
  location_duration_hours?: number;
  location_expires_at?: string;
  created_at: string;
  updated_at: string;
}

interface EmergencyGroupChatProps {
  onMemberRemoved?: (contactId: string) => void;
}

export const EmergencyGroupChat: React.FC<EmergencyGroupChatProps> = ({ onMemberRemoved }) => {
  const [groupChat, setGroupChat] = useState<GroupChat | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locationDuration, setLocationDuration] = useState('1');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadGroupChat();
  }, []);

  useEffect(() => {
    if (groupChat) {
      loadMessages();
      setupRealtimeSubscription();
    }
  }, [groupChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadGroupChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load user's group chat
      const { data: chats, error: chatsError } = await supabase
        .from('group_chats')
        .select('*')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .limit(1);

      if (chatsError) throw chatsError;

      if (chats && chats.length > 0) {
        setGroupChat(chats[0]);
        await loadMembers(chats[0].id);
      }
    } catch (error) {
      console.error('Error loading group chat:', error);
      toast({
        title: "Error",
        description: "Failed to load group chat",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMembers = async (groupId: string) => {
    try {
      const { data, error } = await supabase
        .from('group_chat_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('is_active', true);

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const loadMessages = async () => {
    if (!groupChat) return;

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .select('*')
        .eq('group_id', groupChat.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as ChatMessage[]);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!groupChat) return;

    const channel = supabase
      .channel('group-chat-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_chat_messages',
          filter: `group_id=eq.${groupChat.id}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!groupChat || (!newMessage.trim() && !selectedFile)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const messageData = {
        group_id: groupChat.id,
        sender_id: user.id,
        message_type: selectedFile ? 'file' : 'text',
        content: selectedFile ? `Shared file: ${selectedFile.name}` : newMessage.trim(),
        ...(selectedFile && {
          file_name: selectedFile.name,
          file_size: selectedFile.size,
        })
      };

      const { error } = await supabase
        .from('group_chat_messages')
        .insert([messageData]);

      if (error) throw error;

      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const shareLocation = async () => {
    if (!groupChat) return;

    setSharingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const duration = parseInt(locationDuration);
      const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000);

      const messageData = {
        group_id: groupChat.id,
        sender_id: user.id,
        message_type: 'location',
        content: `Shared location for ${duration} hour${duration > 1 ? 's' : ''}`,
        location_latitude: position.coords.latitude,
        location_longitude: position.coords.longitude,
        location_duration_hours: duration,
        location_expires_at: expiresAt.toISOString()
      };

      const { error } = await supabase
        .from('group_chat_messages')
        .insert([messageData]);

      if (error) throw error;

      toast({
        title: "Location Shared",
        description: `Your location has been shared for ${duration} hour${duration > 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Error sharing location:', error);
      toast({
        title: "Error", 
        description: "Failed to share location",
        variant: "destructive",
      });
    } finally {
      setSharingLocation(false);
    }
  };

  const removeMember = async (memberId: string, contactId?: string) => {
    try {
      const { error } = await supabase
        .from('group_chat_members')
        .update({ is_active: false })
        .eq('id', memberId);

      if (error) throw error;

      // Remove from emergency contacts if provided
      if (contactId && onMemberRemoved) {
        onMemberRemoved(contactId);
      }

      await loadMembers(groupChat!.id);
      
      toast({
        title: "Member Removed",
        description: "Member has been removed from the group chat",
      });
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isLocationExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading group chat...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!groupChat) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageCircle className="h-5 w-5 mr-2 text-primary" />
            Emergency Group Chat
          </CardTitle>
          <CardDescription>
            Verify your emergency contacts to create a group chat
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No group chat available</p>
            <p className="text-sm">Verify at least one emergency contact to create a group chat</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <MessageCircle className="h-5 w-5 mr-2 text-primary" />
            {groupChat.name}
          </div>
          <Badge variant="outline">{members.length} members</Badge>
        </CardTitle>
        <CardDescription>{groupChat.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
          {messages.map((message) => (
            <div key={message.id} className="flex flex-col">
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                  {message.sender_id.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">User</span>
                    <span className="text-xs text-muted-foreground">
                      {formatMessageTime(message.created_at)}
                    </span>
                  </div>
                  
                  {message.message_type === 'location' ? (
                    <div className="bg-primary/5 p-3 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="font-medium">Location Shared</span>
                        {isLocationExpired(message.location_expires_at) ? (
                          <Badge variant="destructive" className="text-xs">Expired</Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {message.location_duration_hours}h
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{message.content}</p>
                      {!isLocationExpired(message.location_expires_at) && (
                        <Button size="sm" variant="outline" className="mt-2">
                          View on Map
                        </Button>
                      )}
                    </div>
                  ) : message.message_type === 'file' ? (
                    <div className="bg-secondary/50 p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span className="font-medium">{message.file_name}</span>
                        {message.file_size && (
                          <span className="text-xs text-muted-foreground">
                            ({(message.file_size / 1024).toFixed(1)} KB)
                          </span>
                        )}
                        <Button size="sm" variant="ghost">
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{message.content}</p>
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="space-y-3">
          {selectedFile && (
            <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded border">
              <FileText className="w-4 h-4" />
              <span className="text-sm flex-1">{selectedFile.name}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1 flex gap-1">
              <Textarea
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="min-h-[40px] max-h-[120px] resize-none"
              />
              
              <div className="flex flex-col gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                
                <div className="flex gap-1">
                  <Select value={locationDuration} onValueChange={setLocationDuration}>
                    <SelectTrigger className="w-16 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1h</SelectItem>
                      <SelectItem value="6">6h</SelectItem>
                      <SelectItem value="8">8h</SelectItem>
                      <SelectItem value="24">1d</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={shareLocation}
                    disabled={sharingLocation}
                  >
                    <MapPin className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() && !selectedFile}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmergencyGroupChat;