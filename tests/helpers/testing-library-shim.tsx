import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

export { act };

export class MockElement {
  nodeType = 1;
  tagName = 'DIV';
  childNodes: any[] = [];
  parentNode: any = null;
  ownerDocument: any = null;
  style: Record<string, string> = {};
  className = '';
  value: string = '';
  src: string = '';
  alt: string = '';
  listeners: Record<string, Array<{ fn: any; capture: boolean }>> = {};

  appendChild(child: any) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore(newChild: any, refChild: any) {
    if (!refChild) return this.appendChild(newChild);
    if (newChild.parentNode) {
      newChild.parentNode.removeChild(newChild);
    }
    const idx = this.childNodes.indexOf(refChild);
    newChild.parentNode = this;
    if (idx !== -1) {
      this.childNodes.splice(idx, 0, newChild);
    } else {
      this.childNodes.push(newChild);
    }
    return newChild;
  }

  removeChild(child: any) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  setAttribute(name: string, value: any) {
    const str = String(value);
    (this as any)[name] = str;
    if (name === 'class') this.className = str;
    if (name === 'value') this.value = str;
    if (name === 'src') this.src = str;
    if (name === 'alt') this.alt = str;
  }

  getAttribute(name: string) {
    if (name === 'class') return this.className || null;
    if (name === 'value') return this.value ?? null;
    if (name === 'src') return this.src || null;
    if (name === 'alt') return this.alt || null;
    return (this as any)[name] ?? null;
  }

  removeAttribute(name: string) {
    delete (this as any)[name];
    if (name === 'class') this.className = '';
    if (name === 'value') this.value = '';
    if (name === 'src') this.src = '';
    if (name === 'alt') this.alt = '';
  }

  hasAttribute(name: string) {
    return this.getAttribute(name) !== null;
  }

  addEventListener(type: string, fn: any, options?: any) {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push({ fn, capture });
  }

  removeEventListener(type: string, fn: any, options?: any) {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(
      (entry) => entry.fn !== fn || entry.capture !== capture
    );
  }

  dispatchEvent(event: any): boolean {
    const evt = event || {};
    evt.target = evt.target || this;
    let stopped = false;
    evt.stopPropagation = () => {
      stopped = true;
    };
    evt.preventDefault = () => {
      evt.defaultPrevented = true;
    };

    const path: any[] = [this];
    let cur: any = this.parentNode;
    while (cur) {
      path.push(cur);
      cur = cur.parentNode;
    }
    if (this.ownerDocument && !path.includes(this.ownerDocument)) {
      path.push(this.ownerDocument);
    }

    // Capture phase (top-down)
    for (let i = path.length - 1; i >= 0 && !stopped; i--) {
      const node = path[i];
      const list = node.listeners?.[evt.type] || [];
      for (const entry of [...list]) {
        if (entry.capture) {
          evt.currentTarget = node;
          entry.fn.call(node, evt);
        }
      }
    }

    // Bubble phase (bottom-up)
    for (let i = 0; i < path.length && !stopped; i++) {
      const node = path[i];
      const list = node.listeners?.[evt.type] || [];
      for (const entry of [...list]) {
        if (!entry.capture) {
          evt.currentTarget = node;
          entry.fn.call(node, evt);
        }
      }
      if (evt.bubbles === false) break;
    }

    return !evt.defaultPrevented;
  }

  click() {
    this.dispatchEvent({ type: 'click', bubbles: true });
  }

  focus() {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
    this.dispatchEvent({ type: 'focus', bubbles: false });
  }

  blur() {
    if (this.ownerDocument && this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = null;
    }
    this.dispatchEvent({ type: 'blur', bubbles: false });
  }

  contains(other: any): boolean {
    if (other === this) return true;
    for (const child of this.childNodes) {
      if (child === other || (child.contains && child.contains(other))) {
        return true;
      }
    }
    return false;
  }

  get textContent(): string {
    return this.childNodes.map((c) => c.textContent || '').join('');
  }

  set textContent(val: string) {
    this.childNodes = [
      {
        nodeType: 3,
        textContent: String(val),
        parentNode: this,
        ownerDocument: this.ownerDocument,
      },
    ];
  }

  get innerText(): string {
    return this.textContent;
  }
}

export class MockHTMLElement extends MockElement { }
export class MockHTMLButtonElement extends MockHTMLElement { }
export class MockHTMLImageElement extends MockHTMLElement { }
export class MockHTMLIFrameElement extends MockHTMLElement { }
export class MockHTMLTextAreaElement extends MockHTMLElement { }
export class MockDocument { }

let globalDoc: any = null;
let globalWin: any = null;
const mountedContainers: any[] = [];

export function ensureDomEnvironment() {
  if (globalDoc) {
    return { document: globalDoc, window: globalWin };
  }

  const docListeners: Record<string, Array<{ fn: any; capture: boolean }>> = {};
  const winListeners: Record<string, Array<{ fn: any; capture: boolean }>> = {};

  const doc: any = {
    nodeType: 9,
    body: new MockElement(),
    activeElement: null,
    listeners: docListeners,
    createElement(tag: string) {
      let el: MockElement;
      const lower = tag.toLowerCase();
      if (lower === 'button') el = new MockHTMLButtonElement();
      else if (lower === 'img') el = new MockHTMLImageElement();
      else if (lower === 'iframe') el = new MockHTMLIFrameElement();
      else if (lower === 'textarea') el = new MockHTMLTextAreaElement();
      else el = new MockHTMLElement();

      el.tagName = tag.toUpperCase();
      el.ownerDocument = doc;
      return el;
    },
    createElementNS(_ns: string, tag: string) {
      return doc.createElement(tag);
    },
    createTextNode(text: string) {
      return {
        nodeType: 3,
        textContent: String(text),
        ownerDocument: doc,
        parentNode: null,
      };
    },
    addEventListener(type: string, fn: any, options?: any) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      if (!docListeners[type]) docListeners[type] = [];
      docListeners[type].push({ fn, capture });
    },
    removeEventListener(type: string, fn: any, options?: any) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      if (!docListeners[type]) return;
      docListeners[type] = docListeners[type].filter(
        (entry) => entry.fn !== fn || entry.capture !== capture
      );
    },
    dispatchEvent(event: any) {
      const list = docListeners[event?.type] || [];
      for (const entry of [...list]) {
        entry.fn(event);
      }
      return true;
    },
  };

  doc.body.tagName = 'BODY';
  doc.body.ownerDocument = doc;

  const storageMap = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, val: string) => {
      storageMap.set(key, String(val));
    },
    removeItem: (key: string) => {
      storageMap.delete(key);
    },
    clear: () => {
      storageMap.clear();
    },
    get length() {
      return storageMap.size;
    },
    key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
  };

  const win: any = {
    document: doc,
    Element: MockElement,
    HTMLElement: MockHTMLElement,
    HTMLButtonElement: MockHTMLButtonElement,
    HTMLImageElement: MockHTMLImageElement,
    HTMLIFrameElement: MockHTMLIFrameElement,
    HTMLTextAreaElement: MockHTMLTextAreaElement,
    Document: MockDocument,
    localStorage: mockLocalStorage,
    addEventListener(type: string, fn: any, options?: any) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      if (!winListeners[type]) winListeners[type] = [];
      winListeners[type].push({ fn, capture });
    },
    removeEventListener(type: string, fn: any, options?: any) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      if (!winListeners[type]) return;
      winListeners[type] = winListeners[type].filter(
        (entry) => entry.fn !== fn || entry.capture !== capture
      );
    },
    dispatchEvent(event: any) {
      const list = winListeners[event?.type] || [];
      for (const entry of [...list]) {
        entry.fn(event);
      }
      return true;
    },
  };
  doc.defaultView = win;

  (global as any).window = win;
  (global as any).document = doc;
  (global as any).Element = MockElement;
  (global as any).HTMLElement = MockHTMLElement;
  (global as any).HTMLButtonElement = MockHTMLButtonElement;
  (global as any).HTMLImageElement = MockHTMLImageElement;
  (global as any).HTMLIFrameElement = MockHTMLIFrameElement;
  (global as any).HTMLTextAreaElement = MockHTMLTextAreaElement;
  (global as any).Document = MockDocument;
  (global as any).localStorage = mockLocalStorage;
  (global as any).IS_REACT_ACT_ENVIRONMENT = true;

  if (!(global as any).CustomEvent) {
    class CustomEvent<T = any> extends Event {
      detail: T;
      constructor(type: string, params?: { detail?: T }) {
        super(type);
        this.detail = params?.detail as T;
      }
    }
    (global as any).CustomEvent = CustomEvent;
  }

  globalDoc = doc;
  globalWin = win;

  return { document: doc, window: win };
}

// Auto-initialize DOM environment upon loading the shim
ensureDomEnvironment();

if (typeof (globalThis as any).afterEach === 'function') {
  (globalThis as any).afterEach(() => {
    cleanup();
  });
}

function traverse(root: any, predicate: (el: any) => boolean): any[] {
  const matches: any[] = [];
  const walk = (node: any) => {
    if (!node || node.nodeType !== 1) return;
    if (predicate(node)) matches.push(node);
    for (const child of node.childNodes || []) {
      walk(child);
    }
  };
  walk(root);
  return matches;
}

function matchesTextOrPattern(actual: string, expected: string | RegExp): boolean {
  if (expected instanceof RegExp) {
    return expected.test(actual);
  }
  return actual.toLowerCase().includes(expected.toLowerCase());
}

export interface RenderResult {
  container: any;
  root: Root;
  unmount: () => void;
  rerender: (ui: React.ReactElement) => void;
}

export function render(ui: React.ReactElement, options?: { container?: any }): RenderResult {
  ensureDomEnvironment();
  const container = options?.container || globalDoc.createElement('div');
  if (!options?.container) {
    globalDoc.body.appendChild(container);
  }
  mountedContainers.push(container);

  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });

  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      const idx = mountedContainers.indexOf(container);
      if (idx !== -1) mountedContainers.splice(idx, 1);
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
    rerender: (newUi: React.ReactElement) => {
      act(() => {
        root.render(newUi);
      });
    },
  };
}

export function cleanup() {
  while (mountedContainers.length > 0) {
    const c = mountedContainers.pop();
    if (c && c.parentNode) {
      c.parentNode.removeChild(c);
    }
  }
}

export const screen = {
  getByRole(role: string, options?: { name?: string | RegExp }): any {
    ensureDomEnvironment();
    const targetRole = role.toLowerCase();
    const match = this.queryByRole(targetRole, options);
    if (!match) {
      throw new Error(
        `Unable to find an element with role "${role}"${options?.name ? ` and name matching ${options.name}` : ''
        }`
      );
    }
    return match;
  },

  queryByRole(role: string, options?: { name?: string | RegExp }): any | null {
    ensureDomEnvironment();
    const targetRole = role.toLowerCase();
    const searchRoots = mountedContainers.length > 0 ? mountedContainers : [globalDoc.body];

    for (const root of searchRoots) {
      const results = traverse(root, (el) => {
        const explicitRole = (el.getAttribute('role') || '').toLowerCase();
        let matchesRole = explicitRole === targetRole;

        // Semantic implicit role mappings
        if (!matchesRole) {
          const tag = (el.tagName || '').toLowerCase();
          if (targetRole === 'region') {
            matchesRole =
              tag === 'section' && (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby'));
          } else if (targetRole === 'button') {
            matchesRole = tag === 'button';
          } else if (targetRole === 'img') {
            matchesRole = tag === 'img';
          } else if (targetRole === 'heading') {
            matchesRole = /^h[1-6]$/.test(tag);
          }
        }

        if (!matchesRole) return false;

        if (options?.name) {
          const accessibleName =
            el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            el.textContent ||
            '';
          return matchesTextOrPattern(accessibleName, options.name);
        }

        return true;
      });

      if (results.length > 0) return results[0];
    }

    return null;
  },

  getByText(text: string | RegExp): any {
    const match = this.queryByText(text);
    if (!match) {
      throw new Error(`Unable to find an element with text matching ${text}`);
    }
    return match;
  },

  queryByText(text: string | RegExp): any | null {
    ensureDomEnvironment();
    const searchRoots = mountedContainers.length > 0 ? mountedContainers : [globalDoc.body];

    for (const root of searchRoots) {
      const results = traverse(root, (el) => {
        const content = el.textContent || '';
        return matchesTextOrPattern(content, text);
      });

      if (results.length > 0) {
        // Return the deepest matching element
        results.sort((a, b) => (a.childNodes?.length || 0) - (b.childNodes?.length || 0));
        return results[0];
      }
    }

    return null;
  },

  getByTestId(id: string | RegExp): any {
    ensureDomEnvironment();
    const searchRoots = mountedContainers.length > 0 ? mountedContainers : [globalDoc.body];

    for (const root of searchRoots) {
      const results = traverse(root, (el) => {
        const testId = el.getAttribute('data-testid') || '';
        return matchesTextOrPattern(testId, id);
      });
      if (results.length > 0) return results[0];
    }
    throw new Error(`Unable to find an element with data-testid ${id}`);
  },

  queryByTestId(id: string | RegExp): any | null {
    try {
      return this.getByTestId(id);
    } catch {
      return null;
    }
  },
};

export interface RenderHookResult<T, P> {
  result: { current: T };
  rerender: (newProps?: P) => void;
  unmount: () => void;
}

export function renderHook<T, P = any>(
  callback: (props?: P) => T,
  options?: { initialProps?: P }
): RenderHookResult<T, P> {
  ensureDomEnvironment();
  const container = globalDoc.createElement('div');
  const root = createRoot(container);
  const result = { current: undefined as unknown as T };

  function TestHookComponent({ hookProps }: { hookProps?: P }) {
    result.current = callback(hookProps);
    return null;
  }

  act(() => {
    root.render(React.createElement(TestHookComponent, { hookProps: options?.initialProps }));
  });

  return {
    result,
    rerender: (newProps?: P) => {
      act(() => {
        root.render(
          React.createElement(TestHookComponent, {
            hookProps: newProps !== undefined ? newProps : options?.initialProps,
          })
        );
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

export const fireEvent = {
  click: (el: any) => {
    act(() => {
      el.dispatchEvent({ type: 'click', bubbles: true });
    });
  },
  error: (el: any) => {
    act(() => {
      el.dispatchEvent({ type: 'error', bubbles: false });
    });
  },
  change: (el: any, options?: { target?: { value?: string } }) => {
    if (options?.target?.value !== undefined) {
      el.setAttribute('value', options.target.value);
    }
    act(() => {
      el.dispatchEvent({ type: 'change', bubbles: true });
    });
  },
};
