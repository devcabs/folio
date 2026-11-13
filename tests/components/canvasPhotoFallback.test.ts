import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ReactDOMServer from 'react-dom/server';
import { CanvasPhoto } from '../../src/components/canvas/CanvasPhoto';
import type { PhotoElement } from '../../src/types/canvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';

function setupMockDom() {
  const prevWindow = (global as any).window;
  const prevDocument = (global as any).document;
  const prevActEnv = (global as any).IS_REACT_ACT_ENVIRONMENT;

  class MockElement {
    nodeType = 1;
    tagName = 'DIV';
    childNodes: any[] = [];
    parentNode: any = null;
    ownerDocument: any = null;
    style: any = {};
    className = '';
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
    }

    getAttribute(name: string) {
      if (name === 'class') return this.className || null;
      return (this as any)[name] ?? null;
    }

    removeAttribute(name: string) {
      delete (this as any)[name];
      if (name === 'class') this.className = '';
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
  }

  class MockHTMLElement extends MockElement { }
  class MockHTMLButtonElement extends MockHTMLElement { }
  class MockHTMLImageElement extends MockHTMLElement { }
  class MockHTMLIFrameElement extends MockHTMLElement { }
  class MockDocument { }

  const docListeners: Record<string, Array<{ fn: any; capture: boolean }>> = {};
  const winListeners: Record<string, Array<{ fn: any; capture: boolean }>> = {};

  const doc: any = {
    nodeType: 9,
    body: new MockElement(),
    activeElement: null,
    listeners: docListeners,
    createElement(tag: string) {
      const el = new MockElement();
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
  };

  doc.body.tagName = 'BODY';
  doc.body.ownerDocument = doc;

  const win: any = {
    document: doc,
    Element: MockElement,
    HTMLElement: MockHTMLElement,
    HTMLButtonElement: MockHTMLButtonElement,
    HTMLImageElement: MockHTMLImageElement,
    HTMLIFrameElement: MockHTMLIFrameElement,
    Document: MockDocument,
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
    dispatchEvent: () => true,
  };
  doc.defaultView = win;

  (global as any).window = win;
  (global as any).document = doc;
  (global as any).Element = MockElement;
  (global as any).HTMLElement = MockHTMLElement;
  (global as any).HTMLButtonElement = MockHTMLButtonElement;
  (global as any).HTMLImageElement = MockHTMLImageElement;
  (global as any).HTMLIFrameElement = MockHTMLIFrameElement;
  (global as any).Document = MockDocument;
  (global as any).IS_REACT_ACT_ENVIRONMENT = true;

  const findElements = (root: any, predicate: (el: any) => boolean): any[] => {
    const out: any[] = [];
    const walk = (node: any) => {
      if (!node || node.nodeType !== 1) return;
      if (predicate(node)) out.push(node);
      for (const child of node.childNodes || []) {
        walk(child);
      }
    };
    walk(root);
    return out;
  };

  return {
    document: doc,
    findElements,
    cleanup: () => {
      (global as any).window = prevWindow;
      (global as any).document = prevDocument;
      (global as any).IS_REACT_ACT_ENVIRONMENT = prevActEnv;
    },
  };
}

describe('Subtask 3.6: Resilient Image Fallback Card & Latency Elimination', () => {
  let dom: ReturnType<typeof setupMockDom>;

  beforeEach(() => {
    vi.restoreAllMocks();
    dom = setupMockDom();
  });

  afterEach(() => {
    dom.cleanup();
    vi.restoreAllMocks();
  });

  const samplePhotoWithDrive: PhotoElement = {
    id: 'photo-test-1',
    type: 'photo',
    pointId: 'node.test.photo.1',
    src: 'https://folio.example.com/api/media/drive/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIvE2up00',
    driveUrl: 'https://drive.google.com/drive/folders/test-folder-123',
    rawDriveUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIvE2up00/view',
    caption: 'Experimental Evidence Specimen',
    alt: 'Specimen Photograph',
  };

  const emptyPhoto: PhotoElement = {
    id: 'photo-test-empty',
    type: 'photo',
    pointId: 'node.test.photo.empty',
    src: '',
    alt: 'Pending Evidence',
  };

  describe('Static & SSR Fallback Card Rendering', () => {
    it('renders the tokenized photographic fallback card when hasPhoto is false', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: true,
        isDesktop: true,
      } as any);

      const html = ReactDOMServer.renderToString(
        React.createElement(CanvasPhoto, {
          element: emptyPhoto,
          nodeId: 'node-test',
        })
      );

      expect(html).toContain('photoFallbackCard');
      expect(html).toContain('role="region"');
      expect(html).toContain('aria-label="Image Unavailable"');
      expect(html).toContain('tabindex="-1"');
      expect(html).toContain('Pending Evidence');
      expect(html).toContain('Source image inaccessible');
    });

    it('renders public calm status message when hasPhoto is false in public mode', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
      } as any);

      const html = ReactDOMServer.renderToString(
        React.createElement(CanvasPhoto, {
          element: emptyPhoto,
          nodeId: 'node-test',
        })
      );

      expect(html).toContain('photoFallbackCard');
      expect(html).toContain('Image documentation is currently being synchronized.');
      expect(html).not.toContain('Re-link Photo');
      expect(html).not.toContain('Verify Google Drive sharing permissions');
    });
  });

  describe('Image Load Failure & Transition to Fallback Card', () => {
    it('transitions to fallback card upon image onError without swapping to drive.google.com thumbnail URL', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: true,
        isDesktop: true,
      } as any);

      const onEditMock = vi.fn();
      const container = dom.document.createElement('div');
      dom.document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          React.createElement(CanvasPhoto, {
            element: samplePhotoWithDrive,
            nodeId: 'node-test',
            onEdit: onEditMock,
          })
        );
      });

      // Initial render must have img tag with edge media proxy
      const imgs = dom.findElements(container, (el) => el.tagName === 'IMG');
      expect(imgs.length).toBe(1);
      const initialImgSrc = imgs[0].src;
      expect(initialImgSrc).toContain('/api/media/drive/');
      expect(initialImgSrc).not.toContain('drive.google.com/thumbnail');

      // Trigger onError on the image
      act(() => {
        imgs[0].dispatchEvent({ type: 'error', bubbles: false });
      });

      // After error, image should be gone, and fallback card should appear
      const imgsAfterError = dom.findElements(container, (el) => el.tagName === 'IMG');
      expect(imgsAfterError.length).toBe(0);

      const fallbackRegions = dom.findElements(
        container,
        (el) => el.getAttribute('role') === 'region' && el.getAttribute('aria-label') === 'Image Unavailable'
      );
      expect(fallbackRegions.length).toBe(1);

      // Verify no network request / src attribute was set to drive.google.com/thumbnail
      const anyGoogleThumbnail = dom.findElements(
        container,
        (el) => typeof el.src === 'string' && el.src.includes('drive.google.com/thumbnail')
      );
      expect(anyGoogleThumbnail.length).toBe(0);

      // Verify developer troubleshooting message is rendered
      const textContent = container.textContent;
      expect(textContent).toContain('Experimental Evidence Specimen');
      expect(textContent).toContain('Source image inaccessible. Verify Google Drive sharing permissions');
      expect(textContent).toContain('Re-link Photo');

      // Verify onEdit button is clickable
      const editButtons = dom.findElements(
        container,
        (el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Edit photo attachment'
      );
      expect(editButtons.length).toBe(1);

      act(() => {
        editButtons[0].click();
      });
      expect(onEditMock).toHaveBeenCalledTimes(1);
    });

    it('renders calm message in public mode upon image failure without edit controls', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
      } as any);

      const container = dom.document.createElement('div');
      dom.document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          React.createElement(CanvasPhoto, {
            element: samplePhotoWithDrive,
            nodeId: 'node-test',
          })
        );
      });

      const imgs = dom.findElements(container, (el) => el.tagName === 'IMG');
      expect(imgs.length).toBe(1);

      // Trigger onError
      act(() => {
        imgs[0].dispatchEvent({ type: 'error', bubbles: false });
      });

      const textContent = container.textContent;
      expect(textContent).toContain('Image documentation is currently being synchronized.');
      expect(textContent).not.toContain('Re-link Photo');
      expect(textContent).not.toContain('Verify Google Drive sharing permissions');

      const editButtons = dom.findElements(
        container,
        (el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Edit photo attachment'
      );
      expect(editButtons.length).toBe(0);
    });

    it('resets error state if element src prop changes', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
      } as any);

      const container = dom.document.createElement('div');
      dom.document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          React.createElement(CanvasPhoto, {
            element: samplePhotoWithDrive,
            nodeId: 'node-test',
          })
        );
      });

      const imgs = dom.findElements(container, (el) => el.tagName === 'IMG');
      expect(imgs.length).toBe(1);

      // Trigger error -> transitions to fallback
      act(() => {
        imgs[0].dispatchEvent({ type: 'error', bubbles: false });
      });

      expect(dom.findElements(container, (el) => el.tagName === 'IMG').length).toBe(0);

      // Update prop with a new valid image src
      const updatedPhoto: PhotoElement = {
        id: 'photo-test-1',
        type: 'photo',
        pointId: 'node.test.photo.updated',
        src: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
      };

      act(() => {
        root.render(
          React.createElement(CanvasPhoto, {
            element: updatedPhoto,
            nodeId: 'node-test',
          })
        );
      });

      // Img must reappear after src change
      const imgsAfterUpdate = dom.findElements(container, (el) => el.tagName === 'IMG');
      expect(imgsAfterUpdate.length).toBe(1);
      expect(imgsAfterUpdate[0].src).toBe('https://images.unsplash.com/photo-1544717305-2782549b5136');
    });
  });
});
