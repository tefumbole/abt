import { supabase } from '@/lib/customSupabaseClient';
import { validateImageSize } from '@/utils/imageCompression';

/**
 * Uploads a system logo to Supabase Storage.
 * @param {File} file - The image file to upload
 * @returns {Promise<{publicUrl: string, filePath: string}>} - The public URL and storage path
 */
export const uploadLogo = async (file) => {
  try {
    const validation = validateImageSize(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only PNG, JPG, JPEG, WebP, and SVG are allowed.');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `system-logo-${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('system-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error("Failed to upload image. Ensure 'system-assets' bucket exists.");
    }

    const storedPath = uploadData?.path || uploadData?.Key || filePath;
    const { data: { publicUrl } } = supabase.storage
      .from('system-assets')
      .getPublicUrl(storedPath);

    if (!publicUrl) {
      throw new Error('Failed to retrieve public URL for uploaded logo.');
    }

    return { publicUrl, filePath: storedPath };
  } catch (error) {
    console.error('Logo upload service error:', error);
    throw error;
  }
};

/**
 * Uploads a PDF letterhead image (header or footer) to Supabase Storage.
 * @param {File} file
 * @param {'header' | 'footer'} type
 */
export const uploadPdfLetterheadImage = async (file, type) => {
  if (!['header', 'footer', 'watermark'].includes(type)) {
    throw new Error('Invalid letterhead type. Use "header", "footer", or "watermark".');
  }

  const validation = validateImageSize(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only PNG, JPG, JPEG, WebP, and SVG are allowed.');
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `pdf-${type}-${Date.now()}.${fileExt}`;
  const filePath = `pdf-letterhead/${fileName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('system-assets')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error("Failed to upload image. Ensure 'system-assets' bucket exists.");
  }

  const storedPath = uploadData?.path || uploadData?.Key || filePath;
  const { data: { publicUrl } } = supabase.storage
    .from('system-assets')
    .getPublicUrl(storedPath);

  if (!publicUrl) {
    throw new Error('Failed to retrieve public URL for uploaded image.');
  }

  return { publicUrl, filePath: storedPath };
};

/**
 * Deletes a file from Supabase Storage (system-assets bucket).
 * @param {string} filePath
 */
export const deleteStoredAsset = async (filePath) => {
  if (!filePath) return;

  try {
    const { error } = await supabase.storage
      .from('system-assets')
      .remove([filePath]);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting stored asset:', error);
    throw error;
  }
};

export const deleteLogo = deleteStoredAsset;
