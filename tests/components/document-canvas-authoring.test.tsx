import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DocumentCanvas } from '../../src/components/canvas/DocumentCanvas';
import { CanvasItemControls } from '../../src/components/canvas/CanvasItemControls';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as nodeCanvasHook from '../../src/hooks/useDocumentCanvas';
import type { NodeCanvasDocument, SubsectionElement, TextElement } from '../../src/types/canvas';

describe('9.1 Unconditional Post-Header Insertion Bar for Canvas Sections', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const createDevModeStub = (isDevMode: boolean) => ({
    isDevMode,
    isDesktop: true,
    canUnlock: isDevMode,
    isUnlocked: isDevMode,
    authToken: isDevMode ? 'test-token' : null,
    toggleDevMode: vi.fn(),
    unlockWithPin: vi.fn(),
    lockDevMode: vi.fn(),
    setHasUnpublishedChanges: vi.fn(),
    showToast: vi.fn(),
  });

  const createCanvasHookStub = (
    doc: NodeCanvasDocument,
    overrides: Partial<ReturnType<typeof nodeCanvasHook.useDocumentCanvas>> = {}
  ) => ({
    document: doc,
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
    ...overrides,
  });

  const existingTextLeaf: TextElement = {
    id: 'leaf-text-existing',
    type: 'text',
    pointId: 'node.access.text.leaf-text-existing',
    content: 'Existing first paragraph in section.',
    as: 'p',
  };

  const populatedDocument: NodeCanvasDocument = {
    nodeId: 'access',
    version: 3,
    updatedAt: '2026-11-18T00:00:00.000Z',
    elements: [
      {
        id: 'sec-1',
        type: 'section',
        title: 'Foundations',
        number: '01',
        isNumbered: true,
      },
      existingTextLeaf,
    ],
  };

  const emptySectionDocument: NodeCanvasDocument = {
    nodeId: 'access',
    version: 3,
    updatedAt: '2026-11-18T00:00:00.000Z',
    elements: [
      {
        id: 'sec-empty',
        type: 'section',
        title: 'Empty Section',
        number: '01',
        isNumbered: true,
      },
    ],
  };

  it('renders a post-header CanvasAddBar immediately after section header in Dev Mode even when section has children', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(true) as any
    );
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(populatedDocument)
    );

    const { container } = render(
      <DocumentCanvas nodeId="access" nodeTitle="Access" />
    );

    const sectionHeading = screen.getByRole('heading', { name: /Foundations/i });
    const existingTextNode = screen.getByText('Existing first paragraph in section.');
    const insertRegions = screen.getAllByRole('region', { name: 'Insert element' });

    // 1 before section (canvas-top), 1 post-header (sec-top-sec-1), 1 after existingTextLeaf
    expect(insertRegions).toHaveLength(3);

    // Verify DOM order: heading -> post-header add bar -> existing child element -> trailing add bar
    const ordered: any[] = [];
    const walk = (node: any) => {
      ordered.push(node);
      for (const child of node.childNodes || []) {
        walk(child);
      }
    };
    walk(container);

    const headingIdx = ordered.indexOf(sectionHeading);
    const postHeaderIdx = ordered.indexOf(insertRegions[1]);
    const existingLeafIdx = ordered.indexOf(existingTextNode);

    expect(headingIdx).toBeGreaterThan(-1);
    expect(postHeaderIdx).toBeGreaterThan(headingIdx);
    expect(existingLeafIdx).toBeGreaterThan(postHeaderIdx);
    expect(container.querySelectorAll('h2')).toHaveLength(1);
  });

  it('renders post-header CanvasAddBar when section is empty in Dev Mode', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(true) as any
    );
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(emptySectionDocument)
    );

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    const insertRegions = screen.getAllByRole('region', { name: 'Insert element' });
    // 1 before section (canvas-top), 1 post-header (sec-top-sec-empty)
    expect(insertRegions).toHaveLength(2);
  });

  it('inserts a new element at index 0 of a populated section when triggered from the post-header CanvasAddBar', () => {
    const addElementSpy = vi.fn();
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(true) as any
    );
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(populatedDocument, { addElement: addElementSpy })
    );

    const { container } = render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    // index 0 = canvas-top, index 1 = sec-top-sec-1 (post-header), index 2 = after existingTextLeaf
    const addButtons = screen.getAllByRole('button', { name: /Add Element/i });
    expect(addButtons).toHaveLength(3);

    // Open palette on the post-header add bar
    (addButtons[1] as any).getBoundingClientRect = () => ({
      top: 100,
      bottom: 130,
      left: 0,
      right: 100,
      width: 100,
      height: 30,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    fireEvent.click(addButtons[1]);

    // Select Text element
    const textMenuItem = screen.getByRole('menuitem', { name: /Text/i });
    fireEvent.click(textMenuItem);

    // Fill the Add Text modal and submit
    const findFirstByTag = (root: any, tag: string): any => {
      if (!root) return null;
      if (String(root.tagName || '').toUpperCase() === tag) return root;
      for (const child of root.childNodes || []) {
        const found = findFirstByTag(child, tag);
        if (found) return found;
      }
      return null;
    };
    const textarea =
      findFirstByTag(container, 'TEXTAREA') || findFirstByTag(document.body, 'TEXTAREA');
    expect(textarea).toBeTruthy();
    textarea.value = 'New leading paragraph.';
    act(() => {
      textarea!.dispatchEvent({ type: 'input', bubbles: true });
    });
    fireEvent.change(textarea!, { target: { value: 'New leading paragraph.' } });

    const submitBtn = screen.getByRole('button', { name: /Add Text|Save|Create/i });
    fireEvent.click(submitBtn);

    expect(addElementSpy).toHaveBeenCalledTimes(1);
    expect(addElementSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'text',
      }),
      1
    );
  });

  it('renders zero CanvasAddBars in Public Mode (isDevMode === false) for both populated and empty sections', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(false) as any
    );
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(populatedDocument)
    );

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    expect(screen.queryByRole('region', { name: 'Insert element' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Add Element/i })).toBeNull();
  });
});

describe('9.2 Eliminate Subsection Ghost Hover Zone & Duplicate Insertion Bars', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const createDevModeStub = (isDevMode: boolean) => ({
    isDevMode,
    isDesktop: true,
    canUnlock: isDevMode,
    isUnlocked: isDevMode,
    authToken: isDevMode ? 'test-token' : null,
    toggleDevMode: vi.fn(),
    unlockWithPin: vi.fn(),
    lockDevMode: vi.fn(),
    setHasUnpublishedChanges: vi.fn(),
    showToast: vi.fn(),
  });

  const createCanvasHookStub = (
    doc: NodeCanvasDocument,
    overrides: Partial<ReturnType<typeof nodeCanvasHook.useDocumentCanvas>> = {}
  ) => ({
    document: doc,
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
    ...overrides,
  });

  const leaf0: TextElement = {
    id: 'leaf-0',
    type: 'text',
    pointId: 'node.access.text.leaf-0',
    content: 'First leaf in subsection.',
    as: 'p',
  };

  const leaf1: TextElement = {
    id: 'leaf-1',
    type: 'text',
    pointId: 'node.access.text.leaf-1',
    content: 'Second leaf in subsection.',
    as: 'p',
  };

  const emptySub: SubsectionElement = {
    id: 'sub-empty',
    type: 'subsection',
    title: 'Empty Subsection',
  };

  const populatedSub: SubsectionElement = {
    id: 'sub-pop',
    type: 'subsection',
    title: 'Populated Subsection',
  };

  const docWithEmptySub: NodeCanvasDocument = {
    nodeId: 'access',
    version: 3,
    updatedAt: '2026-11-18T00:00:00.000Z',
    elements: [
      {
        id: 'sec-1',
        type: 'section',
        title: 'Foundations',
        number: '01',
        isNumbered: true,
      },
      emptySub,
    ],
  };

  const docWithPopulatedSub: NodeCanvasDocument = {
    nodeId: 'access',
    version: 3,
    updatedAt: '2026-11-18T00:00:00.000Z',
    elements: [
      {
        id: 'sec-1',
        type: 'section',
        title: 'Foundations',
        number: '01',
        isNumbered: true,
      },
      emptySub,
      populatedSub,
      leaf0,
      leaf1,
    ],
  };

  it('renders exactly one CanvasAddBar after an empty subsection heading and no duplicate outer sub-bar', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(true) as any
    );
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(docWithEmptySub)
    );

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    const insertRegions = screen.getAllByRole('region', { name: 'Insert element' });
    // Expected: canvas-top (1) + sec-top-sec-1 (1) + sub-top-sub-empty (1) = 3
    // (No duplicate outer sub-sub-empty bar)
    expect(insertRegions).toHaveLength(3);
  });

  it('renders sub-top bar unconditionally before leaves and one bar per leaf in a populated subsection', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(true) as any
    );
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(docWithPopulatedSub)
    );

    const { container } = render(
      <DocumentCanvas nodeId="access" nodeTitle="Access" />
    );

    const insertRegions = screen.getAllByRole('region', { name: 'Insert element' });
    // Expected:
    // 0: canvas-top
    // 1: sec-top-sec-1
    // 2: sub-top-sub-empty
    // 3: sub-top-sub-pop
    // 4: leaf-leaf-0
    // 5: leaf-leaf-1
    // Total = 6 (no sub-sub-empty and no sub-sub-pop)
    expect(insertRegions).toHaveLength(6);

    const popHeading = screen.getByRole('heading', { name: /Populated Subsection/i });
    const firstLeafEl = screen.getByText('First leaf in subsection.');
    const secondLeafEl = screen.getByText('Second leaf in subsection.');

    const ordered: any[] = [];
    const walk = (node: any) => {
      ordered.push(node);
      for (const child of node.childNodes || []) {
        walk(child);
      }
    };
    walk(container);

    const popHeadingIdx = ordered.indexOf(popHeading);
    const subTopBarIdx = ordered.indexOf(insertRegions[3]);
    const leaf0Idx = ordered.indexOf(firstLeafEl);
    const leaf0BarIdx = ordered.indexOf(insertRegions[4]);
    const leaf1Idx = ordered.indexOf(secondLeafEl);
    const leaf1BarIdx = ordered.indexOf(insertRegions[5]);

    expect(subTopBarIdx).toBeGreaterThan(popHeadingIdx);
    expect(leaf0Idx).toBeGreaterThan(subTopBarIdx);
    expect(leaf0BarIdx).toBeGreaterThan(leaf0Idx);
    expect(leaf1Idx).toBeGreaterThan(leaf0BarIdx);
    expect(leaf1BarIdx).toBeGreaterThan(leaf1Idx);
  });

  it('inserts a new subsection at subIdx + 1 in the parent section when triggered from inside a subsection', () => {
    const addSubsectionSpy = vi.fn();
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(true) as any
    );
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(docWithPopulatedSub, {
        addSubsection: addSubsectionSpy,
      })
    );

    render(
      <DocumentCanvas nodeId="access" nodeTitle="Access" />
    );

    // Click the leaf-1 add bar (last bar, index 5) inside populatedSub (which is at index 1 of sec-1)
    const addButtons = screen.getAllByRole('button', { name: /Add Element/i });
    expect(addButtons).toHaveLength(6);

    (addButtons[5] as any).getBoundingClientRect = () => ({
      top: 200,
      bottom: 230,
      left: 0,
      right: 100,
      width: 100,
      height: 30,
      x: 0,
      y: 200,
      toJSON: () => ({}),
    });
    fireEvent.click(addButtons[5]);

    const subMenuItem = screen.getByRole('menuitem', { name: /Subsection/i });
    fireEvent.click(subMenuItem);

    const submitBtn = screen.getByRole('button', {
      name: /Add Subsection|Save|Create/i,
    });
    fireEvent.click(submitBtn);

    expect(addSubsectionSpy).toHaveBeenCalledTimes(1);
    expect(addSubsectionSpy).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        type: 'subsection',
      })
    );
  });

  it('anchors CanvasItemControls floating toolbar at the top for subsection items just like section items', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(true) as any
    );

    render(
      <>
        <CanvasItemControls
          itemId="sec-1"
          itemType="section"
          canMoveUp={false}
          canMoveDown={false}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onDelete={vi.fn()}
        >
          <div>Section Content</div>
        </CanvasItemControls>
        <CanvasItemControls
          itemId="sub-1"
          itemType="subsection"
          canMoveUp={false}
          canMoveDown={false}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onDelete={vi.fn()}
        >
          <div>Subsection Content</div>
        </CanvasItemControls>
      </>
    );

    const toolbars = screen.getAllByRole('toolbar', {
      name: 'Item authoring controls',
    });
    expect(toolbars).toHaveLength(2);
    expect(toolbars[1].className).toBe(toolbars[0].className);
    expect(toolbars[1].className).toContain('itemControlsFloatingBar');
    expect(toolbars[1].className).not.toContain('sectionFloatingBar');
  });
});
