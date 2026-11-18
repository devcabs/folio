import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeveloperModeProvider } from '../src/context/DeveloperModeContext';
import type { GalleryElement } from '../src/types/canvas';
import type { SyncedSourceItem } from '../src/types/source';

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');

function collectSrcFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSrcFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe('Subtask 7.8: Embedded AST Evidence Galleries & Google Drive Photo Sync SSOT', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('1. Legacy Source Service & Static JSON Purge', () => {
    it('deletes src/services/sourceService.ts and src/hooks/useSourcePoint.ts', () => {
      expect(fs.existsSync(path.join(SRC_DIR, 'services/sourceService.ts'))).toBe(false);
      expect(fs.existsSync(path.join(SRC_DIR, 'hooks/useSourcePoint.ts'))).toBe(false);
    });

    it('has zero references to legacy source stores or static JSON fallbacks in src/', () => {
      const files = collectSrcFiles(SRC_DIR);
      const forbidden = [
        'sourceService',
        'useSourcePoint',
        'getSourceSource',
        'source-sources.json',
        'node-nodes.json',
        '_evidence_cache_v2',
        'engine_sources',
        'inMemoryRegistry',
      ];
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        for (const term of forbidden) {
          expect(content, `${path.relative(ROOT, file)} must not reference ${term}`).not.toContain(term);
        }
      }
    });

    it('removes ContentDB source.<id>.source DevActionAffordance binding from SourceFolderAttachment.tsx', () => {
      const attachmentSrc = fs.readFileSync(
        path.join(SRC_DIR, 'components/source/SourceFolderAttachment.tsx'),
        'utf8'
      );
      expect(attachmentSrc).not.toContain('DevActionAffordance');
      expect(attachmentSrc).not.toContain('source.${');
    });

    it('retains pure Drive URL extraction and validation utilities in src/utils/source.ts', async () => {
      const sourceUtils = await import('../src/utils/source');
      expect(typeof sourceUtils.isValidDriveFolderUrl).toBe('function');
      expect(typeof (sourceUtils as Record<string, unknown>).extractDriveFolderId).toBe('function');
      expect((sourceUtils as Record<string, unknown>).getSourceSource).toBeUndefined();
      expect(
        sourceUtils.isValidDriveFolderUrl('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz')
      ).toBe(true);
    });
  });

  describe('2. Edge Media Proxy URL Generation (Zero Direct Drive Thumbnail URLs)', () => {
    it('formatHighResDriveUrl and formatThumbnailDriveUrl always emit Edge Media Proxy URLs', async () => {
      const { formatHighResDriveUrl, formatThumbnailDriveUrl, reconcileDrivePhotos } = await import(
        '../src/services/drivePhotoSyncService'
      );

      expect(formatHighResDriveUrl('https://lh3.googleusercontent.com/d/abc1234567890=s220', 'abc1234567890')).toBe(
        '/api/media/drive/abc1234567890?w=1600'
      );
      expect(formatThumbnailDriveUrl('https://lh3.googleusercontent.com/d/abc1234567890=s220', 'abc1234567890')).toBe(
        '/api/media/drive/abc1234567890?w=320'
      );

      const result = reconcileDrivePhotos(
        [],
        [
          {
            id: 'abc1234567890',
            name: '01_Site_Inspection.jpg',
            mimeType: 'image/jpeg',
            thumbnailLink: 'https://lh3.googleusercontent.com/d/abc1234567890=s220',
          },
        ],
        'gal-1'
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].thumbnailUrl).toBe('/api/media/drive/abc1234567890?w=320');
      expect(result.items[0].fullImageUrl).toBe('/api/media/drive/abc1234567890?w=1600');
      expect(result.items[0].imageSrc).toBe('/api/media/drive/abc1234567890?w=1600');
      expect(result.items[0].photo?.src).toBe('/api/media/drive/abc1234567890?w=1600');
    });

    it('resolveSingleDrivePhotoUrl emits Edge Media Proxy URLs', async () => {
      const { resolveSingleDrivePhotoUrl } = await import('../src/utils/mediaUrl');
      const resolved = resolveSingleDrivePhotoUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view');
      expect(resolved).not.toBeNull();
      expect(resolved?.displayUrl).toBe('/api/media/drive/1AbCdEfGhIjKlMnOp?w=1600');
      expect(resolved?.thumbnailUrl).toBe('/api/media/drive/1AbCdEfGhIjKlMnOp?w=320');
    });
  });

  describe('3. Self-Contained GalleryElement AST Rendering (Public Mode)', () => {
    it('CanvasGallery renders syncedPhotos directly from GalleryElement AST without localStorage or static JSON', async () => {
      const { CanvasGallery } = await import('../src/components/canvas/CanvasGallery');
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
      vi.stubGlobal(
        'Image',
        class {
          referrerPolicy = '';
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          set src(_val: string) {
            setTimeout(() => this.onload?.(), 0);
          }
        }
      );

      const syncedPhotos: SyncedSourceItem[] = [
        {
          id: 'drive-file1234567890',
          pointId: 'gal-ast-1',
          driveFileId: 'file1234567890',
          originalFileName: '01_Evidence.jpg',
          title: 'AST Embedded Evidence Photo',
          category: 'MOV Photo',
          date: '2026-10-09',
          dateStamp: '2026-10-09',
          imageSrc: '/api/media/drive/file1234567890?w=1600',
          thumbnailUrl: '/api/media/drive/file1234567890?w=320',
          fullImageUrl: '/api/media/drive/file1234567890?w=1600',
          photo: {
            src: '/api/media/drive/file1234567890?w=1600',
            alt: 'AST Embedded Evidence Photo',
            caption: 'AST Embedded Evidence Photo',
            showCaption: true,
          },
          orderIndex: 0,
          isCustomTitle: false,
        },
      ];

      const element: GalleryElement = {
        id: 'gal-ast-1',
        type: 'gallery',
        pointId: 'gal-ast-1',
        title: 'AST Folder Title',
        driveUrl: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp',
        syncedPhotos,
      };

      render(
        React.createElement(
          DeveloperModeProvider,
          null,
          React.createElement(CanvasGallery, {
            element,
            nodeId: 'access',
          })
        )
      );

      expect(screen.getByText('AST Folder Title')).toBeTruthy();
      expect(screen.getByRole('button', { name: /AST Embedded Evidence Photo/i })).toBeTruthy();

      const evidenceCacheReads = getItemSpy.mock.calls.filter(
        ([key]) => typeof key === 'string' && key.includes('evidence_cache')
      );
      expect(evidenceCacheReads).toHaveLength(0);
    });
  });

  describe('4. Fail-Stop Drive Verification & LinkFolderModal Gate', () => {
    it('verifyDriveFolderUrl does NOT fall back to files.list when files.get returns 404', async () => {
      vi.stubEnv('VITE_GOOGLE_DRIVE_API_KEY', 'test-api-key-123');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: { code: 404, message: 'File not found' } }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const { verifyDriveFolderUrl } = await import('../src/services/driveVerificationService');
      const result = await verifyDriveFolderUrl('https://drive.google.com/drive/folders/1MissingFolder12345');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('restricted');
    });

    it('LinkFolderModal blocks saving when verification returns unverified', async () => {
      vi.stubEnv('VITE_GOOGLE_DRIVE_API_KEY', '');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({}),
        })
      );

      vi.resetModules();
      vi.resetModules();
      vi.doMock('../src/hooks/useDeveloperMode', () => ({
        useDeveloperMode: () => ({ isDevMode: true, isDesktop: true }),
      }));

      const { LinkFolderModal } = await import('../src/components/source/LinkFolderModal');
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(
        React.createElement(LinkFolderModal, {
          isOpen: true,
          pointId: 'gal-1',
          initialTitle: 'Test Folder',
          initialUrl: 'https://drive.google.com/drive/folders/1ValidFormatFolderId123',
          onClose,
          onSuccess,
        })
      );

      const saveBtn = screen.getByRole('button', { name: 'Save' });
      fireEvent.click(saveBtn);

      await vi.waitFor(() => {
        expect(screen.getByRole('alert')).toBeTruthy();
      });

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('LinkFolderModal fails stop and stays open if onSuccess returns { ok: false }', async () => {
      vi.stubEnv('VITE_GOOGLE_DRIVE_API_KEY', 'test-api-key-123');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            id: '1ValidFolderId123',
            name: 'Verified Folder',
            mimeType: 'application/vnd.google-apps.folder',
          }),
        })
      );

      vi.resetModules();
      vi.doMock('../src/hooks/useDeveloperMode', () => ({
        useDeveloperMode: () => ({ isDevMode: true, isDesktop: true }),
      }));

      const { LinkFolderModal } = await import('../src/components/source/LinkFolderModal');
      const onSuccess = vi.fn().mockResolvedValue({ ok: false, error: 'Draft KV write failed' });
      const onClose = vi.fn();

      render(
        React.createElement(LinkFolderModal, {
          isOpen: true,
          pointId: 'gal-1',
          initialTitle: 'Verified Folder',
          initialUrl: 'https://drive.google.com/drive/folders/1ValidFolderId123',
          onClose,
          onSuccess,
        })
      );

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await vi.waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('Draft KV write failed');
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('5. Fail-Stop Subfolder Scanning in fetchDriveFolderImages', () => {
    it('throws instead of returning partial directImages when a subfolder query fails', async () => {
      vi.stubEnv('VITE_GOOGLE_DRIVE_API_KEY', 'test-api-key-123');
      const fetchMock = vi
        .fn()
        // Root folder listing: 1 direct image + 1 subfolder
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            files: [
              { id: 'img-1', name: '01_Direct.jpg', mimeType: 'image/jpeg' },
              { id: 'sub-1', name: 'Subfolder', mimeType: 'application/vnd.google-apps.folder' },
            ],
          }),
        })
        // Subfolder listing fails with 503
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: async () => ({ error: { message: 'Backend Error' } }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const { fetchDriveFolderImages } = await import('../src/services/drivePhotoSyncService');
      await expect(
        fetchDriveFolderImages('https://drive.google.com/drive/folders/1RootFolderId12345')
      ).rejects.toThrow();
    });
  });
});
