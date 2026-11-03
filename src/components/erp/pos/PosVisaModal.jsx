import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { paymentService } from '@/services/commerceService';

const publishable = import.meta.env.VITE_STRIPE_PUBLIC_KEY || '';
const stripePromise = publishable ? loadStripe(publishable) : null;

function CardForm({ amountLabel, currency, amount, description, onPaid, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pay = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    try {
      const intent = await paymentService.stripeIntent({ amount, currency, description });
      const card = elements.getElement(CardElement);
      const result = await stripe.confirmCardPayment(intent.clientSecret, {
        payment_method: { card },
      });
      if (result.error) {
        setError(result.error.message || 'Card was declined');
        return;
      }
      if (result.paymentIntent?.status !== 'succeeded') {
        setError('Card payment was not completed');
        return;
      }
      onPaid(result.paymentIntent.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={pay} className="space-y-4">
      <p className="text-sm text-slate-600">
        Charge <strong className="text-[#003D82]">{amountLabel}</strong> with Visa / Mastercard.
      </p>
      <div className="rounded-xl border px-3 py-3 bg-slate-50">
        <CardElement options={{ hidePostalCode: true }} />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" className="bg-[#003D82]" disabled={busy || !stripe}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${amountLabel}`}
        </Button>
      </div>
    </form>
  );
}

export default function PosVisaModal({ amount, currency, amountLabel, description, onPaid, onClose }) {
  const [ready, setReady] = useState(Boolean(stripePromise));
  useEffect(() => { setReady(Boolean(stripePromise)); }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3">
        <h3 className="text-lg font-bold text-[#003D82]">Visa payment</h3>
        {!ready || !publishable ? (
          <p className="text-sm text-red-600">Stripe is not configured on this site.</p>
        ) : (
          <Elements stripe={stripePromise}>
            <CardForm
              amount={amount}
              currency={currency}
              amountLabel={amountLabel}
              description={description}
              onPaid={onPaid}
              onClose={onClose}
            />
          </Elements>
        )}
        {!ready ? (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
