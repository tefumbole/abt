import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/services/sharePriceService';
import { formatCountryCodeDisplay } from '@/services/countryCodeService';
import { getPendingShareholders, updateShareholder } from '@/services/shareholderService';
import { sendWhatsAppMessage } from '@/services/wasenderapiService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  Building2, 
  MapPin,
  Hash,
  DollarSign,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileSignature,
  Globe
} from 'lucide-react';
import { format } from 'date-fns';

const PendingShareApprovalsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [adminNotes, setAdminNotes] = useState({});
  const [editedShares, setEditedShares] = useState({});

  const fetchPendingApprovals = async () => {
    console.log('[PENDING] Fetching pending approvals');
    setLoading(true);
    setError(null);

    try {
      const data = await getPendingShareholders();
      console.log('[PENDING] Fetched', data.length, 'pending shareholders');
      setPendingBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[PENDING] Error fetching pending approvals:', err);
      setError(err.message || 'Failed to load pending approvals');
      setPendingBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const calculateNewTotal = (bookingId) => {
    const booking = pendingBookings.find(b => b.id === bookingId);
    if (!booking) return 0;

    const newShares = editedShares[bookingId] || booking.shares_assigned;
    const pricePerShare = booking.investment_amount / booking.shares_assigned;
    return newShares * pricePerShare;
  };

  const handleApprove = async (booking) => {
    console.log('[PENDING] Approving booking:', booking.id);
    
    if (!user?.id) {
      console.error('[PENDING] No user ID for approval');
      toast({
        title: "Authentication Error",
        description: "You must be logged in to approve bookings.",
        variant: "destructive"
      });
      return;
    }

    setProcessingId(booking.id);

    try {
      const finalShares = editedShares[booking.id] || booking.shares_assigned;
      const finalTotal = calculateNewTotal(booking.id);

      console.log('[PENDING] Approving with shares:', finalShares, 'total:', finalTotal);

      // Update shareholder booking
      const updateResult = await updateShareholder(booking.id, {
        status: 'approved',
        shares_assigned: finalShares,
        investment_amount: finalTotal,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        admin_notes: adminNotes[booking.id] || null
      });

      if (!updateResult.success) {
        throw updateResult.error;
      }

      console.log('[PENDING] Shareholder updated successfully');

      // Send WhatsApp confirmation message
      const pricePerShare = booking.investment_amount / booking.shares_assigned;
      const whatsappMessage = `Dear ${booking.full_name || 'Shareholder'},

Your share booking request with Alpha Bridge has been approved.

Approved Shares: ${finalShares}
Share Price: USD ${pricePerShare.toFixed(2)}
Total Investment Value: USD ${finalTotal.toFixed(2)}

Thank you for choosing to become part of Alpha Bridge.

Alpha Bridge - The Technological Bridge to Kigali`;

      console.log('[PENDING] Sending WhatsApp notification to:', booking.full_phone_number);
      
      try {
        await sendWhatsAppMessage(booking.full_phone_number, whatsappMessage);
        console.log('[PENDING] WhatsApp confirmation sent successfully');
      } catch (whatsappError) {
        console.error('[PENDING] WhatsApp notification failed:', whatsappError);
        toast({
          title: "Approval Successful",
          description: "Booking approved but WhatsApp notification failed. Please notify client manually.",
          variant: "default"
        });
      }

      // Refresh pending list
      await fetchPendingApprovals();

      // Clear form data
      setAdminNotes(prev => {
        const updated = { ...prev };
        delete updated[booking.id];
        return updated;
      });
      setEditedShares(prev => {
        const updated = { ...prev };
        delete updated[booking.id];
        return updated;
      });
      setExpandedId(null);

      toast({
        title: "Booking Approved",
        description: "Client has been notified via WhatsApp.",
        className: "bg-green-600 text-white"
      });

    } catch (err) {
      console.error('[PENDING] Approval error:', err);
      toast({
        title: "Approval Failed",
        description: err.message || "An error occurred during approval.",
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (booking) => {
    console.log('[PENDING] Rejecting booking:', booking.id);
    
    if (!user?.id) {
      console.error('[PENDING] No user ID for rejection');
      toast({
        title: "Authentication Error",
        description: "You must be logged in to reject bookings.",
        variant: "destructive"
      });
      return;
    }

    if (!adminNotes[booking.id] || adminNotes[booking.id].trim() === '') {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejection in the admin notes.",
        variant: "destructive"
      });
      return;
    }

    setProcessingId(booking.id);

    try {
      const updateResult = await updateShareholder(booking.id, {
        status: 'rejected',
        rejection_reason: adminNotes[booking.id],
        admin_notes: adminNotes[booking.id]
      });

      if (!updateResult.success) {
        throw updateResult.error;
      }

      console.log('[PENDING] Shareholder rejected successfully');

      await fetchPendingApprovals();

      setAdminNotes(prev => {
        const updated = { ...prev };
        delete updated[booking.id];
        return updated;
      });
      setEditedShares(prev => {
        const updated = { ...prev };
        delete updated[booking.id];
        return updated;
      });
      setExpandedId(null);

      toast({
        title: "Booking Rejected",
        description: "The booking has been rejected.",
        className: "bg-red-600 text-white"
      });

    } catch (err) {
      console.error('[PENDING] Rejection error:', err);
      toast({
        title: "Rejection Failed",
        description: err.message || "An error occurred during rejection.",
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#003D82] mx-auto mb-4" />
          <p className="text-gray-600">Loading pending approvals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto mt-8">
        <XCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (pendingBookings.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardContent className="p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">No Pending Approvals</h3>
          <p className="text-gray-600">All share booking requests have been reviewed.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Pending Share Approvals</h1>
          <p className="text-gray-600 mt-1">Review and approve share booking requests</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {pendingBookings.length} Pending
        </Badge>
      </div>

      <div className="grid gap-4">
        {pendingBookings.map(booking => {
          const isExpanded = expandedId === booking.id;
          const isProcessing = processingId === booking.id;
          const newTotal = calculateNewTotal(booking.id);
          const pricePerShare = booking.investment_amount / booking.shares_assigned;

          return (
            <Card key={booking.id} className="border-2 border-yellow-200 shadow-lg">
              <CardHeader className="bg-yellow-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl">{booking.full_name || 'N/A'}</CardTitle>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending Approval
                      </Badge>
                    </div>
                    <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span>{booking.email || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{booking.full_phone_number || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(booking.id)}
                    disabled={isProcessing}
                  >
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Country Code</p>
                      <p className="font-medium">{formatCountryCodeDisplay(booking.country_code)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Address</p>
                      <p className="font-medium">{booking.address || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Submitted</p>
                      <p className="font-medium">
                        {booking.submitted_at ? format(new Date(booking.submitted_at), 'MMM dd, yyyy') : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                  <div className="flex items-center gap-2">
                    <Hash className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-600">Number of Shares</p>
                      <p className="text-lg font-bold text-blue-800">{booking.shares_assigned || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-xs text-gray-600">Price Per Share</p>
                      <p className="text-lg font-bold text-purple-800">
                        {formatPrice(pricePerShare)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-600">Total Investment</p>
                      <p className="text-lg font-bold text-green-800">
                        {formatPrice(booking.investment_amount || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {booking.signature && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-3">
                      <FileSignature className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-gray-700">Client Signature</span>
                    </div>
                    <div className="bg-white border border-gray-300 rounded-lg p-2 inline-block">
                      <img 
                        src={booking.signature} 
                        alt="Client signature" 
                        className="max-w-[400px] h-auto"
                      />
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div className="mt-6 space-y-4 p-4 bg-gray-50 rounded-lg border">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`shares-${booking.id}`} className="mb-2 block">
                          Adjust Number of Shares (Optional)
                        </Label>
                        <Input
                          id={`shares-${booking.id}`}
                          type="number"
                          min="1"
                          placeholder={booking.shares_assigned}
                          value={editedShares[booking.id] || ''}
                          onChange={(e) => setEditedShares(prev => ({ 
                            ...prev, 
                            [booking.id]: parseInt(e.target.value) || booking.shares_assigned 
                          }))}
                          disabled={isProcessing}
                          className="bg-white"
                        />
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">Calculated Total Investment</p>
                        <p className="text-2xl font-bold text-green-700">
                          {formatPrice(newTotal)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {editedShares[booking.id] || booking.shares_assigned} shares × {formatPrice(pricePerShare)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`notes-${booking.id}`} className="mb-2 block">
                        Admin Notes
                      </Label>
                      <Textarea
                        id={`notes-${booking.id}`}
                        placeholder="Add notes about this approval/rejection..."
                        value={adminNotes[booking.id] || ''}
                        onChange={(e) => setAdminNotes(prev => ({ ...prev, [booking.id]: e.target.value }))}
                        className="min-h-[100px] bg-white"
                        disabled={isProcessing}
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleApprove(booking)}
                        disabled={isProcessing}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve & Notify
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={() => handleReject(booking)}
                        disabled={isProcessing}
                        variant="destructive"
                        className="flex-1"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={() => toggleExpand(booking.id)}
                        disabled={isProcessing}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {!isExpanded && (
                  <div className="mt-4">
                    <Button
                      onClick={() => toggleExpand(booking.id)}
                      variant="outline"
                      className="w-full"
                    >
                      Review & Approve
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PendingShareApprovalsPage;