import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Printer, ArrowLeft, LayoutDashboard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getShareholderByReference } from '@/services/shareholderService';
import { format } from 'date-fns';

const ShareholderConfirmationPage = () => {
  const { referenceNumber } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!referenceNumber) {
        setError("No reference number provided");
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
          const { data, error } = await getShareholderByReference(referenceNumber);
          
          if (error) throw error;
          if (!data) throw new Error("Application not found");
          
          setDetails(data);
      } catch (err) {
          console.error("Confirmation Page Error:", err);
          setError(err.message || "Failed to load application details.");
      } finally {
          setLoading(false);
      }
    };

    fetchDetails();
  }, [referenceNumber]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#003D82] animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Loading Confirmation...</h2>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md border-red-200 shadow-lg">
          <CardHeader className="bg-red-50 rounded-t-lg">
            <CardTitle className="text-red-700 flex items-center gap-2">
               Application Not Found
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-gray-700 mb-6">
              {error || "We couldn't find an application with that reference number. It may have been deleted or the link is incorrect."}
            </p>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        {/* Success Header */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-[#003D82] mb-2">Application Submitted!</h1>
          <p className="text-lg text-gray-600">
            Thank you for your investment interest in Alpha Bridge.
          </p>
        </div>

        {/* Confirmation Card */}
        <Card className="shadow-xl border-t-4 border-t-[#D4AF37] overflow-hidden print:shadow-none print:border-none">
          <div className="bg-[#003D82] text-white p-6 flex justify-between items-center">
            <div>
              <p className="text-blue-200 text-sm uppercase tracking-wider font-semibold">Reference Number</p>
              <h2 className="text-2xl font-mono font-bold tracking-tight">{details.reference_number}</h2>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-blue-200 text-xs">Date</p>
              <p className="font-medium">
                  {details.created_at ? format(new Date(details.created_at), 'MMM dd, yyyy') : 'N/A'}
              </p>
            </div>
          </div>

          <CardContent className="p-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                <div>
                   <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold block mb-1">Full Name</label>
                   <p className="text-lg font-medium text-gray-900">{details.name}</p>
                </div>

                <div>
                   <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold block mb-1">Email Address</label>
                   <p className="text-lg font-medium text-gray-900">{details.email}</p>
                </div>

                <div>
                   <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold block mb-1">Phone Number</label>
                   <p className="text-lg font-medium text-gray-900">{details.phone}</p>
                </div>

                <div>
                   <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold block mb-1">Company</label>
                   <p className="text-lg font-medium text-gray-900">{details.company_name || 'N/A'}</p>
                </div>

                <div className="col-span-1 md:col-span-2 border-t border-gray-100 pt-6 mt-2">
                   <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                      <div>
                          <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold block mb-1">Number of Shares</label>
                          <p className="text-xl font-bold text-[#003D82]">{details.shares_assigned}</p>
                      </div>
                      <div className="text-right">
                          <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold block mb-1">Total Investment</label>
                          <p className="text-2xl font-bold text-[#003D82]">${Number(details.total_amount).toLocaleString()}</p>
                      </div>
                   </div>
                </div>
             </div>

             <div className="mt-8 text-center text-sm text-gray-500 bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                <p>We have sent a confirmation email to <strong>{details.email}</strong>.</p>
                <p className="mt-1">Please keep your reference number safe. A representative will contact you shortly.</p>
             </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4 print:hidden">
            <Button 
                variant="outline" 
                className="flex items-center gap-2 border-gray-300 hover:bg-gray-50 text-gray-700"
                onClick={() => navigate('/')}
            >
                <ArrowLeft className="w-4 h-4" /> Back to Home
            </Button>
            
            <Button 
                className="flex items-center gap-2 bg-[#003D82] hover:bg-[#002a5a] text-white"
                onClick={() => navigate('/shareholder/dashboard')}
            >
                <LayoutDashboard className="w-4 h-4" /> View Dashboard
            </Button>

            <Button 
                variant="ghost"
                className="flex items-center gap-2 text-gray-600 hover:text-[#003D82]"
                onClick={handlePrint}
            >
                <Printer className="w-4 h-4" /> Print Confirmation
            </Button>
        </div>

      </div>
    </div>
  );
};

export default ShareholderConfirmationPage;