import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { publicGetQuotation, publicRespondQuotation } from '@/services/erpService';

export default function PublicQuotationPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    publicGetQuotation(token).then(setData).catch((e) => setError(e.message));
  }, [token]);

  const respond = async (action) => {
    setBusy(true);
    try {
      const res = await publicRespondQuotation(token, { action, comment, signature_data: action === 'approve' ? 'approved' : null });
      setDone(res.status);
      setData((d) => (d ? { ...d, status: res.status } : d));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="min-h-screen flex items-center justify-center p-6 text-red-600">{error}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-lg mx-auto bg-white rounded-2xl border p-6 space-y-4">
        <h1 className="text-xl font-bold text-[#0A2540]">Quotation {data.reference}</h1>
        <p className="text-sm text-slate-600">{data.customer_name || 'Customer'}</p>
        <p className="text-2xl font-semibold">{Number(data.grand_total).toFixed(2)}</p>
        <ul className="text-sm space-y-1 border-t pt-3">
          {(data.items || []).map((i, idx) => (
            <li key={idx} className="flex justify-between">
              <span>{i.product_name} × {i.qty}</span>
              <span>{Number(i.subtotal).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm">Status: <strong>{data.status}</strong></p>
        {done || !['draft', 'awaiting_approval'].includes(data.status) ? (
          <p className="text-green-700">Thank you. Status is now {done || data.status}.</p>
        ) : (
          <>
            <Textarea placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => respond('approve')}>Approve</Button>
              <Button disabled={busy} variant="outline" onClick={() => respond('reject')}>Reject</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
