import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getErpSettings, saveErpSettings } from '@/services/erpService';
import { getSystemSettings } from '@/services/settingsService';
import { makeMoney, num } from '@/lib/erpFormat';

const DEFAULTS = {
  reward_enabled: false,
  reward_points_per_amount: 0.01,
  reward_amount_per_point: 5,
  reward_min_redeem_points: 100,
  reward_expiry_days: 0,
};

const SAMPLE_SALE = 10000;

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return value === 1 || value === '1' || value === 'true';
};

export default function RewardSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState({ currency: 'XAF', currency_position: 'prefix' });
  const [form, setForm] = useState({
    reward_enabled: DEFAULTS.reward_enabled,
    reward_points_per_amount: String(DEFAULTS.reward_points_per_amount),
    reward_amount_per_point: String(DEFAULTS.reward_amount_per_point),
    reward_min_redeem_points: String(DEFAULTS.reward_min_redeem_points),
    reward_expiry_days: String(DEFAULTS.reward_expiry_days),
  });

  useEffect(() => {
    (async () => {
      try {
        const [settings, sys] = await Promise.all([
          getErpSettings(),
          getSystemSettings().catch(() => null),
        ]);
        const s = settings || {};
        setForm({
          reward_enabled: toBool(s.reward_enabled, DEFAULTS.reward_enabled),
          reward_points_per_amount: String(s.reward_points_per_amount ?? DEFAULTS.reward_points_per_amount),
          reward_amount_per_point: String(s.reward_amount_per_point ?? DEFAULTS.reward_amount_per_point),
          reward_min_redeem_points: String(s.reward_min_redeem_points ?? DEFAULTS.reward_min_redeem_points),
          reward_expiry_days: String(s.reward_expiry_days ?? DEFAULTS.reward_expiry_days),
        });
        if (sys) {
          setCurrency({
            currency: sys.currency || 'XAF',
            currency_position: sys.currency_position || 'prefix',
          });
        }
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const money = useMemo(() => makeMoney(currency), [currency]);

  const example = useMemo(() => {
    const earned = SAMPLE_SALE * num(form.reward_points_per_amount);
    const worth = earned * num(form.reward_amount_per_point);
    return {
      points: earned.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      worth: money(worth, { decimals: 0 }),
      sale: money(SAMPLE_SALE, { decimals: 0 }),
    };
  }, [form.reward_points_per_amount, form.reward_amount_per_point, money]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await saveErpSettings({
        reward_enabled: !!form.reward_enabled,
        reward_points_per_amount: num(form.reward_points_per_amount),
        reward_amount_per_point: num(form.reward_amount_per_point),
        reward_min_redeem_points: num(form.reward_min_redeem_points),
        reward_expiry_days: num(form.reward_expiry_days),
      });
      toast.success('Reward point settings saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div>;
  }

  return (
    <form onSubmit={save} className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-[#003D82]">Reward Point Setting</CardTitle>
          <CardDescription>
            Points are earned on completed sales and can be redeemed against future purchases.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-semibold">Enable reward points</Label>
              <p className="text-xs text-slate-500">Turn the loyalty programme on for all customers.</p>
            </div>
            <Switch
              checked={!!form.reward_enabled}
              onCheckedChange={(v) => setField('reward_enabled', v)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Points earned per 1 {currency.currency} spent</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                value={form.reward_points_per_amount}
                onChange={(e) => setField('reward_points_per_amount', e.target.value)}
              />
              <p className="text-xs text-slate-500">e.g. 0.01 = 1 point for every 100 spent.</p>
            </div>
            <div className="space-y-2">
              <Label>Redemption value of 1 point</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.reward_amount_per_point}
                onChange={(e) => setField('reward_amount_per_point', e.target.value)}
              />
              <p className="text-xs text-slate-500">How much 1 point takes off the next invoice.</p>
            </div>
            <div className="space-y-2">
              <Label>Minimum points before redeeming</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={form.reward_min_redeem_points}
                onChange={(e) => setField('reward_min_redeem_points', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Points expire after (days)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={form.reward_expiry_days}
                onChange={(e) => setField('reward_expiry_days', e.target.value)}
              />
              <p className="text-xs text-slate-500">0 = points never expire.</p>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-[#003D82]">
            A {example.sale} sale earns <strong>{example.points} points</strong>, worth{' '}
            <strong>{example.worth}</strong> on the next purchase.
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving} className="bg-[#003D82]">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Save reward settings
      </Button>
    </form>
  );
}
