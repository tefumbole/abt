import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function PayslipVerifyPage() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/hr/payslips/verify/${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.valid) setData(res);
        else setError(res.error || 'Invalid payslip');
      })
      .catch(() => setError('Could not verify payslip'))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#003D82]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          {data?.valid ? (
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
          ) : (
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
          )}
          <CardTitle className="text-[#003D82]">
            {data?.valid ? 'Verified Payslip' : 'Verification Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {error ? (
            <p className="text-center text-gray-600">{error}</p>
          ) : (
            <>
              <div className="flex justify-between border-b py-2"><span className="text-gray-500">Employee</span><span className="font-semibold">{data.employee_name}</span></div>
              <div className="flex justify-between border-b py-2"><span className="text-gray-500">Employee No.</span><span>{data.staff_code}</span></div>
              <div className="flex justify-between border-b py-2"><span className="text-gray-500">Position</span><span>{data.position || '—'}</span></div>
              <div className="flex justify-between border-b py-2"><span className="text-gray-500">Date of employment</span><span>{data.hire_date || '—'}</span></div>
              <div className="flex justify-between border-b py-2"><span className="text-gray-500">Payroll</span><span>{data.payroll_title}</span></div>
              <div className="flex justify-between py-2"><span className="text-gray-500">Net pay</span><span className="font-bold text-[#003D82]">{Number(data.net_amount || 0).toLocaleString()} FCFA</span></div>
              <p className="text-xs text-center text-gray-400 pt-2">Alpha Bridge</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
