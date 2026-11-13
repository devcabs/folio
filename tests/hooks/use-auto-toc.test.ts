import { describe, it, expect } from 'vitest';
import { extractNavItemsFromContainer, defaultFormatIdToTitle } from '../../src/hooks/use-auto-toc';

function createMockElement(tag: string, id: string = '', attrs: Record<string, string> = {}) {
  const children: any[] = [];
  const el: any = {
    tagName: tag.toUpperCase(),
    id,
    textContent: attrs['textContent'] || '',
    getAttribute(name: string) {
      if (name === 'id') return el.id;
      return attrs[name] ?? null;
    },
    setAttribute(name: string, value: string) {
      attrs[name] = value;
      if (name === 'id') el.id = value;
    },
    contains(other: any) {
      if (other === el) return true;
      return children.some((child) => child === other || child.contains?.(other));
    },
    appendChild(child: any) {
      children.push(child);
      child.parentElement = el;
      return child;
    },
    querySelector(selector: string) {
      return el.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector: string) {
      const results: any[] = [];
      const isMatch = (node: any) => {
        if (selector.includes('section[id]') && node.tagName === 'SECTION' && node.id) return true;
        if (selector.includes('[data-toc-title][id]') && node.getAttribute('data-toc-title') && node.id) return true;
        if (selector.includes('[data-toc="true"][id]') && node.getAttribute('data-toc') === 'true' && node.id) return true;
        if (selector.includes('sectionTitle') && (node.className?.includes('sectionTitle') || node.className?.includes('SectionTitle'))) return true;
        if (selector.includes('sectionNumber') && (node.className?.includes('sectionNumber') || node.className?.includes('SectionNumber'))) return true;
        return false;
      };

      const traverse = (parent: any) => {
        for (const child of parent.children || []) {
          if (isMatch(child)) results.push(child);
          traverse(child);
        }
      };
      traverse({ children });
      return results;
    },
    closest(selector: string) {
      let curr = el;
      while (curr) {
        if (selector.includes('section[id]') && curr.tagName === 'SECTION' && curr.id) return curr;
        if (selector.includes('[data-toc-title][id]') && curr.getAttribute('data-toc-title') && curr.id) return curr;
        curr = curr.parentElement;
      }
      return null;
    },
    children,
  };
  return el;
}

describe('useAutoTableOfContents & extractNavItemsFromContainer', () => {
  it('formats id to title cleanly using defaultFormatIdToTitle', () => {
    expect(defaultFormatIdToTitle('node-overview')).toBe('Overview');
    expect(defaultFormatIdToTitle('sec-key-initiatives')).toBe('Key Initiatives');
    expect(defaultFormatIdToTitle('source')).toBe('Evidence & Proof');
  });

  it('extracts table of contents items from container sections without duplication', () => {
    const container = createMockElement('main', 'node-content');

    // 1. Overview section
    const overview = createMockElement('section', 'node-overview', {
      'aria-label': 'Node Overview',
    });
    container.appendChild(overview);

    // 2. Canvas section
    const sec1 = createMockElement('section', 'sec-112323', {
      'data-toc-title': '112323',
      'data-toc-number': '01',
      'data-toc-numbered': 'true',
    });
    container.appendChild(sec1);

    const items = extractNavItemsFromContainer(container);
    expect(items).toEqual([
      { id: 'node-overview', label: 'Node Overview', number: undefined, href: '#node-overview' },
      { id: 'sec-112323', label: '112323', number: '01', href: '#sec-112323' },
    ]);
  });

  it('skips wrapper container element when it has data-toc="false"', () => {
    const container = createMockElement('main', 'node-content');

    const overview = createMockElement('section', 'node-overview', {
      'aria-label': 'Node Overview',
    });
    container.appendChild(overview);

    const canvasWrapper = createMockElement('div', 'node-canvas', {
      'data-toc': 'false',
    });
    const sec1 = createMockElement('section', 'sec-112323', {
      'data-toc-title': '112323',
      'data-toc-number': '01',
      'data-toc-numbered': 'true',
    });
    canvasWrapper.appendChild(sec1);
    container.appendChild(canvasWrapper);

    const items = extractNavItemsFromContainer(container);
    expect(items.map((i) => i.label)).toEqual(['Node Overview', '112323']);
    expect(items.map((i) => i.number)).toEqual([undefined, '01']);
  });

  it('skips parent section when it contains child sections matching sectionSelector', () => {
    const container = createMockElement('main', 'node-content');

    const overview = createMockElement('section', 'node-overview', {
      'aria-label': 'Node Overview',
    });
    container.appendChild(overview);

    // If canvas was rendered as a section, it should be recognized as a wrapper and skipped
    const canvasSectionWrapper = createMockElement('section', 'node-canvas', {
      'aria-label': 'Dynamic Document Canvas',
    });
    const sec1 = createMockElement('section', 'sec-112323', {
      'data-toc-title': '112323',
      'data-toc-number': '01',
      'data-toc-numbered': 'true',
    });
    canvasSectionWrapper.appendChild(sec1);
    container.appendChild(canvasSectionWrapper);

    const items = extractNavItemsFromContainer(container);
    // Dynamic Document Canvas must NOT appear in the items list!
    expect(items.map((i) => i.label)).toEqual(['Node Overview', '112323']);
    expect(items.map((i) => i.number)).toEqual([undefined, '01']);
  });
});

