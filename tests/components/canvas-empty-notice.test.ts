import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { CanvasEmptyNotice } from '../../src/components/canvas/CanvasEmptyNotice';
import { DocumentCanvas } from '../../src/components/canvas/DocumentCanvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as nodeCanvasHook from '../../src/hooks/useNodeCanvas';
import type { NodeCanvasDocument } from '../../src/types/canvas';

describe('Subtask 3.4: Dignified Public Empty Canvas State', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CanvasEmptyNotice Component', () => {
    it('renders with semantic section, aria-label, and tabIndex="-1"', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(CanvasEmptyNotice, { nodeTitle: 'Resiliency' })
      );

      expect(html).toContain('data-testid="canvas-empty-notice"');
      expect(html).toContain('aria-label="Resiliency Documentation Notice"');
      expect(html).toContain('tabindex="-1"');
    });

    it('renders editorial typography: kicker, title, narrative description, and status badge', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(CanvasEmptyNotice, {
          nodeTitle: 'Governance',
          accentColor: '#0f766e',
          className: 'custom-notice-class',
        })
      );

      expect(html).toContain('custom-notice-class');
      expect(html).toContain('Governance Domain Documentation');
      expect(html).toContain('Initiatives in Preparation');
      expect(html).toContain('institutional coordinators are actively curating');
      expect(html).toContain('Status: Drafting in Progress');
    });

    it('renders ParametricShape with the passed accentColor or fallback', () => {
      const htmlWithAccent = ReactDOMServer.renderToString(
        React.createElement(CanvasEmptyNotice, {
          nodeTitle: 'Leadership',
          accentColor: 'rgb(15, 118, 110)',
        })
      );
      expect(htmlWithAccent).toContain('fill="rgb(15, 118, 110)"');

      const htmlDefault = ReactDOMServer.renderToString(
        React.createElement(CanvasEmptyNotice, { nodeTitle: 'Access' })
      );
      expect(htmlDefault).toContain('fill="var(--folio-primary)"');
    });
  });

  describe('DocumentCanvas Integration with CanvasEmptyNotice', () => {
    const emptyDocument: NodeCanvasDocument = {
      nodeId: 'governance',
      version: 1,
      sections: [],
      updatedAt: '2026-11-13T00:00:00.000Z',
    };

    const populatedDocument: NodeCanvasDocument = {
      nodeId: 'governance',
      version: 1,
      sections: [
        {
          id: 'sec-1',
          type: 'section',
          title: 'Foundations',
          number: '01',
          elements: [],
        },
      ],
      updatedAt: '2026-11-13T00:00:00.000Z',
    };

    it('renders CanvasEmptyNotice in public mode when hydrated with zero sections', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
        canUnlock: false,
        isUnlocked: false,
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
        React.createElement(DocumentCanvas, {
          nodeId: 'governance',
          nodeTitle: 'Governance',
          accentColor: 'var(--color-node-3)',
        })
      );

      // Verify CanvasEmptyNotice is rendered with nodeTitle & accentColor
      expect(html).toContain('data-testid="canvas-empty-notice"');
      expect(html).toContain('Governance Domain Documentation');
      expect(html).toContain('Initiatives in Preparation');
      expect(html).toContain('fill="var(--color-node-3)"');

      // Verify no edit controls or starter bar are rendered to the public
      expect(html).not.toContain('Click to add the first Section');
      expect(html).not.toContain('starter-bar');
      // Verify skeleton is NOT rendered when hydrated
      expect(html).not.toContain('data-testid="canvas-ghost-wireframe"');
    });

    it('renders CanvasGhostWireframe during cold boot hydration even if empty, NOT CanvasEmptyNotice', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
        canUnlock: false,
        isUnlocked: false,
        toggleDevMode: vi.fn(),
        unlockWithPin: vi.fn(),
      } as any);

      vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue({
        document: emptyDocument,
        isPending: false,
        isHydrating: true, // Still hydrating
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
        React.createElement(DocumentCanvas, {
          nodeId: 'governance',
          nodeTitle: 'Governance',
        })
      );

      expect(html).toContain('data-testid="canvas-ghost-wireframe"');
      expect(html).not.toContain('data-testid="canvas-empty-notice"');
    });

    it('does NOT render CanvasEmptyNotice in Developer Mode; renders Starter Bar instead', () => {
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
        React.createElement(DocumentCanvas, {
          nodeId: 'governance',
          nodeTitle: 'Governance',
        })
      );

      expect(html).not.toContain('data-testid="canvas-empty-notice"');
      expect(html).toContain('Click to add the first Section');
    });

    it('renders normal document sections when document is populated', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
        canUnlock: false,
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
        React.createElement(DocumentCanvas, {
          nodeId: 'governance',
          nodeTitle: 'Governance',
        })
      );

      expect(html).not.toContain('data-testid="canvas-empty-notice"');
      expect(html).toContain('Foundations');
    });
  });
});
