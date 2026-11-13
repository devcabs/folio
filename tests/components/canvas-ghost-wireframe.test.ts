import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { CanvasGhostWireframe } from '../../src/components/canvas/CanvasGhostWireframe';
import { DocumentCanvas } from '../../src/components/canvas/DocumentCanvas';
import { NodeCanvas } from '../../src/components/canvas/NodeCanvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as nodeCanvasHook from '../../src/hooks/useNodeCanvas';
import type { NodeCanvasDocument } from '../../src/types/canvas';

describe('Subtask 2.8: Cold Boot Skeleton Wireframe (Zero Flash-of-Baseline)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CanvasGhostWireframe Component', () => {
    it('renders with accessibility attributes aria-busy="true" and aria-label="Loading node content"', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(CanvasGhostWireframe, { nodeId: 'access' })
      );

      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading node content"');
      expect(html).toContain('data-testid="canvas-ghost-wireframe"');
    });

    it('renders editorial skeleton structures: title bar, 3-line paragraph block, and 16:9 photo box', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(CanvasGhostWireframe, { nodeId: 'equity', className: 'custom-wireframe-class' })
      );

      expect(html).toContain('custom-wireframe-class');
      expect(html).toContain('data-skeleton-part="section-title"');
      expect(html).toContain('data-skeleton-part="paragraph"');
      expect(html).toContain('data-skeleton-part="paragraph-line-1"');
      expect(html).toContain('data-skeleton-part="paragraph-line-2"');
      expect(html).toContain('data-skeleton-part="paragraph-line-3"');
      expect(html).toContain('data-skeleton-part="photo-box"');
    });

    it('contains zero hardcoded hex colors or inline style background colors', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(CanvasGhostWireframe, { nodeId: 'quality' })
      );

      // Verify no hardcoded hex color codes (#xxx or #xxxxxx) in output
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    });
  });

  describe('DocumentCanvas & NodeCanvas Zero-Flash Cold Boot Integration', () => {
    const emptyDocument: NodeCanvasDocument = {
      nodeId: 'access',
      version: 2,
      sections: [],
      updatedAt: '2026-11-13T00:00:00.000Z',
    };

    const populatedDocument: NodeCanvasDocument = {
      nodeId: 'access',
      version: 2,
      sections: [
        {
          id: 'sec-1',
          type: 'section',
          title: 'Hydrated Operational Roadmap',
          number: '01',
          elements: [
            {
              id: 'text-1',
              type: 'text',
              pointId: 'node.access.text-1',
              content: 'Real edge content loaded successfully.',
            },
          ],
        },
      ],
      updatedAt: '2026-11-13T00:00:01.000Z',
    };

    it('renders CanvasGhostWireframe when isDevMode is false and isHydrating is true with no cached sections', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
        canUnlock: true,
        isUnlocked: false,
        toggleDevMode: vi.fn(),
        unlockWithPin: vi.fn(),
      } as any);

      vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue({
        document: emptyDocument,
        isPending: false,
        isHydrating: true,
        addSection: vi.fn(),
        addSubsection: vi.fn(),
        addElement: vi.fn(),
        restoreSection: vi.fn(),
        restoreSubsection: vi.fn(),
        restoreElement: vi.fn(),
        moveItem: vi.fn(),
        relocateItem: vi.fn(),
        removeItem: vi.fn(),
        updateItem: vi.fn(),
        resetToDefault: vi.fn(),
        deployToCloud: vi.fn(),
        saveError: null,
        clearSaveError: vi.fn(),
      });

      const html = ReactDOMServer.renderToString(
        React.createElement(DocumentCanvas, { nodeId: 'access', nodeTitle: 'Access' })
      );

      expect(html).toContain('data-testid="canvas-ghost-wireframe"');
      expect(html).toContain('aria-busy="true"');
      expect(html).not.toContain('Starter Bar');
      expect(html).not.toContain('starter-bar');
    });

    it('does NOT render CanvasGhostWireframe in Developer Mode even if empty', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: true,
        isDesktop: true,
        canUnlock: true,
        isUnlocked: true,
        toggleDevMode: vi.fn(),
        unlockWithPin: vi.fn(),
      } as any);

      vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue({
        document: emptyDocument,
        isPending: false,
        isHydrating: false,
        addSection: vi.fn(),
        addSubsection: vi.fn(),
        addElement: vi.fn(),
        restoreSection: vi.fn(),
        restoreSubsection: vi.fn(),
        restoreElement: vi.fn(),
        moveItem: vi.fn(),
        relocateItem: vi.fn(),
        removeItem: vi.fn(),
        updateItem: vi.fn(),
        resetToDefault: vi.fn(),
        deployToCloud: vi.fn(),
        saveError: null,
        clearSaveError: vi.fn(),
      });

      const html = ReactDOMServer.renderToString(
        React.createElement(DocumentCanvas, { nodeId: 'access', nodeTitle: 'Access' })
      );

      expect(html).not.toContain('data-testid="canvas-ghost-wireframe"');
      // In dev authoring mode with 0 sections, the starter add bar is rendered
      expect(html).toContain('Click to add the first Section');
    });

    it('renders real content once hydration completes (isHydrating = false)', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
        canUnlock: true,
        isUnlocked: false,
        toggleDevMode: vi.fn(),
        unlockWithPin: vi.fn(),
      } as any);

      vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue({
        document: populatedDocument,
        isPending: false,
        isHydrating: false,
        addSection: vi.fn(),
        addSubsection: vi.fn(),
        addElement: vi.fn(),
        restoreSection: vi.fn(),
        restoreSubsection: vi.fn(),
        restoreElement: vi.fn(),
        moveItem: vi.fn(),
        relocateItem: vi.fn(),
        removeItem: vi.fn(),
        updateItem: vi.fn(),
        resetToDefault: vi.fn(),
        deployToCloud: vi.fn(),
        saveError: null,
        clearSaveError: vi.fn(),
      });

      const html = ReactDOMServer.renderToString(
        React.createElement(DocumentCanvas, { nodeId: 'access', nodeTitle: 'Access' })
      );

      expect(html).not.toContain('data-testid="canvas-ghost-wireframe"');
      expect(html).toContain('Hydrated Operational Roadmap');
      expect(html).toContain('Real edge content loaded successfully.');
    });

    it('NodeCanvas export behaves identically as DocumentCanvas', () => {
      expect(NodeCanvas).toBe(DocumentCanvas);
    });
  });
});
