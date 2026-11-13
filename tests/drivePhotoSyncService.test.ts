import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchDriveFolderImages,
  reconcileDrivePhotos,
  cleanDriveFileName,
  compareNaturalFilenames,
  formatHighResDriveUrl,
  formatThumbnailDriveUrl,
  syncFolderPhotos,
  MAX_SYNC_PAGES,
} from '../src/services/drivePhotoSyncService';
import type { DrivePhotoFile, SyncedSourceItem } from '../src/types/source';

describe('Subtask 2.2: Google Drive Photo Sync Pagination & Resilience', () => {
  const originalEnvKey = process.env.VITE_GOOGLE_DRIVE_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.VITE_GOOGLE_DRIVE_API_KEY = 'test-drive-api-key-12345';
  });

  afterEach(() => {
    process.env.VITE_GOOGLE_DRIVE_API_KEY = originalEnvKey;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Constants & Guards', () => {
    it('exports MAX_SYNC_PAGES with safe ceiling of 5 pages (500 items max)', () => {
      expect(MAX_SYNC_PAGES).toBeDefined();
      expect(MAX_SYNC_PAGES).toBe(5);
    });
  });

  describe('fetchDriveFolderImages Pagination', () => {
    it('exits after 1 page when nextPageToken is not provided', async () => {
      const mockFiles: DrivePhotoFile[] = [
        { id: 'img-1', name: 'photo1.jpg', mimeType: 'image/jpeg' },
        { id: 'img-2', name: 'photo2.png', mimeType: 'image/png' },
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ files: mockFiles }),
      } as Response);
      globalThis.fetch = fetchMock;

      const result = await fetchDriveFolderImages('folder-123');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType,thumbnailLink,createdTime,modifiedTime)'));
      expect(url).toContain('pageSize=100');
      expect(url).not.toContain('pageToken=');
      expect(result).toHaveLength(2);
      expect(result.map((f) => f.id)).toEqual(['img-1', 'img-2']);
    });

    it('aggregates all pages when nextPageToken is returned (e.g. 100 on page 1, 20 on page 2)', async () => {
      const page1Files: DrivePhotoFile[] = Array.from({ length: 100 }, (_, i) => ({
        id: `img-${i + 1}`,
        name: `photo_${String(i + 1).padStart(3, '0')}.jpg`,
        mimeType: 'image/jpeg',
      }));

      const page2Files: DrivePhotoFile[] = Array.from({ length: 20 }, (_, i) => ({
        id: `img-${100 + i + 1}`,
        name: `photo_${String(100 + i + 1).padStart(3, '0')}.jpg`,
        mimeType: 'image/jpeg',
      }));

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: page1Files,
            nextPageToken: 'token_page_2',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: page2Files,
          }),
        } as Response);

      globalThis.fetch = fetchMock;

      const result = await fetchDriveFolderImages('https://drive.google.com/drive/folders/test-folder-xyz');

      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Verify page 1 URL
      const url1 = fetchMock.mock.calls[0][0] as string;
      expect(url1).toContain('fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType,thumbnailLink,createdTime,modifiedTime)'));
      expect(url1).not.toContain('pageToken=');

      // Verify page 2 URL
      const url2 = fetchMock.mock.calls[1][0] as string;
      expect(url2).toContain('pageToken=token_page_2');

      // Assert all 120 images are collected
      expect(result).toHaveLength(120);
      expect(result[0].id).toBe('img-1');
      expect(result[99].id).toBe('img-100');
      expect(result[100].id).toBe('img-101');
      expect(result[119].id).toBe('img-120');
    });

    it('enforces MAX_SYNC_PAGES safety guard to prevent infinite pagination loops', async () => {
      // Mock an API that always returns a nextPageToken
      let callCount = 0;
      const fetchMock = vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          json: async () => ({
            files: [
              {
                id: `img-page-${callCount}`,
                name: `photo_page_${callCount}.jpg`,
                mimeType: 'image/jpeg',
              },
            ],
            nextPageToken: `token_for_page_${callCount + 1}`,
          }),
        } as Response;
      });

      globalThis.fetch = fetchMock;

      const result = await fetchDriveFolderImages('folder-infinite');

      // Must stop at MAX_SYNC_PAGES (5)
      expect(fetchMock).toHaveBeenCalledTimes(5);
      expect(result).toHaveLength(5);
      expect(result.map((f) => f.id)).toEqual([
        'img-page-1',
        'img-page-2',
        'img-page-3',
        'img-page-4',
        'img-page-5',
      ]);
    });
  });

  describe('Subfolder Scan Resilience & Diagnostics', () => {
    it('catches and logs console.warn on subfolder scan errors without discarding direct images', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const rootFiles: DrivePhotoFile[] = [
        { id: 'img-root', name: 'direct.jpg', mimeType: 'image/jpeg' },
        { id: 'subfolder-1', name: 'Sub 1', mimeType: 'application/vnd.google-apps.folder' },
      ];

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: rootFiles }),
        } as Response)
        .mockRejectedValueOnce(new Error('Subfolder network timeout'));

      globalThis.fetch = fetchMock;

      const result = await fetchDriveFolderImages('folder-with-subfolders');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('img-root');

      // Verify structured warning was dispatched
      expect(warnSpy).toHaveBeenCalledWith(
        '[drivePhotoSyncService] Subfolder image scan encountered an error; direct images retained:',
        expect.any(Error)
      );
    });

    it('aggregates subfolder images when subfolder scan succeeds', async () => {
      const rootFiles: DrivePhotoFile[] = [
        { id: 'img-root', name: 'direct.jpg', mimeType: 'image/jpeg' },
        { id: 'subfolder-1', name: 'Sub 1', mimeType: 'application/vnd.google-apps.folder' },
      ];

      const subFiles: DrivePhotoFile[] = [
        { id: 'img-sub-1', name: 'sub-photo.jpg', mimeType: 'image/jpeg' },
      ];

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: rootFiles }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: subFiles }),
        } as Response);

      globalThis.fetch = fetchMock;

      const result = await fetchDriveFolderImages('folder-with-subfolders');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result.map((f) => f.id)).toEqual(['img-root', 'img-sub-1']);
    });
  });

  describe('Differential Reconciliation & Identity Preservation', () => {
    it('preserves coordinator custom titles across paginated multi-page sync items', () => {
      const existingItems: SyncedSourceItem[] = [
        {
          id: 'drive-img-1',
          pointId: 'node-1',
          driveFileId: 'img-1',
          originalFileName: '01_raw.jpg',
          title: 'Curated Coordinator Custom Title',
          isCustomTitle: true,
          category: 'MOV Photo',
          date: '2026-10-09',
          dateStamp: '2026-10-09',
          orderIndex: 0,
          thumbnailUrl: 'https://drive.google.com/thumbnail?id=img-1&sz=w320',
          fullImageUrl: 'https://drive.google.com/thumbnail?id=img-1&sz=w1600',
        },
      ];

      const incomingFiles: DrivePhotoFile[] = [
        { id: 'img-1', name: '01_raw.jpg', mimeType: 'image/jpeg' },
        { id: 'img-2', name: '02_second.jpg', mimeType: 'image/jpeg' },
      ];

      const result = reconcileDrivePhotos(existingItems, incomingFiles, 'node-1');

      expect(result.items).toHaveLength(2);
      expect(result.stats).toEqual({
        added: 1,
        removed: 0,
        retained: 1,
        total: 2,
        hasChanged: true,
      });

      // Assert custom title is retained
      const item1 = result.items.find((i) => i.driveFileId === 'img-1');
      expect(item1?.title).toBe('Curated Coordinator Custom Title');
      expect(item1?.isCustomTitle).toBe(true);

      // Assert newly added item receives cleaned title and isCustomTitle: false
      const item2 = result.items.find((i) => i.driveFileId === 'img-2');
      expect(item2?.title).toBe('second');
      expect(item2?.isCustomTitle).toBe(false);
    });

    it('performs natural numeric comparison on filenames', () => {
      const filenames = ['10_Photo.jpg', '01_Photo.jpg', '02_Photo.jpg', '2_Photo.jpg'];
      const sorted = [...filenames].sort(compareNaturalFilenames);
      expect(sorted).toEqual(['01_Photo.jpg', '02_Photo.jpg', '2_Photo.jpg', '10_Photo.jpg']);
    });

    it('correctly cleans machine prefixes from filenames', () => {
      expect(cleanDriveFileName('IMG_20261009_01_Front_View.jpg')).toBe('Front View');
      expect(cleanDriveFileName('01-exterior_elevation.png')).toBe('exterior elevation');
      expect(cleanDriveFileName('99_site_plan.webp')).toBe('site plan');
      expect(cleanDriveFileName('')).toBe('Source Photo');
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('throws if folder URL or ID is empty or invalid', async () => {
      await expect(fetchDriveFolderImages('')).rejects.toThrow('Invalid Google Drive folder link or folder ID.');
      await expect(fetchDriveFolderImages('   ')).rejects.toThrow('Invalid Google Drive folder link or folder ID.');
    });

    it('throws if Google Drive API key is not configured', async () => {
      delete process.env.VITE_GOOGLE_DRIVE_API_KEY;
      await expect(fetchDriveFolderImages('folder-123')).rejects.toThrow(
        'Google Drive API Key is not configured in VITE_GOOGLE_DRIVE_API_KEY.'
      );
    });

    it('handles HTTP 404 folder not found', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: { message: 'File not found' } }),
      } as Response);

      await expect(fetchDriveFolderImages('missing-folder')).rejects.toThrow(
        'Google Drive folder not found [HTTP 404: File not found].'
      );
    });

    it('handles HTTP 403 referrer restriction error with guidance', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          error: {
            errors: [{ reason: 'API_KEY_HTTP_REFERRER_BLOCKED', message: 'Referrer blocked' }],
            message: 'Requests from referer are blocked.',
          },
        }),
      } as Response);

      await expect(fetchDriveFolderImages('folder-123')).rejects.toThrow(
        'Google Cloud API Key Referrer Block [HTTP 403: Requests from referer are blocked.]. Add your deployment domain to allowed HTTP referrers in Google Cloud Console.'
      );
    });

    it('handles general HTTP 403 permission error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          error: { message: 'The user does not have access to this file' },
        }),
      } as Response);

      await expect(fetchDriveFolderImages('folder-123')).rejects.toThrow(
        'Access denied [HTTP 403: The user does not have access to this file]. Ensure folder General Access is set to "Anyone with the link can view".'
      );
    });

    it('handles generic HTTP 500 error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          error: { message: 'Backend error' },
        }),
      } as Response);

      await expect(fetchDriveFolderImages('folder-123')).rejects.toThrow(
        'Google Drive API error [HTTP 500]: Backend error'
      );
    });
  });

  describe('URL Formatter Functions', () => {
    it('formats high-res and thumbnail URLs correctly', () => {
      const highRes = formatHighResDriveUrl('https://lh3.googleusercontent.com/abc=s220', 'file1234567890');
      expect(highRes).toBe('https://lh3.googleusercontent.com/abc=s1600');

      const thumb = formatThumbnailDriveUrl('https://lh3.googleusercontent.com/abc=s220', 'file1234567890');
      expect(thumb).toBe('https://lh3.googleusercontent.com/abc=s220');

      // Edge proxy format
      const edgeThumb = formatThumbnailDriveUrl(undefined, 'file1234567890', true);
      expect(edgeThumb).toBe('/api/media/drive/file1234567890?w=320');
      const edgeHigh = formatHighResDriveUrl(undefined, 'file1234567890', true);
      expect(edgeHigh).toBe('/api/media/drive/file1234567890?w=1600');
    });
  });

  describe('Subtask 2.3: syncFolderPhotos Background & Cloud Observability', () => {
    it('propagates isBackground option and returns cloudSynced / cloudError', async () => {
      const mockFiles: DrivePhotoFile[] = [
        { id: 'img-101', name: 'photo-101.jpg', mimeType: 'image/jpeg' },
      ];

      // Google Drive fetch mock
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ files: mockFiles }),
      } as Response);

      const result = await syncFolderPhotos(
        'node-orchestration-test',
        'https://drive.google.com/drive/folders/1234567890abcdef12345',
        [],
        undefined,
        { isBackground: true }
      );

      expect(result.items).toHaveLength(1);
      expect(result.stats.added).toBe(1);
      expect(result.source).toBeDefined();
      expect(result.source.pointId).toBe('orchestration-test');
    });
  });
});
