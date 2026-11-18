import { useState, useEffect, useRef } from 'react';
import type { NavItem } from '../types/navigation';

export interface UseAutoTableOfContentsOptions {
  /** Target container DOM ID to observe (default: 'node-content') */
  containerId?: string;
  /** React ref to container element (overrides containerId if provided) */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Selector for section elements (default: 'section[id], [data-toc-title][id], [data-toc="true"][id]') */
  sectionSelector?: string;
  /** Optional custom ID to title formatter */
  formatIdToTitle?: (id: string) => string;
}

/**
 * Converts a kebab-case or snake_case element ID into a readable title fallback.
 * e.g. "node-overview" -> "Overview", "source-proof" -> "Evidence & Proof"
 */
export function defaultFormatIdToTitle(id: string): string {
  const cleanId = id.replace(/^(node|page|section|sec)-/, '');
  if (cleanId === 'source' || cleanId === 'source-proof') return 'Evidence & Proof';
  if (cleanId === 'overview') return 'Overview';

  return cleanId
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Pure function to extract canonical NavItems from a given container element.
 */
export function extractNavItemsFromContainer(
  container: HTMLElement,
  sectionSelector = 'section[id], [data-toc-title][id], [data-toc="true"][id]',
  formatTitle = defaultFormatIdToTitle
): NavItem[] {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(sectionSelector));
  const seenIds = new Set<string>();
  const items: NavItem[] = [];
  const sectionEntries: Array<{ el: HTMLElement; item: NavItem }> = [];

  const isSubsectionEl = (node: HTMLElement) =>
    node.getAttribute('data-toc-level') === 'subsection';

  for (const el of elements) {
    const id = el.id?.trim();
    if (!id || seenIds.has(id)) continue;

    // Explicit opt-out for wrapper elements or hidden sections
    if (
      el.getAttribute('data-toc') === 'false' ||
      el.getAttribute('data-toc-ignore') === 'true'
    ) {
      continue;
    }

    const isSubsection = isSubsectionEl(el);

    // If a top-level element contains child top-level sections,
    // this element is a wrapper container, NOT an individual leaf section
    if (!isSubsection) {
      const hasChildSections = elements.some(
        (other) => other !== el && el.contains(other) && !isSubsectionEl(other)
      );
      if (hasChildSections) {
        continue;
      }
    }

    seenIds.add(id);

    // 1. Title Extraction:
    // Fallback cascade: data-toc-title > data-title > aria-label > inner heading text > formatted id
    const dataTitle = el.getAttribute('data-toc-title') || el.getAttribute('data-title');
    const ariaLabel = el.getAttribute('aria-label');
    const headingEl = el.querySelector<HTMLElement>(
      'h1, h2, h3, [class*="sectionTitle"], [class*="SectionTitle"]'
    );
    const validHeadingEl =
      headingEl && (!headingEl.closest(sectionSelector) || headingEl.closest(sectionSelector) === el)
        ? headingEl
        : null;
    const headingText = validHeadingEl?.textContent?.trim();

    const label = dataTitle || ariaLabel || headingText || formatTitle(id);

    // 2. Number Extraction:
    // Cascade: data-toc-number > data-number > inner sectionNumber text
    // Explicitly unnumbered elements (data-toc-numbered="false") strictly omit number
    const isExplicitlyUnnumbered =
      el.getAttribute('data-toc-numbered') === 'false' ||
      el.getAttribute('data-numbered') === 'false' ||
      el.getAttribute('data-toc-number') === 'false' ||
      el.getAttribute('data-toc-number') === 'none' ||
      el.getAttribute('data-toc-number') === '';

    let number: string | undefined = undefined;

    if (!isExplicitlyUnnumbered) {
      const dataNumber = el.getAttribute('data-toc-number') || el.getAttribute('data-number');
      const numberEl = el.querySelector<HTMLElement>(
        '[class*="sectionNumber"], [class*="SectionNumber"]'
      );
      const validNumberEl =
        numberEl && (!numberEl.closest(sectionSelector) || numberEl.closest(sectionSelector) === el)
          ? numberEl
          : null;
      const numberText = validNumberEl?.textContent?.replace(/^Section\s*/i, '').trim();

      number = (dataNumber && dataNumber !== 'false') ? dataNumber : numberText || undefined;
    }

    if (isSubsection) {
      const subItem: NavItem = {
        id,
        label,
        number,
        href: `#${id}`,
        level: 'subsection',
      };

      let parentEntry: { el: HTMLElement; item: NavItem } | undefined;
      for (let i = sectionEntries.length - 1; i >= 0; i--) {
        if (sectionEntries[i].el.contains(el)) {
          parentEntry = sectionEntries[i];
          break;
        }
      }

      if (parentEntry) {
        if (!parentEntry.item.children) {
          parentEntry.item.children = [];
        }
        parentEntry.item.children.push(subItem);
      } else {
        items.push(subItem);
      }
    } else {
      const sectionItem: NavItem = {
        id,
        label,
        number,
        href: `#${id}`,
      };
      items.push(sectionItem);
      sectionEntries.push({ el, item: sectionItem });
    }
  }

  return items;
}

function areNavItemsEqual(a: NavItem[], b: NavItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((itemA, idx) => {
    const itemB = b[idx];
    return (
      itemA.id === itemB.id &&
      itemA.label === itemB.label &&
      itemA.number === itemB.number &&
      itemA.href === itemB.href &&
      itemA.level === itemB.level &&
      areNavItemsEqual(itemA.children || [], itemB.children || [])
    );
  });
}

/**
 * useAutoTableOfContents Hook
 *
 * Canonical DOM-driven table of contents discovery for long-form editorial views:
 * - Scans a content container for semantic sections with IDs
 * - Automatically extracts labels and numbers using a robust cascade
 * - Dynamic reactivity: attaches a MutationObserver to instantly capture added/removed sections
 * - Debounced via requestAnimationFrame to guarantee smooth 60fps performance without layout thrashing
 */
export function useAutoTableOfContents(
  options: UseAutoTableOfContentsOptions = {}
): NavItem[] {
  const {
    containerId = 'node-content',
    containerRef,
    sectionSelector,
    formatIdToTitle = defaultFormatIdToTitle,
  } = options;

  const [items, setItems] = useState<NavItem[]>([]);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const getContainer = (): HTMLElement | null => {
      if (containerRef?.current) return containerRef.current;
      if (containerId) return document.getElementById(containerId);
      return null;
    };

    const updateItems = () => {
      const container = getContainer();
      if (!container) {
        setItems([]);
        return;
      }

      const newItems = extractNavItemsFromContainer(
        container,
        sectionSelector,
        formatIdToTitle
      );

      setItems((prev) => (areNavItemsEqual(prev, newItems) ? prev : newItems));
    };

    if (typeof MutationObserver === 'undefined') {
      updateItems();
      return;
    }

    const scheduleUpdate = () => {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        updateItems();
        rafIdRef.current = null;
      });
    };

    let observedContainer: HTMLElement | null = null;
    const containerObserver = new MutationObserver(() => {
      scheduleUpdate();
    });

    const syncContainerObserver = () => {
      const nextContainer = getContainer();
      if (nextContainer === observedContainer) return;

      containerObserver.disconnect();
      observedContainer = nextContainer;

      if (observedContainer) {
        containerObserver.observe(observedContainer, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: [
            'id',
            'data-toc-title',
            'data-title',
            'data-toc-number',
            'data-toc-numbered',
            'data-toc-level',
            'data-number',
            'data-numbered',
            'aria-label',
          ],
        });
      }

      updateItems();
    };

    // Initial scan & observer attachment
    syncContainerObserver();

    // Watch document.body when targeting by containerId so route transitions
    // that mount/unmount the container automatically re-bind the observer.
    let rootObserver: MutationObserver | null = null;
    if (!containerRef && containerId && typeof document !== 'undefined' && document.body) {
      rootObserver = new MutationObserver(() => {
        syncContainerObserver();
      });
      rootObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      containerObserver.disconnect();
      rootObserver?.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [containerId, containerRef, sectionSelector, formatIdToTitle]);

  return items;
}

export default useAutoTableOfContents;
