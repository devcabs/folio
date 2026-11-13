import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { CanvasGallery } from '../../src/components/canvas/CanvasGallery';
import type { GalleryElement } from '../../src/types/canvas';
import {
  resetSourceCache,
  upsertLiveSourceSource,
} from '../../src/services/sourceService';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';

describe('Decoupled Photo Gallery Architecture & Element-Level Ownership', () => {
  beforeEach(() => {
    resetSourceCache();
    vi.restoreAllMocks();
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: true,
      isDesktop: true,
      canUnlock: true,
      isUnlocked: true,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any);
  });

  afterEach(() => {
    resetSourceCache();
    vi.restoreAllMocks();
  });

  describe('1. Element-Level Ownership & Independence', () => {
    it('renders dedicated Google Drive folder attachment for element when driveUrl is provided in AST', async () => {
      const dedicatedElement: GalleryElement = {
        id: 'gal-alpha-101',
        type: 'gallery',
        pointId: 'node.access.gallery.gal-alpha-101',
        title: 'Alpha Evidence Showcase',
        driveUrl: 'https://drive.google.com/drive/folders/alpha-dedicated-folder-123',
      };

      const html = ReactDOMServer.renderToString(
        React.createElement(CanvasGallery, {
          element: dedicatedElement,
          nodeId: 'access',
        })
      );

      // Verify that the element's dedicated driveUrl is rendered in the folder link
      expect(html).toContain('alpha-dedicated-folder-123');
      expect(html).toContain('Alpha Evidence Showcase');
    });

    it('isolates multiple independent galleries on the same canvas', async () => {
      // Seed dedicated photos for Gallery A
      await upsertLiveSourceSource({
        pointId: 'node.access.gallery.gal-a',
        folderUrl: 'https://drive.google.com/drive/folders/folder-for-gallery-a',
        folderTitle: 'Gallery A Evidence',
        syncedPhotos: [
          {
            id: 'photo-gal-a-1',
            pointId: 'node.access.gallery.gal-a',
            driveFileId: 'df-a-1',
            originalFileName: 'site-a.jpg',
            title: 'Site A Inspection',
            isCustomTitle: false,
            orderIndex: 0,
            thumbnailUrl: 'https://thumb.a/1',
            fullImageUrl: 'https://full.a/1',
          },
        ],
      });

      // Seed dedicated photos for Gallery B
      await upsertLiveSourceSource({
        pointId: 'node.access.gallery.gal-b',
        folderUrl: 'https://drive.google.com/drive/folders/folder-for-gallery-b',
        folderTitle: 'Gallery B Evidence',
        syncedPhotos: [
          {
            id: 'photo-gal-b-1',
            pointId: 'node.access.gallery.gal-b',
            driveFileId: 'df-b-1',
            originalFileName: 'lab-b.jpg',
            title: 'Lab B Analysis',
            isCustomTitle: false,
            orderIndex: 0,
            thumbnailUrl: 'https://thumb.b/1',
            fullImageUrl: 'https://full.b/1',
          },
        ],
      });

      const elementA: GalleryElement = {
        id: 'gal-a',
        type: 'gallery',
        pointId: 'node.access.gallery.gal-a',
        title: 'Gallery A',
        driveUrl: 'https://drive.google.com/drive/folders/folder-for-gallery-a',
      };

      const elementB: GalleryElement = {
        id: 'gal-b',
        type: 'gallery',
        pointId: 'node.access.gallery.gal-b',
        title: 'Gallery B',
        driveUrl: 'https://drive.google.com/drive/folders/folder-for-gallery-b',
      };

      const htmlA = ReactDOMServer.renderToString(
        React.createElement(CanvasGallery, {
          element: elementA,
          nodeId: 'access',
        })
      );

      const htmlB = ReactDOMServer.renderToString(
        React.createElement(CanvasGallery, {
          element: elementB,
          nodeId: 'access',
        })
      );

      // Gallery A displays its own photos and folder, and does not contain Gallery B's content
      expect(htmlA).toContain('folder-for-gallery-a');
      expect(htmlA).toContain('Site A Inspection');
      expect(htmlA).not.toContain('folder-for-gallery-b');
      expect(htmlA).not.toContain('Lab B Analysis');

      // Gallery B displays its own photos and folder, and does not contain Gallery A's content
      expect(htmlB).toContain('folder-for-gallery-b');
      expect(htmlB).toContain('Lab B Analysis');
      expect(htmlB).not.toContain('folder-for-gallery-a');
      expect(htmlB).not.toContain('Site A Inspection');
    });
  });

  describe('2. AST Contract Alignment', () => {
    it('uses GalleryElement pointId and driveUrl from AST document model', () => {
      const astElement: GalleryElement = {
        id: 'custom-ast-id',
        type: 'gallery',
        pointId: 'node.research.gallery.custom-ast-id',
        title: 'Fieldwork Artifacts',
        driveUrl: 'https://drive.google.com/drive/folders/fieldwork-ast-folder',
      };

      const html = ReactDOMServer.renderToString(
        React.createElement(CanvasGallery, {
          element: astElement,
          nodeId: 'research',
        })
      );

      // Inspect that the AST contract driveUrl and title are rendered by CanvasGallery
      expect(html).toContain('fieldwork-ast-folder');
      expect(html).toContain('Fieldwork Artifacts');
    });
  });

  describe('3. Strict Failure & Isolation on Missing Configuration', () => {
    it('does NOT fall back to parent node photos or folder when gallery element has no dedicated folder', async () => {
      // 1. Setup parent node with legacy photo stream
      await upsertLiveSourceSource({
        pointId: 'access',
        folderUrl: 'https://drive.google.com/drive/folders/parent-legacy-folder',
        folderTitle: 'Parent Legacy Repository',
        syncedPhotos: [
          {
            id: 'legacy-p1',
            pointId: 'access',
            driveFileId: 'df-legacy-1',
            originalFileName: 'legacy1.jpg',
            title: 'Legacy Baseline Photo',
            isCustomTitle: false,
            orderIndex: 0,
            thumbnailUrl: 'https://thumb.legacy/1',
            fullImageUrl: 'https://full.legacy/1',
          },
        ],
      });

      // 2. Element without dedicated folderUrl or prior sync
      const unlinkedElement: GalleryElement = {
        id: 'unlinked-gal-0',
        type: 'gallery',
        pointId: 'node.access.gallery.unlinked-gal-0',
      };

      const html = ReactDOMServer.renderToString(
        React.createElement(CanvasGallery, {
          element: unlinkedElement,
          nodeId: 'access',
        })
      );

      // Must NOT display parent node's legacy folder or photos!
      expect(html).not.toContain('parent-legacy-folder');
      expect(html).not.toContain('Legacy Baseline Photo');
      expect(html).toContain('No Google Drive Folder Linked');
    });
  });
});
