import React, { useState, useEffect } from 'react';
import { getAllEvents, createEvent, deleteEvent, updateEvent } from '@/services/eventService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Calendar, Clock, X } from 'lucide-react';
import EventsCountdownDisplay from '@/components/EventsCountdownDisplay';
import ImageUploadZone from '@/components/ui/ImageUploadZone';

const AdminEventsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  // Form State
  const [activeTab, setActiveTab] = useState('list');
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    description: '',
    image_url: '',
    enable_countdown: false
  });
  const [editingId, setEditingId] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    const data = await getAllEvents();
    setEvents(data);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (checked) => {
    setFormData(prev => ({ ...prev, enable_countdown: checked }));
  };

  const selectEventImage = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      setFormData(prev => ({ ...prev, image_url: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      date: '',
      description: '',
      image_url: '',
      enable_countdown: false
    });
    setImagePreview(null);
    setEditingId(null);
  };

  const handleEdit = (event) => {
    setFormData({
      title: event.title,
      date: event.date,
      description: event.description,
      image_url: event.image_url,
      enable_countdown: event.enable_countdown
    });
    setImagePreview(event.image_url);
    setEditingId(event.id);
    setActiveTab('add');
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this event?")) {
      await deleteEvent(id);
      loadEvents();
      toast({ title: "Deleted", description: "Event removed successfully." });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await updateEvent(editingId, formData);
        toast({ title: "Updated", description: "Event updated successfully." });
      } else {
        await createEvent(formData);
        toast({ title: "Created", description: "Event created successfully." });
      }
      resetForm();
      setActiveTab('list');
      loadEvents();
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold text-[#003D82]">Events Management</h1>
           <p className="text-gray-500">Create and manage upcoming company events</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); if(val === 'add' && !editingId) resetForm(); }}>
        <TabsList className="bg-white border mb-6">
          <TabsTrigger value="list">Event List</TabsTrigger>
          <TabsTrigger value="add">{editingId ? 'Edit Event' : 'Add Event'}</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
           {events.length === 0 ? (
             <div className="text-center py-12 bg-white rounded-lg border text-gray-500">No events found. Create one!</div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map(event => (
                  <Card key={event.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="relative h-48 bg-gray-200">
                      <img src={event.image_url || 'https://via.placeholder.com/400x200'} alt={event.title} className="w-full h-full object-cover" />
                      {event.enable_countdown && (
                         <div className="absolute bottom-2 left-2 right-2">
                             <EventsCountdownDisplay targetDate={event.date} />
                         </div>
                      )}
                    </div>
                    <CardContent className="p-5">
                       <h3 className="text-lg font-bold text-[#003D82] mb-1 line-clamp-1">{event.title}</h3>
                       <div className="flex items-center text-sm text-gray-500 mb-3">
                         <Calendar className="w-4 h-4 mr-1" />
                         {new Date(event.date).toLocaleDateString()}
                         <Clock className="w-4 h-4 ml-3 mr-1" />
                         {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                       </div>
                       <p className="text-sm text-gray-600 line-clamp-2 mb-4 h-10">{event.description}</p>
                       <div className="flex justify-end gap-2 border-t pt-3">
                         <Button variant="outline" size="sm" onClick={() => handleEdit(event)}><Edit className="w-4 h-4" /></Button>
                         <Button variant="destructive" size="sm" onClick={() => handleDelete(event.id)}><Trash2 className="w-4 h-4" /></Button>
                       </div>
                    </CardContent>
                  </Card>
                ))}
             </div>
           )}
        </TabsContent>

        <TabsContent value="add">
           <Card className="max-w-2xl mx-auto">
             <CardContent className="p-6">
               <form onSubmit={handleSubmit} className="space-y-6">
                 <div className="grid gap-2">
                   <Label htmlFor="title">Event Name <span className="text-red-500">*</span></Label>
                   <Input id="title" name="title" value={formData.title} onChange={handleInputChange} required placeholder="e.g. Annual Tech Conference" />
                 </div>

                 <div className="grid gap-2">
                   <Label htmlFor="date">Event Date & Time <span className="text-red-500">*</span></Label>
                   <Input id="date" name="date" type="datetime-local" value={formData.date} onChange={handleInputChange} required />
                 </div>

                 <div className="grid gap-2">
                   <Label htmlFor="image">Event Image</Label>
                   {imagePreview ? (
                     <div className="flex gap-4 items-start">
                       <div className="relative w-32 h-24 rounded border overflow-hidden shrink-0">
                         <img src={imagePreview} className="w-full h-full object-cover" alt="Event preview" />
                         <button type="button" onClick={() => { setImagePreview(null); setFormData(p => ({...p, image_url: ''}))}} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"><X className="w-3 h-3"/></button>
                       </div>
                       <ImageUploadZone
                         accept="image/*"
                         onFile={selectEventImage}
                         title="Replace — click, drop, or paste"
                         hint="Max 2MB — Ctrl/Cmd+V supported"
                         className="flex-1 py-4"
                       />
                     </div>
                   ) : (
                     <ImageUploadZone
                       accept="image/*"
                       onFile={selectEventImage}
                       title="Click, drop, or paste a cover image"
                       hint="Max 2MB — Ctrl/Cmd+V supported"
                     />
                   )}
                 </div>

                 <div className="grid gap-2">
                   <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
                   <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} required placeholder="Event details..." className="h-32" />
                 </div>

                 <div className="flex items-center space-x-2 border p-4 rounded bg-gray-50">
                   <Checkbox id="enable_countdown" checked={formData.enable_countdown} onCheckedChange={handleCheckboxChange} />
                   <Label htmlFor="enable_countdown" className="cursor-pointer font-medium">Enable Countdown Timer</Label>
                 </div>

                 <div className="flex justify-end gap-3 pt-4">
                   <Button type="button" variant="outline" onClick={() => { setActiveTab('list'); resetForm(); }}>Cancel</Button>
                   <Button type="submit" className="bg-[#003D82]" disabled={loading}>{loading ? 'Saving...' : (editingId ? 'Update Event' : 'Create Event')}</Button>
                 </div>
               </form>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminEventsPage;