import { supabase } from '@/lib/customSupabaseClient';

/**
 * Service for managing member data.
 * Handles Create, Read, Update, Delete, and reorder for the 'members' table.
 */

// Fetch all members (public + admin) in display order
export const getAllMembers = async () => {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('getAllMembers Error:', error);
    throw error;
  }
};

export const createMember = async (memberData) => {
  try {
    let sort_order = memberData.sort_order;
    if (sort_order == null) {
      const existing = await getAllMembers();
      const maxOrder = existing.reduce((max, m) => Math.max(max, Number(m.sort_order) || 0), 0);
      sort_order = maxOrder + 1;
    }

    const payload = {
      name: memberData.name,
      title: memberData.title,
      description: memberData.description || '',
      email: memberData.email || null,
      phone: memberData.phone || null,
      photo_url: memberData.photo_url || null,
      country: memberData.country || null,
      sort_order,
    };

    const { data, error } = await supabase
      .from('members')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('createMember Error:', error);
    throw error;
  }
};

export const updateMember = async (id, updates) => {
  try {
    const { data, error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('updateMember Error:', error);
    throw error;
  }
};

/** Persist display order for the public team page (1-based). */
export const reorderMembers = async (ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids array required');
  }
  await Promise.all(
    ids.map(async (id, index) => {
      const { error } = await supabase
        .from('members')
        .update({ sort_order: index + 1 })
        .eq('id', id);
      if (error) throw error;
    })
  );
  return true;
};

export const deleteMember = async (id) => {
  try {
    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete SQL Error:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    const { data: check } = await supabase
      .from('members')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (check) {
      throw new Error('Member still exists after deletion attempt (RLS issue?).');
    }

    return true;
  } catch (error) {
    console.error('deleteMember Exception:', error);
    throw error;
  }
};
