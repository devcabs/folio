import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasVideo } from '../../src/components/canvas/CanvasVideo';
import { CanvasAddBar } from '../../src/components/canvas/CanvasAddBar';
import { DocumentCanvas } from '../../src/components/canvas/DocumentCanvas';
import type { NodeCanvasDocument, VideoElement } from '../../src/types/canvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as nodeCanvasHook from '../../src/hooks/useDocumentCanvas';

describe('15.2 Inline <CanvasVideo> & Unified Media Authoring', () => {
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

  const createCanvasHookStub = (doc: NodeCanvasDocument) => ({
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
  });

  const ytVideo: VideoElement = {
    id: 'video-yt-1',
    type: 'video',
    pointId: 'node.access.video.1',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Program Overview Video',
    caption: 'Recorded during the 2026 annual briefing.',
    showCaption: true,
  };

  const driveVideo: VideoElement = {
    id: 'video-drive-1',
    type: 'video',
    pointId: 'node.access.video.2',
    videoUrl: 'https://drive.google.com/file/d/1ABCxyz0123456789/view?usp=sharing',
    title: 'Field Verification Clip',
  };

  const invalidVideo: VideoElement = {
    id: 'video-empty-1',
    type: 'video',
    pointId: 'node.access.video.empty',
    title: 'Pending Video',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(false) as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders YouTube youtube-nocookie.com/embed/{id} iframe and Open in New Tab link for a YouTube URL', () => {
    const { container } = render(
      <CanvasVideo element={ytVideo} nodeId="access" isDevMode={false} />
    );

    const iframe = container.querySelector('iframe') as HTMLIFrameElement | null;
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(iframe?.getAttribute('title')).toBe('Program Overview Video');
    expect(iframe?.getAttribute('loading')).toBe('lazy');
    expect(iframe?.getAttribute('allow')).toContain('fullscreen');

    const openLink = container.querySelector('a') as HTMLAnchorElement | null;
    expect(openLink).not.toBeNull();
    expect(openLink?.getAttribute('aria-label')).toBe('Open video in new tab: Program Overview Video');
    expect(openLink?.getAttribute('href')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(openLink?.textContent).toContain('Open in New Tab ↗');
    expect(screen.getByText('Recorded during the 2026 annual briefing.')).toBeTruthy();
  });

  it('renders Google Drive /file/d/{id}/preview iframe for a Drive video URL', () => {
    const { container } = render(
      <CanvasVideo element={driveVideo} nodeId="access" isDevMode={false} />
    );

    const iframe = container.querySelector('iframe') as HTMLIFrameElement | null;
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toBe('https://drive.google.com/file/d/1ABCxyz0123456789/preview');
    expect(iframe?.getAttribute('title')).toBe('Field Verification Clip');

    const openLink = container.querySelector('a') as HTMLAnchorElement | null;
    expect(openLink?.getAttribute('href')).toBe('https://drive.google.com/file/d/1ABCxyz0123456789/view');
  });

  it('renders calm unconfigured fallback in Dev Mode when URL is missing or invalid', () => {
    const onEdit = vi.fn();
    render(
      <CanvasVideo
        element={invalidVideo}
        nodeId="access"
        isDevMode={true}
        onEdit={onEdit}
      />
    );

    expect(screen.getByRole('region', { name: 'Video Unavailable' })).toBeTruthy();
    expect(screen.getByText(/Video link missing or invalid/i)).toBeTruthy();

    const reLinkBtn = screen.getByRole('button', { name: /Re-link Video/i });
    fireEvent.click(reLinkBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('CanvasAddBar displays Media and opens the 3-item submenu firing onAddElement("video")', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(true) as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>
    );

    const onAddElement = vi.fn();
    render(<CanvasAddBar onAddElement={onAddElement} />);

    fireEvent.click(screen.getByRole('button', { name: /Add Element/i }));
    const mediaMenuItem = screen.getByRole('menuitem', { name: 'Media' });
    fireEvent.click(mediaMenuItem);

    expect(screen.getByRole('menuitem', { name: 'Single Photo' })).toBeTruthy();
    const singleVideoOption = screen.getByRole('menuitem', { name: 'Single Video' });
    expect(singleVideoOption).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Media Gallery' })).toBeTruthy();

    fireEvent.click(singleVideoOption);
    expect(onAddElement).toHaveBeenCalledWith('video');
  });

  it('DocumentCanvas renders a video leaf element and opens edit modal on ✎ Edit', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(true) as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>
    );

    const doc: NodeCanvasDocument = {
      nodeId: 'access',
      version: 3,
      updatedAt: '2026-11-24T00:00:00.000Z',
      elements: [
        {
          id: 'sec-1',
          type: 'section',
          title: 'Media Showcase',
          isNumbered: true,
        },
        ytVideo,
      ],
    };

    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(doc) as unknown as ReturnType<typeof nodeCanvasHook.useDocumentCanvas>
    );

    const { container } = render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    const iframe = container.querySelector('iframe') as HTMLIFrameElement | null;
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');

    const editBtn = container.querySelector(
      `[data-canvas-edit-trigger="${ytVideo.id}"]`
    ) as HTMLButtonElement | null;
    expect(editBtn).not.toBeNull();
    fireEvent.click(editBtn!);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Edit Video' })).toBeTruthy();
    expect(screen.getByText('Video Link')).toBeTruthy();
  });
});
