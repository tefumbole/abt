import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { publicGetBooking, publicSignBooking } from '@/services/erpService';

export default function PublicBookingPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    publicGetBooking(token).then(setData).catch((e) => setError(e.message));
  }, [token]);

  if (error) return <div className="min-h-screen flex items-center justify-center p-6 text-red-600">{error}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-lg mx-auto bg-white rounded-2xl border p-6 space-y-4">
        <h1 className="text-xl font-bold text-[#0A2540]">Rental {data.reference}</h1>
        <p className="text-sm">{new Date(data.from_datetime).toLocaleString()} → {new Date(data.to_datetime).toLocaleString()}</p>
        <p className="text-2xl font-semibold">{Number(data.grand_total).toFixed(2)}</p>
        {done || data.signature_status === 'signed' ? (
          <p className="text-green-700">Contract signed. Booking confirmed.</p>
        ) : (
          <Button onClick={async () => {
            try {
              await publicSignBooking(token);
              setDone(true);
            } catch (e) { setError(e.message); }
          }}>Sign & confirm</Button>
        )}
      </div>
    </div>
  );
}
