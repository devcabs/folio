import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SourceCard } from '../../src/components/source/SourceCard';
import { SourceLightbox } from '../../src/components/source/SourceLightbox';
import { LightboxPhotoStrip } from '../../src/components/source/LightboxPhotoStrip';
import { EditPhotoModal } from '../../src/components/source/EditPhotoModal';
import type { SourceItem } from '../../src/types/node';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as lightboxHistoryHook from '../../src/hooks/useLightboxHistory';

describe('15.3 Video Badges, Thumbnail Strip & Playable SourceLightbox', () => {
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

  const videoItem: SourceItem = {
    id: 'drive-vid1234567890',
    title: 'Site Walkthrough Video',
    mediaType: 'video',
    videoPreviewUrl: 'https://drive.google.com/file/d/vid1234567890/preview',
    videoViewUrl: 'https://drive.google.com/file/d/vid1234567890/view',
    durationMs: 65000,
    photo: {
      src: '/api/media/drive/vid1234567890?w=1600',
      alt: 'Site Walkthrough Video',
      caption: 'Site Walkthrough Video',
      showCaption: true,
    },
  };

  const photoItem: SourceItem = {
    id: 'drive-img1234567890',
    title: 'Entrance Photo',
    photo: {
      src: '/api/media/drive/img1234567890?w=1600',
      alt: 'Entrance Photo',
      caption: 'Entrance Photo',
      showCaption: true,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof globalThis.Image === 'undefined') {
      (globalThis as unknown as { Image: unknown }).Image = class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        referrerPolicy = '';
        private _src = '';
        get src() {
          return this._src;
        }
        set src(val: string) {
          this._src = val;
        }
      };
    }
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(false) as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>
    );
    vi.spyOn(lightboxHistoryHook, 'useLightboxHistory').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('SourceCard', () => {
    it('renders play badge and formatted duration pill (1:05) for video items', () => {
      const onClick = vi.fn();
      const { container } = render(<SourceCard item={videoItem} onClick={onClick} />);

      expect(screen.getByText('1:05')).toBeTruthy();
      expect(container.querySelector('[data-video-play-badge="true"]')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Play video: Site Walkthrough Video' })).toBeTruthy();
    });

    it('omits play badge and duration pill for photo items', () => {
      const onClick = vi.fn();
      const { container } = render(<SourceCard item={photoItem} onClick={onClick} />);

      expect(screen.queryByText('1:05')).toBeNull();
      expect(container.querySelector('[data-video-play-badge="true"]')).toBeNull();
      expect(screen.getByRole('button', { name: 'View source photo: Entrance Photo' })).toBeTruthy();
    });

    it('omits play badge and duration pill on overflow +N tiles', () => {
      const onClick = vi.fn();
      const { container } = render(
        <SourceCard item={videoItem} overlayCount={3} onClick={onClick} />
      );

      expect(screen.getByText('+3')).toBeTruthy();
      expect(screen.queryByText('1:05')).toBeNull();
      expect(container.querySelector('[data-video-play-badge="true"]')).toBeNull();
    });
  });

  describe('LightboxPhotoStrip', () => {
    it('renders a play indicator on video thumbnails and omits it on photo thumbnails', () => {
      const { container } = render(
        <LightboxPhotoStrip
          items={[videoItem, photoItem]}
          currentIndex={0}
          onNavigate={vi.fn()}
        />
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(2);
      expect(tabs[0].querySelector('[data-video-thumb-badge="true"]')).not.toBeNull();
      expect(tabs[1].querySelector('[data-video-thumb-badge="true"]')).toBeNull();
      expect(container.querySelectorAll('[data-video-thumb-badge="true"]')).toHaveLength(1);
    });
  });

  describe('SourceLightbox', () => {
    it('renders iframe on video slides, SourceImage on photo slides, and unmounts iframe on navigation', () => {
      const onNavigate = vi.fn();
      const { rerender } = render(
        <SourceLightbox
          isOpen={true}
          items={[videoItem, photoItem]}
          currentIndex={0}
          driveFolderUrl="https://drive.google.com/drive/folders/folder123"
          onClose={vi.fn()}
          onNavigate={onNavigate}
        />
      );

      const iframe = document.body.querySelector('iframe') as HTMLIFrameElement | null;
      expect(iframe).not.toBeNull();
      expect(iframe?.getAttribute('src')).toBe('https://drive.google.com/file/d/vid1234567890/preview');

      // Navigate to photo slide
      rerender(
        <SourceLightbox
          isOpen={true}
          items={[videoItem, photoItem]}
          currentIndex={1}
          driveFolderUrl="https://drive.google.com/drive/folders/folder123"
          onClose={vi.fn()}
          onNavigate={onNavigate}
        />
      );

      expect(document.body.querySelector('iframe')).toBeNull();
      const img = document.body.querySelector('img[alt="Entrance Photo"]');
      expect(img).not.toBeNull();
    });

    it('keeps Dev Mode Edit button working on video slides', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
        createDevModeStub(true) as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>
      );
      const onEditPhoto = vi.fn();

      render(
        <SourceLightbox
          isOpen={true}
          items={[videoItem]}
          currentIndex={0}
          onClose={vi.fn()}
          onNavigate={vi.fn()}
          onEditPhoto={onEditPhoto}
        />
      );

      const editBtn = screen.getByRole('button', { name: 'Edit photo details' });
      fireEvent.click(editBtn);
      expect(onEditPhoto).toHaveBeenCalledWith(videoItem);
    });
  });

  describe('EditPhotoModal', () => {
    it('shows "Edit Video" when editing a video item and "Edit Photo" for a photo item', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
        createDevModeStub(true) as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>
      );

      const { rerender } = render(
        <EditPhotoModal
          isOpen={true}
          photoItem={videoItem}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByText('Edit Video')).toBeTruthy();

      rerender(
        <EditPhotoModal
          isOpen={true}
          photoItem={photoItem}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByText('Edit Photo')).toBeTruthy();
    });
  });
});
