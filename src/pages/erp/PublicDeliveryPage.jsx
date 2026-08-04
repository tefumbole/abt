import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { publicGetDelivery, publicSignDelivery } from '@/services/erpService';

export default function PublicDeliveryPage() {
  const { token } = useParams();
  const canvasRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const drawing = useRef(false);

  useEffect(() => {
    publicGetDelivery(token).then(setData).catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0A2540';
    ctx.lineWidth = 2;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: src.clientX - r.left, y: src.clientY - r.top };
    };
    const start = (e) => { drawing.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
    const move = (e) => { if (!drawing.current) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
    const end = () => { drawing.current = false; };
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, [data]);

  if (error) return <div className="min-h-screen flex items-center justify-center p-6 text-red-600">{error}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-lg mx-auto bg-white rounded-2xl border p-6 space-y-4">
        <h1 className="text-xl font-bold text-[#0A2540]">Delivery {data.reference}</h1>
        <p className="text-sm">Sale: {data.sale_reference}</p>
        <p className="text-sm">{data.customer_name}</p>
        <p className="text-sm">Address: {data.address || '—'}</p>
        {done || data.signature_status === 'signed' ? (
          <p className="text-green-700">Signed. Thank you.</p>
        ) : (
          <>
            <p className="text-sm font-medium">Sign below</p>
            <canvas ref={canvasRef} width={400} height={160} className="w-full border rounded-lg bg-slate-50 touch-none" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                const c = canvasRef.current;
                c.getContext('2d').clearRect(0, 0, c.width, c.height);
              }}>Clear</Button>
              <Button onClick={async () => {
                try {
                  const signature_data = canvasRef.current.toDataURL('image/png');
                  await publicSignDelivery(token, { signature_data });
                  setDone(true);
                } catch (e) { setError(e.message); }
              }}>Confirm signature</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
