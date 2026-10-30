/**
 * Folio Engine — Canonical Modal & Dialog Positive Action Utilities
 * Handles Ctrl+Enter / Cmd+Enter positive action discovery and triggering.
 */

// Active modal stack to support nested modals and priority targeting
const activeModalStack: HTMLElement[] = [];

export function registerActiveModal(el: HTMLElement | null): void {
  if (!el) return;
  if (!activeModalStack.includes(el)) {
    activeModalStack.push(el);
  }
}

export function unregisterActiveModal(el: HTMLElement | null): void {
  if (!el) return;
  const index = activeModalStack.indexOf(el);
  if (index !== -1) {
    activeModalStack.splice(index, 1);
  }
}

export function isTopmostModal(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (activeModalStack.length === 0) return true;
  return activeModalStack[activeModalStack.length - 1] === el;
}

/**
 * Checks if a keyboard event corresponds to the canonical positive submission shortcut:
 * Ctrl+Enter (Windows/Linux) or Cmd+Enter (Mac).
 */
export function isPositiveShortcut(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return e.key === 'Enter' && (e.ctrlKey || e.metaKey);
}

const POSITIVE_REGEX = /\b(save|submit|publish|confirm|approve|next|done|add|create|continue|apply|deploy|verify|restore|exit|delete|proceed|ok|yes)\b/i;
const NEGATIVE_REGEX = /\b(cancel|close|discard|dismiss|reset|back|keep editing|cancel & exit|no)\b/i;

/**
 * Verifies whether an element is an enabled, visible, clickable positive candidate.
 */
export function isClickablePositiveCandidate(el: HTMLElement | null): el is HTMLElement {
  if (!el) return false;

  // Disabled checks
  if ('disabled' in el && (el as HTMLButtonElement | HTMLInputElement).disabled) {
    return false;
  }
  if (el.getAttribute('aria-disabled') === 'true') {
    return false;
  }

  // Hidden check
  if (el.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  if (typeof window !== 'undefined') {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
  }

  // Reject close/dismiss/cancel buttons explicitly
  const text = (el.textContent || el.getAttribute('aria-label') || '').trim();
  if (
    text === '✕' ||
    text === '×' ||
    NEGATIVE_REGEX.test(text) ||
    el.getAttribute('aria-label')?.toLowerCase().includes('close')
  ) {
    return false;
  }

  return true;
}

/**
 * Discovers the canonical positive action element (button or form) inside a modal container.
 * Priority:
 * 1. Explicit data attributes: [data-positive="true"], [data-action="confirm"|"save"|"submit"|"primary"]
 * 2. Form submit button: button[type="submit"]:not([disabled])
 * 3. Primary/Admin variant buttons: button[data-variant="primary"|"admin"], button[data-primary="true"]
 * 4. Text-matched buttons (Save, Submit, Publish, Add, Confirm, Next, etc.)
 * 5. Containing form (for form.requestSubmit())
 */
export function findPositiveActionElement(container: HTMLElement | null): HTMLElement | null {
  if (!container) return null;

  // 1. Explicit data action indicators
  const explicitCandidates = Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-positive="true"], [data-action="confirm"], [data-action="save"], [data-action="submit"], [data-action="primary"]'
    )
  ).filter(isClickablePositiveCandidate);

  if (explicitCandidates.length > 0) {
    return explicitCandidates[0];
  }

  // 2. Submit buttons
  const submitButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      'button[type="submit"], input[type="submit"]'
    )
  ).filter(isClickablePositiveCandidate);

  if (submitButtons.length > 0) {
    return submitButtons[0];
  }

  // 3. Primary or Admin variant styled buttons
  const variantButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      'button[data-variant="primary"], button[data-variant="admin"], button[data-primary="true"], button[class*="variantPrimary"], button[class*="variantAdmin"], button[class*="modalDeleteButton"], button[class*="primaryButton"], button[class*="saveButton"]'
    )
  ).filter(isClickablePositiveCandidate);

  if (variantButtons.length > 0) {
    return variantButtons[0];
  }

  // 4. Positive keyword matches on button text/labels
  const allButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement>('button')
  ).filter(isClickablePositiveCandidate);

  const textMatched = allButtons.filter((btn) => {
    const text = (btn.textContent || btn.getAttribute('aria-label') || '').trim();
    return POSITIVE_REGEX.test(text) && !NEGATIVE_REGEX.test(text);
  });

  if (textMatched.length > 0) {
    return textMatched[0];
  }

  // 5. Fallback: Form element inside container
  const form = container.querySelector('form');
  if (form) {
    return form;
  }

  return null;
}

/**
 * Triggers the positive action element cleanly:
 * - If form: calls requestSubmit() or submits
 * - If button: calls .click()
 */
export function triggerPositiveAction(element: HTMLElement | null): boolean {
  if (!element) return false;

  if (element instanceof HTMLFormElement) {
    if (typeof element.requestSubmit === 'function') {
      element.requestSubmit();
      return true;
    }
    const submitBtn = element.querySelector<HTMLButtonElement | HTMLInputElement>(
      'button[type="submit"], input[type="submit"]'
    );
    if (submitBtn && isClickablePositiveCandidate(submitBtn)) {
      submitBtn.click();
      return true;
    }
    element.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    return true;
  }

  if (isClickablePositiveCandidate(element)) {
    element.click();
    return true;
  }

  return false;
}
