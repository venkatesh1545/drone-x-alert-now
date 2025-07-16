
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Mail, Plus, Trash2, User, Save, Edit, Heart } from "lucide-react";

interface EmergencyContact {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  relationship?: string;
  priority: number;
}

interface EmergencyContactsProps {
  readOnly?: boolean;
}

export const EmergencyContacts = ({ readOnly = false }: EmergencyContactsProps) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data, error } = await supabase
          .from('emergency_contacts')
          .select('*')
          .eq('user_id', user.id)
          .order('priority');

        if (error) throw error;
        setContacts(data || []);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({
        title: "Error",
        description: "Failed to load emergency contacts.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveContact = async (contact: EmergencyContact) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (contact.id) {
        // Update existing contact
        const { error } = await supabase
          .from('emergency_contacts')
          .update({
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            relationship: contact.relationship,
            priority: contact.priority,
          })
          .eq('id', contact.id);

        if (error) throw error;
      } else {
        // Create new contact
        const { error } = await supabase
          .from('emergency_contacts')
          .insert({
            user_id: user.id,
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            relationship: contact.relationship,
            priority: contact.priority,
          });

        if (error) throw error;
      }

      await fetchContacts();
      setEditingContact(null);
      toast({
        title: "Success",
        description: "Emergency contact saved successfully.",
      });
    } catch (error: any) {
      console.error('Error saving contact:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save contact.",
        variant: "destructive",
      });
    }
  };

  const deleteContact = async (id: string) => {
    try {
      const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchContacts();
      toast({
        title: "Success",
        description: "Emergency contact deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        title: "Error",
        description: "Failed to delete contact.",
        variant: "destructive",
      });
    }
  };

  const startEditing = (contact?: EmergencyContact) => {
    if (contact) {
      setEditingContact(contact);
    } else {
      // Find next available priority
      const usedPriorities = contacts.map(c => c.priority);
      const nextPriority = [1, 2, 3, 4, 5].find(p => !usedPriorities.includes(p)) || 1;
      
      setEditingContact({
        name: '',
        phone: '',
        email: '',
        relationship: '',
        priority: nextPriority,
      });
    }
  };

  const relationships = [
    'Family',
    'Spouse',
    'Parent',
    'Child',
    'Sibling',
    'Friend',
    'Colleague',
    'Neighbor',
    'Doctor',
    'Other'
  ];

  const getPriorityLabel = (priority: number) => {
    const labels = {
      1: 'Primary',
      2: 'Secondary',
      3: 'Tertiary',
      4: 'Backup',
      5: 'Emergency'
    };
    return labels[priority as keyof typeof labels] || `Priority ${priority}`;
  };

  const getPriorityColor = (priority: number) => {
    const colors = {
      1: 'bg-red-100 text-red-700',
      2: 'bg-orange-100 text-orange-700',
      3: 'bg-yellow-100 text-yellow-700',
      4: 'bg-blue-100 text-blue-700',
      5: 'bg-green-100 text-green-700'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  if (readOnly) {
    return (
      <div className="space-y-3">
        {contacts.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No emergency contacts added yet</p>
          </div>
        ) : (
          contacts.slice(0, 5).map((contact) => (
            <div key={contact.id} className="flex items-center space-x-3 p-3 bg-sky-50 rounded-lg">
              <div className="flex-shrink-0">
                <Badge className={getPriorityColor(contact.priority)}>
                  {contact.priority}
                </Badge>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{contact.name}</p>
                <p className="text-sm text-gray-500 truncate">{contact.phone}</p>
                {contact.relationship && (
                  <p className="text-xs text-gray-400">{contact.relationship}</p>
                )}
              </div>
              <div className="flex space-x-1">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Phone className="h-3 w-3" />
                </Button>
                {contact.email && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                    <Mail className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add/Edit Contact Form */}
      {editingContact && (
        <Card className="border-sky-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <User className="h-5 w-5 mr-2 text-sky-500" />
              {editingContact.id ? 'Edit Contact' : 'Add Emergency Contact'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={editingContact.name}
                  onChange={(e) => setEditingContact({...editingContact, name: e.target.value})}
                  placeholder="Full name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={editingContact.phone}
                  onChange={(e) => setEditingContact({...editingContact, phone: e.target.value})}
                  placeholder="Phone number"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editingContact.email || ''}
                  onChange={(e) => setEditingContact({...editingContact, email: e.target.value})}
                  placeholder="Email address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship</Label>
                <Select 
                  value={editingContact.relationship || ''} 
                  onValueChange={(value) => setEditingContact({...editingContact, relationship: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationships.map((rel) => (
                      <SelectItem key={rel} value={rel}>
                        {rel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  value={editingContact.priority.toString()} 
                  onValueChange={(value) => setEditingContact({...editingContact, priority: parseInt(value)})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((priority) => (
                      <SelectItem 
                        key={priority} 
                        value={priority.toString()}
                        disabled={contacts.some(c => c.priority === priority && c.id !== editingContact.id)}
                      >
                        {getPriorityLabel(priority)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button 
                onClick={() => saveContact(editingContact)}
                disabled={!editingContact.name || !editingContact.phone}
                className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Contact
              </Button>
              <Button variant="outline" onClick={() => setEditingContact(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Emergency Contacts ({contacts.length}/5)</h4>
          {!editingContact && contacts.length < 5 && (
            <Button 
              size="sm" 
              onClick={() => startEditing()}
              className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Contact
            </Button>
          )}
        </div>

        {contacts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Heart className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium mb-1">No emergency contacts yet</p>
            <p className="text-sm">Add up to 5 emergency contacts for immediate notifications</p>
          </div>
        ) : (
          contacts.map((contact) => (
            <Card key={contact.id} className="border-sky-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge className={getPriorityColor(contact.priority)}>
                      {contact.priority}
                    </Badge>
                    <div>
                      <p className="font-medium text-gray-900">{contact.name}</p>
                      <p className="text-sm text-gray-600">{contact.phone}</p>
                      {contact.email && (
                        <p className="text-sm text-gray-500">{contact.email}</p>
                      )}
                      {contact.relationship && (
                        <p className="text-xs text-gray-400">{contact.relationship}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing(contact)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => contact.id && deleteContact(contact.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
