import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { COUNTRIES } from '@/lib/countries';
import { acceptPhone } from '@/lib/phones';
import { createCustomer } from '@/services/erpService';
import SearchSelect from '@/components/erp/SearchSelect';

const EMPTY = { name: '', phone: '', address: '', country: 'Rwanda' };

function upsertCustomer(list, row) {
  if (!row?.id) return list;
  return [row, ...(list || []).filter((c) => String(c.id) !== String(row.id))];
}

/** Navy + button that opens the POS Add Customer modal. */
export function QuickAddCustomerButton({ onCreated, size = 'md', className }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const close = () => {
    setOpen(false);
    setForm(EMPTY);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    const phone = acceptPhone(form.phone);
    if (form.phone.trim() && !phone) {
      toast.error('Enter a valid phone such as +250794… or 250794…');
      return;
    }
    setSaving(true);
    try {
      const created = await createCustomer({
        name: form.name.trim(),
        phone: phone || null,
        address: form.address || null,
        country: form.country || 'Rwanda',
        is_active: true,
      });
      const row = created?.data || created;
      toast.success('Customer added');
      close();
      if (row?.id) onCreated?.(row);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        size="icon"
        title="Add customer"
        className={cn(
          'shrink-0 bg-[#003D82] hover:bg-[#002855] text-white',
          size === 'sm' ? 'h-9 w-9' : 'h-11 w-11',
          className
        )}
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>
      {open && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#003D82]">Add Customer</h3>
              <button type="button" onClick={close}><X className="h-5 w-5" /></button>
            </div>
            <div>
              <Label>Name *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone number</Label>
              <Input
                value={form.phone}
                placeholder="+250794… or 250794…"
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <Label>Country</Label>
              <SearchSelect
                className="mt-1"
                value={form.country}
                onChange={(country) => setForm({ ...form, country })}
                options={COUNTRIES}
                placeholder="Search country…"
                allowClear={false}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" className="bg-[#003D82]" disabled={saving}>Save</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/**
 * Searchable customer field with the POS + button beside it.
 * onCreated(row) and/or setCustomers(updater) receive the new customer.
 */
export default function CustomerSelect({
  value,
  onChange,
  customers = [],
  setCustomers,
  onCreated,
  size = 'md',
  className,
  buttonClassName,
  ...selectProps
}) {
  const handleCreated = (row) => {
    if (setCustomers) setCustomers((prev) => upsertCustomer(prev, row));
    onCreated?.(row);
    if (row?.id) onChange?.(row.id);
  };

  return (
    <div className={cn('flex gap-2 items-center', className)}>
      <SearchSelect
        className="flex-1 min-w-0"
        value={value}
        onChange={onChange}
        size={size}
        options={(customers || []).map((c) => ({
          value: c.id,
          label: c.name,
          hint: c.phone || '',
        }))}
        placeholder="Search customer…"
        emptyLabel="No customer matches"
        requireQuery
        typeHint="Start typing a name or phone"
        {...selectProps}
      />
      <QuickAddCustomerButton size={size} className={buttonClassName} onCreated={handleCreated} />
    </div>
  );
}
