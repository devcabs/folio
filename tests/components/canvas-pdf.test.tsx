import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasPdf } from '../../src/components/canvas/CanvasPdf';
import type { PdfElement } from '../../src/types/canvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';

describe('11.2 Inline <CanvasPdf> Viewer Component & Fallback States', () => {
  const FILE_ID = '1ABCxyz0123456789';

  const validViewUrlPdf: PdfElement = {
    id: 'pdf-elem-1',
    type: 'pdf',
    pointId: 'node.access.pdf.1',
    driveUrl: `https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`,
    title: 'Annual Compliance Report',
    caption: 'Signed compliance report for FY 2026.',
    showCaption: true,
  };

  const validPreviewUrlPdf: PdfElement = {
    id: 'pdf-elem-2',
    type: 'pdf',
    pointId: 'node.access.pdf.2',
    src: `https://drive.google.com/file/d/${FILE_ID}/preview`,
    title: 'Technical Architecture Brief',
  };

  const validFileIdOnlyPdf: PdfElement = {
    id: 'pdf-elem-3',
    type: 'pdf',
    pointId: 'node.access.pdf.3',
    driveFileId: FILE_ID,
  };

  const placeholderCaptionPdf: PdfElement = {
    id: 'pdf-elem-placeholder',
    type: 'pdf',
    pointId: 'node.access.pdf.placeholder',
    driveFileId: FILE_ID,
    title: 'Board Resolution',
    caption: 'PDF document attachment.',
    showCaption: true,
  };

  const hiddenCaptionPdf: PdfElement = {
    id: 'pdf-elem-hidden-caption',
    type: 'pdf',
    pointId: 'node.access.pdf.hidden',
    driveFileId: FILE_ID,
    title: 'Audit Trail',
    caption: 'Should remain hidden when showCaption is false.',
    showCaption: false,
  };

  const unlinkedPdf: PdfElement = {
    id: 'pdf-elem-empty',
    type: 'pdf',
    pointId: 'node.access.pdf.empty',
    title: 'Pending Document',
  };

  const folderUrlPdf: PdfElement = {
    id: 'pdf-elem-folder',
    type: 'pdf',
    pointId: 'node.access.pdf.folder',
    driveUrl: 'https://drive.google.com/drive/folders/1FolderIdExample12345',
    title: 'Invalid Folder Link',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: false,
      isDesktop: true,
      canUnlock: false,
      isUnlocked: false,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders an inline /preview iframe when given a Drive view URL', () => {
    const { container } = render(
      <CanvasPdf
        element={validViewUrlPdf}
        nodeId="access"
        isDevMode={false}
      />
    );

    const iframes = container.querySelectorAll('iframe');
    expect(iframes).toHaveLength(1);
    const iframe = iframes[0] as HTMLIFrameElement;
    expect(iframe.getAttribute('title')).toBe('Annual Compliance Report');
    expect(iframe.getAttribute('src')).toBe(`https://drive.google.com/file/d/${FILE_ID}/preview`);
    expect(iframe.getAttribute('loading')).toBe('lazy');
  });

  it('renders an inline /preview iframe when given a Drive preview URL or driveFileId', () => {
    const { container, rerender } = render(
      <CanvasPdf
        element={validPreviewUrlPdf}
        nodeId="access"
        isDevMode={false}
      />
    );

    let iframe = container.querySelectorAll('iframe')[0] as HTMLIFrameElement;
    expect(iframe.getAttribute('title')).toBe('Technical Architecture Brief');
    expect(iframe.getAttribute('src')).toBe(`https://drive.google.com/file/d/${FILE_ID}/preview`);

    rerender(
      <CanvasPdf
        element={validFileIdOnlyPdf}
        nodeId="access"
        isDevMode={false}
      />
    );

    iframe = container.querySelectorAll('iframe')[0] as HTMLIFrameElement;
    expect(iframe.getAttribute('title')).toBe('Official PDF Document');
    expect(iframe.getAttribute('src')).toBe(`https://drive.google.com/file/d/${FILE_ID}/preview`);
  });

  it('renders an accessible "Open in New Tab ↗" link pointing to the /view URL', () => {
    const { container } = render(
      <CanvasPdf
        element={validViewUrlPdf}
        nodeId="access"
        isDevMode={false}
      />
    );

    const links = Array.from(container.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links).toHaveLength(1);
    const link = links[0];
    expect(link.getAttribute('aria-label')).toBe(
      'Open PDF document in new tab: Annual Compliance Report'
    );
    expect(link.getAttribute('href')).toBe(`https://drive.google.com/file/d/${FILE_ID}/view`);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toContain('Open in New Tab ↗');
  });

  it('renders title and caption accurately, hiding authoring placeholders in Public Mode', () => {
    const { rerender } = render(
      <CanvasPdf
        element={validViewUrlPdf}
        nodeId="access"
        isDevMode={false}
      />
    );

    expect(screen.getByText('Annual Compliance Report')).toBeDefined();
    expect(screen.getByText('Signed compliance report for FY 2026.')).toBeDefined();

    // Authoring placeholder caption should be hidden in Public Mode
    rerender(
      <CanvasPdf
        element={placeholderCaptionPdf}
        nodeId="access"
        isDevMode={false}
      />
    );
    expect(screen.queryByText('PDF document attachment.')).toBeNull();

    // Authoring placeholder caption is visible in Dev Mode
    rerender(
      <CanvasPdf
        element={placeholderCaptionPdf}
        nodeId="access"
        isDevMode={true}
      />
    );
    expect(screen.getByText('PDF document attachment.')).toBeDefined();

    // Caption is hidden when showCaption is false
    rerender(
      <CanvasPdf
        element={hiddenCaptionPdf}
        nodeId="access"
        isDevMode={true}
      />
    );
    expect(screen.queryByText('Should remain hidden when showCaption is false.')).toBeNull();
  });

  it('renders the calm fallback card for unlinked or folder URLs without broken iframes', () => {
    const { container, rerender } = render(
      <CanvasPdf
        element={unlinkedPdf}
        nodeId="access"
        isDevMode={false}
      />
    );

    const fallbackRegion = screen.getByRole('region', { name: 'PDF Document Unavailable' });
    expect(fallbackRegion).toBeDefined();
    expect(screen.getByText('Pending Document')).toBeDefined();
    expect(screen.getByText('Official PDF documentation is currently being prepared.')).toBeDefined();
    expect(container.querySelectorAll('iframe')).toHaveLength(0);

    // Folder URL must also fall back
    rerender(
      <CanvasPdf
        element={folderUrlPdf}
        nodeId="access"
        isDevMode={false}
      />
    );
    expect(screen.getByRole('region', { name: 'PDF Document Unavailable' })).toBeDefined();
    expect(screen.getByText('Invalid Folder Link')).toBeDefined();
    expect(container.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('renders side "✎ Edit" and fallback "✎ Re-link Document" buttons in Dev Mode and invokes onEdit', () => {
    const onEditMock = vi.fn();
    const { rerender } = render(
      <CanvasPdf
        element={validViewUrlPdf}
        nodeId="access"
        isDevMode={true}
        onEdit={onEditMock}
      />
    );

    const sideEditBtn = screen.getByRole('button', { name: '✎ Edit' });
    expect(sideEditBtn).toBeDefined();
    expect(sideEditBtn.getAttribute('data-dev-edit-trigger')).toBe('true');
    expect(sideEditBtn.getAttribute('data-canvas-edit-trigger')).toBe('pdf-elem-1');
    fireEvent.click(sideEditBtn);
    expect(onEditMock).toHaveBeenCalledTimes(1);

    rerender(
      <CanvasPdf
        element={unlinkedPdf}
        nodeId="access"
        isDevMode={true}
        onEdit={onEditMock}
      />
    );

    expect(
      screen.getByText(
        'PDF document link missing or invalid. Paste a Google Drive PDF file link (Anyone with the link can view).'
      )
    ).toBeDefined();

    const relinkBtn = screen.getByRole('button', { name: '✎ Re-link Document' });
    expect(relinkBtn).toBeDefined();
    fireEvent.click(relinkBtn);
    expect(onEditMock).toHaveBeenCalledTimes(2);
  });

  it('renders zero authoring buttons in Public Mode', () => {
    const onEditMock = vi.fn();
    const { rerender } = render(
      <CanvasPdf
        element={validViewUrlPdf}
        nodeId="access"
        isDevMode={false}
        onEdit={onEditMock}
      />
    );

    expect(screen.queryByRole('button')).toBeNull();

    rerender(
      <CanvasPdf
        element={unlinkedPdf}
        nodeId="access"
        isDevMode={false}
        onEdit={onEditMock}
      />
    );

    expect(screen.queryByRole('button')).toBeNull();
  });
});
