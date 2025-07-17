
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  message_type: 'user' | 'assistant' | 'system';
  content: string;
  audio_url?: string;
  emergency_detected?: boolean;
  location_data?: any;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  session_name?: string;
  is_active: boolean;
  emergency_detected?: boolean;
  location_shared?: boolean;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}

export const useRealtimeChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    initializeSession();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const initializeSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create or get active session
      const { data: session, error: sessionError } = await supabase
        .from('ai_chat_sessions')
        .insert({
          user_id: user.id,
          session_name: `Chat ${new Date().toLocaleDateString()}`,
          is_active: true,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      setCurrentSession(session);
      loadMessages(session.id);
      setupRealtimeSubscription(session.id);
    } catch (error) {
      console.error('Error initializing session:', error);
      toast({
        title: "Session Error",
        description: "Failed to initialize chat session",
        variant: "destructive",
      });
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Type cast the database response to match our interface
      const typedMessages = (data || []).map(message => ({
        ...message,
        message_type: message.message_type as 'user' | 'assistant' | 'system'
      })) as ChatMessage[];
      
      setMessages(typedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const setupRealtimeSubscription = (sessionId: string) => {
    const channel = supabase
      .channel(`chat_session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const typedMessage = {
            ...payload.new,
            message_type: payload.new.message_type as 'user' | 'assistant' | 'system'
          } as ChatMessage;
          
          setMessages(prev => [...prev, typedMessage]);
        }
      )
      .subscribe();

    channelRef.current = channel;
  };

  const sendMessage = async (content: string, audioData?: string, locationData?: any) => {
    if (!currentSession) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Insert user message
      const { error: messageError } = await supabase
        .from('ai_chat_messages')
        .insert({
          session_id: currentSession.id,
          user_id: user.id,
          message_type: 'user',
          content,
          location_data: locationData,
        });

      if (messageError) throw messageError;

      // Process with AI (simulate for now)
      await processWithAI(content, audioData, locationData);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Message Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processWithAI = async (content: string, audioData?: string, locationData?: any) => {
    try {
      // Simulate AI processing with emergency detection
      const isEmergency = content.toLowerCase().includes('help') || 
                         content.toLowerCase().includes('emergency') ||
                         content.toLowerCase().includes('rescue');

      let aiResponse = "I understand your message. How can I assist you further?";
      
      if (isEmergency) {
        aiResponse = "🚨 Emergency detected! I'm immediately alerting rescue teams and your emergency contacts with your location. Stay calm and follow safety protocols. Help is on the way!";
        
        // Update session with emergency status
        await supabase
          .from('ai_chat_sessions')
          .update({
            emergency_detected: true,
            latitude: locationData?.latitude,
            longitude: locationData?.longitude,
            location_shared: !!locationData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentSession!.id);
      }

      // Insert AI response
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('ai_chat_messages')
        .insert({
          session_id: currentSession!.id,
          user_id: user!.id,
          message_type: 'assistant',
          content: aiResponse,
          emergency_detected: isEmergency,
        });

    } catch (error) {
      console.error('Error processing with AI:', error);
    }
  };

  return {
    messages,
    currentSession,
    loading,
    sendMessage,
  };
};
