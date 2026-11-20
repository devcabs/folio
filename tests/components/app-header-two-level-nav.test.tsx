import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppHeader, type NavItem } from '../../src/components/layout/AppHeader';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function mockDevMode() {
  vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
    isDevMode: false,
    isPinModalOpen: false,
    openPinModal: vi.fn(),
    closePinModal: vi.fn(),
    enterDevMode: vi.fn(),
    exitDevMode: vi.fn(),
    showToast: vi.fn(),
    toasts: [],
    dismissToast: vi.fn(),
  } as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>);
}

const SAMPLE_NAV_ITEMS: NavItem[] = [
  {
    label: 'Access',
    href: '#/access',
    pageId: 'access',
    level: 'chapter',
    isActive: true,
    children: [
      {
        label: 'Research',
        href: '#/access/research',
        pageId: 'page-research',
        level: 'subpage',
        children: [
          {
            label: 'Level 3 Grandchild',
            href: '#/access/research/deep',
            pageId: 'page-deep',
            level: 'subpage',
          },
        ],
      },
      {
        label: 'Field Notes',
        href: '#/access/field-notes',
        pageId: 'page-field-notes',
        level: 'subpage',
      },
    ],
  },
  {
    label: 'Equity',
    href: '#/equity',
    pageId: 'equity',
    level: 'chapter',
  },
  {
    label: 'Quality',
    href: '#/quality',
    pageId: 'quality',
    level: 'chapter',
    children: [
      {
        label: 'Benchmarks',
        href: '#/quality/benchmarks',
        pageId: 'page-benchmarks',
        level: 'subpage',
      },
    ],
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function findLinkByText(container: HTMLElement, text: string): HTMLAnchorElement {
  const link = Array.from(container.querySelectorAll('a')).find(
    (el) => el.textContent?.trim() === text
  );
  if (!link) {
    throw new Error(`Unable to find <a> with text "${text}"`);
  }
  return link as HTMLAnchorElement;
}

function dispatchKeyDown(el: Element, key: string) {
  act(() => {
    el.dispatchEvent({
      type: 'keydown',
      key,
      bubbles: true,
      cancelable: true,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent);
  });
}

function dispatchMouseDown(target: Element) {
  act(() => {
    document.dispatchEvent({
      type: 'mousedown',
      target,
      bubbles: true,
    } as unknown as MouseEvent);
  });
}

describe('Subtask 13.11: 2-Level Desktop AppHeader & Mobile Menu (Option A)', () => {
  it('navigates directly on chapter click and opens Level 2 dropdown on chevron click', () => {
    mockDevMode();
    const onNavigatePage = vi.fn();

    const { container } = render(
      <AppHeader
        brandTitle="Folio"
        navItems={SAMPLE_NAV_ITEMS}
        onNavigatePage={onNavigatePage}
      />
    );

    // Clicking chapter label navigates directly to the chapter
    const accessLink = findLinkByText(container, 'Access');
    expect(accessLink.getAttribute('aria-current')).toBe('page');
    fireEvent.click(accessLink);
    expect(onNavigatePage).toHaveBeenCalledTimes(1);
    expect(onNavigatePage).toHaveBeenCalledWith('access');

    // Clicking chevron button opens dropdown without navigating away
    const chevronBtn = screen.getByRole('button', { name: 'Access subpages' });
    expect(chevronBtn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(chevronBtn);
    expect(chevronBtn.getAttribute('aria-expanded')).toBe('true');
    expect(onNavigatePage).toHaveBeenCalledTimes(1);

    // Direct Level 2 subpages appear in exact order
    const menu = screen.getByRole('menu', { name: 'Access subpages' });
    const items = menu.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>;
    expect(Array.from(items).map((el) => el.textContent?.trim())).toEqual([
      'Research',
      'Field Notes',
    ]);

    // Clicking a Level 2 subpage navigates to it and closes the dropdown
    fireEvent.click(screen.getByRole('menuitem', { name: 'Research' }));
    expect(onNavigatePage).toHaveBeenCalledTimes(2);
    expect(onNavigatePage).toHaveBeenLastCalledWith('page-research');
    expect(screen.queryByRole('menu', { name: 'Access subpages' })).toBeNull();
  });

  it('strictly caps navigation at 2 levels (never renders Level 3 grandchildren)', () => {
    mockDevMode();
    const onNavigatePage = vi.fn();

    render(
      <AppHeader
        brandTitle="Folio"
        navItems={SAMPLE_NAV_ITEMS}
        onNavigatePage={onNavigatePage}
      />
    );

    // Desktop dropdown
    fireEvent.click(screen.getByRole('button', { name: 'Access subpages' }));
    expect(screen.queryByText('Level 3 Grandchild')).toBeNull();

    // Mobile hamburger menu
    const mobileToggle = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(mobileToggle);
    expect(screen.queryByText('Level 3 Grandchild')).toBeNull();
  });

  it('supports keyboard navigation (ArrowDown, ArrowUp, Home, End, Escape) and outside-click dismissal', () => {
    mockDevMode();
    const onNavigatePage = vi.fn();

    const { container } = render(
      <div>
        <AppHeader
          brandTitle="Folio"
          navItems={SAMPLE_NAV_ITEMS}
          onNavigatePage={onNavigatePage}
        />
        <div data-testid="outside-area">Outside</div>
      </div>
    );

    const accessLink = findLinkByText(container, 'Access');
    const chevronBtn = screen.getByRole('button', { name: 'Access subpages' });

    // ArrowDown on chapter link opens dropdown and focuses first subpage
    dispatchKeyDown(accessLink, 'ArrowDown');
    const researchItem = screen.getByRole('menuitem', { name: 'Research' });
    const fieldNotesItem = screen.getByRole('menuitem', { name: 'Field Notes' });
    expect(document.activeElement).toBe(researchItem);

    // ArrowDown moves to next item
    dispatchKeyDown(researchItem, 'ArrowDown');
    expect(document.activeElement).toBe(fieldNotesItem);

    // ArrowUp moves back to previous item
    dispatchKeyDown(fieldNotesItem, 'ArrowUp');
    expect(document.activeElement).toBe(researchItem);

    // End jumps to last, Home jumps to first
    dispatchKeyDown(researchItem, 'End');
    expect(document.activeElement).toBe(fieldNotesItem);
    dispatchKeyDown(fieldNotesItem, 'Home');
    expect(document.activeElement).toBe(researchItem);

    // Escape closes dropdown and returns focus to chevron button
    dispatchKeyDown(researchItem, 'Escape');
    expect(screen.queryByRole('menu', { name: 'Access subpages' })).toBeNull();
    expect(document.activeElement).toBe(chevronBtn);

    // Re-open and test outside-click dismissal
    fireEvent.click(chevronBtn);
    expect(screen.getByRole('menu', { name: 'Access subpages' })).toBeTruthy();
    const outside = screen.getByTestId('outside-area');
    dispatchMouseDown(outside);
    expect(screen.queryByRole('menu', { name: 'Access subpages' })).toBeNull();
  });

  it('groups overflow chapters (> 5) into a "More" solid-surface dropdown', () => {
    mockDevMode();
    const onNavigatePage = vi.fn();

    const sevenChapters: NavItem[] = [
      { label: 'One', href: '#/one', pageId: 'one', level: 'chapter' },
      { label: 'Two', href: '#/two', pageId: 'two', level: 'chapter' },
      { label: 'Three', href: '#/three', pageId: 'three', level: 'chapter' },
      { label: 'Four', href: '#/four', pageId: 'four', level: 'chapter' },
      {
        label: 'Five',
        href: '#/five',
        pageId: 'five',
        level: 'chapter',
        children: [
          { label: 'Five Sub', href: '#/five/sub', pageId: 'five-sub', level: 'subpage' },
        ],
      },
      { label: 'Six', href: '#/six', pageId: 'six', level: 'chapter' },
      { label: 'Seven', href: '#/seven', pageId: 'seven', level: 'chapter' },
    ];

    const { container } = render(
      <AppHeader
        brandTitle="Folio"
        navItems={sevenChapters}
        onNavigatePage={onNavigatePage}
      />
    );

    // First 4 rendered directly in top bar
    expect(findLinkByText(container, 'One')).toBeTruthy();
    expect(findLinkByText(container, 'Two')).toBeTruthy();
    expect(findLinkByText(container, 'Three')).toBeTruthy();
    expect(findLinkByText(container, 'Four')).toBeTruthy();

    // Remaining 3 are inside "More" overflow menu, not directly in top bar
    expect(screen.queryByText('Five')).toBeNull();
    const moreBtn = screen.getByRole('button', { name: /More/i });
    fireEvent.click(moreBtn);

    const moreMenu = screen.getByRole('menu', { name: 'More chapters' });
    expect(moreMenu).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Five' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Five Sub' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Six' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Seven' })).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Five Sub' }));
    expect(onNavigatePage).toHaveBeenCalledWith('five-sub');
    expect(screen.queryByRole('menu', { name: 'More chapters' })).toBeNull();
  });

  it('renders strictly 2-level chapter & subpage hierarchy in mobile hamburger menu (Option A)', () => {
    mockDevMode();
    const onNavigatePage = vi.fn();

    render(
      <AppHeader
        brandTitle="Folio"
        navItems={SAMPLE_NAV_ITEMS}
        onNavigatePage={onNavigatePage}
      />
    );

    const toggle = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(toggle);

    const mobileMenu = document.getElementById('app-mobile-nav');
    expect(mobileMenu).toBeTruthy();

    const menuItems = mobileMenu!.querySelectorAll('a');
    const labels = Array.from(menuItems).map((el) => el.textContent?.trim());
    expect(labels).toEqual([
      'Access',
      'Research',
      'Field Notes',
      'Equity',
      'Quality',
      'Benchmarks',
    ]);

    // Clicking a subpage in mobile menu calls onNavigatePage and closes menu
    const benchmarksItem = Array.from(menuItems).find((el) => el.textContent?.trim() === 'Benchmarks')!;
    fireEvent.click(benchmarksItem);
    expect(onNavigatePage).toHaveBeenCalledWith('page-benchmarks');
    expect(document.getElementById('app-mobile-nav')).toBeNull();
  });

  it('enforces solid-surface dropdown styling (zero backdrop-filter, token-only) and zero raw <button> in AppHeader', () => {
    const cssPath = path.join(ROOT, 'src/components/layout/AppHeader.module.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // .desktopDropdown and .mobileDropdown must use var(--nav-dropdown-bg) and zero backdrop-filter
    const desktopMatch = css.match(/\.desktopDropdown\s*\{[\s\S]*?\}/);
    const mobileMatch = css.match(/\.mobileDropdown\s*\{[\s\S]*?\}/);
    expect(desktopMatch).toBeTruthy();
    expect(mobileMatch).toBeTruthy();
    expect(desktopMatch![0]).toContain('var(--nav-dropdown-bg)');
    expect(desktopMatch![0]).not.toContain('backdrop-filter');
    expect(mobileMatch![0]).toContain('var(--nav-dropdown-bg)');
    expect(mobileMatch![0]).not.toContain('backdrop-filter');

    // Zero raw <button> in AppHeader.tsx
    const tsxPath = path.join(ROOT, 'src/components/layout/AppHeader.tsx');
    const tsx = fs.readFileSync(tsxPath, 'utf8');
    expect(tsx).not.toMatch(/<button\b/);
  });
});
