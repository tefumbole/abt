import React, { useState, useEffect } from 'react';
import { createLetter } from '@/services/letterService';
import { getAllCategories } from '@/services/CommunicationCategoryService';
import { getAllShareholders } from '@/services/shareholdersService';
import { getAllMembers } from '@/services/membersService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Send, Loader2, FileText, Eye } from 'lucide-react';

const AdminLetterComposerPage = () => {
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({ title: '', content: '', category_id: '' });
  const [recipientType, setRecipientType] = useState('shareholders'); 
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadRecipients();
  }, [recipientType]);

  const loadInitialData = async () => {
    const cats = await getAllCategories();
    setCategories(cats);
  };

  const loadRecipients = async () => {
    setLoading(true);
    let data = [];
    if (recipientType === 'shareholders') data = await getAllShareholders();
    else if (recipientType === 'members') data = await getAllMembers();
    
    setRecipients(data.map(r => ({
        id: r.id,
        name: r.name || r.full_name,
        type: recipientType === 'shareholders' ? 'Shareholder' : 'Member'
    })));
    setSelectedRecipients([]);
    setLoading(false);
  };

  const handleSelectAll = (checked) => {
    if (checked) setSelectedRecipients(recipients.map(r => r.id));
    else setSelectedRecipients([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedRecipients.length === 0) {
        toast({ title: "Error", description: "Select recipients first.", variant: "destructive" });
        return;
    }
    if (!confirm(`Send official letter to ${selectedRecipients.length} recipients?`)) return;

    setLoading(true);
    try {
        const finalRecipients = recipients.filter(r => selectedRecipients.includes(r.id));
        await createLetter(formData, finalRecipients);
        toast({ title: "Letter Sent", description: "The official letter has been dispatched." });
        setFormData({ title: '', content: '', category_id: '' });
        setSelectedRecipients([]);
        setPreviewMode(false);
    } catch (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold text-[#003D82]">Compose Official Letter</h1>
                <p className="text-gray-500">Create formal communications with letterhead.</p>
            </div>
            <Button variant={previewMode ? "secondary" : "outline"} onClick={() => setPreviewMode(!previewMode)}>
                <Eye className="w-4 h-4 mr-2" /> {previewMode ? 'Edit Mode' : 'Preview Letter'}
            </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
            {/* Editor / Preview Area */}
            <div className="lg:col-span-2">
                {previewMode ? (
                    <Card className="min-h-[600px] border-t-8 border-t-[#003D82] shadow-xl">
                        <CardContent className="p-8 md:p-12 font-serif text-gray-800 space-y-8">
                            {/* Letterhead Mock */}
                            <div className="flex justify-between items-start border-b-2 border-[#D4AF37] pb-6 mb-8">
                                <div>
                                    <h2 className="text-2xl font-bold text-[#003D82] uppercase tracking-wider">Alpha Bridge</h2>
                                    <p className="text-sm text-gray-500">Technologies Ltd</p>
                                </div>
                                <div className="text-right text-sm text-gray-600">
                                    <p>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    <p>Official Correspondence</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-xl font-bold text-center underline decoration-gray-300 underline-offset-4">
                                    {formData.title || '[Subject Title]'}
                                </h3>
                                <p className="italic text-gray-500">Dear &#123;Recipient Name&#125;,</p>
                                <div className="whitespace-pre-wrap leading-relaxed text-lg">
                                    {formData.content || '[Letter Content Body]'}
                                </div>
                            </div>

                            <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col items-end">
                                <p className="font-bold">Alpha Bridge Administration</p>
                                <p className="text-sm text-gray-500">Authorized Signature</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>Letter Content</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form id="letter-form" onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <Select 
                                            value={formData.category_id} 
                                            onValueChange={(val) => setFormData({...formData, category_id: val})}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                            <SelectContent>
                                                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Subject Title</Label>
                                        <Input 
                                            value={formData.title} 
                                            onChange={e => setFormData({...formData, title: e.target.value})} 
                                            placeholder="Official Subject"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Body Content</Label>
                                    <Textarea 
                                        value={formData.content} 
                                        onChange={e => setFormData({...formData, content: e.target.value})} 
                                        placeholder="Type your formal letter content here. Use {name} for personalization."
                                        rows={15}
                                        className="font-serif text-lg leading-relaxed"
                                        required
                                    />
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Recipient Selection */}
            <div className="space-y-6">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileText className="w-4 h-4" /> Recipients</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                        <div className="mb-4">
                             <Select value={recipientType} onValueChange={setRecipientType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="shareholders">Shareholders</SelectItem>
                                    <SelectItem value="members">Team Members</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="flex items-center space-x-2 mb-4 p-2 bg-gray-50 rounded">
                            <Checkbox 
                                id="select-all-l" 
                                checked={recipients.length > 0 && selectedRecipients.length === recipients.length}
                                onCheckedChange={handleSelectAll}
                            />
                            <Label htmlFor="select-all-l" className="font-semibold cursor-pointer">Select All ({recipients.length})</Label>
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-[400px] space-y-2 pr-2">
                             {recipients.map(r => (
                                <div key={r.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                                    <Checkbox 
                                        checked={selectedRecipients.includes(r.id)}
                                        onCheckedChange={(c) => {
                                            if(c) setSelectedRecipients([...selectedRecipients, r.id]);
                                            else setSelectedRecipients(selectedRecipients.filter(id => id !== r.id));
                                        }}
                                    />
                                    <Label className="cursor-pointer truncate">{r.name}</Label>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    <div className="p-6 border-t bg-gray-50 rounded-b-lg">
                        <Button type="submit" form="letter-form" className="w-full bg-[#003D82]" disabled={loading || selectedRecipients.length === 0}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                            Dispatch Letter ({selectedRecipients.length})
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    </div>
  );
};

export default AdminLetterComposerPage;