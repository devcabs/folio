import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';
import {
  cleanDriveDocumentName,
  reconcileDriveDocuments,
  fetchDriveFolderPdfs,
  syncFolderDocuments,
} from '../../src/services/driveDocumentSyncService';
import { useDriveDocumentSync } from '../../src/hooks/useDriveDocumentSync';
import type {
  DriveDocumentFile,
  SyncedDocumentItem,
  UseDriveDocumentSyncOptions,
  UseDriveDocumentSyncResult,
} from '../../src/types/source';

describe('Subtask 11.4: Google Drive PDF Folder Sync Service & Hook', () => {
  const originalEnv = process.env.VITE_GOOGLE_DRIVE_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.VITE_GOOGLE_DRIVE_API_KEY = 'test-api-key-12345';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env.VITE_GOOGLE_DRIVE_API_KEY;
    } else {
      process.env.VITE_GOOGLE_DRIVE_API_KEY = originalEnv;
    }
  });

  describe('cleanDriveDocumentName', () => {
    it('strips numeric prefix, .pdf extension, and underscores into clean title', () => {
      expect(cleanDriveDocumentName('01_Annual_Procurement_Plan_2026.pdf')).toBe(
        'Annual Procurement Plan 2026'
      );
    });

    it('strips DOC_ and date prefixes with uppercase .PDF extension', () => {
      expect(cleanDriveDocumentName('DOC_20261118_Signed_MOA.PDF')).toBe('Signed MOA');
    });

    it('strips PDF_ prefix and hyphens', () => {
      expect(cleanDriveDocumentName('PDF_02-Division-Memorandum.pdf')).toBe(
        'Division Memorandum'
      );
    });

    it('falls back to "Official Document" for empty or whitespace-only names', () => {
      expect(cleanDriveDocumentName('')).toBe('Official Document');
      expect(cleanDriveDocumentName('   .pdf')).toBe('Official Document');
    });
  });

  describe('reconcileDriveDocuments', () => {
    const makeDriveFile = (id: string, name: string, createdTime?: string): DriveDocumentFile => ({
      id,
      name,
      mimeType: 'application/pdf',
      size: '102400',
      createdTime: createdTime ?? '2026-11-18T08:00:00.000Z',
    });

    it('returns empty result when both existing and incoming are empty', () => {
      const result = reconcileDriveDocuments([], [], 'node.access');
      expect(result.items).toEqual([]);
      expect(result.stats).toEqual({
        added: 0,
        removed: 0,
        retained: 0,
        total: 0,
        hasChanged: false,
      });
    });

    it('adds incoming PDFs in natural numeric order with previewUrl and viewUrl', () => {
      const incoming: DriveDocumentFile[] = [
        makeDriveFile('drive-file-10', '10_Annex_B.pdf'),
        makeDriveFile('drive-file-02', '02_Executive_Summary.pdf'),
        makeDriveFile('drive-file-01', '01_Cover_Letter.pdf'),
      ];

      const result = reconcileDriveDocuments([], incoming, 'node.access');

      expect(result.stats).toEqual({
        added: 3,
        removed: 0,
        retained: 0,
        total: 3,
        hasChanged: true,
      });
      expect(result.items.map((item) => item.driveFileId)).toEqual([
        'drive-file-01',
        'drive-file-02',
        'drive-file-10',
      ]);
      expect(result.items.map((item) => item.title)).toEqual([
        'Cover Letter',
        'Executive Summary',
        'Annex B',
      ]);
      expect(result.items[0].previewUrl).toBe(
        'https://drive.google.com/file/d/drive-file-01/preview'
      );
      expect(result.items[0].viewUrl).toBe(
        'https://drive.google.com/file/d/drive-file-01/view'
      );
      expect(result.items[0].orderIndex).toBe(0);
      expect(result.items[2].orderIndex).toBe(2);
    });

    it('preserves existing custom titles (isCustomTitle: true) and captions across re-syncs', () => {
      const existing: SyncedDocumentItem[] = [
        {
          id: 'drive-doc-file01',
          pointId: 'node.access',
          driveFileId: 'file01',
          originalFileName: '01_Raw_File.pdf',
          title: 'Board Resolution No. 5',
          previewUrl: 'https://drive.google.com/file/d/file01/preview',
          viewUrl: 'https://drive.google.com/file/d/file01/view',
          isCustomTitle: true,
          caption: 'Approved in Q4 session',
          orderIndex: 0,
        },
      ];

      const incoming: DriveDocumentFile[] = [makeDriveFile('file01', '01_Raw_File.pdf')];
      const result = reconcileDriveDocuments(existing, incoming, 'node.access');

      expect(result.items[0].title).toBe('Board Resolution No. 5');
      expect(result.items[0].isCustomTitle).toBe(true);
      expect(result.items[0].caption).toBe('Approved in Q4 session');
      expect(result.stats).toEqual({
        added: 0,
        removed: 0,
        retained: 1,
        total: 1,
        hasChanged: false,
      });
    });

    it('prunes files removed from Drive and reports accurate diff stats', () => {
      const existing: SyncedDocumentItem[] = [
        {
          id: 'drive-doc-file01',
          pointId: 'node.access',
          driveFileId: 'file01',
          originalFileName: '01_Keep.pdf',
          title: 'Keep',
          previewUrl: 'https://drive.google.com/file/d/file01/preview',
          viewUrl: 'https://drive.google.com/file/d/file01/view',
          orderIndex: 0,
        },
        {
          id: 'drive-doc-file02',
          pointId: 'node.access',
          driveFileId: 'file02',
          originalFileName: '02_Remove.pdf',
          title: 'Remove',
          previewUrl: 'https://drive.google.com/file/d/file02/preview',
          viewUrl: 'https://drive.google.com/file/d/file02/view',
          orderIndex: 1,
        },
      ];

      const incoming: DriveDocumentFile[] = [makeDriveFile('file01', '01_Keep.pdf')];
      const result = reconcileDriveDocuments(existing, incoming, 'node.access');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].driveFileId).toBe('file01');
      expect(result.stats).toEqual({
        added: 0,
        removed: 1,
        retained: 1,
        total: 1,
        hasChanged: true,
      });
    });

    it('yields hasChanged: false when re-syncing identical 3 files', () => {
      const incoming: DriveDocumentFile[] = [
        makeDriveFile('f1', '01_A.pdf'),
        makeDriveFile('f2', '02_B.pdf'),
        makeDriveFile('f3', '03_C.pdf'),
      ];
      const first = reconcileDriveDocuments([], incoming, 'node.access');
      const second = reconcileDriveDocuments(first.items, incoming, 'node.access');

      expect(second.stats).toEqual({
        added: 0,
        removed: 0,
        retained: 3,
        total: 3,
        hasChanged: false,
      });
    });
  });

  describe('fetchDriveFolderPdfs', () => {
    it('filters strictly for PDFs and ignores images in the same folder', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            { id: 'pdf1', name: '01_Report.pdf', mimeType: 'application/pdf' },
            { id: 'img1', name: '02_Photo.jpg', mimeType: 'image/jpeg' },
            { id: 'img2', name: '03_Scan.png', mimeType: 'image/png' },
            { id: 'pdf2', name: '04_FallbackExt.PDF', mimeType: 'application/octet-stream' },
          ],
        }),
      } as unknown as Response);

      const files = await fetchDriveFolderPdfs(
        'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz?resourcekey=0-key123'
      );

      expect(files.map((f) => f.id)).toEqual(['pdf1', 'pdf2']);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toContain('supportsAllDrives=true');
      expect((init as RequestInit).headers).toMatchObject({
        'X-Goog-Drive-Resource-Keys': '1AbCdEfGhIjKlMnOpQrStUvWxYz/0-key123',
      });
    });

    it('scans 1st-level subfolders and aggregates PDFs', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: [
              { id: 'pdf-root', name: '01_Root.pdf', mimeType: 'application/pdf' },
              {
                id: 'sub-folder-1',
                name: 'Annexes',
                mimeType: 'application/vnd.google-apps.folder',
              },
            ],
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: [
              { id: 'pdf-sub', name: '02_Annex.pdf', mimeType: 'application/pdf' },
              { id: 'img-sub', name: '03_Ignore.jpg', mimeType: 'image/jpeg' },
            ],
          }),
        } as unknown as Response);

      const files = await fetchDriveFolderPdfs('1AbCdEfGhIjKlMnOpQrStUvWxYz');
      expect(files.map((f) => f.id)).toEqual(['pdf-root', 'pdf-sub']);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('surfaces clear diagnostic errors on HTTP 404, 403 restricted, and 403 referrer block', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: { message: 'File not found' } }),
      } as unknown as Response);

      await expect(fetchDriveFolderPdfs('1AbCdEfGhIjKlMnOpQrStUvWxYz')).rejects.toThrow(
        /HTTP 404/
      );

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          error: {
            message: 'Requests from referer https://example.com are blocked.',
            errors: [{ reason: 'API_KEY_HTTP_REFERRER_BLOCKED' }],
          },
        }),
      } as unknown as Response);

      await expect(fetchDriveFolderPdfs('1AbCdEfGhIjKlMnOpQrStUvWxYz')).rejects.toThrow(
        /Referrer Block/
      );

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: { message: 'Insufficient permissions' } }),
      } as unknown as Response);

      await expect(fetchDriveFolderPdfs('1AbCdEfGhIjKlMnOpQrStUvWxYz')).rejects.toThrow(
        /Anyone with the link can view/
      );
    });
  });

  describe('syncFolderDocuments', () => {
    it('fetches, reconciles, and returns items, stats, and lastVerified', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: 'pdf1', name: '01_Charter.pdf', mimeType: 'application/pdf' }],
        }),
      } as unknown as Response);

      const res = await syncFolderDocuments(
        'node.access',
        'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz',
        []
      );

      expect(res.items).toHaveLength(1);
      expect(res.items[0].title).toBe('Charter');
      expect(res.stats.added).toBe(1);
      expect(res.lastVerified).toBeTruthy();
    });
  });

  describe('useDriveDocumentSync hook', () => {
    function HookHarness({
      nodeId,
      options,
      onResult,
    }: {
      nodeId: string;
      options?: UseDriveDocumentSyncOptions;
      onResult: (res: UseDriveDocumentSyncResult) => void;
    }) {
      const result = useDriveDocumentSync(nodeId, options);
      onResult(result);
      return null;
    }

    it('transitions through never_synced -> syncing -> synced_success and invokes onPersistDocuments', async () => {
      let resolveFetch!: (value: Response) => void;
      globalThis.fetch = vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      );

      let latest!: UseDriveDocumentSyncResult;
      const persistedDocs: SyncedDocumentItem[][] = [];
      let currentDocs: SyncedDocumentItem[] | undefined = undefined;

      const onPersistDocuments = vi.fn(async (docs: SyncedDocumentItem[]) => {
        persistedDocs.push(docs);
        currentDocs = docs;
        return { ok: true };
      });

      const { rerender } = render(
        React.createElement(HookHarness, {
          nodeId: 'node.access',
          options: {
            folderUrl: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz',
            syncedDocuments: currentDocs,
            autoSync: false,
            onPersistDocuments,
          },
          onResult: (r: UseDriveDocumentSyncResult) => {
            latest = r;
          },
        })
      );

      expect(latest.syncState).toBe('never_synced');
      expect(latest.hasSynced).toBe(false);

      let syncPromise!: Promise<unknown>;
      act(() => {
        syncPromise = latest.syncDocuments();
      });

      expect(latest.syncState).toBe('syncing');
      expect(latest.isSyncing).toBe(true);

      await act(async () => {
        resolveFetch({
          ok: true,
          json: async () => ({
            files: [{ id: 'pdf1', name: '01_Memo.pdf', mimeType: 'application/pdf' }],
          }),
        } as unknown as Response);
        await syncPromise;
      });

      expect(onPersistDocuments).toHaveBeenCalledTimes(1);
      expect(persistedDocs[0]).toHaveLength(1);

      rerender(
        React.createElement(HookHarness, {
          nodeId: 'node.access',
          options: {
            folderUrl: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz',
            syncedDocuments: currentDocs,
            autoSync: false,
            onPersistDocuments,
          },
          onResult: (r: UseDriveDocumentSyncResult) => {
            latest = r;
          },
        })
      );

      expect(latest.syncState).toBe('synced_success');
      expect(latest.hasSynced).toBe(true);
      expect(latest.syncedDocuments).toHaveLength(1);
    });

    it('transitions to synced_empty when folder has zero PDFs and sync_error on API failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      } as unknown as Response);

      let latest!: UseDriveDocumentSyncResult;
      let currentDocs: SyncedDocumentItem[] | undefined = undefined;

      const { rerender } = render(
        React.createElement(HookHarness, {
          nodeId: 'node.access',
          options: {
            folderUrl: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz',
            syncedDocuments: currentDocs,
            autoSync: false,
            onPersistDocuments: (docs) => {
              currentDocs = docs;
            },
          },
          onResult: (r: UseDriveDocumentSyncResult) => {
            latest = r;
          },
        })
      );

      await act(async () => {
        await latest.syncDocuments();
      });

      rerender(
        React.createElement(HookHarness, {
          nodeId: 'node.access',
          options: {
            folderUrl: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz',
            syncedDocuments: currentDocs,
            autoSync: false,
          },
          onResult: (r: UseDriveDocumentSyncResult) => {
            latest = r;
          },
        })
      );

      expect(latest.syncState).toBe('synced_empty');

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: { message: 'Missing' } }),
      } as unknown as Response);

      await act(async () => {
        await expect(latest.syncDocuments()).rejects.toThrow(/HTTP 404/);
      });

      expect(latest.syncState).toBe('sync_error');
      expect(latest.error).toMatch(/HTTP 404/);
    });
  });
});
