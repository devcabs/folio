import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SourceGallery } from '../../src/components/source/SourceGallery';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as drivePhotoSyncHook from '../../src/hooks/useDrivePhotoSync';

describe('9.3 Deduplicate Gallery Sync Photos Affordance in SourceGallery', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const createDevModeStub = (isDevMode: boolean) =>
    ({
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
    }) as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>;

  const createSyncStub = (syncPhotosMock = vi.fn().mockResolvedValue(null)) =>
    ({
      syncedPhotos: [],
      syncState: 'never_synced' as const,
      isSyncing: false,
      isBackgroundSyncing: false,
      hasSynced: false,
      error: null,
      backgroundError: null,
      lastStats: null,
      syncPhotos: syncPhotosMock,
      updatePhotoTitle: vi.fn(),
      clearError: vi.fn(),
      clearBackgroundError: vi.fn(),
    }) as unknown as ReturnType<typeof drivePhotoSyncHook.useDrivePhotoSync>;

  it('renders exactly one Sync button with aria-label="Sync photos from Google Drive" in Developer Mode', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub(true));
    const syncPhotosMock = vi.fn().mockResolvedValue({ added: 0, updated: 0, removed: 0, total: 0 });
    vi.spyOn(drivePhotoSyncHook, 'useDrivePhotoSync').mockReturnValue(createSyncStub(syncPhotosMock));

    render(
      <SourceGallery
        nodeId="access"
        pointId="node.access.gallery.1"
        driveUrl="https://drive.google.com/drive/folders/folder-123"
        title="Field Evidence"
      />
    );

    const syncButtons = screen.getAllByRole('button', {
      name: 'Sync photos from Google Drive',
    });
    expect(syncButtons).toHaveLength(1);
    expect(syncButtons[0].textContent).toContain('Sync');
    expect(screen.queryByText('Sync Photos')).toBeNull();

    await act(async () => {
      fireEvent.click(syncButtons[0]);
    });
    expect(syncPhotosMock).toHaveBeenCalledTimes(1);
  });

  it('renders zero Sync buttons in Public Visitor Mode', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub(false));
    vi.spyOn(drivePhotoSyncHook, 'useDrivePhotoSync').mockReturnValue(createSyncStub());

    render(
      <SourceGallery
        nodeId="access"
        pointId="node.access.gallery.1"
        driveUrl="https://drive.google.com/drive/folders/folder-123"
        title="Field Evidence"
      />
    );

    expect(
      screen.queryAllByRole('button', { name: 'Sync photos from Google Drive' })
    ).toHaveLength(0);
  });
});
