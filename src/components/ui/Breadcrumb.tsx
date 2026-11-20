import React, { memo } from 'react';
import styles from './Breadcrumb.module.css';

export interface BreadcrumbItem {
  id?: string;
  label: React.ReactNode;
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  isCurrent?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  maxItems?: number;
  separator?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  endSlot?: React.ReactNode;
}

type CollapsedBreadcrumbEntry =
  | (BreadcrumbItem & { isEllipsis?: false })
  | { id: string; isEllipsis: true };

/**
 * Pure helper that collapses middle ancestor segments when `items.length > maxItems`,
 * preserving the first two segments, a single non-interactive ellipsis, and the last two segments.
 */
export function collapseBreadcrumbItems(
  items: BreadcrumbItem[],
  maxItems = 4
): CollapsedBreadcrumbEntry[] {
  if (!items || items.length <= maxItems || maxItems < 4) {
    return items;
  }

  return [
    items[0],
    items[1],
    { id: '__breadcrumb-ellipsis__', isEllipsis: true },
    items[items.length - 2],
    items[items.length - 1],
  ];
}

/**
 * Default editorial breadcrumb separator — restrained slash conforming to Academic Editorial
 */
const DefaultSeparator: React.FC = () => (
  <span className={styles.separator} aria-hidden="true">
    /
  </span>
);

/**
 * Canonical Breadcrumb Navigation Component
 *
 * Implements W3C Breadcrumb Pattern:
 * - Landmark `<nav aria-label="...">` wrapping `<ol>` and `<li>` elements
 * - `aria-current="page"` on current terminal items
 * - Universal Zero Outline Policy compliant
 * - Pure token-driven styling (zero hardcoded values)
 * - Optional endSlot for auxiliary status markers or page badges
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = memo(({
  items,
  maxItems = 4,
  separator = <DefaultSeparator />,
  className,
  ariaLabel = 'Breadcrumb navigation',
  endSlot,
}) => {
  if (!items || items.length === 0) {
    return null;
  }

  const visibleEntries = collapseBreadcrumbItems(items, maxItems);

  return (
    <nav
      className={`${styles.breadcrumbNav} ${className || ''}`}
      aria-label={ariaLabel}
    >
      <div className={styles.breadcrumbInner}>
        <ol className={styles.list}>
          {visibleEntries.map((entry, index) => {
            if ('isEllipsis' in entry && entry.isEllipsis) {
              return (
                <li key={entry.id} className={`${styles.item} ${styles.itemEllipsis}`}>
                  {index > 0 && separator}
                  <span className={styles.ellipsis} aria-hidden="true">
                    …
                  </span>
                </li>
              );
            }

            const item = entry;
            const isLast = index === visibleEntries.length - 1;
            const isCurrent = item.isCurrent ?? isLast;
            const itemKey = item.id || (typeof item.label === 'string' ? `${item.label}-${index}` : `crumb-${index}`);
            const titleAttr = typeof item.label === 'string' ? item.label : undefined;

            return (
              <li
                key={itemKey}
                className={`${styles.item} ${isCurrent ? styles.itemCurrent : ''}`}
              >
                {index > 0 && separator}

                {isCurrent && !item.href && !item.onClick ? (
                  <span
                    className={styles.current}
                    aria-current="page"
                    title={titleAttr}
                  >
                    {item.icon && <span className={styles.itemIcon}>{item.icon}</span>}
                    <span className={styles.itemLabel}>{item.label}</span>
                    {item.badge && <span className={styles.itemBadge}>{item.badge}</span>}
                  </span>
                ) : item.href ? (
                  <a
                    href={item.href}
                    className={styles.link}
                    onClick={item.onClick}
                    aria-current={isCurrent ? 'page' : undefined}
                    title={titleAttr}
                  >
                    {item.icon && <span className={styles.itemIcon}>{item.icon}</span>}
                    <span className={styles.itemLabel}>{item.label}</span>
                    {item.badge && <span className={styles.itemBadge}>{item.badge}</span>}
                  </a>
                ) : (
                  <button
                    type="button"
                    className={styles.button}
                    onClick={item.onClick}
                    aria-current={isCurrent ? 'page' : undefined}
                    title={titleAttr}
                  >
                    {item.icon && <span className={styles.itemIcon}>{item.icon}</span>}
                    <span className={styles.itemLabel}>{item.label}</span>
                    {item.badge && <span className={styles.itemBadge}>{item.badge}</span>}
                  </button>
                )}
              </li>
            );
          })}
        </ol>

        {endSlot && <div className={styles.endSlot}>{endSlot}</div>}
      </div>
    </nav>
  );
});

Breadcrumb.displayName = 'Breadcrumb';

export default Breadcrumb;
