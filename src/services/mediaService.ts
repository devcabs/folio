/**
 * Folio Engine - Canonical Cloud Media Upload Service
 * Location: src/services/mediaService.ts
 * Specification: docs/tasks/task11_2g_db_draft_and_blob_storage_pipeline.md
 * Aligned with: docs/00_WORKFLOW.md, docs/03_ARCHITECTURE.md, docs/07_CODING_STANDARDS.md
 */

import { getSupabaseConfig } from '../utils/supabase-config';
import type { MediaFolder, ImageDownscaleOptions } from '../types/media';

export const MEDIA_BUCKET_ID = 'engine-media';
export const DEFAULT_MAX_DIMENSION = 1600;
export const DEFAULT_IMAGE_QUALITY = 0.82;

/**
 * Sanitizes a filename, preserving lowercase extension and alphanumeric characters.
 */
export function sanitizeFilename(filename: string): string {
  const parts = filename.split('.');
  const ext = (parts.pop() || 'png').toLowerCase().trim();
  const base = parts.join('.');
  const cleanBase = base.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 40);
  return `${cleanBase || 'asset'}.${ext}`;
}

/**
 * Client-side downscaling using an offscreen HTML Canvas.
 * Scales large camera photos (e.g. 12 MB, 4000x3000) down to max 1600px,
 * producing crisp, responsive ~120 KB WebP or JPEG binaries.
 */
export async function downscaleImage(
  file: File | Blob,
  options?: ImageDownscaleOptions
): Promise<Blob> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  // Only downscale raster image types
  const type = file.type || 'image/jpeg';
  if (!type.startsWith('image/') || type.includes('svg')) {
    return file;
  }

  const maxDim = options?.maxDimension || DEFAULT_MAX_DIMENSION;
  const quality = options?.quality || DEFAULT_IMAGE_QUALITY;
  const targetMime = options?.mimeType || (type === 'image/png' ? 'image/png' : 'image/jpeg');

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Calculate scaled dimensions maintaining aspect ratio
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(blob);
          } else {
            // Keep original if converted blob is larger or null
            resolve(file);
          }
        },
        targetMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Uploads a binary media asset directly to the Supabase engine-media bucket.
 * Returns the permanent public CDN URL.
 */
export async function uploadMediaAsset(
  file: File | Blob,
  folder: MediaFolder = 'photos',
  originalFilename?: string
): Promise<string> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error('Supabase configuration missing');
  }

  const rawName = originalFilename || (file instanceof File ? file.name : `asset-${Date.now()}.png`);
  const cleanName = sanitizeFilename(rawName);
  const path = `${folder}/${Date.now()}-${cleanName}`;

  // Downscale image if applicable
  const processedBlob = await downscaleImage(file);

  const keyToUse = config.anonKey;
  const uploadUrl = `${config.url}/storage/v1/object/${MEDIA_BUCKET_ID}/${path}`;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      apikey: keyToUse,
      Authorization: `Bearer ${keyToUse}`,
      'Content-Type': processedBlob.type || file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: processedBlob,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let diagnosticMessage = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.message) {
        if (parsed.message.includes('row-level security') || parsed.code === 'AccessDenied') {
          diagnosticMessage =
            'Storage permission denied (RLS policy missing). Apply migration 20261021160000_create_engine_media_storage_and_drafts.sql in Supabase SQL Editor.';
        } else {
          diagnosticMessage = parsed.message;
        }
      }
    } catch {
      // Keep raw text if not JSON
    }
    throw new Error(`Media upload failed (${res.status}): ${diagnosticMessage}`);
  }

  // Return permanent public CDN URL
  return `${config.url}/storage/v1/object/public/${MEDIA_BUCKET_ID}/${path}`;
}
