import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import {
  extractDriveFileId,
  resolveSingleDrivePhotoUrl,
  buildEdgeMediaUrl,
  buildEdgeSrcSet,
} from '../src/utils/mediaUrl';

describe('extractDriveFileId & resolveSingleDrivePhotoUrl (Subtask 2.11)', () => {
  const TEST_FILE_ID = '1ABCxyz0123456789_-';

  describe('extractDriveFileId', () => {
    it('extracts ID from standard web share link (/file/d/.../view?usp=sharing)', () => {
      const url = `https://drive.google.com/file/d/${TEST_FILE_ID}/view?usp=sharing`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('extracts ID from embedded preview link (/file/d/.../preview)', () => {
      const url = `https://drive.google.com/file/d/${TEST_FILE_ID}/preview`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('extracts ID from bare file path (/file/d/...)', () => {
      const url = `https://drive.google.com/file/d/${TEST_FILE_ID}`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('extracts ID from direct open link (/open?id=...)', () => {
      const url = `https://drive.google.com/open?id=${TEST_FILE_ID}`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('extracts ID from uc direct download link (/uc?id=...&export=download)', () => {
      const url = `https://drive.google.com/uc?id=${TEST_FILE_ID}&export=download`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('extracts ID from existing permanent thumbnail link (/thumbnail?id=...&sz=w1600)', () => {
      const url = `https://drive.google.com/thumbnail?id=${TEST_FILE_ID}&sz=w1600`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('extracts ID from Google user content direct CDN (lh3.googleusercontent.com/d/...)', () => {
      const url = `https://lh3.googleusercontent.com/d/${TEST_FILE_ID}`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('extracts ID from Google user content direct CDN with size suffix (=s1600)', () => {
      const url = `https://lh3.googleusercontent.com/d/${TEST_FILE_ID}=s1600`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('extracts ID from Google user content drive viewer (lh3.googleusercontent.com/drive-viewer/...)', () => {
      const url = `https://lh3.googleusercontent.com/drive-viewer/${TEST_FILE_ID}`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('extracts ID from multi-account URL prefixes (/u/1/file/d/... or /u/2/file/d/...)', () => {
      const url1 = `https://drive.google.com/u/1/file/d/${TEST_FILE_ID}/view`;
      const url2 = `https://drive.google.com/u/2/file/d/${TEST_FILE_ID}/preview`;
      expect(extractDriveFileId(url1)).toBe(TEST_FILE_ID);
      expect(extractDriveFileId(url2)).toBe(TEST_FILE_ID);
    });

    it('extracts ID from raw alphanumeric string', () => {
      expect(extractDriveFileId(TEST_FILE_ID)).toBe(TEST_FILE_ID);
    });

    it('sanitizes and extracts ID wrapped in angle brackets (<...>)', () => {
      const url = `<https://drive.google.com/file/d/${TEST_FILE_ID}/view>`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('sanitizes and extracts ID wrapped in double quotes ("...")', () => {
      const url = `"https://drive.google.com/file/d/${TEST_FILE_ID}/view"`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('sanitizes and extracts ID wrapped in single quotes (\'...\')', () => {
      const url = `'https://drive.google.com/file/d/${TEST_FILE_ID}/view'`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('sanitizes and extracts ID wrapped in both quotes and angle brackets', () => {
      const url = `"<https://drive.google.com/file/d/${TEST_FILE_ID}/view>"`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('handles query parameters in varied order (?usp=sharing&id=...)', () => {
      const url = `https://drive.google.com/uc?usp=sharing&id=${TEST_FILE_ID}`;
      expect(extractDriveFileId(url)).toBe(TEST_FILE_ID);
    });

    it('strictly rejects folder links and returns null', () => {
      const folderUrls = [
        'https://drive.google.com/drive/folders/1XYZabcdef123456789_-',
        'https://drive.google.com/drive/u/0/folders/1XYZabcdef123456789_-',
        'https://drive.google.com/drive/u/2/folders/1XYZabcdef123456789_-?usp=sharing',
        '<https://drive.google.com/drive/folders/1XYZabcdef123456789_->',
        '"https://drive.google.com/drive/folders/1XYZabcdef123456789_-"',
      ];

      for (const folderUrl of folderUrls) {
        expect(extractDriveFileId(folderUrl)).toBeNull();
      }
    });

    it('returns null for non-Drive URLs and invalid inputs', () => {
      expect(extractDriveFileId('')).toBeNull();
      expect(extractDriveFileId('   ')).toBeNull();
      expect(extractDriveFileId('https://example.com/photo.jpg')).toBeNull();
      expect(extractDriveFileId('too-short')).toBeNull();
      expect(extractDriveFileId('invalid$characters!here#test')).toBeNull();
      // @ts-expect-error test invalid types defensively
      expect(extractDriveFileId(null)).toBeNull();
      // @ts-expect-error test invalid types defensively
      expect(extractDriveFileId(undefined)).toBeNull();
      // @ts-expect-error test invalid types defensively
      expect(extractDriveFileId(12345)).toBeNull();
    });
  });

  describe('resolveSingleDrivePhotoUrl', () => {
    it('resolves valid Google Drive photo links to high-res thumbnail endpoint', () => {
      const input = `https://drive.google.com/file/d/${TEST_FILE_ID}/view?usp=sharing`;
      const result = resolveSingleDrivePhotoUrl(input);

      expect(result).not.toBeNull();
      expect(result).toEqual({
        fileId: TEST_FILE_ID,
        displayUrl: `https://drive.google.com/thumbnail?id=${TEST_FILE_ID}&sz=w1600`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${TEST_FILE_ID}&sz=w320`,
        rawUrl: input,
      });
    });

    it('resolves raw alphanumeric file ID', () => {
      const result = resolveSingleDrivePhotoUrl(TEST_FILE_ID);

      expect(result).not.toBeNull();
      expect(result?.fileId).toBe(TEST_FILE_ID);
      expect(result?.displayUrl).toBe(`https://drive.google.com/thumbnail?id=${TEST_FILE_ID}&sz=w1600`);
      expect(result?.thumbnailUrl).toBe(`https://drive.google.com/thumbnail?id=${TEST_FILE_ID}&sz=w320`);
    });

    it('returns null for Google Drive folder URLs', () => {
      const result = resolveSingleDrivePhotoUrl('https://drive.google.com/drive/folders/1XYZabcdef123456789_-');
      expect(result).toBeNull();
    });

    it('returns null for empty or non-Drive input', () => {
      expect(resolveSingleDrivePhotoUrl('')).toBeNull();
      expect(resolveSingleDrivePhotoUrl('https://example.com/picture.png')).toBeNull();
    });
  });

  describe('Edge Media Proxy Integration with Strict Single Photo Filtering', () => {
    it('builds edge media proxy URL for valid single photo links', () => {
      const url = `https://drive.google.com/file/d/${TEST_FILE_ID}/view?usp=sharing`;
      expect(buildEdgeMediaUrl(url, { width: 800 })).toBe(`/api/media/drive/${TEST_FILE_ID}?w=800`);
    });

    it('falls back to raw string and does not proxy folders as photos', () => {
      const folderUrl = 'https://drive.google.com/drive/folders/1XYZabcdef123456789_-';
      expect(buildEdgeMediaUrl(folderUrl)).toBe(folderUrl);
    });

    it('generates responsive srcSet for single photos and empty string for folders', () => {
      const photoUrl = `https://drive.google.com/file/d/${TEST_FILE_ID}/preview`;
      const srcSet = buildEdgeSrcSet(photoUrl, [400, 800]);
      expect(srcSet).toContain(`/api/media/drive/${TEST_FILE_ID}?w=400 400w`);
      expect(srcSet).toContain(`/api/media/drive/${TEST_FILE_ID}?w=800 800w`);

      const folderUrl = 'https://drive.google.com/drive/folders/1XYZabcdef123456789_-';
      expect(buildEdgeSrcSet(folderUrl)).toBe('');
    });
  });

  describe('Modal Integration Contracts', () => {
    it('verifies UniversalEditModal wires resolveSingleDrivePhotoUrl and canvasDraft.driveUrl', () => {
      const modalSrc = fs.readFileSync('src/components/dev/UniversalEditModal.tsx', 'utf8');

      // Must import resolveSingleDrivePhotoUrl
      expect(modalSrc).toContain('resolveSingleDrivePhotoUrl');

      // Must wire handlePhotoUrlChange to canvas-photo-url
      expect(modalSrc).toContain('onChange={(e) => handlePhotoUrlChange(e.target.value)}');

      // Must display canvasDraft.driveUrl || canvasDraft.src
      expect(modalSrc).toContain('value={canvasDraft.driveUrl || canvasDraft.src || \'\'}');

      // Must render preview using canvasDraft.src
      expect(modalSrc).toContain('<img\n                  src={canvasDraft.src}');
    });

    it('verifies CanvasAddModal wires resolveSingleDrivePhotoUrl for new photo additions', () => {
      const addModalSrc = fs.readFileSync('src/components/canvas/CanvasAddModal.tsx', 'utf8');

      // Must import resolveSingleDrivePhotoUrl
      expect(addModalSrc).toContain('resolveSingleDrivePhotoUrl');

      // Must wire resolveSingleDrivePhotoUrl on add-photo-url
      expect(addModalSrc).toContain('resolveSingleDrivePhotoUrl(val)');
    });
  });
});

