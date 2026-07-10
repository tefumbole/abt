import React, { useState, useEffect } from 'react';
import { getApplicationsByStatus, updateApplicationStatus } from '@/services/applicationStatusService';
import { sendInterviewInvitation } from '@/services/emailService';
import { WhatsAppService } from '@/services/WhatsAppService'; // Import WhatsApp Service
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, Calendar, Mail, Eye, MessageSquare } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import ApplicationReviewModal from '@/components/admin/ApplicationReviewModal';
import { Checkbox } from '@/components/ui/checkbox';

const applicantName = (app) => app.full_name || app.candidate_name || 'Applicant';

const AdminShortlistedApplicationsPage = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  
  // Schedule Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '' });
  const [schedulingAppId, setSchedulingAppId] = useState(null);

  // Invite Modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState({
    date: '', time: '', location: 'Alpha Bridge Office', contactPerson: 'HR', contactPhone: ''
  });
  const [invitingApp, setInvitingApp] = useState(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sendWhatsAppInvite, setSendWhatsAppInvite] = useState(true); // WhatsApp toggle
  
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const data = await getApplicationsByStatus('shortlisted');
      setApplications(data);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load shortlisted applications", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const openScheduleModal = (app) => {
      setSchedulingAppId(app.id);
      const existingDate = app.interview_date ? new Date(app.interview_date) : new Date();
      setScheduleData({ 
        date: existingDate.toISOString().split('T')[0], 
        time: existingDate.toTimeString().slice(0,5)
      });
      setScheduleModalOpen(true);
  };

  const openInviteModal = (app) => {
      setInvitingApp(app);
      const existingDate = app.interview_date ? new Date(app.interview_date) : new Date();
      setInviteData(prev => ({ 
          ...prev, 
          date: existingDate.toISOString().split('T')[0],
          time: existingDate.toTimeString().slice(0,5)
      }));
      setInviteModalOpen(true);
  };

  const handleUpdateSchedule = async () => {
      if (!scheduleData.date || !scheduleData.time) return;
      try {
          const dateTime = new Date(`${scheduleData.date}T${scheduleData.time}`);
          await updateApplicationStatus(schedulingAppId, 'shortlisted', { interviewDate: dateTime }, user?.id);
          toast({ title: "Success", description: "Interview date updated" });
          setScheduleModalOpen(false);
          fetchApplications();
      } catch (error) {
          toast({ title: "Error", description: "Failed to update interview date", variant: "destructive" });
      }
  };

  const handleSendInvite = async () => {
      setSendingInvite(true);
      try {
          // 1. Send Email
          const result = await sendInterviewInvitation(invitingApp.email, invitingApp, inviteData);
          if (result.success) {
            toast({ title: "Email Sent", description: `Invitation sent to ${invitingApp.email}` });
            
            // 2. Send WhatsApp
            if (sendWhatsAppInvite && invitingApp.phone) {
                const waMessage = `Your interview for ${invitingApp.jobs?.title || 'the position'} is scheduled for ${inviteData.date} at ${inviteData.time}. Please check your email for details and confirm.`;
                await WhatsAppService.sendMessage(invitingApp.phone, waMessage, 'interview_scheduled', {
                    recipient_name: applicantName(invitingApp),
                    recipient_type: 'applicant'
                });
                toast({ title: "WhatsApp Sent", description: "Notification sent to candidate's phone." });
            }

            setInviteModalOpen(false);
          } else {
            throw new Error(result.error);
          }
      } catch (error) {
          toast({ title: "Failed", description: "Could not send invitation", variant: "destructive" });
      } finally {
          setSendingInvite(false);
      }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-green-700">Shortlisted Candidates</h1>
            <p className="text-gray-500">Manage interviews and next steps.</p>
        </div>
        <Button variant="outline" onClick={fetchApplications}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
             <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>
          ) : applications.length === 0 ? (
             <div className="text-center p-12 text-gray-500">No shortlisted candidates yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-green-50 hover:bg-green-50">
                  <TableHead>Candidate</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Interview Date</TableHead>
                  <TableHead>Shortlisted On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                        <div className="flex flex-col">
                            <span className="font-medium">{applicantName(app)}</span>
                            <span className="text-xs text-gray-500">{app.email}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className="bg-white">{app.jobs?.title}</Badge>
                    </TableCell>
                    <TableCell>
                        {app.interview_date ? (
                            <div className="flex items-center gap-1 text-green-700 font-medium">
                                <Calendar className="w-4 h-4" />
                                {new Date(app.interview_date).toLocaleString()}
                            </div>
                        ) : (
                            <span className="text-gray-400 italic">Not scheduled</span>
                        )}
                    </TableCell>
                    <TableCell className="text-sm">
                        {new Date(app.status_changed_at || app.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedApp(app)}>
                            <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openScheduleModal(app)}>
                            <Calendar className="w-4 h-4 mr-1" /> Schedule
                        </Button>
                        <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openInviteModal(app)}>
                            <Mail className="w-4 h-4 mr-1" /> Invite
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Schedule Modal */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Update Schedule</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                  <div>
                      <Label>Date</Label>
                      <Input type="date" value={scheduleData.date} onChange={(e) => setScheduleData({...scheduleData, date: e.target.value})} />
                  </div>
                  <div>
                      <Label>Time</Label>
                      <Input type="time" value={scheduleData.time} onChange={(e) => setScheduleData({...scheduleData, time: e.target.value})} />
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setScheduleModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleUpdateSchedule}>Update</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Send Interview Invitation</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Date</Label>
                        <Input type="date" value={inviteData.date} onChange={(e) => setInviteData({...inviteData, date: e.target.value})} />
                      </div>
                      <div>
                        <Label>Time</Label>
                        <Input type="time" value={inviteData.time} onChange={(e) => setInviteData({...inviteData, time: e.target.value})} />
                      </div>
                  </div>
                  <div>
                      <Label>Location</Label>
                      <Input value={inviteData.location} onChange={(e) => setInviteData({...inviteData, location: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Contact Person</Label>
                        <Input value={inviteData.contactPerson} onChange={(e) => setInviteData({...inviteData, contactPerson: e.target.value})} />
                      </div>
                      <div>
                        <Label>Contact Phone</Label>
                        <Input value={inviteData.contactPhone} onChange={(e) => setInviteData({...inviteData, contactPhone: e.target.value})} />
                      </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-2 border-t mt-2">
                     <Checkbox id="wa-invite" checked={sendWhatsAppInvite} onCheckedChange={setSendWhatsAppInvite} />
                     <Label htmlFor="wa-invite" className="flex items-center gap-2 cursor-pointer font-medium text-green-700">
                        <MessageSquare className="w-4 h-4" /> Also send WhatsApp Notification
                     </Label>
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleSendInvite} disabled={sendingInvite} className="bg-green-600 hover:bg-green-700">
                      {sendingInvite ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                      Send Invitation
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <ApplicationReviewModal 
        isOpen={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        application={selectedApp}
        onSuccess={fetchApplications}
      />
    </div>
  );
};

export default AdminShortlistedApplicationsPage;