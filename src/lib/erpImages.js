import { getStoragePublicUrl } from '@/utils/storageUrl';

export const PRODUCT_IMAGE_BUCKET = 'products';

/** Product images are stored as upload paths; older rows may hold an absolute URL. */
export function productImageSrc(value) {
  if (!value) return null;
  if (/^(https?:|data:|blob:|\/)/i.test(value)) return value;
  return getStoragePublicUrl(PRODUCT_IMAGE_BUCKET, value);
}
