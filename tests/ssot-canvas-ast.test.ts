import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ChartElement,
  GalleryElement,
  NodeCanvasDocument,
  SectionElement,
} from '../src/types/canvas';
import {
  NodeCanvasDocumentSchema,
  PublicNodePayloadSchema,
} from '../src/types/edge';
import { useDynamicCanvasSectionNumbers } from '../src/hooks/use-dynamic-section-numbers';
import { SectionTitle } from '../src/components/ui/SectionTitle';
import { useDocumentCanvas } from '../src/hooks/useDocumentCanvas';
import * as canvasLayoutService from '../src/services/canvasLayoutService';
import * as developerModeHook from '../src/hooks/useDeveloperMode';
import { UndoRedoProvider } from '../src/context/UndoRedoContext';
import { useUndoRedo } from '../src/hooks/useUndoRedo';
import { DocumentCanvas } from '../src/components/canvas/DocumentCanvas';
import type { DeveloperModeContextType } from '../src/types/developer';

function createDevContextValue(isDevMode: boolean, lockToken: string | null = 'tok-123'): DeveloperModeContextType {
  return {
    isDevMode,
    isAuthenticated: isDevMode,
    isDesktop: true,
    toggleDevMode: vi.fn(),
    enterDevMode: vi.fn(async () => true),
    exitDevMode: vi.fn(),
    isPublishModalOpen: false,
    openPublishModal: vi.fn(),
    closePublishModal: vi.fn(),
    isAuthModalOpen: false,
    openAuthModal: vi.fn(),
    closeAuthModal: vi.fn(),
    isDiscardModalOpen: false,
    openDiscardModal: vi.fn(),
    closeDiscardModal: vi.fn(),
    isHistoryModalOpen: false,
    openHistoryModal: vi.fn(),
    closeHistoryModal: vi.fn(),
    isDraftDirty: false,
    markDraftDirty: vi.fn(),
    clearDraftDirty: vi.fn(),
    lastSavedAt: null,
    lockStatus: 'unlocked',
    lockHolder: null,
    lockToken,
    lockError: null,
    acquireDevLock: vi.fn(async () => true),
    releaseDevLock: vi.fn(async () => {}),
    refreshLockStatus: vi.fn(async () => {}),
    sessionId: 'sess-1',
    isInitializingDraft: false,
    draftInitError: null,
  } as unknown as DeveloperModeContextType;
}

describe('Subtask 7.3: Self-Contained Document AST, Section Numbering & Undo SSOT', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('1. Self-Contained AST & PublicNodePayload Contracts', () => {
    it('validates ChartElement.config, ChartElement.dataset, and GalleryElement.syncedPhotos inside NodeCanvasDocumentSchema', () => {
      const chartEl: ChartElement = {
        id: 'el-chart-1',
        type: 'chart',
        chartId: 'chart-access-01',
        title: 'Enrollment Rate',
        subtitle: 'SY 2025-2026',
        config: {
          chartId: 'chart-access-01',
          nodeId: 'access',
          defaultType: 'bar',
          titleOverride: 'Enrollment Rate',
        },
        dataset: {
          chartId: 'chart-access-01',
          title: 'Enrollment Rate',
          asOfDate: '2026-01-01',
          chartType: 'bar',
          categories: ['2024', '2025'],
          series: [{ name: 'Total', data: [100, 120] }],
          sanitizedCsvContent: 'Year,Total\n2024,100\n2025,120',
        },
      };

      const galleryEl: GalleryElement = {
        id: 'el-gal-1',
        type: 'gallery',
        pointId: 'gal-access-01',
        title: 'Campus Photos',
        driveUrl: 'https://drive.google.com/drive/folders/abc123',
        description: 'Verified campus facilities',
        lastVerified: '2026-01-01T00:00:00.000Z',
        syncedPhotos: [
          {
            id: 'photo-1',
            driveFileId: 'file-1',
            originalFileName: 'campus.jpg',
            title: 'Campus Main',
            thumbnailUrl: '/api/media/drive/file-1?sz=w400',
            fullImageUrl: '/api/media/drive/file-1?sz=w1600',
            orderIndex: 0,
          },
        ],
      };

      const doc: NodeCanvasDocument = {
        nodeId: 'access',
        version: 3,
        updatedAt: '2026-01-01T00:00:00.000Z',
        elements: [
          {
            id: 'sec-1',
            type: 'section',
            title: 'Overview',
            isNumbered: true,
            number: '01',
          },
          chartEl,
          galleryEl,
        ],
      };

      const parsedDoc = NodeCanvasDocumentSchema.parse(doc);
      const parsedChart = parsedDoc.elements[1] as ChartElement;
      const parsedGallery = parsedDoc.elements[2] as GalleryElement;

      expect(parsedChart.config?.defaultType).toBe('bar');
      expect(parsedChart.dataset?.categories).toEqual(['2024', '2025']);
      expect(parsedGallery.syncedPhotos).toHaveLength(1);
      expect(parsedGallery.syncedPhotos?.[0].driveFileId).toBe('file-1');

      const payload = PublicNodePayloadSchema.parse({
        nodeId: 'access',
        snapshotId: 'snap-1',
        version: 2,
        updatedAt: '2026-01-01T00:00:00.000Z',
        canvas: doc,
      });

      expect('chartDatasets' in payload).toBe(false);
      expect('sourceMetadata' in payload).toBe(false);
    });
  });

  describe('2. Pure AST Section Numbering & SectionTitle (Zero ContentDB)', () => {
    it('useDynamicCanvasSectionNumbers computes numbers purely from SectionElement.isNumbered', () => {
      const sections: SectionElement[] = [
        { id: 's1', type: 'section', title: 'First', isNumbered: true },
        { id: 's2', type: 'section', title: 'Unnumbered', isNumbered: false },
        { id: 's3', type: 'section', title: 'Second', isNumbered: true },
      ];

      const { result } = renderHook(() => useDynamicCanvasSectionNumbers('access', sections));
      expect(result.current).toEqual({
        s1: '01',
        s2: null,
        s3: '02',
      });
    });

    it('SectionTitle renders title and number strictly from props without ContentDB', () => {
      render(
        React.createElement(SectionTitle, {
          title: 'AST Section Title',
          number: '03',
          defaultNumbered: true,
          titlePointId: 'node.access.section.s1.title',
        })
      );

      expect(screen.getByText('AST Section Title')).toBeTruthy();
      expect(screen.getByText('Section 03')).toBeTruthy();
    });

    it('section numbering hook and SectionTitle source files do not import ContentDB', () => {
      const hookSrc = fs.readFileSync(
        path.resolve(process.cwd(), 'src/hooks/use-dynamic-section-numbers.ts'),
        'utf-8'
      );
      const titleSrc = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/ui/SectionTitle.tsx'),
        'utf-8'
      );

      expect(hookSrc).not.toContain('getContent');
      expect(hookSrc).not.toContain('subscribeToContentChange');
      expect(titleSrc).not.toContain('useContent');
      expect(titleSrc).not.toContain('EditableText');
    });
  });

  describe('3. Stateless canvasLayoutService.ts (Zero localStorage / Supabase / Legacy Folding)', () => {
    it('removes legacy folding, localStorage, and Supabase deploy functions', () => {
      const svc = canvasLayoutService as Record<string, unknown>;
      expect(svc.migrateLegacyStorageKeys).toBeUndefined();
      expect(svc.foldCanvasOverridesIntoDocument).toBeUndefined();
      expect(svc.migrateCanvasOverridesIntoAst).toBeUndefined();
      expect(svc.getLiveNodeCanvas).toBeUndefined();
      expect(svc.saveLiveNodeCanvas).toBeUndefined();
      expect(svc.deployNodeCanvasToCloud).toBeUndefined();

      const src = fs.readFileSync(
        path.resolve(process.cwd(), 'src/services/canvasLayoutService.ts'),
        'utf-8'
      );
      expect(src).not.toContain('localStorage');
      expect(src).not.toContain('/rest/v1/node_canvas');
    });
  });

  describe('4. Direct KV Read/Write in useDocumentCanvas.ts (Fail-Stop)', () => {
    it('Public Mode fetches GET /api/public/node/:nodeId and sets fetchError on HTTP error', async () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
        createDevContextValue(false, null)
      );

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'KV unavailable' }),
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useDocumentCanvas('access'));

      await vi.waitFor(() => {
        expect(result.current.isHydrating).toBe(false);
        expect(result.current.fetchError).toContain('503');
      });
    });

    it('Dev Mode reads GET /api/draft, persists mutations via PUT /api/draft, and fails stop on KV write error', async () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
        createDevContextValue(true, 'tok-abc')
      );

      const initialDoc: NodeCanvasDocument = {
        nodeId: 'access',
        version: 3,
        updatedAt: '2026-01-01T00:00:00.000Z',
        elements: [
          {
            id: 'sec-existing',
            type: 'section',
            title: 'Existing KV Section',
            isNumbered: true,
            number: '01',
          },
        ],
      };

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            canvases: { access: initialDoc },
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => JSON.stringify({ error: 'KV write failed' }),
        });

      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const { result } = renderHook(() => useDocumentCanvas('access'));

      await vi.waitFor(() => {
        expect(result.current.document.elements).toHaveLength(1);
        expect((result.current.document.elements[0] as SectionElement).title).toBe('Existing KV Section');
      });

      act(() => {
        result.current.addSection();
      });

      await vi.waitFor(() => {
        expect(result.current.saveError).toContain('500');
        // Fail-stop: reverted to last persisted KV state
        expect(result.current.document.elements).toHaveLength(1);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/draft',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: 'Bearer tok-abc',
          }),
        })
      );
    });
  });

  describe('5. Unified Undo in DocumentCanvas.tsx', () => {
    it('clicking Undo on the deletion toast pops the action from useUndoRedo()', async () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
        createDevContextValue(true, 'tok-undo')
      );

      const initialDoc: NodeCanvasDocument = {
        nodeId: 'access',
        version: 3,
        updatedAt: '2026-01-01T00:00:00.000Z',
        elements: [
          {
            id: 'sec-1',
            type: 'section',
            title: 'Deletable Section',
            isNumbered: true,
            number: '01',
          },
        ],
      };

      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const body = JSON.parse(String(init.body || '{}'));
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              canvases: body.canvases,
              updatedAt: '2026-01-01T00:00:01.000Z',
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            canvases: { access: initialDoc },
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        };
      }) as unknown as typeof fetch;

      let undoRedoProbe: ReturnType<typeof useUndoRedo> | null = null;
      const Probe = () => {
        undoRedoProbe = useUndoRedo();
        return null;
      };

      render(
        React.createElement(
          UndoRedoProvider,
          null,
          React.createElement(Probe),
          React.createElement(DocumentCanvas, {
            nodeId: 'access',
            nodeTitle: 'Access',
          })
        )
      );

      await vi.waitFor(() => {
        expect(screen.getByText('Deletable Section')).toBeTruthy();
      });

      const deleteBtn = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(deleteBtn);

      await vi.waitFor(() => {
        expect(screen.getByText('Delete Section')).toBeTruthy();
      });

      const confirmDeleteBtns = screen.getAllByRole('button', { name: 'Delete' });
      fireEvent.click(confirmDeleteBtns[confirmDeleteBtns.length - 1]);

      await vi.waitFor(() => {
        expect(screen.queryByText('Deletable Section')).toBeNull();
        expect(undoRedoProbe?.canUndo).toBe(true);
      });

      const undoBtn = screen.getByRole('button', { name: 'Undo' });
      fireEvent.click(undoBtn);

      await vi.waitFor(() => {
        expect(screen.getByText('Deletable Section')).toBeTruthy();
        expect(undoRedoProbe?.canUndo).toBe(false);
      });
    });
  });
});
