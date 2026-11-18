import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setContent,
  resetContent,
  resolveContent,
  resolveContentObject,
  hasContentOverrideInMap,
  updateDraftContentOverride,
  removeDraftContentOverride,
  fetchPublicManifestOverrides,
  fetchDraftWorkspaceOverrides,
} from '../src/utils/contentDb';
import { resetEngineConfig } from '../src/config/engine.config';

describe('Subtask 7.2: Direct Cloudflare KV Content Overrides (Zero Tombstones)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetEngineConfig();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('updateDraftContentOverride and removeDraftContentOverride mutate KV directly via PUT /api/draft', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          updatedAt: '2026-11-18T00:01:00Z',
          contentOverrides: { hero_headline: 'Draft Headline' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const updated = await updateDraftContentOverride(
      'hero_headline',
      'Draft Headline',
      {},
      { lockToken: 'tok-abc' }
    );
    expect(resolveContent(updated.contentOverrides, 'hero_headline', 'System Default')).toBe('Draft Headline');
    expect(hasContentOverrideInMap(updated.contentOverrides, 'hero_headline')).toBe(true);

    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          updatedAt: '2026-11-18T00:02:00Z',
          contentOverrides: {},
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const removed = await removeDraftContentOverride('hero_headline', updated.contentOverrides, {
      lockToken: 'tok-abc',
      expectedUpdatedAt: updated.updatedAt,
    });
    expect(removed.contentOverrides).not.toHaveProperty('hero_headline');
    expect(resolveContent(removed.contentOverrides, 'hero_headline', 'System Default')).toBe('System Default');
    expect(hasContentOverrideInMap(removed.contentOverrides, 'hero_headline')).toBe(false);
  });

  it('resolveContentObject gracefully parses JSON overrides and falls back to default', () => {
    const defaultImg = { src: 'default.png', alt: 'Default' };
    expect(resolveContentObject({}, 'hero.img', defaultImg)).toEqual(defaultImg);
    expect(
      resolveContentObject(
        { 'hero.img': JSON.stringify({ src: 'custom.png', alt: 'Custom' }) },
        'hero.img',
        defaultImg
      )
    ).toEqual({ src: 'custom.png', alt: 'Custom' });
  });

  it('fetchPublicManifestOverrides and fetchDraftWorkspaceOverrides fail stop on non-2xx', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }));
    await expect(fetchPublicManifestOverrides()).rejects.toThrow(/404/);

    global.fetch = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    await expect(fetchDraftWorkspaceOverrides()).rejects.toThrow(/401/);
  });

  it('setContent and resetContent reject in Public Mode and fail stop on KV write error', async () => {
    await expect(setContent('hero.title', 'Nope', false)).rejects.toThrow(/Public Mode/);
    await expect(resetContent('hero.title', false)).rejects.toThrow(/Public Mode/);

    global.fetch = vi.fn().mockResolvedValue(new Response('Conflict', { status: 409 }));
    await expect(setContent('hero.title', 'Conflict', true)).rejects.toThrow(/409/);
    await expect(resetContent('hero.title', true)).rejects.toThrow(/409/);
  });
});
