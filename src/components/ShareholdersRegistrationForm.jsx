import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, User, Mail, Phone, Hash, Building2, MapPin, CheckCircle2, AlertCircle, Info, FileSignature, FileText, Globe } from 'lucide-react';
import { calculateTotalInvestment, formatPrice, getSystemSettings } from '@/services/sharePriceService';
import { getCountryCodeOptions, combinePhoneNumber, validatePhoneNumber } from '@/services/countryCodeService';
import { saveShareholderRegistration, getAvailableSharesForSubscription } from '@/services/shareholderService';
import { generateAgreementPDFBlob, sendPendingAgreementViaWhatsApp } from '@/services/agreementService';
import AgreementDocument from '@/components/admin/AgreementDocument';
import { usePageT } from '@/hooks/useSiteLabel';
import SignaturePadModal from '@/components/SignaturePadModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const SHAREHOLDER_AGREEMENT_TEXT = `
SHAREHOLDER AGREEMENT

This Shareholder Agreement ("Agreement") is entered into between Alpha Bridge ("Company") and the undersigned shareholder ("Shareholder").

1. SHARE OWNERSHIP
The Shareholder agrees to purchase shares in Alpha Bridge at the agreed price per share.

2. RIGHTS AND OBLIGATIONS
- Shareholders have voting rights proportional to their share ownership
- Shareholders are entitled to dividends when declared by the Board
- Shareholders must comply with company bylaws and regulations

3. VESTING PERIOD
Shares are subject to a 24-month vesting period from the date of purchase.

4. TRANSFER RESTRICTIONS
Shares may not be transferred without prior written consent from the Company.

5. CONFIDENTIALITY
Shareholders agree to maintain confidentiality regarding company proprietary information.

6. GOVERNING LAW
This Agreement shall be governed by the laws of the jurisdiction where the Company is registered.

By signing below, the Shareholder acknowledges having read, understood, and agreed to all terms and conditions of this Shareholder Agreement.
`;

const ShareholdersRegistrationForm = () => {
  const { toast } = useToast();
  const tForm = usePageT('shareholders_form');

  const [loading, setLoading] = useState(false);
  const [pdfShareholder, setPdfShareholder] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [sharePrice, setSharePrice] = useState(1000);
  const [currency, setCurrency] = useState('USD');
  const [availableShares, setAvailableShares] = useState(100);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successReferenceNumber, setSuccessReferenceNumber] = useState('');
  const [error, setError] = useState(null);
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    country_code: '+250',
    phone_number: '',
    company_name: '',
    address: '',
    nationality: '',
    shares_count: 1,
    total_investment: 0,
    terms_accepted: false,
    signature: null
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const countryCodeOptions = getCountryCodeOptions();

  // Fetch share price on mount
  useEffect(() => {
    const fetchPriceSettings = async () => {
      console.log('[FORM] Fetching share price settings');
      setPriceLoading(true);
      try {
        const settings = await getSystemSettings();
        const available = await getAvailableSharesForSubscription();
        console.log('[FORM] Settings loaded:', settings);
        setSharePrice(settings.price_per_share);
        setCurrency(settings.currency);
        setAvailableShares(available);
        
        const initialTotal = await calculateTotalInvestment(1, settings.price_per_share);
        setFormData(prev => ({ ...prev, total_investment: initialTotal }));
        console.log('[FORM] Initial total investment:', initialTotal);
      } catch (err) {
        console.error('[FORM] Error loading share price:', err);
        toast({
          title: "Warning",
          description: "Using default share price. Please refresh if needed.",
          variant: "default"
        });
      } finally {
        setPriceLoading(false);
      }
    };

    fetchPriceSettings();
  }, [toast]);

  // Recalculate total when shares count changes
  useEffect(() => {
    const updateTotal = async () => {
      const total = await calculateTotalInvestment(formData.shares_count, sharePrice);
      console.log('[FORM] Recalculated total:', total, 'for shares:', formData.shares_count);
      setFormData(prev => ({ ...prev, total_investment: total }));
    };

    if (formData.shares_count > 0) {
      updateTotal();
    }
  }, [formData.shares_count, sharePrice]);

  useEffect(() => {
    if (!pdfShareholder) return undefined;

    let cancelled = false;
    const sendSignedCopy = async () => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      if (cancelled) return;

      try {
        const { pdfBlob, filename } = await generateAgreementPDFBlob(
          pdfShareholder.id,
          'shareholder-pending-agreement',
          pdfShareholder.full_name
        );

        const result = await sendPendingAgreementViaWhatsApp(
          pdfShareholder.full_phone_number,
          pdfShareholder.full_name,
          pdfBlob,
          filename,
          {
            sharesCount: pdfShareholder.shares_assigned,
            totalInvestment: pdfShareholder.investment_amount,
            referenceNumber: pdfShareholder.reference_number,
          }
        );

        if (result.success) {
          console.log('[FORM] Signed agreement PDF sent via WhatsApp');
        } else {
          console.warn('[FORM] WhatsApp PDF send failed:', result.error);
        }
      } catch (err) {
        console.error('[FORM] WhatsApp PDF error (non-blocking):', err);
      } finally {
        if (!cancelled) setPdfShareholder(null);
      }
    };

    sendSignedCopy();
    return () => { cancelled = true; };
  }, [pdfShareholder]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }

    if (error) setError(null);
  };

  const handleCountryCodeChange = (value) => {
    console.log('[FORM] Country code changed:', value);
    setFormData(prev => ({
      ...prev,
      country_code: value
    }));

    if (fieldErrors.country_code) {
      setFieldErrors(prev => {
        const updated = { ...prev };
        delete updated.country_code;
        return updated;
      });
    }
  };

  const handlePhoneNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    console.log('[FORM] Phone number changed:', value);
    setFormData(prev => ({
      ...prev,
      phone_number: value
    }));

    if (fieldErrors.phone_number) {
      setFieldErrors(prev => {
        const updated = { ...prev };
        delete updated.phone_number;
        return updated;
      });
    }
  };

  const handleSignatureCapture = (signatureDataUrl) => {
    console.log('[FORM] Signature captured, length:', signatureDataUrl?.length);
    setFormData(prev => ({
      ...prev,
      signature: signatureDataUrl
    }));

    if (fieldErrors.signature) {
      setFieldErrors(prev => {
        const updated = { ...prev };
        delete updated.signature;
        return updated;
      });
    }

    toast({
      title: "Signature Captured",
      description: "Your signature has been saved successfully.",
      className: "bg-green-600 text-white"
    });
  };

  const validateForm = () => {
    console.log('[FORM] === FORM VALIDATION START ===');
    const errors = {};

    // Required fields validation
    if (!formData.full_name || !formData.full_name.trim()) {
      errors.full_name = 'Full name is required';
      console.log('[FORM] Validation error: Full name missing');
    }

    if (!formData.email || !formData.email.trim()) {
      errors.email = 'Email is required';
      console.log('[FORM] Validation error: Email missing');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
        console.log('[FORM] Validation error: Invalid email format');
      }
    }

    if (!formData.country_code) {
      errors.country_code = 'Country code is required';
      console.log('[FORM] Validation error: Country code missing');
    }

    const phoneValidation = validatePhoneNumber(formData.phone_number);
    if (!phoneValidation.valid) {
      errors.phone_number = phoneValidation.error;
      console.log('[FORM] Validation error: Invalid phone -', phoneValidation.error);
    }

    if (!formData.address || !formData.address.trim()) {
      errors.address = 'Address is required';
      console.log('[FORM] Validation error: Address missing');
    }

    if (formData.shares_count < 1) {
      errors.shares_count = 'Number of shares must be at least 1';
      console.log('[FORM] Validation error: Invalid share count');
    }

    if (formData.shares_count > availableShares) {
      errors.shares_count = `Only ${availableShares} shares are currently available`;
      console.log('[FORM] Validation error: Exceeds available shares');
    }

    if (!formData.terms_accepted) {
      errors.terms_accepted = 'You must accept the Shareholder Agreement';
      console.log('[FORM] Validation error: Terms not accepted');
    }

    if (!formData.signature) {
      errors.signature = 'Digital signature is required to complete your booking';
      console.log('[FORM] Validation error: Signature missing');
    }

    console.log('[FORM] Validation complete:', Object.keys(errors).length, 'errors found');
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[FORM] === FORM SUBMISSION START ===');

    setError(null);

    if (!validateForm()) {
      console.warn('[FORM] Validation failed');
      toast({
        title: "Validation Error",
        description: "Please complete all required fields and add your signature.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      console.log('[FORM] Preparing submission data');

      const fullPhoneNumber = combinePhoneNumber(formData.country_code, formData.phone_number);
      console.log('[FORM] Full phone number:', fullPhoneNumber);

      const submissionData = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        country_code: formData.country_code,
        phone_number: formData.phone_number,
        full_phone_number: fullPhoneNumber,
        company_name: formData.company_name?.trim() || null,
        address: formData.address.trim(),
        nationality: formData.nationality?.trim() || null,
        shares_count: parseInt(formData.shares_count),
        total_investment: formData.total_investment,
        signature: formData.signature
      };

      console.log('[FORM] Submission data prepared:', {
        ...submissionData,
        signature: '[OMITTED]'
      });

      console.log('[FORM] Calling saveShareholderRegistration service');
      const result = await saveShareholderRegistration(submissionData);

      if (!result.success) {
        console.error('[FORM] === REGISTRATION FAILED ===');
        console.error('[FORM] Error:', result.error);
        
        // Provide specific error messages
        let errorMessage = 'Registration failed. Please try again.';
        
        if (result.error?.code === 'PGRST204') {
          errorMessage = 'Database schema error. Please contact support.';
        } else if (result.error?.message) {
          errorMessage = result.error.message;
        }
        
        throw new Error(errorMessage);
      }

      console.log('[FORM] === REGISTRATION SUCCESS ===');
      console.log('[FORM] Booking ID:', result.data?.id);
      console.log('[FORM] Reference Number:', result.data?.reference_number);

      const referenceNumber = result.data?.reference_number || 'N/A';
      setSuccessReferenceNumber(referenceNumber);

      setPdfShareholder({
        id: result.data?.id,
        reference_number: referenceNumber,
        full_name: submissionData.full_name,
        email: submissionData.email,
        full_phone_number: submissionData.full_phone_number,
        address: submissionData.address,
        company_name: submissionData.company_name,
        nationality: submissionData.nationality,
        shares_assigned: submissionData.shares_count,
        investment_amount: submissionData.total_investment,
        signature: submissionData.signature,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      });

      // Show success
      setShowSuccess(true);
      toast({
        title: tForm('success_title', 'Booking Submitted Successfully'),
        description: tForm('success_toast', `Your reference number is ${referenceNumber}. We will review your request and contact you via WhatsApp.`).replace('{reference}', referenceNumber),
        className: "bg-green-600 text-white"
      });

      // Clear form after 8 seconds
      setTimeout(() => {
        console.log('[FORM] Resetting form');
        setFormData({
          full_name: '',
          email: '',
          country_code: '+250',
          phone_number: '',
          company_name: '',
          address: '',
          nationality: '',
          shares_count: 1,
          total_investment: sharePrice,
          terms_accepted: false,
          signature: null
        });
        setShowSuccess(false);
        setSuccessReferenceNumber('');
        setFieldErrors({});
      }, 8000);

    } catch (err) {
      console.error('[FORM] === SUBMISSION ERROR ===');
      console.error('[FORM] Error:', err);
      
      const errorMessage = err.message || "An error occurred during registration.";
      
      setError(errorMessage);
      
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (priceLoading) {
    return (
      <Card className="border-none shadow-2xl">
        <CardContent className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-[#003D82] mx-auto mb-4" />
            <p className="text-gray-600">{tForm('loading_shares', 'Loading share information...')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showSuccess) {
    return (
      <Card className="border-none shadow-2xl">
        <CardContent className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800 mb-2">{tForm('success_heading', 'Booking Submitted Successfully!')}</h3>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4 inline-block">
              <p className="text-sm text-gray-600 mb-1">{tForm('reference_label', 'Your Reference Number:')}</p>
              <p className="text-2xl font-bold text-blue-600">{successReferenceNumber}</p>
            </div>
            <p className="text-gray-600 max-w-md mx-auto mb-4">
              {tForm('success_message', 'Your share booking request has been submitted for approval. We will review your request and notify you via WhatsApp.')}
            </p>
            <p className="text-sm text-gray-500">
              {tForm('no_payment_note', 'No payment is required at this stage.')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-none shadow-2xl">
        <CardHeader className="bg-gradient-to-r from-[#003D82] to-[#002855] text-white">
          <CardTitle className="text-2xl">{tForm('form_title', 'Become a Shareholder')}</CardTitle>
          <CardDescription className="text-blue-100">
            {tForm('form_subtitle', 'Book your shares in Alpha Bridge (No login required)')}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 md:p-8">
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              <span className="font-semibold">{tForm('booking_only_label', 'Share Booking Only:')}</span>{' '}
              {tForm('booking_only_text', 'This is a share booking request. No payment is required at this stage. After your request is approved, we will contact you with payment details.')}
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-gray-800 border-b pb-2">{tForm('personal_info', 'Personal Information')}</h3>
              
              <div className="space-y-2">
                <Label htmlFor="full_name">{tForm('full_name', 'Full Name')} <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input 
                    id="full_name" 
                    name="full_name" 
                    placeholder="John Doe"
                    className={`pl-10 bg-white text-gray-900 ${fieldErrors.full_name ? 'border-red-500' : ''}`}
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                {fieldErrors.full_name && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.full_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{tForm('email', 'Email Address')} <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input 
                    id="email" 
                    name="email" 
                    type="email"
                    placeholder="john@example.com"
                    className={`pl-10 bg-white text-gray-900 ${fieldErrors.email ? 'border-red-500' : ''}`}
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.email}</p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country_code">{tForm('country_code', 'Country Code')} <span className="text-red-500">*</span></Label>
                  <Select value={formData.country_code} onValueChange={handleCountryCodeChange}>
                    <SelectTrigger className={`bg-white ${fieldErrors.country_code ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder="Select country code" />
                    </SelectTrigger>
                    <SelectContent>
                      {countryCodeOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.country_code && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.country_code}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone_number">{tForm('phone_number', 'Phone Number')} <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                      id="phone_number" 
                      name="phone_number"
                      type="tel"
                      placeholder="794006160"
                      className={`pl-10 bg-white text-gray-900 ${fieldErrors.phone_number ? 'border-red-500' : ''}`}
                      value={formData.phone_number}
                      onChange={handlePhoneNumberChange}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500">{tForm('phone_hint', 'Enter phone number without country code')}</p>
                  {fieldErrors.phone_number && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.phone_number}</p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">{tForm('company_name', 'Company Name (Optional)')}</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                      id="company_name" 
                      name="company_name" 
                      placeholder="Alpha Bridge"
                      className="pl-10 bg-white text-gray-900"
                      value={formData.company_name}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nationality">{tForm('nationality', 'Nationality (Optional)')}</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                      id="nationality" 
                      name="nationality" 
                      placeholder="Cameroonian"
                      className="pl-10 bg-white text-gray-900"
                      value={formData.nationality}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{tForm('address', 'Address')} <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input 
                    id="address" 
                    name="address" 
                    placeholder="City, Country"
                    className={`pl-10 bg-white text-gray-900 ${fieldErrors.address ? 'border-red-500' : ''}`}
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                </div>
                {fieldErrors.address && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.address}</p>
                )}
              </div>
            </div>

            {/* Investment Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-gray-800 border-b pb-2">{tForm('investment_details', 'Investment Details')}</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">{tForm('current_share_price', 'Current Share Price:')}</span>
                  <span className="text-xl font-bold text-[#003D82]">{formatPrice(sharePrice, currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{tForm('available_shares', 'Available Shares:')}</span>
                  <span className="text-lg font-semibold text-green-600">{availableShares.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shares_count">{tForm('shares_count', 'Number of Shares')} <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input 
                    id="shares_count" 
                    name="shares_count" 
                    type="number"
                    min="1"
                    max={availableShares}
                    placeholder="1"
                    className={`pl-10 bg-white text-gray-900 ${fieldErrors.shares_count ? 'border-red-500' : ''}`}
                    value={formData.shares_count}
                    onChange={handleChange}
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">Minimum: 1 share | Maximum: {availableShares.toLocaleString()} shares</p>
                {fieldErrors.shares_count && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.shares_count}</p>
                )}
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{tForm('total_investment', 'Total Investment:')}</span>
                  <span className="text-2xl font-bold text-green-700">
                    {formatPrice(formData.total_investment, currency)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {formData.shares_count} share{formData.shares_count !== 1 ? 's' : ''} × {formatPrice(sharePrice, currency)}
                </p>
              </div>
            </div>

            {/* Digital Signature Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-gray-800 border-b pb-2">{tForm('digital_signature', 'Digital Signature')}</h3>
              
              {formData.signature ? (
                <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">{tForm('signature_captured', 'Signature Captured')}</span>
                  </div>
                  <div className="bg-white border border-gray-300 rounded-lg p-2 inline-block">
                    <img 
                      src={formData.signature} 
                      alt="Your signature" 
                      className="max-w-[300px] h-auto"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsSignaturePadOpen(true)}
                    className="mt-3"
                  >
                    <FileSignature className="w-4 h-4 mr-2" />
                    {tForm('resign', 'Re-sign')}
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-yellow-300 rounded-lg p-4 bg-yellow-50">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-yellow-800">{tForm('signature_required', 'Signature Required')}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">
                    {tForm('signature_required_text', 'A digital signature is required to complete your share booking request.')}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      console.log('[FORM] Opening signature pad');
                      setIsSignaturePadOpen(true);
                    }}
                    className="border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                  >
                    <FileSignature className="w-4 h-4 mr-2" />
                    {tForm('add_signature', 'Add Signature')}
                  </Button>
                  {fieldErrors.signature && (
                    <p className="text-red-600 text-sm mt-2">{fieldErrors.signature}</p>
                  )}
                </div>
              )}
            </div>

            {/* Agreement Section */}
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border">
                <input 
                  type="checkbox" 
                  id="terms_accepted" 
                  name="terms_accepted"
                  className="mt-1 h-4 w-4 text-[#003D82] focus:ring-[#003D82]"
                  checked={formData.terms_accepted}
                  onChange={handleChange}
                />
                <label htmlFor="terms_accepted" className="text-sm text-gray-700 cursor-pointer flex-1">
                  {tForm('terms_prefix', 'I have read and agree to the')}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      console.log('[FORM] Opening agreement modal');
                      setIsAgreementModalOpen(true);
                    }}
                    className="text-[#003D82] underline font-medium hover:text-[#002855]"
                  >
                    {tForm('shareholder_agreement', 'Shareholder Agreement')}
                  </button>
                  {' '}{tForm('terms_suffix', 'and confirm that all information provided is accurate.')}
                </label>
              </div>
              {fieldErrors.terms_accepted && (
                <p className="text-red-600 text-sm">{fieldErrors.terms_accepted}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full bg-[#003D82] hover:bg-[#002855] text-white font-bold h-12 text-lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  {tForm('submitting', 'Submitting for Approval...')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  {tForm('submit_button', 'Submit for Approval')}
                </>
              )}
            </Button>

            <p className="text-xs text-center text-gray-500 mt-4">
              {tForm('footer_note', 'Your booking request will be reviewed by our team. You will be contacted with payment details once approved.')}
            </p>

          </form>
        </CardContent>
      </Card>

      {/* Signature Pad Modal */}
      <SignaturePadModal
        isOpen={isSignaturePadOpen}
        onClose={() => {
          console.log('[FORM] Closing signature pad');
          setIsSignaturePadOpen(false);
        }}
        onSignatureCapture={handleSignatureCapture}
      />

      {/* Shareholder Agreement Modal */}
      <Dialog open={isAgreementModalOpen} onOpenChange={setIsAgreementModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#003D82]" />
              {tForm('shareholder_agreement', 'Shareholder Agreement')}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {tForm('agreement_modal_hint', 'Please read the agreement carefully before accepting')}
            </DialogDescription>
          </DialogHeader>
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
              {tForm('agreement_text', SHAREHOLDER_AGREEMENT_TEXT)}
            </pre>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsAgreementModalOpen(false)}
            >
              {tForm('close', 'Close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {pdfShareholder && (
        <div
          style={{ position: 'fixed', left: '-10000px', top: 0, width: '210mm', pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <AgreementDocument
            shareholder={pdfShareholder}
            isSignedView
            elementId="shareholder-pending-agreement"
          />
        </div>
      )}
    </>
  );
};

export default ShareholdersRegistrationForm;