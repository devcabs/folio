import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { CanvasPdf } from '../../src/components/canvas/CanvasPdf';
import { PdfPreviewModal } from '../../src/components/source/PdfPreviewModal';
import { Step1Source } from '../../src/components/chart/drawer/panels/Step1Source';
import { Step1SourceRange } from '../../src/components/chart/drawer/panels/Step1SourceRange';
import buttonStyles from '../../src/components/ui/Button.module.css';
import statusPillStyles from '../../src/components/ui/StatusPill.module.css';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';

const VALID_DRIVE_URL =
  'https://drive.google.com/file/d/1AbCDeFgHiJkLmNoPqRsTuVwXyZ123456/view';

function findAll(root: any, predicate: (node: any) => boolean): any[] {
  const results: any[] = [];
  if (!root) return results;
  if (predicate(root)) results.push(root);
  const children = root.children || root.childNodes || [];
  for (const child of children) {
    results.push(...findAll(child, predicate));
  }
  return results;
}

describe('Subtask 12.1: Drop-In Canonical Cleanups & Feedback Token Purity', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('EmptyState renders canonical Button with data-variant="secondary" and invokes onAction', () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="No Records"
        description="Nothing to display yet."
        actionLabel="Retry Sync"
        onAction={onAction}
      />
    );

    const btn = screen.getByRole('button', { name: 'Retry Sync' });
    expect(btn.getAttribute('data-variant')).toBe('secondary');
    expect(btn.className).toContain(buttonStyles.btn);
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('CanvasPdf renders canonical Button in fallback and canonical Button as="a" for Open in New Tab ↗', () => {
    const onEdit = vi.fn();
    const { rerender } = render(
      <CanvasPdf
        element={{
          id: 'pdf-1',
          pointId: 'node.access.pdf.1',
          type: 'pdf',
          title: 'Missing PDF',
          driveUrl: '',
          showCaption: true,
        }}
        nodeId="access"
        isDevMode={true}
        onEdit={onEdit}
      />
    );

    const relinkBtn = screen.getByRole('button', { name: '✎ Re-link Document' });
    expect(relinkBtn.getAttribute('data-variant')).toBe('secondary');
    expect(relinkBtn.className).toContain(buttonStyles.btn);
    fireEvent.click(relinkBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);

    rerender(
      <CanvasPdf
        element={{
          id: 'pdf-2',
          pointId: 'node.access.pdf.2',
          type: 'pdf',
          title: 'Valid PDF',
          driveUrl: VALID_DRIVE_URL,
          showCaption: true,
        }}
        nodeId="access"
        isDevMode={false}
      />
    );

    const openLink = findAll(
      document.body,
      (n) =>
        n.tagName?.toLowerCase() === 'a' &&
        n.getAttribute?.('aria-label') === 'Open PDF document in new tab: Valid PDF'
    )[0];
    expect(openLink).toBeDefined();
    expect(openLink.className).toContain(buttonStyles.btn);
    expect(openLink.textContent).toContain('Open in New Tab ↗');
  });

  it('PdfPreviewModal renders canonical StatusPill for counter and date badges and Button as="a" for Open in New Tab ↗', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDeveloperMode: false,
      isDevMode: false,
      isAuthenticated: false,
      hasSession: false,
      isEditing: false,
      toggleDeveloperMode: vi.fn(),
      setDeveloperMode: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      showToast: vi.fn(),
      activeModal: null,
      openModal: vi.fn(),
      closeModal: vi.fn(),
      isDrawerOpen: false,
      openDrawer: vi.fn(),
      closeDrawer: vi.fn(),
      hasPendingChanges: false,
      pendingChangesCount: 0,
      markDirty: vi.fn(),
      clearDirty: vi.fn(),
      lastSavedAt: null,
    } as any);

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        items={[
          {
            id: 'doc-1',
            driveFileId: 'file-1',
            title: 'Report One',
            originalFileName: 'report-one.pdf',
            previewUrl: 'https://drive.google.com/file/d/file-1/preview',
            viewUrl: 'https://drive.google.com/file/d/file-1/view',
            orderIndex: 0,
            date: '2026-10-01',
          },
          {
            id: 'doc-2',
            driveFileId: 'file-2',
            title: 'Report Two',
            originalFileName: 'report-two.pdf',
            previewUrl: 'https://drive.google.com/file/d/file-2/preview',
            viewUrl: 'https://drive.google.com/file/d/file-2/view',
            orderIndex: 1,
            date: '2026-10-02',
          },
        ]}
        currentIndex={0}
        onNavigate={vi.fn()}
      />
    );

    const statusBadges = findAll(
      document.body,
      (n) => n.getAttribute?.('role') === 'status'
    );
    const counterBadge = statusBadges.find((el) => el.textContent?.includes('1 / 2'));
    const dateBadge = statusBadges.find((el) => el.textContent?.includes('2026-10-01'));
    expect(counterBadge).toBeDefined();
    expect(counterBadge?.className).toContain(statusPillStyles.pill);
    expect(dateBadge).toBeDefined();
    expect(dateBadge?.className).toContain(statusPillStyles.pill);

    const openLink = findAll(
      document.body,
      (n) =>
        n.tagName?.toLowerCase() === 'a' &&
        n.getAttribute?.('aria-label') === 'Open Report One in new tab'
    )[0];
    expect(openLink).toBeDefined();
    expect(openLink.className).toContain(buttonStyles.btn);
    expect(openLink.textContent).toContain('Open in New Tab ↗');
  });

  it('Step1Source and Step1SourceRange render canonical Button / Button as="a" for Go To Source and Open ↗', () => {
    const { rerender } = render(
      <Step1Source
        sheetUrl=""
        setSheetUrl={vi.fn()}
        accessStatus="idle"
        statusMessage=""
        discoveredTabs={[]}
        tabName=""
        setTabName={vi.fn()}
        executeVerification={vi.fn()}
        handleTabChange={vi.fn()}
      />
    );

    const disabledBtn = findAll(
      document.body,
      (n) => n.tagName?.toLowerCase() === 'button' && n.textContent?.includes('Go To Source')
    )[0];
    expect(disabledBtn).toBeDefined();
    expect(disabledBtn.className).toContain(buttonStyles.btn);
    expect(disabledBtn.hasAttribute('disabled')).toBe(true);

    rerender(
      <Step1Source
        sheetUrl="https://docs.google.com/spreadsheets/d/abc123/edit"
        setSheetUrl={vi.fn()}
        accessStatus="public"
        statusMessage=""
        discoveredTabs={[]}
        tabName=""
        setTabName={vi.fn()}
        executeVerification={vi.fn()}
        handleTabChange={vi.fn()}
      />
    );

    const goToSourceLink = findAll(
      document.body,
      (n) => n.tagName?.toLowerCase() === 'a' && n.textContent?.includes('Go To Source ↗')
    )[0];
    expect(goToSourceLink).toBeDefined();
    expect(goToSourceLink.className).toContain(buttonStyles.btn);

    rerender(
      <Step1SourceRange
        sheetUrl="https://docs.google.com/spreadsheets/d/abc123/edit"
        setSheetUrl={vi.fn()}
        accessStatus="public"
        statusMessage=""
        discoveredTabs={[]}
        tabName=""
        setTabName={vi.fn()}
        executeVerification={vi.fn()}
        handleTabChange={vi.fn()}
        range="A1:B10"
        isRangeValid={true}
        isSelectingRange={false}
        setIsSelectingRange={vi.fn()}
        executeSync={vi.fn()}
      />
    );

    const openRangeLink = findAll(
      document.body,
      (n) => n.tagName?.toLowerCase() === 'a' && n.textContent?.includes('Open ↗')
    )[0];
    expect(openRangeLink).toBeDefined();
    expect(openRangeLink.className).toContain(buttonStyles.btn);
  });

  it('contains zero hardcoded hex, rgb(), rgba(), hsl(), or hsla() values in src/components/feedback/*.module.css', () => {
    const feedbackDir = path.resolve(process.cwd(), 'src/components/feedback');
    const cssFiles = fs
      .readdirSync(feedbackDir)
      .filter((f) => f.endsWith('.module.css'));
    const colorPattern = /#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/;

    for (const file of cssFiles) {
      const content = fs.readFileSync(path.join(feedbackDir, file), 'utf-8');
      expect(content, `${file} should have zero hardcoded colors`).not.toMatch(colorPattern);
    }
  });
});
