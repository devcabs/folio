import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cleanDriveFileName,
  reconcileDrivePhotos,
  fetchDriveFolderImages,
} from '../../src/services/drivePhotoSyncService';
import type { DrivePhotoFile, SyncedSourceItem } from '../../src/types/source';

describe('15.3 Mixed-Media Google Drive Sync', () => {
  const originalEnv = process.env.VITE_GOOGLE_DRIVE_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.VITE_GOOGLE_DRIVE_API_KEY = 'test-api-key-12345';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env.VITE_GOOGLE_DRIVE_API_KEY;
    } else {
      process.env.VITE_GOOGLE_DRIVE_API_KEY = originalEnv;
    }
  });

  describe('cleanDriveFileName', () => {
    it('strips VID_ prefix and .mp4 extension into clean editorial title', () => {
      expect(cleanDriveFileName('VID_20260101_site_walkthrough.mp4')).toBe('site walkthrough');
    });

    it('strips MOV_ prefix and .mov/.webm/.m4v extensions', () => {
      expect(cleanDriveFileName('MOV_0042_ribbon_cutting.mov')).toBe('ribbon cutting');
      expect(cleanDriveFileName('02_training_clip.webm')).toBe('training clip');
      expect(cleanDriveFileName('03-briefing-recap.m4v')).toBe('briefing recap');
    });

    it('preserves existing photo cleaning behavior', () => {
      expect(cleanDriveFileName('IMG_20260101_campus_gate.jpg')).toBe('campus gate');
    });
  });

  describe('reconcileDrivePhotos with mixed photos and videos', () => {
    it('ingests mixed image/jpeg and video/mp4 files in natural filename order with video metadata', () => {
      const incoming: DrivePhotoFile[] = [
        {
          id: '1DriveFileOutro03',
          name: '03_outro.jpg',
          mimeType: 'image/jpeg',
          createdTime: '2026-11-20T09:00:00.000Z',
        },
        {
          id: '1DriveFileClip02',
          name: '02_clip.mp4',
          mimeType: 'video/mp4',
          thumbnailLink: 'https://lh3.googleusercontent.com/thumb-clip',
          createdTime: '2026-11-20T08:30:00.000Z',
          videoMediaMetadata: {
            durationMillis: '65000',
            width: 1920,
            height: 1080,
          },
        },
        {
          id: '1DriveFileIntro01',
          name: '01_intro.jpg',
          mimeType: 'image/jpeg',
          createdTime: '2026-11-20T08:00:00.000Z',
        },
      ];

      const result = reconcileDrivePhotos([], incoming, 'node.access');

      expect(result.stats).toEqual({
        added: 3,
        removed: 0,
        retained: 0,
        total: 3,
        hasChanged: true,
      });

      expect(result.items.map((item) => item.originalFileName)).toEqual([
        '01_intro.jpg',
        '02_clip.mp4',
        '03_outro.jpg',
      ]);

      const intro = result.items[0];
      const clip = result.items[1];
      const outro = result.items[2];

      // Legacy photo items omit mediaType
      expect(intro.mediaType).toBeUndefined();
      expect(outro.mediaType).toBeUndefined();

      // Video item sets video fields and durationMs
      expect(clip.mediaType).toBe('video');
      expect(clip.mimeType).toBe('video/mp4');
      expect(clip.videoPreviewUrl).toBe('https://drive.google.com/file/d/1DriveFileClip02/preview');
      expect(clip.videoViewUrl).toBe('https://drive.google.com/file/d/1DriveFileClip02/view');
      expect(clip.durationMs).toBe(65000);
      expect(clip.thumbnailUrl).toContain('1DriveFileClip02');
      expect(clip.photo?.src).toContain('1DriveFileClip02');
    });

    it('preserves coordinator custom titles and order on re-sync for mixed media', () => {
      const existing: SyncedSourceItem[] = [
        {
          id: 'drive-file-clip',
          pointId: 'node.access',
          driveFileId: 'file-clip',
          originalFileName: '02_clip.mp4',
          title: 'Custom Walkthrough Video',
          isCustomTitle: true,
          orderIndex: 1,
          thumbnailUrl: '/api/media/drive/file-clip?w=320',
          fullImageUrl: '/api/media/drive/file-clip?w=1600',
          imageSrc: '/api/media/drive/file-clip?w=1600',
          mediaType: 'video',
          videoPreviewUrl: 'https://drive.google.com/file/d/file-clip/preview',
          videoViewUrl: 'https://drive.google.com/file/d/file-clip/view',
          durationMs: 65000,
          photo: {
            src: '/api/media/drive/file-clip?w=1600',
            alt: 'Custom Walkthrough Video',
            caption: 'Custom Walkthrough Video',
            showCaption: true,
          },
        },
      ];

      const incoming: DrivePhotoFile[] = [
        {
          id: 'file-clip',
          name: '02_clip.mp4',
          mimeType: 'video/mp4',
          videoMediaMetadata: { durationMillis: 68000, width: 1920, height: 1080 },
        },
        {
          id: 'file-intro',
          name: '01_intro.jpg',
          mimeType: 'image/jpeg',
        },
      ];

      const result = reconcileDrivePhotos(existing, incoming, 'node.access');

      expect(result.items[0].driveFileId).toBe('file-intro');
      expect(result.items[0].orderIndex).toBe(0);

      expect(result.items[1].driveFileId).toBe('file-clip');
      expect(result.items[1].title).toBe('Custom Walkthrough Video');
      expect(result.items[1].isCustomTitle).toBe(true);
      expect(result.items[1].mediaType).toBe('video');
      expect(result.items[1].durationMs).toBe(68000);
      expect(result.items[1].orderIndex).toBe(1);
    });
  });

  describe('fetchDriveFolderImages', () => {
    it('requests videoMediaMetadata fields and returns both image/* and video/* files', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          files: [
            { id: 'img-1', name: '01_photo.jpg', mimeType: 'image/jpeg' },
            {
              id: 'vid-1',
              name: '02_walkthrough.mp4',
              mimeType: 'video/mp4',
              videoMediaMetadata: { durationMillis: '42000', width: 1280, height: 720 },
            },
            { id: 'vid-2', name: '03_clip.mov', mimeType: 'application/octet-stream' },
            { id: 'doc-1', name: '04_notes.pdf', mimeType: 'application/pdf' },
          ],
        }),
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const files = await fetchDriveFolderImages('https://drive.google.com/drive/folders/folder1234567890');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const requestUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
      expect(requestUrl).toContain('videoMediaMetadata(durationMillis,width,height)');

      expect(files.map((f) => f.id)).toEqual(['img-1', 'vid-1', 'vid-2']);
    });
  });
});
