import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { submitMealSelection } from '@/services/mealSelectionsService';
import { sendWhatsAppMessage } from '@/services/wasenderapiService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Utensils, CheckCircle, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';

const STARTER_OPTIONS = ['Avocado Salad', 'Accra Beans'];
const MAIN_OPTIONS = ['Grilled Pork', 'Roasted Tilapia', 'Grilled Chicken', 'Beef Brochettes'];
const SIDE_OPTIONS = ['Fried Rice', 'Fried Plantains', 'Potato Wedges', 'Stir Fry Vegetables'];

const MenuSelectionPage = () => {
  const { eventId } = useParams();
  const { toast } = useToast();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    starter: '',
    mainCourse: '',
    sideDish: '',
    dessert: 'Fruit Salad'
  });

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, event_name, event_date, event_time, location')
          .eq('id', eventId)
          .single();

        if (error) throw error;
        setEvent(data);
      } catch (err) {
        toast({ title: 'Error', description: 'Event not found or unavailable.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    if (eventId) fetchEvent();
  }, [eventId]);

  const handleWhatsAppConfirmation = async (data) => {
    const template = `Hello {name},\n\nYour meal selection for ${event?.event_name} has been successfully registered!\n\n🍽️ *Your Menu:*\n- Starter: ${data.starter}\n- Main: ${data.mainCourse}\n- Side: ${data.sideDish}\n- Dessert: ${data.dessert}\n\nWe look forward to seeing you!\n\n*Alpha Bridge*`;
    
    try {
      await sendWhatsAppMessage(data.phone, template, { name: data.name });
    } catch (err) {
      console.error('WhatsApp confirmation failed, but meal is saved:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.starter || !formData.mainCourse || !formData.sideDish) {
      toast({ title: 'Missing Fields', description: 'Please complete all required fields.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitMealSelection({
        event_id: event.id,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        starter: formData.starter,
        main_course: formData.mainCourse,
        side_dish: formData.sideDish,
        dessert: formData.dessert
      });

      if (!result.success) throw new Error(result.error);

      await handleWhatsAppConfirmation(formData);
      
      setSuccess(true);
    } catch (err) {
      toast({ title: 'Submission Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#003D82]" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center py-10">
          <Utensils className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <CardTitle className="text-xl">Event Not Found</CardTitle>
          <CardDescription className="mt-2">The event you are looking for does not exist or has been removed.</CardDescription>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center py-12 px-6 shadow-xl border-t-4 border-t-green-500">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl text-gray-800 mb-2">Selection Confirmed!</CardTitle>
          <p className="text-gray-600 mb-6">
            Thank you, {formData.name}. Your meal preferences for <strong>{event.event_name}</strong> have been recorded successfully.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left text-sm space-y-2 border">
            <p><span className="font-semibold text-gray-700">Starter:</span> {formData.starter}</p>
            <p><span className="font-semibold text-gray-700">Main:</span> {formData.mainCourse}</p>
            <p><span className="font-semibold text-gray-700">Side:</span> {formData.sideDish}</p>
            <p><span className="font-semibold text-gray-700">Dessert:</span> {formData.dessert}</p>
          </div>
          <p className="text-xs text-gray-500 mt-6">A confirmation message has been sent to your WhatsApp.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-10 px-4 flex justify-center items-start">
      <div className="max-w-2xl w-full space-y-6">
        
        {/* Event Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-md">
            <Utensils className="w-8 h-8 text-[#003D82]" />
          </div>
          <h1 className="text-3xl font-bold text-[#003D82]">{event.event_name}</h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-gray-600 text-sm">
            <div className="flex items-center"><Calendar className="w-4 h-4 mr-1.5" /> {format(new Date(event.event_date), 'MMMM do, yyyy')}</div>
            <div className="flex items-center"><MapPin className="w-4 h-4 mr-1.5" /> {event.location}</div>
          </div>
        </div>

        <Card className="shadow-xl border-none">
          <CardHeader className="bg-white rounded-t-xl border-b pb-6">
            <CardTitle className="text-xl text-gray-800">Menu Selection</CardTitle>
            <CardDescription>Please provide your details and select your preferred meals for the event.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-700 font-semibold">Full Name *</Label>
                  <Input 
                    id="name" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="e.g. John Doe" 
                    required 
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-gray-700 font-semibold">WhatsApp Number *</Label>
                  <Input 
                    id="phone" 
                    type="tel"
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    placeholder="e.g. 2376XXXXXXXX" 
                    required 
                    className="bg-gray-50"
                  />
                </div>
              </div>

              <div className="space-y-6 bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                
                {/* Starter */}
                <div className="space-y-3">
                  <Label className="text-lg font-semibold text-[#003D82]">1. Starter *</Label>
                  <RadioGroup value={formData.starter} onValueChange={v => setFormData({...formData, starter: v})} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {STARTER_OPTIONS.map(opt => (
                      <div key={opt} className={`flex items-center space-x-2 border p-3 rounded-lg cursor-pointer transition-colors ${formData.starter === opt ? 'bg-blue-100 border-[#003D82]' : 'bg-white hover:bg-gray-50'}`}>
                        <RadioGroupItem value={opt} id={`starter-${opt}`} />
                        <Label htmlFor={`starter-${opt}`} className="cursor-pointer flex-1 font-medium">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Main Course */}
                <div className="space-y-3">
                  <Label className="text-lg font-semibold text-[#003D82]">2. Main Course *</Label>
                  <RadioGroup value={formData.mainCourse} onValueChange={v => setFormData({...formData, mainCourse: v})} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {MAIN_OPTIONS.map(opt => (
                      <div key={opt} className={`flex items-center space-x-2 border p-3 rounded-lg cursor-pointer transition-colors ${formData.mainCourse === opt ? 'bg-blue-100 border-[#003D82]' : 'bg-white hover:bg-gray-50'}`}>
                        <RadioGroupItem value={opt} id={`main-${opt}`} />
                        <Label htmlFor={`main-${opt}`} className="cursor-pointer flex-1 font-medium">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Side Dish */}
                <div className="space-y-3">
                  <Label className="text-lg font-semibold text-[#003D82]">3. Side Dish *</Label>
                  <RadioGroup value={formData.sideDish} onValueChange={v => setFormData({...formData, sideDish: v})} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SIDE_OPTIONS.map(opt => (
                      <div key={opt} className={`flex items-center space-x-2 border p-3 rounded-lg cursor-pointer transition-colors ${formData.sideDish === opt ? 'bg-blue-100 border-[#003D82]' : 'bg-white hover:bg-gray-50'}`}>
                        <RadioGroupItem value={opt} id={`side-${opt}`} />
                        <Label htmlFor={`side-${opt}`} className="cursor-pointer flex-1 font-medium">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Dessert (Auto-filled) */}
                <div className="space-y-2 pt-2">
                  <Label className="text-lg font-semibold text-[#003D82]">4. Dessert</Label>
                  <div className="bg-white border p-3 rounded-lg text-gray-500 font-medium">
                    <CheckCircle className="inline-block w-4 h-4 mr-2 text-green-500" />
                    {formData.dessert} (Included for all guests)
                  </div>
                </div>

              </div>

              <Button type="submit" className="w-full bg-[#003D82] hover:bg-blue-800 text-white text-lg py-6" disabled={submitting}>
                {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...</> : 'Confirm Selection'}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <div className="text-center text-xs text-gray-500">
          Powered by Alpha Bridge
        </div>
      </div>
    </div>
  );
};

export default MenuSelectionPage;