import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Phone, Check, Clock, X, Send } from 'lucide-react';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  verification_status: 'pending' | 'verified' | 'failed';
  verification_type: 'email' | 'sms';
  verification_code?: string;
  verification_expires_at?: string;
  verified_at?: string;
}

interface EmergencyContactVerificationProps {
  contacts: EmergencyContact[];
  onVerificationUpdate: () => void;
}

export const EmergencyContactVerification: React.FC<EmergencyContactVerificationProps> = ({
  contacts,
  onVerificationUpdate
}) => {
  const [verifyingContact, setVerifyingContact] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationType, setVerificationType] = useState<'email' | 'sms'>('email');
  const { toast } = useToast();

  const sendVerification = async (contactId: string, type: 'email' | 'sms') => {
    setVerifyingContact(contactId);
    
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;

      // Generate 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Set expiration to 30 minutes from now
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      // Update contact with verification code
      const { error } = await supabase
        .from('emergency_contacts')
        .update({
          verification_code: code,
          verification_type: type,
          verification_expires_at: expiresAt,
          verification_status: 'pending'
        })
        .eq('id', contactId);

      if (error) throw error;

      // Here you would integrate with an email/SMS service
      // For demo purposes, we'll show the code in a toast
      toast({
        title: "Verification Code Sent",
        description: `Code: ${code} (Demo - normally sent via ${type})`,
        duration: 10000,
      });

      onVerificationUpdate();
    } catch (error) {
      console.error('Error sending verification:', error);
      toast({
        title: "Error",
        description: "Failed to send verification code",
        variant: "destructive",
      });
    } finally {
      setVerifyingContact(null);
    }
  };

  const verifyCode = async (contactId: string, inputCode: string) => {
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;

      // Check if code matches and hasn't expired
      if (contact.verification_code !== inputCode) {
        toast({
          title: "Invalid Code",
          description: "The verification code you entered is incorrect",
          variant: "destructive",
        });
        return;
      }

      if (contact.verification_expires_at && new Date(contact.verification_expires_at) < new Date()) {
        toast({
          title: "Code Expired",
          description: "The verification code has expired. Please request a new one",
          variant: "destructive",
        });
        return;
      }

      // Mark as verified
      const { error } = await supabase
        .from('emergency_contacts')
        .update({
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
          verification_code: null,
          verification_expires_at: null
        })
        .eq('id', contactId);

      if (error) throw error;

      toast({
        title: "Contact Verified",
        description: `${contact.name} has been successfully verified and added to your emergency network`,
      });

      setVerificationCode('');
      onVerificationUpdate();
    } catch (error) {
      console.error('Error verifying code:', error);
      toast({
        title: "Error",
        description: "Failed to verify contact",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (contact: EmergencyContact) => {
    switch (contact.verification_status) {
      case 'verified':
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            <Check className="w-3 h-3 mr-1" />
            Verified
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <X className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            Not Started
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Mail className="h-5 w-5 mr-2 text-primary" />
          Contact Verification
        </CardTitle>
        <CardDescription>
          Verify your emergency contacts to enable group chat and location sharing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium">{contact.name}</h4>
                  {getStatusBadge(contact)}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {contact.phone}
                  </div>
                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {contact.email}
                    </div>
                  )}
                  {contact.verified_at && (
                    <div className="text-xs text-success">
                      Verified on {new Date(contact.verified_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {contact.verification_status === 'verified' ? (
                  <div className="text-success text-sm">✓ Verified</div>
                ) : contact.verification_status === 'pending' && contact.verification_code ? (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Enter code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="w-24"
                      maxLength={6}
                    />
                    <Button
                      size="sm"
                      onClick={() => verifyCode(contact.id, verificationCode)}
                      disabled={verificationCode.length !== 6}
                    >
                      Verify
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select
                      value={verificationType}
                      onValueChange={(value: 'email' | 'sms') => setVerificationType(value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {contact.email && (
                          <SelectItem value="email">Email</SelectItem>
                        )}
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => sendVerification(contact.id, verificationType)}
                      disabled={verifyingContact === contact.id || (!contact.email && verificationType === 'email')}
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Send Code
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {contacts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No emergency contacts added yet</p>
              <p className="text-sm">Add contacts first to enable verification</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EmergencyContactVerification;