import { supabase } from '@/lib/customSupabaseClient';
import { enrichSystemSettingsAssets } from '@/utils/storageUrl';

/**
 * Service to handle system settings via Supabase
 * Maps to 'system_settings' table
 */

export const getSystemSettings = async () => {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
        // Fallback or init if missing
        if (error.code === 'PGRST116') {
             // Create default row if it doesn't exist
             const { data: newData, error: insertError } = await supabase
                .from('system_settings')
                .insert([{ developed_by: 'Alpha Bridge', copyright_text: 'All rights reserved' }])
                .select()
                .single();
             if (!insertError) return enrichSystemSettingsAssets(newData);
        }
        console.warn('getSystemSettings error:', error.message);
        return enrichSystemSettingsAssets({
            developed_by: 'Alpha Bridge',
            copyright_text: 'All rights reserved',
            logo_url: null
        });
    }
    
    return enrichSystemSettingsAssets(data);
  } catch (error) {
    console.error('System settings fetch exception:', error);
    throw error;
  }
};

export const updateSystemSettings = async (newSettings) => {
  try {
    // 1. Get current ID
    const { data: current } = await supabase
      .from('system_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    const payload = {
        ...newSettings,
        updated_at: new Date().toISOString()
    };

    let result;
    if (current?.id) {
        // Update existing
        result = await supabase
            .from('system_settings')
            .update(payload)
            .eq('id', current.id)
            .select()
            .single();
    } else {
        // Insert if not exists
        result = await supabase
            .from('system_settings')
            .insert([payload])
            .select()
            .single();
    }

    if (result.error) throw result.error;
    return enrichSystemSettingsAssets(result.data);
  } catch (error) {
    console.error('System settings update exception:', error);
    throw error;
  }
};