import { describe, it, expect, beforeEach } from 'vitest';
import {
  setContent,
  getContent,
  hasContentOverride,
  resetContent,
  getAllContentOverrides,
  resetAllContentOverrides,
  clearDraftTombstones,
} from '../src/utils/contentDb';
import {
  clearDraftStorage,
  discardDraftSession,
  syncDraftWithPublished,
} from '../src/services/draftService';
import { publishNewSnapshot } from '../src/services/historyService';
import { getStorage } from '../src/utils/storage';
import { resetEngineConfig } from '../src/config/engine.config';

describe('Subtask 2.1: Content Override "Reset to Default" Tombstone Isolation', () => {
  beforeEach(() => {
    resetEngineConfig();
    const storage = getStorage();
    if (storage) {
      storage.clear();
    }
    resetAllContentOverrides(false);
    resetAllContentOverrides(true);
    clearDraftTombstones();
  });

  describe('Tombstone Isolation in Developer Mode', () => {
    it('ensures resetting a key in draft prevents live override resurrection in getAllContentOverrides(true)', () => {
      // 1. Establish live published override
      setContent('hero_headline', 'Live Headline', false);
      expect(getAllContentOverrides(false)).toEqual({ hero_headline: 'Live Headline' });
      expect(getAllContentOverrides(true)).toEqual({ hero_headline: 'Live Headline' });

      // 2. In dev mode, reset key to system default
      resetContent('hero_headline', true);

      // 3. Draft view must NOT resurrect the live value
      const devOverrides = getAllContentOverrides(true);
      expect(devOverrides).not.toHaveProperty('hero_headline');
      expect(devOverrides.hero_headline).toBeUndefined();

      // 4. getContent and hasContentOverride in dev mode must respect tombstone
      expect(getContent('hero_headline', 'System Default Headline', true)).toBe('System Default Headline');
      expect(hasContentOverride('hero_headline', true)).toBe(false);

      // 5. Public channel (isDevMode = false) remains strictly untouched
      const liveOverrides = getAllContentOverrides(false);
      expect(liveOverrides).toHaveProperty('hero_headline', 'Live Headline');
      expect(getContent('hero_headline', 'System Default Headline', false)).toBe('Live Headline');
      expect(hasContentOverride('hero_headline', false)).toBe(true);
    });

    it('clears tombstone when a new draft value is set after reset', () => {
      // 1. Live override
      setContent('about_bio', 'Live Bio', false);

      // 2. Reset in dev mode -> tombstoned
      resetContent('about_bio', true);
      expect(getAllContentOverrides(true)).toEqual({});
      expect(hasContentOverride('about_bio', true)).toBe(false);

      // 3. Set a new draft override
      setContent('about_bio', 'Draft Bio Iteration 2', true);

      // 4. Tombstone must be gone and new draft value returned
      const devOverrides = getAllContentOverrides(true);
      expect(devOverrides).toEqual({ about_bio: 'Draft Bio Iteration 2' });
      expect(getContent('about_bio', 'Default Bio', true)).toBe('Draft Bio Iteration 2');
      expect(hasContentOverride('about_bio', true)).toBe(true);
    });

    it('retains untombstoned live overrides while filtering out tombstoned keys', () => {
      // 1. Multiple live overrides
      setContent('key_a', 'Live A', false);
      setContent('key_b', 'Live B', false);
      setContent('key_c', 'Live C', false);

      // 2. Draft modifies key_a, resets key_b, leaves key_c untouched
      setContent('key_a', 'Draft A Modified', true);
      resetContent('key_b', true);

      // 3. getAllContentOverrides(true) should contain key_a (draft) and key_c (live fallback), but NOT key_b
      const devOverrides = getAllContentOverrides(true);
      expect(devOverrides).toEqual({
        key_a: 'Draft A Modified',
        key_c: 'Live C',
      });
      expect(devOverrides).not.toHaveProperty('key_b');
    });

    it('clearDraftTombstones() clears active tombstones', () => {
      setContent('feature_flag', 'Live Active', false);
      resetContent('feature_flag', true);
      expect(getAllContentOverrides(true)).toEqual({});

      clearDraftTombstones();
      expect(getAllContentOverrides(true)).toEqual({ feature_flag: 'Live Active' });
    });

    it('resetAllContentOverrides(true) clears draft tombstones', () => {
      setContent('key1', 'Live 1', false);
      resetContent('key1', true);
      expect(getAllContentOverrides(true)).toEqual({});

      resetAllContentOverrides(true);
      // Since live still has key1, clearing draft tombstones restores live visibility in dev mode
      expect(getAllContentOverrides(true)).toEqual({ key1: 'Live 1' });
    });
  });

  describe('Lifecycle Integration with draftService', () => {
    it('clearDraftStorage() clears draft tombstones', () => {
      setContent('title', 'Live Title', false);
      resetContent('title', true);
      expect(getAllContentOverrides(true)).toEqual({});

      clearDraftStorage();
      expect(getAllContentOverrides(true)).toEqual({ title: 'Live Title' });
    });

    it('discardDraftSession() clears draft tombstones', async () => {
      setContent('title', 'Live Title', false);
      resetContent('title', true);
      expect(getAllContentOverrides(true)).toEqual({});

      await discardDraftSession();
      expect(getAllContentOverrides(true)).toEqual({ title: 'Live Title' });
    });

    it('syncDraftWithPublished() clears draft tombstones', () => {
      setContent('title', 'Live Title', false);
      resetContent('title', true);
      expect(getAllContentOverrides(true)).toEqual({});

      syncDraftWithPublished({});
      expect(getAllContentOverrides(true)).toEqual({ title: 'Live Title' });
    });

    it('successfully publishes a snapshot omitting reset/tombstoned content overrides without resurrecting', async () => {
      // 1. Establish live state with two overridden fields
      setContent('headline', 'Old Live Headline', false);
      setContent('cta_text', 'Click Here Live', false);
      expect(getAllContentOverrides(false)).toEqual({
        headline: 'Old Live Headline',
        cta_text: 'Click Here Live',
      });

      // 2. In dev mode, reset 'headline' to default
      resetContent('headline', true);

      // 3. Verify dev overrides only show cta_text
      expect(getAllContentOverrides(true)).toEqual({
        cta_text: 'Click Here Live',
      });

      // 4. Publish new snapshot
      const res = await publishNewSnapshot('Reset headline to system default');
      expect(res.success).toBe(true);
      expect(res.snapshot.contentOverrides).toEqual({
        cta_text: 'Click Here Live',
      });
      expect(res.snapshot.contentOverrides).not.toHaveProperty('headline');

      // 5. Post-publish live channel must have cleared 'headline' permanently
      expect(getAllContentOverrides(false)).toEqual({
        cta_text: 'Click Here Live',
      });
      expect(getContent('headline', 'System Headline', false)).toBe('System Headline');
      expect(getContent('headline', 'System Headline', true)).toBe('System Headline');
      expect(hasContentOverride('headline', false)).toBe(false);
      expect(hasContentOverride('headline', true)).toBe(false);
    });
  });
});
