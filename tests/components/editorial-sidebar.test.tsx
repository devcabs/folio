import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { EditorialSidebar } from '../../src/components/layout/EditorialSidebar';
import { CanvasSection } from '../../src/components/canvas/CanvasSection';
import { CanvasSubsection } from '../../src/components/canvas/CanvasSubsection';
import { useAutoTableOfContents } from '../../src/hooks/use-auto-toc';
import type { NavItem } from '../../src/types/navigation';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SidebarWithAutoTocHarness: React.FC<{ showNodeContent: boolean }> = ({
  showNodeContent,
}) => {
  const items = useAutoTableOfContents({ containerId: 'node-content' });

  return (
    <div>
      <EditorialSidebar title="Contents" items={items} />
      {showNodeContent && (
        <main id="node-content">
          <CanvasSection
            nodeId="node-1"
            computedNumber="01"
            section={{
              id: 'sec-overview',
              type: 'section',
              title: 'System Overview',
              isNumbered: true,
              elements: [],
            }}
          >
            <CanvasSubsection
              nodeId="node-1"
              subsection={{
                id: 'subsec-tokens',
                type: 'subsection',
                title: 'Design Tokens',
                elements: [],
              }}
            />
          </CanvasSection>
        </main>
      )}
    </div>
  );
};

describe('EditorialSidebar section & subsection navigation', () => {
  it('renders section and nested subsection nav links with active state', () => {
    const items: NavItem[] = [
      {
        id: 'sec-1',
        label: 'Architecture',
        number: '01',
        href: '#sec-1',
        children: [
          {
            id: 'subsec-1',
            label: 'Token Gate',
            href: '#subsec-1',
            level: 'subsection',
          },
        ],
      },
    ];

    const { container } = render(
      <EditorialSidebar title="Contents" items={items} activeId="subsec-1" />
    );

    const links = Array.from(container.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.length).toBe(2);

    const sectionLink = links[0];
    const subsectionLink = links[1];

    expect(sectionLink.getAttribute('href')).toBe('#sec-1');
    expect(sectionLink.textContent).toContain('Architecture');
    expect(sectionLink.getAttribute('aria-current')).toBeNull();

    expect(subsectionLink.getAttribute('href')).toBe('#subsec-1');
    expect(subsectionLink.textContent).toContain('Token Gate');
    expect(subsectionLink.getAttribute('aria-current')).toBe('true');
  });

  it('discovers section and subsection links when #node-content mounts after initial render', () => {
    const observers: Array<{ callback: () => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
    class MockMutationObserver {
      callback: () => void;
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(cb: () => void) {
        this.callback = cb;
        observers.push(this);
      }
    }
    vi.stubGlobal('MutationObserver', MockMutationObserver);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    // Enhance shim's querySelectorAll / querySelector for this test to match production TOC selectors
    const proto = Object.getPrototypeOf(document.body);
    const originalQsa = proto.querySelectorAll;
    const hadQs = typeof proto.querySelector === 'function';
    if (!hadQs) {
      proto.querySelector = function (sel: string) {
        return this.querySelectorAll(sel)[0] || null;
      };
    }
    if (typeof proto.getBoundingClientRect !== 'function') {
      proto.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 });
    }
    vi.spyOn(proto as Element, 'querySelectorAll').mockImplementation(function (this: Element, selector: string) {
      if (selector.includes('[data-toc-title]')) {
        const all = originalQsa.call(this, '*') as unknown as Element[];
        return all.filter((el) => {
          const id = el.getAttribute('id');
          if (!id) return false;
          return (
            el.tagName === 'SECTION' ||
            Boolean(el.getAttribute('data-toc-title')) ||
            el.getAttribute('data-toc') === 'true'
          );
        }) as unknown as NodeListOf<Element>;
      }
      return originalQsa.call(this, selector);
    });

    const { rerender, container } = render(
      <SidebarWithAutoTocHarness showNodeContent={false} />
    );
    document.body.appendChild(container);

    expect(container.querySelectorAll('a').length).toBe(0);

    rerender(<SidebarWithAutoTocHarness showNodeContent={true} />);

    // Trigger the body MutationObserver callback to simulate DOM mount notification
    act(() => {
      observers.forEach((obs) => obs.callback());
    });

    expect(screen.getByText('System Overview')).toBeTruthy();
    expect(screen.getByText('Design Tokens')).toBeTruthy();
    const links = Array.from(container.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '#sec-overview',
      '#subsec-tokens',
    ]);
  });
});
