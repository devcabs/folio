import { describe, it, expect } from 'vitest';
import {
  extractYouTubeVideoId,
  resolveSingleVideoUrl,
  formatVideoDuration,
} from '../../src/utils/mediaUrl';
import {
  isVideoElement,
  isLeafElement,
  type VideoElement,
  type NodeCanvasDocument,
} from '../../src/types/canvas';
import { createDefaultVideoElement } from '../../src/utils/canvasDefaults';
import { VideoElementSchema, PublicNodePayloadSchema } from '../../src/types/edge';
import { compilePublicNodePayload } from '../../src/services/edgePreBakeService';
import { computeMetricsSummary } from '../../src/services/historyService';
import type { PublishedSnapshot } from '../../src/types/history';

const SAMPLE_YT_ID = 'dQw4w9WgXcQ';
const SAMPLE_DRIVE_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

describe('YouTube & Drive Video URL Resolver', () => {
  it('resolves all 5 YouTube URL formats to youtube-nocookie.com/embed/{id}', () => {
    const variants = [
      `https://www.youtube.com/watch?v=${SAMPLE_YT_ID}`,
      `https://youtu.be/${SAMPLE_YT_ID}`,
      `https://www.youtube.com/shorts/${SAMPLE_YT_ID}`,
      `https://www.youtube.com/live/${SAMPLE_YT_ID}`,
      `https://www.youtube.com/embed/${SAMPLE_YT_ID}`,
    ];

    for (const url of variants) {
      expect(extractYouTubeVideoId(url)).toBe(SAMPLE_YT_ID);
      const resolved = resolveSingleVideoUrl(url);
      expect(resolved).toEqual({
        provider: 'youtube',
        fileId: SAMPLE_YT_ID,
        embedUrl: `https://www.youtube-nocookie.com/embed/${SAMPLE_YT_ID}`,
        viewUrl: `https://www.youtube.com/watch?v=${SAMPLE_YT_ID}`,
        rawUrl: url,
      });
    }
  });

  it('preserves ?t=90, ?t=1m30s, and ?start=45 as ?start=... on YouTube embed URLs', () => {
    const r1 = resolveSingleVideoUrl(`https://www.youtube.com/watch?v=${SAMPLE_YT_ID}&t=90`);
    expect(r1?.embedUrl).toBe(`https://www.youtube-nocookie.com/embed/${SAMPLE_YT_ID}?start=90`);

    const r2 = resolveSingleVideoUrl(`https://youtu.be/${SAMPLE_YT_ID}?t=1m30s`);
    expect(r2?.embedUrl).toBe(`https://www.youtube-nocookie.com/embed/${SAMPLE_YT_ID}?start=90`);

    const r3 = resolveSingleVideoUrl(`https://www.youtube.com/watch?v=${SAMPLE_YT_ID}&start=45`);
    expect(r3?.embedUrl).toBe(`https://www.youtube-nocookie.com/embed/${SAMPLE_YT_ID}?start=45`);
  });

  it('resolves Google Drive single-file links to provider: drive + /preview', () => {
    const driveVariants = [
      `https://drive.google.com/file/d/${SAMPLE_DRIVE_ID}/view`,
      `https://drive.google.com/open?id=${SAMPLE_DRIVE_ID}`,
      SAMPLE_DRIVE_ID,
    ];

    for (const input of driveVariants) {
      const resolved = resolveSingleVideoUrl(input);
      expect(resolved).toEqual({
        provider: 'drive',
        fileId: SAMPLE_DRIVE_ID,
        embedUrl: `https://drive.google.com/file/d/${SAMPLE_DRIVE_ID}/preview`,
        viewUrl: `https://drive.google.com/file/d/${SAMPLE_DRIVE_ID}/view`,
        rawUrl: input,
      });
    }
  });

  it('rejects Google Drive folder URLs and non-video URLs', () => {
    expect(
      resolveSingleVideoUrl('https://drive.google.com/drive/folders/1ABCdefGHIjklMNOpqrSTU')
    ).toBeNull();
    expect(resolveSingleVideoUrl('https://vimeo.com/123456789')).toBeNull();
    expect(resolveSingleVideoUrl('https://example.com/video.mp4')).toBeNull();
    expect(resolveSingleVideoUrl('')).toBeNull();
    expect(resolveSingleVideoUrl('   ')).toBeNull();
  });
});

describe('formatVideoDuration', () => {
  it('formats milliseconds as M:SS or H:MM:SS and returns null for invalid or <= 0', () => {
    expect(formatVideoDuration(undefined)).toBeNull();
    expect(formatVideoDuration(0)).toBeNull();
    expect(formatVideoDuration(-1000)).toBeNull();
    expect(formatVideoDuration(NaN)).toBeNull();
    expect(formatVideoDuration(5000)).toBe('0:05');
    expect(formatVideoDuration(125000)).toBe('2:05');
    expect(formatVideoDuration(3661000)).toBe('1:01:01');
  });
});

describe('VideoElement Contract, Factory, Zod Schema & Pre-Bake', () => {
  it('createDefaultVideoElement returns valid VideoElement with canonical pointId', () => {
    const el = createDefaultVideoElement('access');
    expect(el.type).toBe('video');
    expect(el.id).toMatch(/^video-/);
    expect(el.pointId).toBe(`node.access.video.${el.id}`);
    expect(isVideoElement(el)).toBe(true);
    expect(isLeafElement(el)).toBe(true);
  });

  it('VideoElementSchema.safeParse accepts valid VideoElement payloads and rejects invalid types', () => {
    const validVideo: VideoElement = {
      id: 'video-1',
      type: 'video',
      pointId: 'node.access.video.video-1',
      src: `https://www.youtube-nocookie.com/embed/${SAMPLE_YT_ID}`,
      provider: 'youtube',
      videoUrl: `https://www.youtube.com/watch?v=${SAMPLE_YT_ID}`,
      title: 'Project Walkthrough',
      caption: 'Recorded walkthrough.',
      showCaption: true,
    };

    expect(VideoElementSchema.safeParse(validVideo).success).toBe(true);
    expect(
      VideoElementSchema.safeParse({
        ...validVideo,
        type: 'photo',
      }).success
    ).toBe(false);
    expect(
      VideoElementSchema.safeParse({
        ...validVideo,
        provider: 'vimeo',
      }).success
    ).toBe(false);
  });

  it('compilePublicNodePayload passes video elements through without image-proxy mutation', () => {
    const videoEl: VideoElement = {
      id: 'video-1',
      type: 'video',
      pointId: 'node.access.video.video-1',
      src: `https://drive.google.com/file/d/${SAMPLE_DRIVE_ID}/preview`,
      provider: 'drive',
      videoUrl: `https://drive.google.com/file/d/${SAMPLE_DRIVE_ID}/view`,
      title: 'Site Inspection',
    };

    const canvas: NodeCanvasDocument = {
      nodeId: 'access',
      version: 3,
      elements: [videoEl],
      updatedAt: '2026-11-24T00:00:00.000Z',
    };

    const snapshot: PublishedSnapshot = {
      id: 'snap-1',
      schemaVersion: 3,
      title: 'Test Snapshot',
      description: 'Test',
      createdAt: '2026-11-24T00:00:00.000Z',
      authorSessionId: 'session-1',
      isActive: true,
      canvases: { access: canvas },
      contentOverrides: {},
      pages: {},
      summary: computeMetricsSummary({ access: canvas }),
    };

    const payload = compilePublicNodePayload('access', snapshot);
    expect(PublicNodePayloadSchema.safeParse(payload).success).toBe(true);
    const outEl = payload.canvas.elements[0] as VideoElement;
    expect(outEl.src).toBe(`https://drive.google.com/file/d/${SAMPLE_DRIVE_ID}/preview`);
    expect(outEl.src).not.toContain('/api/media/drive/');
    expect(outEl.provider).toBe('drive');
  });
});
