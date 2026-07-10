import { supabase } from '@/lib/customSupabaseClient';

const DEFAULTS = {
  company_name: import.meta.env.VITE_COMPANY_NAME || 'Alpha Bridge',
  default_header: import.meta.env.VITE_COMPANY_NAME || 'Alpha Bridge',
  serial_prefix: 'ABT/ANN',
  next_serial: 1,
  serial_padding: 6,
  timezone: 'Africa/Douala',
  timezone_offset: '+01:00',
};

function mapSettings(row) {
  if (!row) return { ...DEFAULTS };
  return {
    id: row.id,
    companyName: row.company_name,
    defaultHeader: row.default_header,
    serialPrefix: row.serial_prefix,
    nextSerial: row.next_serial,
    serialPadding: row.serial_padding,
    timezone: row.timezone,
    timezoneOffset: row.timezone_offset,
  };
}

export async function getAnnouncementSettings() {
  const { data, error } = await supabase
    .from('announcement_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const { data: created, error: createError } = await supabase
      .from('announcement_settings')
      .insert(DEFAULTS)
      .select()
      .single();
    if (createError) throw createError;
    return mapSettings(created);
  }

  return mapSettings(data);
}

export async function saveAnnouncementSettings(payload) {
  const current = await getAnnouncementSettings();
  const updated = {
    company_name: payload.companyName ?? current.companyName,
    default_header: payload.defaultHeader ?? current.defaultHeader,
    serial_prefix: payload.serialPrefix ?? current.serialPrefix,
    next_serial: payload.nextSerial !== undefined ? Number(payload.nextSerial) : current.nextSerial,
    serial_padding: payload.serialPadding !== undefined ? Number(payload.serialPadding) : current.serialPadding,
    timezone: payload.timezone ?? current.timezone ?? DEFAULTS.timezone,
    timezone_offset: payload.timezoneOffset ?? current.timezoneOffset ?? DEFAULTS.timezone_offset,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('announcement_settings')
    .update(updated)
    .eq('id', current.id)
    .select()
    .single();

  if (error) throw error;
  return mapSettings(data);
}

export async function allocateSerialReference() {
  const settings = await getAnnouncementSettings();
  const num = String(settings.nextSerial || 1).padStart(settings.serialPadding || 6, '0');
  const reference = `${settings.serialPrefix || 'ABT/ANN'}-${num}`;
  await saveAnnouncementSettings({ ...settings, nextSerial: (settings.nextSerial || 1) + 1 });
  return reference;
}
