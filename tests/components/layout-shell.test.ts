import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
import { CURRENT_ENGINE_VERSION } from '../../src/migrations/ledger';

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

  it('renders version control text in AppFooter with default CURRENT_ENGINE_VERSION', () => {
    const html = renderToStaticMarkup(React.createElement(AppFooter));
    expect(html).toContain(`Folio V${CURRENT_ENGINE_VERSION}`);
    expect(html).not.toContain('<button');
  });

  it('renders custom version cleanly without button semantics', () => {
    const html = renderToStaticMarkup(
      React.createElement(AppFooter, {
        version: '0.2.0',
      })
    );
    expect(html).toContain('Folio V0.2.0');
    expect(html).not.toContain('<button');
  });
});
