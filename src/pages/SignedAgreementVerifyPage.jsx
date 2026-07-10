import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ShieldCheck, AlertTriangle, ArrowLeft } from 'lucide-react';
import AgreementDocument from '@/components/admin/AgreementDocument';
import { getShareholderAgreement } from '@/services/agreementService';
import { Button } from '@/components/ui/button';

const SignedAgreementVerifyPage = () => {
  const { shareholderId } = useParams();
  const [loading, setLoading] = useState(true);
  const [shareholder, setShareholder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!shareholderId) {
      setError('Invalid verification link.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const result = await getShareholderAgreement(shareholderId);
        if (!result.success || !result.shareholder) {
          throw new Error(result.error || 'Agreement not found');
        }

        const record = result.shareholder;
        if (!record.agreement_signed_at) {
          throw new Error('This agreement has not been signed yet.');
        }

        setShareholder({
          ...record,
          signature: record.signature || record.signature_image_url,
        });
      } catch (err) {
        setError(err.message || 'Unable to load agreement');
      } finally {
        setLoading(false);
      }
    })();
  }, [shareholderId]);

  return (
    <>
      <Helmet>
        <title>Verify Signed Agreement | Alpha Bridge</title>
      </Helmet>

      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Home
              </Link>
            </Button>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              Official signed agreement verification
            </div>
          </div>

          {loading && (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-[#003D82]" />
            </div>
          )}

          {!loading && error && (
            <div className="bg-white rounded-lg shadow p-8 text-center space-y-3">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
              <h1 className="text-xl font-bold text-gray-800">Verification Failed</h1>
              <p className="text-gray-600">{error}</p>
            </div>
          )}

          {!loading && shareholder && (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-[#003D82] text-white px-6 py-4">
                <h1 className="text-lg font-bold">Verified Signed Shareholder Agreement</h1>
                <p className="text-sm text-blue-100 mt-1">
                  {shareholder.full_name} · Signed {new Date(shareholder.agreement_signed_at).toLocaleDateString()}
                </p>
              </div>
              <AgreementDocument shareholder={shareholder} showVerificationCodes={false} />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SignedAgreementVerifyPage;
