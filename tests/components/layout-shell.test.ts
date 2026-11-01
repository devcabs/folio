import { describe, it, expect } from 'vitest';
import {
  AppHeader,
  AppFooter,
  HeroWelcome,
  SearchField,
  EditorialSection,
  EditorialSidebar,
} from '../../src/components/layout';
import { PageNotFound } from '../../src/components/feedback/PageNotFound';

describe('Layout Shell & Editorial Primitives', () => {
  it('exports all layout components as defined React components', () => {
    expect(AppHeader).toBeDefined();
    expect(typeof AppHeader).toBe('function');

    expect(AppFooter).toBeDefined();
    expect(typeof AppFooter).toBe('function');

    expect(HeroWelcome).toBeDefined();
    expect(typeof HeroWelcome).toBe('function');

    expect(SearchField).toBeDefined();
    expect(typeof SearchField).toBe('function');

    expect(EditorialSection).toBeDefined();
    expect(['function', 'object']).toContain(typeof EditorialSection);

    expect(EditorialSidebar).toBeDefined();
    expect(typeof EditorialSidebar).toBe('function');

    expect(PageNotFound).toBeDefined();
    expect(typeof PageNotFound).toBe('function');
  });
});
