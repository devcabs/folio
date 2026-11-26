import { describe, it, expect } from 'vitest';
import {
  CanvasVideo,
  isVideoElement,
  resolveSingleVideoUrl,
  extractYouTubeVideoId,
  formatVideoDuration,
  type VideoElement,
  type VideoProvider,
  type CanvasVideoProps,
} from '../../src/index';

describe('Epic 15 Public Exports (@devcabs/folio-engine)', () => {
  it('exports CanvasVideo, video type guards, and mediaUrl video helpers', () => {
    expect(CanvasVideo).toBeDefined();
    expect(typeof isVideoElement).toBe('function');
    expect(typeof resolveSingleVideoUrl).toBe('function');
    expect(typeof extractYouTubeVideoId).toBe('function');
    expect(typeof formatVideoDuration).toBe('function');

    const provider: VideoProvider = 'youtube';
    const element: VideoElement = {
      id: 'vid-1',
      type: 'video',
      pointId: 'pt-vid-1',
      provider,
      src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    };
    const props: CanvasVideoProps = { element, nodeId: 'node-1' };

    expect(isVideoElement(props.element)).toBe(true);
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(resolveSingleVideoUrl('https://youtu.be/dQw4w9WgXcQ')?.provider).toBe('youtube');
    expect(formatVideoDuration(65000)).toBe('1:05');
  });
});
