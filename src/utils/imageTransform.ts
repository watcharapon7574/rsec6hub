/**
 * Supabase Image Transformation utility
 * Converts Supabase Storage public URLs to use the render/image endpoint
 * for automatic resize, quality optimization, and WebP conversion.
 *
 * Pro Plan required. WebP is automatically negotiated by the browser's Accept header.
 */

const SUPABASE_STORAGE_PREFIX = '/storage/v1/object/public/';
const SUPABASE_RENDER_PREFIX = '/storage/v1/render/image/public/';

interface TransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Transform a Supabase Storage public URL to use Image Transformation.
 * Non-Supabase URLs or invalid URLs are returned as-is.
 */
export function transformImageUrl(
  url: string | undefined | null,
  options: TransformOptions
): string | undefined {
  if (!url) return undefined;

  // Only transform Supabase Storage public URLs
  if (!url.includes(SUPABASE_STORAGE_PREFIX)) return url;

  // Replace object path with render path
  let transformed = url.replace(SUPABASE_STORAGE_PREFIX, SUPABASE_RENDER_PREFIX);

  // Build query params
  const params = new URLSearchParams();
  if (options.width) params.set('width', String(options.width));
  if (options.height) params.set('height', String(options.height));
  if (options.quality) params.set('quality', String(options.quality));
  if (options.resize) params.set('resize', options.resize);

  const qs = params.toString();
  if (qs) {
    transformed += (transformed.includes('?') ? '&' : '?') + qs;
  }

  return transformed;
}

// Preset transforms for common use cases
export const imagePresets = {
  /** Post avatar (40x40 circle) */
  avatar: { width: 80, height: 80, quality: 70, resize: 'cover' as const },
  /** Comment avatar (32x32 circle) */
  avatarSmall: { width: 64, height: 64, quality: 70, resize: 'cover' as const },
  /** Reply avatar (28x28 circle) */
  avatarTiny: { width: 56, height: 56, quality: 70, resize: 'cover' as const },
  /** Post image thumbnail in grid */
  postThumbnail: { width: 600, quality: 70, resize: 'cover' as const },
  /** Post image full (lightbox) */
  postFull: { width: 1200, quality: 80 },
};
