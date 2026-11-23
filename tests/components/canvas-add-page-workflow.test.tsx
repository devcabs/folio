import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { CanvasAddBar } from '../../src/components/canvas/CanvasAddBar';
import { UniversalEditModal } from '../../src/components/dev/UniversalEditModal';
import { DocumentCanvas } from '../../src/components/canvas/DocumentCanvas';
import { CanvasPageLink } from '../../src/components/canvas/CanvasPageLink';
import { Breadcrumb } from '../../src/components/ui/Breadcrumb';
import { AppHeader } from '../../src/components/layout/AppHeader';
import { PortalChromeProvider, usePortalChrome } from '../../src/context/PortalChromeContext';
import { UndoRedoProvider } from '../../src/context/UndoRedoContext';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as nodeCanvasHook from '../../src/hooks/useDocumentCanvas';
import { undoRedoService } from '../../src/services/undoRedoService';
import { getAncestorChain, buildTwoLevelNavTree } from '../../src/services/pageTreeService';
import * as engineConfig from '../../src/config/engine.config';
import type { NodeCanvasDocument } from '../../src/types/canvas';
import type { PageRegistry } from '../../src/types/page';

const findDescendant = (root: any, predicate: (node: any) => boolean): any => {
  if (!root || !Array.isArray(root.childNodes)) return null;
  for (const child of root.childNodes) {
    if (predicate(child)) return child;
    const found = findDescendant(child, predicate);
    if (found) return found;
  }
  return null;
};

const setInputValue = (el: HTMLInputElement, nextValue: string) => {
  el.value = nextValue;
  el.setAttribute('value', nextValue);
  const propsKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  const reactProps = propsKey ? (el as any)[propsKey] : null;
  act(() => {
    reactProps?.onChange?.({ target: { value: nextValue }, currentTarget: { value: nextValue } });
  });
};

const stubAddButtonsRect = () => {
  for (const btn of screen.getAllByRole('button', { name: /add element/i })) {
    (btn as any).getBoundingClientRect = () => ({
      top: 100,
      bottom: 132,
      left: 0,
      right: 100,
      width: 100,
      height: 32,
    });
  }
};

describe('13.13 CanvasAddBar Add Page & Canonical Page Metadata Modal', () => {
  beforeEach(() => {
    undoRedoService.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    undoRedoService.clear();
  });

  const createDevModeStub = (showToast = vi.fn()) => ({
    isDevMode: true,
    isDesktop: true,
    canUnlock: true,
    isUnlocked: true,
    authToken: 'test-token',
    lockToken: 'test-lock-token',
    toggleDevMode: vi.fn(),
    unlockWithPin: vi.fn(),
    lockDevMode: vi.fn(),
    setHasUnpublishedChanges: vi.fn(),
    showToast,
  });

  const existingPages: PageRegistry = {
    'page-existing': {
      id: 'page-existing',
      parentId: 'access',
      slug: 'research-notes',
      title: 'Research Notes',
      summary: 'Initial field summary',
      order: 0,
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
    },
    'page-other-parent': {
      id: 'page-other-parent',
      parentId: 'quality',
      slug: 'other-branch-only',
      title: 'Other Branch Only',
      order: 0,
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
    },
  };

  it('1. CanvasAddBar renders "Page" menuitem with PageIcon and calls onAddElement("page-link") on click', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub() as any
    );
    const onAddElement = vi.fn();

    render(<CanvasAddBar onAddElement={onAddElement} />);
    stubAddButtonsRect();

    fireEvent.click(screen.getByRole('button', { name: /add element/i }));
    const pageMenuItem = screen.getByRole('menuitem', { name: 'Page' });
    expect(pageMenuItem).toBeTruthy();
    expect(
      Boolean(findDescendant(pageMenuItem, (n) => n?.tagName?.toLowerCase() === 'svg'))
    ).toBe(true);

    fireEvent.click(pageMenuItem);
    expect(onAddElement).toHaveBeenCalledWith('page-link');
  });

  it('2. Auto-Slug & Live Preview: typing "2026 Field Research!" auto-fills URL Name "2026-field-research" and renders monospace path preview', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub() as any
    );

    render(
      <UniversalEditModal
        isOpen
        mode="add"
        elementType="page-link"
        nodeId="access"
        parentPageId="access"
        parentPagePath="/node/access"
        existingPages={existingPages}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const titleInput = document.getElementById('canvas-page-title') as HTMLInputElement;
    expect(titleInput).toBeTruthy();
    expect(document.getElementById('canvas-page-slug')).toBeNull();
    expect(document.getElementById('canvas-page-summary')).toBeNull();
    expect(document.getElementById('canvas-page-cover')).toBeNull();

    setInputValue(titleInput, '2026 Field Research!');

    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    const slugInput = document.getElementById('canvas-page-slug') as HTMLInputElement;
    expect(slugInput).toBeTruthy();
    expect(slugInput.value).toBe('2026-field-research');
    expect(document.getElementById('canvas-page-slug-hint')?.textContent).toContain(
      '/node/access/2026-field-research/'
    );
  });

  it('3. Sibling Collision Validation: duplicate sibling slug shows role="alert" and disables "Add Page"; slug under another parent is accepted', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub() as any
    );

    render(
      <UniversalEditModal
        isOpen
        mode="add"
        elementType="page-link"
        nodeId="access"
        parentPageId="access"
        parentPagePath="/node/access"
        existingPages={existingPages}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const titleInput = document.getElementById('canvas-page-title') as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: 'Add Page' }) as HTMLButtonElement;

    setInputValue(titleInput, 'My Notes');
    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    const slugInput = document.getElementById('canvas-page-slug') as HTMLInputElement;
    setInputValue(slugInput, 'research-notes');

    expect(screen.getByRole('alert').textContent).toMatch(/already uses "research-notes"/i);
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    // Slug used only under a different parent ('quality') must be accepted under 'access'
    setInputValue(slugInput, 'other-branch-only');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(submitBtn.hasAttribute('disabled')).toBe(false);
  });

  it('4. <= 15-Word Summary Limit: 16 words shows inline error and disables submit; trimming to 15 words enables submit', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub() as any
    );

    render(
      <UniversalEditModal
        isOpen
        mode="add"
        elementType="page-link"
        nodeId="access"
        parentPageId="access"
        parentPagePath="/node/access"
        existingPages={existingPages}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const titleInput = document.getElementById('canvas-page-title') as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: 'Add Page' }) as HTMLButtonElement;

    setInputValue(titleInput, 'Valid Title');
    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    const summaryInput = document.getElementById('canvas-page-summary') as HTMLInputElement;
    const sixteenWords = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen';
    setInputValue(summaryInput, sixteenWords);

    expect(screen.getByRole('alert').textContent).toMatch(/15 words or fewer/i);
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    const fifteenWords = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen';
    setInputValue(summaryInput, fifteenWords);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(submitBtn.hasAttribute('disabled')).toBe(false);
  });

  it('5. Atomic Creation & Undo: Add Page executes single PUT /api/draft (canvases + pages) and undo() sends deletedPageIds + restores parent canvas', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub() as any
    );

    const parentDoc: NodeCanvasDocument = {
      nodeId: 'access',
      version: 3,
      updatedAt: '2026-11-18T00:00:00.000Z',
      elements: [
        {
          id: 'sec-1',
          type: 'section',
          title: 'Overview',
          number: '01',
          isNumbered: true,
        },
      ],
    };

    const putPayloads: any[] = [];
    let currentPagesState: PageRegistry = { ...existingPages };
    let currentCanvasesState: Record<string, NodeCanvasDocument> = { access: parentDoc };

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.includes('/api/draft') && method === 'GET') {
          return new Response(
            JSON.stringify({
              status: 'ok',
              contentOverrides: {},
              canvases: currentCanvasesState,
              pages: currentPagesState,
              updatedAt: '2026-11-18T00:00:00.000Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/api/draft') && method === 'PUT') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          putPayloads.push(body);
          if (body.pages) currentPagesState = body.pages;
          if (body.canvases) {
            currentCanvasesState = { ...currentCanvasesState, ...body.canvases };
          }
          if (Array.isArray(body.deletedPageIds)) {
            for (const delId of body.deletedPageIds) {
              delete currentCanvasesState[delId];
            }
          }
          return new Response(
            JSON.stringify({
              status: 'ok',
              contentOverrides: {},
              canvases: currentCanvasesState,
              pages: currentPagesState,
              updatedAt: '2026-11-19T00:00:00.000Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      })
    );

    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue({
      document: parentDoc,
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
      fetchError: null,
      retryFetch: vi.fn(),
    });

    const HydrationProbe: React.FC = () => {
      const chrome = usePortalChrome();
      return chrome?.hasHydrated ? <span data-testid="chrome-hydrated">ready</span> : null;
    };

    render(
      <UndoRedoProvider>
        <PortalChromeProvider isDevModeOverride lockTokenOverride="test-lock-token">
          <HydrationProbe />
          <DocumentCanvas nodeId="access" nodeTitle="Access" />
        </PortalChromeProvider>
      </UndoRedoProvider>
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId('chrome-hydrated')).toBeTruthy();
      expect(screen.getAllByRole('button', { name: /add element/i }).length).toBeGreaterThan(0);
    });
    stubAddButtonsRect();

    fireEvent.click(screen.getAllByRole('button', { name: /add element/i })[1]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Page' }));

    const titleInput = document.getElementById('canvas-page-title') as HTMLInputElement;
    setInputValue(titleInput, '2026 Field Research');
    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    const summaryInput = document.getElementById('canvas-page-summary') as HTMLInputElement;
    setInputValue(summaryInput, 'Field survey findings');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Page' }));
    });

    await vi.waitFor(() => {
      expect(putPayloads.length).toBe(1);
    });

    const createPayload = putPayloads[0];
    const createdPageIds = Object.keys(createPayload.pages).filter((id) => !(id in existingPages));
    expect(createdPageIds).toHaveLength(1);
    const newPageId = createdPageIds[0];

    expect(createPayload.pages[newPageId]).toMatchObject({
      id: newPageId,
      parentId: 'access',
      slug: '2026-field-research',
      title: '2026 Field Research',
      summary: 'Field survey findings',
    });
    expect(createPayload.canvases[newPageId]).toBeDefined();
    expect(createPayload.canvases[newPageId].nodeId).toBe(newPageId);
    expect(createPayload.canvases[newPageId].elements).toEqual([]);
    expect(
      createPayload.canvases.access.elements.some(
        (el: any) => el.type === 'page-link' && el.targetPageId === newPageId
      )
    ).toBe(true);

    // Undo should delete the created page and restore parent canvas & pages
    await act(async () => {
      await undoRedoService.popUndoAsync();
    });

    await vi.waitFor(() => {
      expect(putPayloads.length).toBe(2);
    });
    const undoPayload = putPayloads[1];
    expect(undoPayload.deletedPageIds).toEqual([newPageId]);
    expect(undoPayload.pages).toEqual(existingPages);
    expect(undoPayload.canvases.access.elements).toHaveLength(1);
  });

  it('6. Card Edit Single Authority: editing title/slug/summary from Page Link card updates draft.pages atomically and reflects on CanvasPageLink, Breadcrumb, and AppHeader', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub() as any
    );
    vi.spyOn(engineConfig, 'getActiveNodes').mockReturnValue([
      {
        id: 'access',
        code: 'A' as any,
        title: 'Access',
        subtitle: '',
        description: '',
        accentColor: 'var(--color-node-1)',
        order: 0,
      } as any,
    ]);

    const pageLinkLeaf = {
      id: 'link-1',
      type: 'page-link' as const,
      pointId: 'node.access.page-link.link-1',
      targetPageId: 'page-existing',
    };

    const parentDoc: NodeCanvasDocument = {
      nodeId: 'access',
      version: 3,
      updatedAt: '2026-11-18T00:00:00.000Z',
      elements: [
        {
          id: 'sec-1',
          type: 'section',
          title: 'Overview',
          number: '01',
          isNumbered: true,
        },
        pageLinkLeaf,
      ],
    };

    let currentPagesState: PageRegistry = { ...existingPages };
    const putPayloads: any[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.includes('/api/draft') && method === 'GET') {
          return new Response(
            JSON.stringify({
              status: 'ok',
              contentOverrides: {},
              canvases: { access: parentDoc },
              pages: currentPagesState,
              updatedAt: '2026-11-18T00:00:00.000Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/api/draft') && method === 'PUT') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          putPayloads.push(body);
          if (body.pages) currentPagesState = body.pages;
          return new Response(
            JSON.stringify({
              status: 'ok',
              contentOverrides: {},
              canvases: { access: parentDoc },
              pages: currentPagesState,
              updatedAt: '2026-11-19T00:00:00.000Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      })
    );

    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue({
      document: parentDoc,
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
      fetchError: null,
      retryFetch: vi.fn(),
    });

    const LiveChromeHarness: React.FC = () => {
      const chrome = usePortalChrome();
      const pages = chrome?.pages ?? {};
      const rootNodes = engineConfig.getActiveNodes();
      const chain = getAncestorChain('page-existing', rootNodes, pages);
      const breadcrumbItems = chain.ancestors.map((a, i) => ({
        id: a.id,
        label: a.title,
        href: a.path,
        isCurrent: i === chain.ancestors.length - 1,
      }));
      const navItems = buildTwoLevelNavTree(rootNodes, pages);
      return (
        <>
          <AppHeader navItems={navItems} />
          <Breadcrumb items={breadcrumbItems} />
          <DocumentCanvas nodeId="access" nodeTitle="Access" />
          <div data-testid="standalone-card">
            <CanvasPageLink element={pageLinkLeaf} nodeId="access" />
          </div>
        </>
      );
    };

    render(
      <UndoRedoProvider>
        <PortalChromeProvider isDevModeOverride lockTokenOverride="test-lock-token">
          <LiveChromeHarness />
        </PortalChromeProvider>
      </UndoRedoProvider>
    );

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Research Notes');
    });

    const editTrigger = screen.getByRole('button', { name: /✎ Edit/i });
    expect(editTrigger).toBeTruthy();
    fireEvent.click(editTrigger);

    const titleInput = document.getElementById('canvas-page-title') as HTMLInputElement;
    expect(titleInput.value).toBe('Research Notes');
    setInputValue(titleInput, 'Updated Field Notes');

    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    const slugInput = document.getElementById('canvas-page-slug') as HTMLInputElement;
    const summaryInput = document.getElementById('canvas-page-summary') as HTMLInputElement;
    expect(slugInput.value).toBe('research-notes');

    setInputValue(slugInput, 'updated-field-notes');
    setInputValue(summaryInput, 'Revised concise summary');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    });

    await vi.waitFor(() => {
      expect(putPayloads.length).toBe(1);
    });

    expect(putPayloads[0].pages['page-existing']).toMatchObject({
      title: 'Updated Field Notes',
      slug: 'updated-field-notes',
      summary: 'Revised concise summary',
    });

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Updated Field Notes');
      expect(screen.getByText('Revised concise summary')).toBeTruthy();
    });

    const standaloneCard = screen.getByTestId('standalone-card');
    const standaloneLink = findDescendant(
      standaloneCard,
      (n) => n?.tagName?.toLowerCase() === 'a'
    ) as HTMLAnchorElement;
    expect(standaloneLink).toBeTruthy();
    expect(standaloneLink.getAttribute('href')).toContain('/node/access/updated-field-notes/');
  });

  it('7. Fail-Stop Error Handling: keeps modal open and calls showToast(..., "error") if PUT /api/draft fails', async () => {
    const showToast = vi.fn();
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(showToast) as any
    );

    render(
      <UniversalEditModal
        isOpen
        mode="add"
        elementType="page-link"
        nodeId="access"
        parentPageId="access"
        parentPagePath="/node/access"
        existingPages={existingPages}
        onClose={vi.fn()}
        onSubmit={async () => {
          throw new Error('Network failure saving draft');
        }}
      />
    );

    setInputValue(document.getElementById('canvas-page-title') as HTMLInputElement, 'Resilient Page');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Page' }));
    });

    await vi.waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Network failure saving draft', 'error');
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('8. Modal Focus Stability: typing in non-first fields does not yank focus back to the first field', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub() as any
    );

    render(
      <UniversalEditModal
        isOpen
        mode="add"
        elementType="page-link"
        nodeId="access"
        parentPageId="access"
        parentPagePath="/node/access"
        existingPages={existingPages}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const titleInput = document.getElementById('canvas-page-title') as HTMLInputElement;
    const focusTitleSpy = vi.spyOn(titleInput, 'focus');

    // Wait for initial open focus timer (50ms) to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 70));
    });
    focusTitleSpy.mockClear();

    // Switch to Advanced tab, focus summary, and type multiple characters
    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    const summaryInput = document.getElementById('canvas-page-summary') as HTMLInputElement;
    summaryInput.focus();
    setInputValue(summaryInput, 'a');
    setInputValue(summaryInput, 'ab');
    setInputValue(summaryInput, 'abc');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 70));
    });

    expect(focusTitleSpy).not.toHaveBeenCalled();
  });

  it('9. Refresh URL Name Button: resets URL name to sanitized Page Title barring sibling collisions', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub() as any
    );

    render(
      <UniversalEditModal
        isOpen
        mode="add"
        elementType="page-link"
        nodeId="access"
        parentPageId="access"
        parentPagePath="/node/access"
        existingPages={existingPages}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const titleInput = document.getElementById('canvas-page-title') as HTMLInputElement;
    setInputValue(titleInput, 'Research Notes');

    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    const slugInput = document.getElementById('canvas-page-slug') as HTMLInputElement;
    const resetBtn = screen.getByRole('button', {
      name: /reset url name from page title/i,
    }) as HTMLButtonElement;

    setInputValue(slugInput, 'custom-manual-slug');
    expect(slugInput.value).toBe('custom-manual-slug');

    fireEvent.click(resetBtn);
    expect(slugInput.value).toBe('research-notes-2');
  });

  describe('card size SegmentedControl in page-link modal', () => {
    it('shows card size control on General tab', async () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
        createDevModeStub() as any
      );

      render(
        <UniversalEditModal
          isOpen
          mode="add"
          elementType="page-link"
          nodeId="access"
          parentPageId="access"
          parentPagePath="/node/access"
          existingPages={existingPages}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      expect(screen.getByRole('group', { name: /card size/i })).toBeInTheDocument();
    });

    it('defaults card size to Medium', async () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
        createDevModeStub() as any
      );

      render(
        <UniversalEditModal
          isOpen
          mode="add"
          elementType="page-link"
          nodeId="access"
          parentPageId="access"
          parentPagePath="/node/access"
          existingPages={existingPages}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      expect(screen.getByRole('radio', { name: /medium/i })).toBeChecked();
    });

    it('persists sm cardSize in page-link element when saved', async () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
        createDevModeStub() as any
      );

      const onSubmit = vi.fn();

      render(
        <UniversalEditModal
          isOpen
          mode="add"
          elementType="page-link"
          nodeId="access"
          parentPageId="access"
          parentPagePath="/node/access"
          existingPages={existingPages}
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />
      );

      const titleInput = document.getElementById('canvas-page-title') as HTMLInputElement;
      setInputValue(titleInput, 'Compact Card Page');

      fireEvent.click(screen.getByRole('radio', { name: /small/i }));
      const submitBtn = screen.getByRole('button', { name: 'Add Page' }) as HTMLButtonElement;
      fireEvent.click(submitBtn);

      expect(onSubmit).toHaveBeenCalled();
      const submittedData = onSubmit.mock.calls[0][0];
      expect(submittedData.cardSize).toBe('sm');
    });
  });
});
