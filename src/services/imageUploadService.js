import { supabase } from '@/lib/customSupabaseClient';
import { compressImageToMaxBytes, MEMBER_PHOTO_MAX_BYTES } from '@/utils/imageCompression';

/**
 * Service for handling secure image uploads for members
 */

/** Allow large pastes/uploads; we compress down to ~1MB before storing. */
const MAX_INPUT_FILE_SIZE = 25 * 1024 * 1024; // 25MB source
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];

/**
 * Validates a file before processing
 * @param {File} file 
 * @returns {Object} { valid: boolean, error: string }
 */
export const validateFile = (file) => {
  if (!file) return { valid: false, error: "No file selected." };
  
  const typeOk = ALLOWED_TYPES.includes(file.type) || String(file.type || '').startsWith('image/');
  if (!typeOk) {
    return { 
      valid: false, 
      error: "Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed." 
    };
  }
  
  if (file.size > MAX_INPUT_FILE_SIZE) {
    return { 
      valid: false, 
      error: "File is too large to process (max 25MB). Please choose a smaller image." 
    };
  }
  
  return { valid: true };
};

/**
 * Uploads a member image to Supabase storage with authentication check
 * @param {File} file - The image file to upload
 * @param {string} memberId - ID of the member (or 'temp' for new members)
 * @returns {Promise<string>} - The public URL of the uploaded image
 */
export const uploadMemberImage = async (file, memberId = 'temp') => {
  // 1. Validation
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  try {
    // 2. Compress to ~1MB for fast public page loads
    const compressedFile = await compressImageToMaxBytes(file, MEMBER_PHOTO_MAX_BYTES);

    // 3. Prepare File Path
    const timestamp = Date.now();
    // Sanitize filename to avoid special char issues
    const sanitizedName = String(compressedFile.name || file.name || 'photo.jpg').replace(/[^a-zA-Z0-9.]/g, '_'); 
    const filePath = `members/${memberId}/${timestamp}-${sanitizedName}`;

    // 4. Upload to Supabase
    const { data, error: uploadError } = await supabase.storage
      .from('members-photos')
      .upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: compressedFile.type || 'image/jpeg',
      });

    if (uploadError) {
      console.error("Storage Upload Error:", uploadError);
      
      // Handle permission errors specifically
      if (
        uploadError.statusCode === '403' || 
        uploadError.error === 'Unauthorized' || 
        (uploadError.message || '').includes('row-level security')
      ) {
        throw new Error("Permission denied: You need to be logged in as an admin to upload photos.");
      }
      
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // 5. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('members-photos')
      .getPublicUrl(filePath);

    if (!publicUrl) {
      throw new Error("Upload successful but failed to retrieve public URL.");
    }

    return publicUrl;
  } catch (error) {
    console.error("uploadMemberImage error:", error);
    throw error;
  }
};

/**
 * Deletes a member image from Supabase storage
 * @param {string} imageUrl - The full public URL of the image to delete
 * @returns {Promise<boolean>}
 */
export const deleteMemberImage = async (imageUrl) => {
  if (!imageUrl) return false;

  try {
    const bucketName = 'members-photos';
    // Extract path from URL: .../storage/v1/object/public/members-photos/members/123/image.jpg
    const parts = imageUrl.split(`/${bucketName}/`);
    
    if (parts.length < 2) {
      console.warn("Invalid image URL format for deletion:", imageUrl);
      return false;
    }
    
    const filePath = parts[1];

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error("Delete image error:", error);
      // We log but don't throw, as this is a cleanup operation
      return false;
    }

    return true;
  } catch (error) {
    console.error("deleteMemberImage error:", error);
    return false;
  }
};