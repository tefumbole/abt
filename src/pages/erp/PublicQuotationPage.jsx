import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  publicGetQuotation,
  publicApproveQuotation,
  publicRejectQuotation,
  publicQuoteQuotation,
} from '@/services/erpService';

const money = (value) =>
  Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EXPIRED =
  'This approval link has already been used or replaced. Please ask the company for a new one.';

function SignaturePad({ canvasRef, height = 220 }) {
  const drawing = useRef(false);
  const inked = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 400;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.strokeStyle = '#0A2540';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      inked.current = false;
    };
    resize();
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: src.clientX - r.left, y: src.clientY - r.top };
    };
    const start = (e) => {
      drawing.current = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      e.preventDefault();
    };
    const move = (e) => {
      if (!drawing.current) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      inked.current = true;
      e.preventDefault();
    };
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
  }, [canvasRef, height]);

  return (
    <canvas
      ref={canvasRef}
      data-inked={() => inked.current}
      height={height}
      className="w-full rounded-lg border bg-slate-50 touch-none"
      style={{ height }}
    />
  );
}

export default function PublicQuotationPage() {
  const { token } = useParams();
  const canvasRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [panel, setPanel] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [quoteMode, setQuoteMode] = useState('overall');
  const [proposedGrand, setProposedGrand] = useState('');
  const [linePrices, setLinePrices] = useState({});

  useEffect(() => {
    publicGetQuotation(token)
      .then((row) => {
        setData(row);
        setProposedGrand(row?.grand_total != null ? String(row.grand_total) : '');
        const prices = {};
        (row?.items || []).forEach((item) => { prices[item.id] = String(item.net_unit_price ?? ''); });
        setLinePrices(prices);
      })
      .catch((e) => {
        if (e.expired || e.status === 410) setExpired(true);
        setError(e.message || EXPIRED);
      });
  }, [token]);

  const fail = (e) => {
    if (e.expired || e.status === 410) {
      setExpired(true);
      setError(EXPIRED);
    } else {
      setError(e.message);
    }
  };

  const canvasHasInk = () => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    const { data: pixels } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 8) return true;
    }
    return false;
  };

  const handleApprove = async () => {
    if (!agreed) return setError('Please confirm you have read the quotation notes and terms.');
    if (!canvasHasInk()) return setError('Draw your signature before confirming approval.');
    setBusy(true);
    setError('');
    try {
      const signature_data = canvasRef.current.toDataURL('image/png');
      const res = await publicApproveQuotation(token, { signature_data, comment });
      setDone(res.message || 'Thank you. Your signed quotation PDF will be sent on WhatsApp.');
      setPanel('');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) return setError('A comment is required if you reject.');
    setBusy(true);
    setError('');
    try {
      const res = await publicRejectQuotation(token, { comment });
      setDone(res.message || 'Your response has been recorded.');
      setPanel('');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const handleQuote = async () => {
    setBusy(true);
    setError('');
    try {
      const body = quoteMode === 'overall'
        ? { mode: 'overall', proposed_grand_total: Number(proposedGrand), note: comment }
        : {
          mode: 'lines',
          note: comment,
          lines: (data.items || []).map((item) => ({
            product_quotation_id: item.id,
            proposed_net_unit_price: Number(linePrices[item.id]),
          })),
        };
      const res = await publicQuoteQuotation(token, body);
      setDone(res.message || 'Your quote was submitted. Our team will review it.');
      setPanel('');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  if (expired) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border bg-white p-8 text-center space-y-3 shadow-sm">
          <h1 className="text-xl font-bold text-[#0A2540]">Link expired</h1>
          <p className="text-slate-600">{EXPIRED}</p>
        </div>
      </div>
    );
  }

  if (!data && !error) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div>;
  }

  if (error && !data) {
    return <div className="min-h-[60vh] flex items-center justify-center p-6 text-red-600">{error}</div>;
  }

  const company = data.company || 'Alpha Bridge';

  return (
    <div className="min-h-[60vh] bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border shadow-sm p-6 sm:p-8 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-[#D4AF37] font-semibold">Quotation for Approval</p>
          <h1 className="text-2xl font-bold text-[#0A2540]">{company} · Ref {data.reference}</h1>
          <p className="text-sm text-slate-600">{data.customer_name || 'Customer'}</p>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-[#003D82] text-white text-left">
              <tr>
                <th className="p-2">Product</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Unit</th>
                <th className="p-2 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {(data.items || []).map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2">{item.product_name}</td>
                  <td className="p-2 text-right">{item.qty}</td>
                  <td className="p-2 text-right">{money(item.net_unit_price)}</td>
                  <td className="p-2 text-right">{money(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto w-full sm:w-72 text-sm space-y-1">
          {Number(data.subtotal) > 0 && <div className="flex justify-between"><span>Subtotal</span><span>{money(data.subtotal)}</span></div>}
          {Number(data.discount) > 0.009 && <div className="flex justify-between"><span>Discount</span><span>-{money(data.discount)}</span></div>}
          {Number(data.tax) > 0 && <div className="flex justify-between"><span>Tax</span><span>{money(data.tax)}</span></div>}
          {Number(data.shipping) > 0 && <div className="flex justify-between"><span>Shipping</span><span>{money(data.shipping)}</span></div>}
          <div className="flex justify-between border-t pt-2 text-lg font-bold text-[#003D82]">
            <span>Total due</span><span>{money(data.grand_total)}</span>
          </div>
        </div>

        {data.note && (
          <div className="rounded-lg bg-slate-50 border p-3 text-sm whitespace-pre-wrap">
            <span className="font-semibold text-[#0A2540]">Note: </span>{data.note}
          </div>
        )}

        {done ? (
          <p className="text-emerald-700 font-medium">{done}</p>
        ) : (
          <>
            <div>
              <Label>Comment</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Required if you reject. Optional if you approve or quote."
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="text-red-700" disabled={busy} onClick={() => setPanel('reject')}>
                Reject
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setPanel('quote')}>
                Quote
              </Button>
              <Button type="button" className="bg-[#003D82] hover:bg-[#002855]" disabled={busy} onClick={() => setPanel('sign')}>
                Sign & Approve
              </Button>
            </div>
          </>
        )}
      </div>

      {panel === 'sign' && !done && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-[#0A2540]">Sign to approve</h2>
            <p className="text-sm text-slate-600">Draw your signature below, then confirm approval.</p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I have read the quotation notes and terms above, and I confirm my approval.</span>
            </label>
            <SignaturePad canvasRef={canvasRef} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                const c = canvasRef.current;
                if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
              }}>Clear</Button>
              <Button type="button" variant="outline" onClick={() => setPanel('')}>Cancel</Button>
              <Button type="button" className="bg-[#003D82] hover:bg-[#002855]" disabled={busy} onClick={handleApprove}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm approval
              </Button>
            </div>
          </div>
        </div>
      )}

      {panel === 'reject' && !done && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-[#0A2540]">Reject quotation</h2>
            <p className="text-sm text-slate-600">A comment is required.</p>
            <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPanel('')}>Cancel</Button>
              <Button type="button" variant="destructive" disabled={busy} onClick={handleReject}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}

      {panel === 'quote' && !done && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-[#0A2540]">Propose a quote</h2>
            <p className="text-sm text-slate-600">
              Choose an overall total for the whole quotation, or edit individual item prices. Our team will review and may accept, reject, or adjust your proposal.
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={quoteMode === 'overall' ? 'default' : 'outline'} onClick={() => setQuoteMode('overall')}>
                Overall total
              </Button>
              <Button type="button" size="sm" variant={quoteMode === 'lines' ? 'default' : 'outline'} onClick={() => setQuoteMode('lines')}>
                Item prices
              </Button>
            </div>
            {quoteMode === 'overall' ? (
              <div>
                <Label>Proposed grand total</Label>
                <Input className="mt-1" type="number" step="0.01" value={proposedGrand} onChange={(e) => setProposedGrand(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                {(data.items || []).map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_8rem] gap-2 items-center">
                    <div className="text-sm">{item.product_name} × {item.qty}</div>
                    <Input
                      type="number"
                      step="0.01"
                      value={linePrices[item.id] ?? ''}
                      onChange={(e) => setLinePrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPanel('')}>Cancel</Button>
              <Button type="button" className="bg-[#003D82] hover:bg-[#002855]" disabled={busy} onClick={handleQuote}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit quote
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
