/**
 * Utility for client-side image compression using HTML5 Canvas
 */

const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];

/** Target size for member / profile photos after client compression */
export const MEMBER_PHOTO_MAX_BYTES = 1024 * 1024; // ~1MB

/**
 * Compresses an image file to specified dimensions and quality
 * @param {File} file - The image file to compress
 * @param {number} maxWidth - Maximum width of the output image (default 1200px)
 * @param {number} maxHeight - Maximum height of the output image
 * @param {number} quality - JPEG compression quality (0 to 1)
 * @returns {Promise<Blob>} - The compressed image as a Blob
 */
export const compressImage = async (file, maxWidth = 1200, maxHeight = 1200, quality = 0.6) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error("No file provided"));
            return;
        }

        if (!COMPRESSIBLE_TYPES.includes(file.type) && !String(file.type || '').startsWith('image/')) {
            reject(new Error("Invalid file type. Only image files are allowed."));
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions to maintain aspect ratio
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(width));
                canvas.height = Math.max(1, Math.round(height));

                const ctx = canvas.getContext('2d');
                // White background so transparent PNGs don't become black as JPEG
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error("Image compression failed"));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };

            img.onerror = () => reject(new Error("Failed to load image"));
        };

        reader.onerror = () => reject(new Error("Failed to read file"));
    });
};

/**
 * Compress until the result is at or under maxBytes (~1MB by default).
 * Returns a JPEG File suitable for member profile uploads.
 */
export const compressImageToMaxBytes = async (
    file,
    maxBytes = 1024 * 1024,
    { maxWidth = 1600, maxHeight = 1600, minQuality = 0.35 } = {}
) => {
    if (!file) throw new Error('No file provided');

    // Already small enough — keep original (faster load/upload)
    if (file.size <= maxBytes) {
        return file;
    }

    let width = maxWidth;
    let height = maxHeight;
    let quality = 0.82;
    let blob = await compressImage(file, width, height, quality);
    let guard = 0;

    while (blob.size > maxBytes && guard < 12) {
        guard += 1;
        if (quality > minQuality) {
            quality = Math.max(minQuality, quality - 0.12);
        } else {
            width = Math.max(480, Math.floor(width * 0.82));
            height = Math.max(480, Math.floor(height * 0.82));
            quality = Math.min(0.75, quality + 0.05);
        }
        blob = await compressImage(file, width, height, quality);
    }

    const baseName = String(file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
    });
};

/**
 * Formats bytes to human readable string
 * @param {number} bytes 
 * @param {number} decimals 
 * @returns {string}
 */
export const formatBytes = (bytes, decimals = 2) => {
    if (!Number.isFinite(bytes) || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Validates if an image file is suitable for upload (size and type only)
 * Updated for 5MB limit.
 * @param {File} file 
 * @returns {Object} { valid: boolean, error: string | null }
 */
export const validateImageSize = (file) => {
    if (!file) return { valid: false, error: 'No file selected.' };
    
    // Updated 5MB input limit (5 * 1024 * 1024 = 5242880 bytes)
    const MAX_SIZE_MB = 5;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    if (file.size > MAX_SIZE_BYTES) {
        return { 
            valid: false, 
            error: `File is too large (${formatBytes(file.size)}). Maximum file size is 5MB. Please compress your image.` 
        };
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
        return { valid: false, error: 'Invalid file type. Only JPG, PNG, WebP, and SVG are allowed.' };
    }

    return { valid: true, error: null };
};