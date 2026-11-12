import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createInMemoryAdapter, type StorageAdapter } from '../src/utils/storageAdapter';
import {
  createInMemoryAdapter as createInMemoryAdapterFromIndex,
  ContentMigrationSchema,
  CodeMigrationSchema,
  MigrationEntrySchema,
  PendingMigrationReportSchema,
  EngineConfigSchema as EngineConfigSchemaFromIndex,
  createDefaultEngineConfig as createDefaultEngineConfigFromIndex,
  FOLIO_MIGRATION_LEDGER as FOLIO_MIGRATION_LEDGER_FROM_INDEX,
  compareSemver as compareSemverFromIndex,
  getMigrationLedger as getMigrationLedgerFromIndex,
  getPendingMigrations as getPendingMigrationsFromIndex,
  generateAiMigrationPrompt as generateAiMigrationPromptFromIndex,
  DevMigrationModal as DevMigrationModalFromIndex,
  DevModeBadge,
  MigrationProvider,
  DeveloperModeProvider,
  setSessionUnlockTime,
  clearSessionUnlockTime,
  hashPin,
  useDeveloperMode,
  type ContentMigration,
  type CodeMigration,
  type MigrationEntry,
  type PendingMigrationReport,
  type EngineConfig,
} from '../src/index';
import { DevMigrationModal } from '../src/components/dev/DevMigrationModal';
import {
  FOLIO_MIGRATION_LEDGER,
  compareSemver as compareSemverFromLedger,
} from '../src/migrations/ledger';
import {
  EngineConfigSchema,
  createDefaultEngineConfig,
  setEngineConfig,
  resetEngineConfig,
} from '../src/config/engine.config';
import {
  getMigrationLedger,
  getContentVersionWatermark,
  setContentVersionWatermark,
  getPendingMigrations,
  generateAiMigrationPrompt,
} from '../src/services/migrationService';
import {
  resolveContentWatermark,
  updateWatermark,
  FOLIO_CONTENT_VERSION_KEY,
} from '../src/utils/watermarkResolver';

/**
 * Migration & Storage Isolation Test Suite
 *
 * Structural Test Conventions (Subtask 1.8):
 * 1. Every `describe` block that touches watermark state MUST declare an isolated
 *    `let storage: StorageAdapter` reset via `beforeEach(() => { storage = createInMemoryAdapter(); })`.
 * 2. All storage interactions MUST go through the injected `storage` adapter.
 * 3. Direct global browser storage references are strictly forbidden in test files.
 */

describe('storage isolation & deterministic ordering', () => {
  it('storage adapter is isolated between test cases', () => {
    const a = createInMemoryAdapter();
    const b = createInMemoryAdapter();
    a.setItem('key', 'value-a');
    expect(b.getItem('key')).toBeNull(); // No shared state
  });

  it('exports createInMemoryAdapter from public package index', () => {
    const adapter = createInMemoryAdapterFromIndex();
    adapter.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.3');
    expect(adapter.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('0.1.3');
  });
});

describe('watermark resolution', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createInMemoryAdapter();
  });

  it('sets watermark to 0.1.3 in isolated storage without leaking to subsequent tests', () => {
    setContentVersionWatermark('0.1.3', storage);

    expect(getContentVersionWatermark(undefined, storage)).toBe('0.1.3');
    expect(resolveContentWatermark(undefined, storage)).toBe('0.1.3');
  });

  it('starts at 0.0.0 baseline even when executed after a test that wrote 0.1.3', () => {
    expect(getContentVersionWatermark(undefined, storage)).toBe('0.0.0');
    expect(resolveContentWatermark(undefined, storage)).toBe('0.0.0');
  });

  it('passes injected storage adapter across updateWatermark and getPendingMigrations', () => {
    updateWatermark('0.1.2', storage);
    expect(getContentVersionWatermark({ contentVersion: '0.1.1' }, storage)).toBe('0.1.2');

    const report = getPendingMigrations(undefined, storage);
    expect(report.contentVersionWatermark).toBe('0.1.2');
  });
});

// ── Pre-wired Test Structure for Tasks 1.10–1.15 ─────────────────────────────

describe('Task 1.10: Migration Data Contracts & Configuration', () => {
  beforeEach(() => {
    resetEngineConfig();
  });

  afterEach(() => {
    resetEngineConfig();
  });

  it('validates well-formed MigrationEntry objects with Zod schemas', () => {
    const contentChange: ContentMigration = {
      id: 'chart-dataset-v2',
      title: 'Migrate Chart Datasets',
      required: true,
      description: 'Wrap legacy CSV payloads in CachedIndicatorDataset structure.',
      affectedEntities: ['nodes', 'sample-nodes.json', 'chartDatasets'],
      migrationPrompt: 'Inspect chartDatasets and add asOfDate to each dataset entry.',
    };

    const codeAction: CodeMigration = {
      description: 'Pass contentVersion in EngineConfig.',
      affectedFiles: ['src/App.tsx'],
      exampleBefore: "setEngineConfig({ appId: 'my-app', appNamespace: 'my' })",
      exampleAfter: "setEngineConfig({ appId: 'my-app', appNamespace: 'my', contentVersion: '0.1.4' })",
    };

    const entry: MigrationEntry = {
      version: '0.1.4',
      releaseDate: '2026-11-11',
      title: 'Migration Data Contracts',
      summary: 'Introduces typed migration contracts and contentVersion config watermark.',
      breakingChanges: ['Requires Zod ^3.24.2 for schema validation.'],
      codeActions: [codeAction],
      contentChanges: [contentChange],
    };

    const parsedEntry = MigrationEntrySchema.safeParse(entry);
    expect(parsedEntry.success).toBe(true);
    if (parsedEntry.success) {
      expect(parsedEntry.data).toEqual(entry);
    }

    expect(ContentMigrationSchema.safeParse(contentChange).success).toBe(true);
    expect(CodeMigrationSchema.safeParse(codeAction).success).toBe(true);

    const report: PendingMigrationReport = {
      currentEngineVersion: '0.1.4',
      contentVersionWatermark: '0.1.2',
      hasPendingContentChanges: true,
      pendingContentChanges: [contentChange],
      unappliedVersions: ['0.1.3', '0.1.4'],
    };
    expect(PendingMigrationReportSchema.safeParse(report).success).toBe(true);

    // Rejects malformed entries (missing required fields, invalid semver, extra strict keys)
    expect(MigrationEntrySchema.safeParse({ ...entry, version: 'v0.1.4' }).success).toBe(false);
    expect(MigrationEntrySchema.safeParse({ ...entry, title: '' }).success).toBe(false);
    expect(MigrationEntrySchema.safeParse({ ...entry, unexpected: true }).success).toBe(false);
  });

  it('validates EngineConfigSchema with and without contentVersion', () => {
    const baseConfig: EngineConfig = {
      appId: 'consumer-portfolio',
      appNamespace: 'consumer',
      nodes: [],
      branding: {
        appName: 'Consumer App',
      },
    };

    const withoutContentVersion = EngineConfigSchema.safeParse(baseConfig);
    expect(withoutContentVersion.success).toBe(true);
    if (withoutContentVersion.success) {
      expect(withoutContentVersion.data.contentVersion).toBeUndefined();
    }

    const withUndefinedContentVersion = EngineConfigSchema.safeParse({
      ...baseConfig,
      contentVersion: undefined,
    });
    expect(withUndefinedContentVersion.success).toBe(true);

    const withContentVersion = EngineConfigSchema.safeParse({
      ...baseConfig,
      contentVersion: '0.1.4',
    });
    expect(withContentVersion.success).toBe(true);
    if (withContentVersion.success) {
      expect(withContentVersion.data.contentVersion).toBe('0.1.4');
    }

    const invalidContentVersion = EngineConfigSchema.safeParse({
      ...baseConfig,
      contentVersion: 104,
    });
    expect(invalidContentVersion.success).toBe(false);

    // Verify public index re-exports match module exports
    expect(EngineConfigSchemaFromIndex).toBe(EngineConfigSchema);
    expect(createDefaultEngineConfigFromIndex).toBe(createDefaultEngineConfig);
  });

  it('defaults EngineConfig contentVersion cleanly in createDefaultEngineConfig', () => {
    const defaults = createDefaultEngineConfig();
    expect(defaults.contentVersion).toBeUndefined();
    expect(EngineConfigSchema.safeParse(defaults).success).toBe(true);

    const withWatermark = createDefaultEngineConfig({ contentVersion: '0.1.3' });
    expect(withWatermark.contentVersion).toBe('0.1.3');
    expect(EngineConfigSchema.safeParse(withWatermark).success).toBe(true);

    const updated = setEngineConfig({ contentVersion: '0.1.4' });
    expect(updated.contentVersion).toBe('0.1.4');

    resetEngineConfig();
    expect(createDefaultEngineConfig().contentVersion).toBeUndefined();
  });
});

describe('Task 1.11: Migration Ledger & Runtime Service', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createInMemoryAdapter();
  });

  it('verifies every entry in FOLIO_MIGRATION_LEDGER conforms to MigrationEntrySchema with valid semver', () => {
    expect(FOLIO_MIGRATION_LEDGER_FROM_INDEX).toBe(FOLIO_MIGRATION_LEDGER);
    expect(getMigrationLedgerFromIndex).toBe(getMigrationLedger);
    expect(getPendingMigrationsFromIndex).toBe(getPendingMigrations);
    expect(generateAiMigrationPromptFromIndex).toBe(generateAiMigrationPrompt);

    const ledger = getMigrationLedger();
    expect(ledger.length).toBeGreaterThanOrEqual(4);

    const versions = ledger.map((entry) => entry.version);
    expect(versions).toEqual(expect.arrayContaining(['0.1.0', '0.1.1', '0.1.2', '0.1.3']));

    for (const entry of ledger) {
      const parsed = MigrationEntrySchema.safeParse(entry);
      expect(parsed.success).toBe(true);
    }

    // Mutating the returned array must not mutate the underlying ledger
    ledger.pop();
    expect(getMigrationLedger().length).toBe(FOLIO_MIGRATION_LEDGER.length);
  });

  it('sorts and filters semver versions deterministically (0.1.0 < 0.1.1 < 0.1.2 < 0.1.3)', () => {
    expect(compareSemverFromLedger).toBe(compareSemverFromIndex);

    expect(compareSemverFromLedger('0.1.0', '0.1.1')).toBe(-1);
    expect(compareSemverFromLedger('0.1.1', '0.1.2')).toBe(-1);
    expect(compareSemverFromLedger('0.1.2', '0.1.3')).toBe(-1);
    expect(compareSemverFromLedger('0.1.3', '0.1.3')).toBe(0);
    expect(compareSemverFromLedger('0.1.4', '0.1.3')).toBe(1);
    expect(compareSemverFromLedger('0.2.0', '0.1.10')).toBe(1);
    expect(compareSemverFromLedger('0.1.10', '0.1.2')).toBe(1);

    const unsorted = ['0.1.3', '0.1.0', '0.1.2', '0.1.1'];
    const sorted = [...unsorted].sort(compareSemverFromLedger);
    expect(sorted).toEqual(['0.1.0', '0.1.1', '0.1.2', '0.1.3']);

    const ledgerVersions = getMigrationLedger().map((e) => e.version);
    expect(ledgerVersions).toEqual([...ledgerVersions].sort(compareSemverFromLedger));
  });

  it('returns pending content changes introduced after the resolved watermark', () => {
    const reportFrom011 = getPendingMigrations('0.1.1', storage);
    expect(PendingMigrationReportSchema.safeParse(reportFrom011).success).toBe(true);

    expect(reportFrom011.contentVersionWatermark).toBe('0.1.1');
    expect(reportFrom011.unappliedVersions).toEqual(
      expect.arrayContaining(['0.1.2', '0.1.3'])
    );
    expect(reportFrom011.unappliedVersions).not.toContain('0.1.0');
    expect(reportFrom011.unappliedVersions).not.toContain('0.1.1');
    expect(reportFrom011.hasPendingContentChanges).toBe(true);

    const changeIds = reportFrom011.pendingContentChanges.map((c) => c.id);
    expect(changeIds).toEqual(
      expect.arrayContaining([
        'hero-accent-markdown-0.1.2',
        'milestone-photo-flight-0.1.3',
      ])
    );

    const reportFrom012 = getPendingMigrations('0.1.2', storage);
    expect(reportFrom012.unappliedVersions).not.toContain('0.1.2');
    expect(reportFrom012.unappliedVersions).toContain('0.1.3');
    expect(reportFrom012.pendingContentChanges.map((c) => c.id)).not.toContain(
      'hero-accent-markdown-0.1.2'
    );
    expect(reportFrom012.pendingContentChanges.map((c) => c.id)).toContain(
      'milestone-photo-flight-0.1.3'
    );
  });

  it('formats actionable AI migration prompt with affected entities and instructions', () => {
    const report = getPendingMigrations('0.1.1', storage);
    const prompt = generateAiMigrationPrompt(report);

    expect(prompt).toContain('# AI Migration Prompt');
    expect(prompt).toContain(`Updating from v0.1.1 → v${report.currentEngineVersion}`);
    expect(prompt).toContain('**Affected Entities:**');
    expect(prompt).toContain('**Instructions:**');
    for (const change of report.pendingContentChanges) {
      expect(prompt).toContain(change.title);
      if (change.affectedEntities?.length) {
        expect(prompt).toContain(change.affectedEntities.join(', '));
      }
      if (change.migrationPrompt) {
        expect(prompt).toContain(change.migrationPrompt);
      }
    }
    expect(prompt).toContain('<!-- Generated by @devcabs/folio-engine migrationService -->');
  });

  it('persists acknowledged watermark via injected storage adapter and clears pending flags', () => {
    storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.1');

    const initialReport = getPendingMigrations(undefined, storage);
    expect(initialReport.hasPendingContentChanges).toBe(true);
    expect(initialReport.unappliedVersions.length).toBeGreaterThan(0);

    setContentVersionWatermark(initialReport.currentEngineVersion, storage);
    expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe(initialReport.currentEngineVersion);

    const afterAckReport = getPendingMigrations(undefined, storage);
    expect(afterAckReport.contentVersionWatermark).toBe(initialReport.currentEngineVersion);
    expect(afterAckReport.hasPendingContentChanges).toBe(false);
    expect(afterAckReport.pendingContentChanges).toEqual([]);
    expect(afterAckReport.unappliedVersions).toEqual([]);
  });
});

type MockEventListener = (evt: unknown) => void;

interface MockDomHandle {
  document: any;
  cleanup: () => void;
  findElements: (root: any, predicate: (el: any) => boolean) => any[];
}

function setupMockDom(): MockDomHandle {
  const prevWindow = (global as any).window;
  const prevDocument = (global as any).document;
  const prevNavigator = (global as any).navigator;
  const prevElement = (global as any).Element;
  const prevHTMLElement = (global as any).HTMLElement;
  const prevHTMLButtonElement = (global as any).HTMLButtonElement;
  const prevHTMLInputElement = (global as any).HTMLInputElement;
  const prevHTMLFormElement = (global as any).HTMLFormElement;
  const prevHTMLIFrameElement = (global as any).HTMLIFrameElement;
  const prevDocumentClass = (global as any).Document;
  const prevActEnv = (global as any).IS_REACT_ACT_ENVIRONMENT;

  class MockElement {
    nodeType = 1;
    tagName = 'DIV';
    ownerDocument: any = null;
    parentNode: any = null;
    childNodes: any[] = [];
    style: Record<string, string> = {};
    private attrs: Record<string, string> = {};
    private listeners: Record<string, Array<{ fn: MockEventListener; capture: boolean }>> = {};
    private _text = '';
    className = '';
    disabled = false;
    type = '';

    setAttribute(name: string, value: string) {
      const str = String(value);
      this.attrs[name] = str;
      if (name === 'class') this.className = str;
      if (name === 'disabled') this.disabled = true;
    }

    getAttribute(name: string): string | null {
      if (name === 'class') return this.className || null;
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    }

    hasAttribute(name: string): boolean {
      return Object.prototype.hasOwnProperty.call(this.attrs, name);
    }

    removeAttribute(name: string) {
      delete this.attrs[name];
      if (name === 'class') this.className = '';
      if (name === 'disabled') this.disabled = false;
    }

    get textContent(): string {
      if (this.childNodes.length === 0) return this._text;
      return this.childNodes.map((c) => c.textContent ?? '').join('');
    }

    set textContent(val: string) {
      this.childNodes = [];
      this._text = val == null ? '' : String(val);
    }

    appendChild(child: any) {
      if (child.parentNode) {
        child.parentNode.removeChild(child);
      }
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }

    insertBefore(newNode: any, refNode: any) {
      if (!refNode) return this.appendChild(newNode);
      if (newNode.parentNode) {
        newNode.parentNode.removeChild(newNode);
      }
      const idx = this.childNodes.indexOf(refNode);
      newNode.parentNode = this;
      if (idx === -1) {
        this.childNodes.push(newNode);
      } else {
        this.childNodes.splice(idx, 0, newNode);
      }
      return newNode;
    }

    removeChild(child: any) {
      const idx = this.childNodes.indexOf(child);
      if (idx !== -1) {
        this.childNodes.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }

    contains(other: any): boolean {
      let cur = other;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentNode;
      }
      return false;
    }

    addEventListener(type: string, fn: MockEventListener, options?: boolean | { capture?: boolean }) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push({ fn, capture });
    }

    removeEventListener(type: string, fn: MockEventListener, options?: boolean | { capture?: boolean }) {
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

    focus() {
      if (this.ownerDocument) {
        this.ownerDocument.activeElement = this;
      }
    }

    click() {
      this.dispatchEvent({ type: 'click', bubbles: true, cancelable: true });
    }

    querySelectorAll(selector: string): any[] {
      const results: any[] = [];
      const matchSimple = (el: any): boolean => {
        if (selector.includes('button') && el.tagName === 'BUTTON') {
          if (selector.includes(':not([disabled])') && el.disabled) return false;
          return true;
        }
        if (selector.includes('[data-autofocus]') && el.hasAttribute('data-autofocus')) return true;
        return false;
      };
      const walk = (node: any) => {
        for (const child of node.childNodes || []) {
          if (child.nodeType === 1) {
            if (matchSimple(child)) results.push(child);
            walk(child);
          }
        }
      };
      walk(this);
      return results;
    }

    querySelector(selector: string): any | null {
      return this.querySelectorAll(selector)[0] || null;
    }
  }

  class MockHTMLElement extends MockElement { }
  class MockHTMLButtonElement extends MockHTMLElement { }
  class MockHTMLInputElement extends MockHTMLElement { }
  class MockHTMLFormElement extends MockHTMLElement { }
  class MockHTMLIFrameElement extends MockHTMLElement { }
  class MockDocument { }

  const sessionMap = new Map<string, string>();
  const mockSessionStorage = {
    getItem: (k: string) => (sessionMap.has(k) ? sessionMap.get(k)! : null),
    setItem: (k: string, v: string) => {
      sessionMap.set(k, String(v));
    },
    removeItem: (k: string) => {
      sessionMap.delete(k);
    },
    clear: () => {
      sessionMap.clear();
    },
  };

  const docListeners: Record<string, Array<{ fn: MockEventListener; capture: boolean }>> = {};
  const winListeners: Record<string, Array<{ fn: MockEventListener; capture: boolean }>> = {};

  const doc: any = {
    nodeType: 9,
    activeElement: null as any,
    defaultView: null as any,
    listeners: docListeners,
    documentElement: new MockHTMLElement(),
    body: new MockHTMLElement(),
    createElement(tag: string) {
      const upper = tag.toUpperCase();
      const el =
        upper === 'BUTTON'
          ? new MockHTMLButtonElement()
          : upper === 'INPUT'
            ? new MockHTMLInputElement()
            : upper === 'FORM'
              ? new MockHTMLFormElement()
              : new MockHTMLElement();
      el.tagName = upper;
      el.ownerDocument = doc;
      return el;
    },
    createElementNS(ns: string, tag: string) {
      const el = doc.createElement(tag);
      (el as any).namespaceURI = ns;
      return el;
    },
    createTextNode(text: string) {
      return { nodeType: 3, textContent: String(text), ownerDocument: doc, parentNode: null };
    },
    getElementById: () => null,
    addEventListener(type: string, fn: MockEventListener, options?: boolean | { capture?: boolean }) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      if (!docListeners[type]) docListeners[type] = [];
      docListeners[type].push({ fn, capture });
    },
    removeEventListener(type: string, fn: MockEventListener, options?: boolean | { capture?: boolean }) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      if (!docListeners[type]) return;
      docListeners[type] = docListeners[type].filter(
        (entry) => entry.fn !== fn || entry.capture !== capture
      );
    },
  };

  doc.body.tagName = 'BODY';
  doc.body.ownerDocument = doc;
  doc.documentElement.tagName = 'HTML';
  doc.documentElement.ownerDocument = doc;
  doc.documentElement.clientWidth = 1280;

  const win: any = {
    document: doc,
    innerWidth: 1280,
    Element: MockElement,
    HTMLElement: MockHTMLElement,
    HTMLButtonElement: MockHTMLButtonElement,
    HTMLInputElement: MockHTMLInputElement,
    HTMLFormElement: MockHTMLFormElement,
    HTMLIFrameElement: MockHTMLIFrameElement,
    Document: MockDocument,
    sessionStorage: mockSessionStorage,
    matchMedia: (query: string) => ({
      matches: query.includes('fine'),
      media: query,
      onchange: null,
      addListener: () => { },
      removeListener: () => { },
      addEventListener: () => { },
      removeEventListener: () => { },
      dispatchEvent: () => true,
    }),
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    requestAnimationFrame: (cb: FrameRequestCallback) => globalThis.setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: (id: number) => globalThis.clearTimeout(id),
    addEventListener(type: string, fn: MockEventListener, options?: boolean | { capture?: boolean }) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      if (!winListeners[type]) winListeners[type] = [];
      winListeners[type].push({ fn, capture });
    },
    removeEventListener(type: string, fn: MockEventListener, options?: boolean | { capture?: boolean }) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      if (!winListeners[type]) return;
      winListeners[type] = winListeners[type].filter(
        (entry) => entry.fn !== fn || entry.capture !== capture
      );
    },
    dispatchEvent: (evt: any) => {
      const list = winListeners[evt?.type] || [];
      for (const entry of [...list]) {
        entry.fn(evt);
      }
      return true;
    },
    history: { replaceState: () => { } },
    location: { href: 'http://localhost:5174/', pathname: '/', search: '', hash: '' },
  };
  doc.defaultView = win;

  (global as any).Element = MockElement;
  (global as any).HTMLElement = MockHTMLElement;
  (global as any).HTMLButtonElement = MockHTMLButtonElement;
  (global as any).HTMLInputElement = MockHTMLInputElement;
  (global as any).HTMLFormElement = MockHTMLFormElement;
  (global as any).HTMLIFrameElement = MockHTMLIFrameElement;
  (global as any).Document = MockDocument;
  (global as any).window = win;
  (global as any).document = doc;
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
      if (prevNavigator === undefined) {
        delete (global as any).navigator;
      } else {
        Object.defineProperty(global, 'navigator', { value: prevNavigator, configurable: true });
      }
      (global as any).Element = prevElement;
      (global as any).HTMLElement = prevHTMLElement;
      (global as any).HTMLButtonElement = prevHTMLButtonElement;
      (global as any).HTMLInputElement = prevHTMLInputElement;
      (global as any).HTMLFormElement = prevHTMLFormElement;
      (global as any).HTMLIFrameElement = prevHTMLIFrameElement;
      (global as any).Document = prevDocumentClass;
      (global as any).IS_REACT_ACT_ENVIRONMENT = prevActEnv;
    },
  };
}

describe('Task 1.12: Dev Mode Notification & Review Modal', () => {
  let storage: StorageAdapter;
  let dom: MockDomHandle;
  let clipboardWriteMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetEngineConfig();
    storage = createInMemoryAdapter();
    dom = setupMockDom();
    clipboardWriteMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global, 'navigator', {
      value: {
        platform: 'MacIntel',
        userAgent: 'Mozilla/5.0 (Macintosh)',
        clipboard: { writeText: clipboardWriteMock },
      },
      configurable: true,
    });
  });

  afterEach(() => {
    clearSessionUnlockTime();
    dom.cleanup();
    resetEngineConfig();
  });

  it('triggers sticky action toast with Review button when dev mode unlocks with pending migrations', () => {
    storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.1');
    setSessionUnlockTime(Date.now());

    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const root = createRoot(container);

    const expectedReport = getPendingMigrations('0.1.1', storage);

    React.act(() => {
      root.render(
        React.createElement(
          MigrationProvider,
          { storage },
          React.createElement(DeveloperModeProvider, null, React.createElement('div'))
        )
      );
    });

    const toasts = dom.findElements(
      dom.document.body,
      (el) => el.getAttribute('role') === 'status'
    );
    expect(toasts.length).toBeGreaterThanOrEqual(1);

    const toastText = toasts[0].textContent;
    expect(toastText).toContain(`v${expectedReport.currentEngineVersion}`);
    expect(toastText).toContain(
      `${expectedReport.pendingContentChanges.length} content migration(s) pending`
    );

    const reviewButtons = dom.findElements(
      toasts[0],
      (el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Review'
    );
    expect(reviewButtons.length).toBe(1);

    React.act(() => {
      root.unmount();
    });
  });

  it('renders pending migration warning pill in DevModeBadge', () => {
    storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.1');
    setSessionUnlockTime(Date.now());

    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const root = createRoot(container);

    const expectedReport = getPendingMigrations('0.1.1', storage);
    const expectedCount = expectedReport.pendingContentChanges.length;

    React.act(() => {
      root.render(
        React.createElement(
          MigrationProvider,
          { storage },
          React.createElement(DeveloperModeProvider, null, React.createElement(DevModeBadge))
        )
      );
    });

    const warningButtons = dom.findElements(
      container,
      (el) =>
        el.tagName === 'BUTTON' &&
        el.textContent.includes('Pending Migration') &&
        el.textContent.includes(String(expectedCount))
    );
    expect(warningButtons.length).toBe(1);
    expect(warningButtons[0].textContent).toContain('⚠️');

    React.act(() => {
      root.unmount();
    });
  });

  it('opens DevMigrationModal on toast action or badge click', () => {
    expect(DevMigrationModalFromIndex).toBe(DevMigrationModal);
    storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.1');
    setSessionUnlockTime(Date.now());

    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const root = createRoot(container);

    const expectedReport = getPendingMigrations('0.1.1', storage);

    React.act(() => {
      root.render(
        React.createElement(
          MigrationProvider,
          { storage },
          React.createElement(
            DeveloperModeProvider,
            null,
            React.createElement(DevModeBadge),
            React.createElement(DevMigrationModal)
          )
        )
      );
    });

    // Initially closed
    expect(
      dom.findElements(dom.document.body, (el) => el.getAttribute('role') === 'dialog').length
    ).toBe(0);

    // Click [Review] button in Toast
    const reviewButton = dom.findElements(
      dom.document.body,
      (el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Review'
    )[0];
    expect(reviewButton).toBeDefined();

    React.act(() => {
      reviewButton.click();
    });

    const dialogs = dom.findElements(
      dom.document.body,
      (el) => el.getAttribute('role') === 'dialog'
    );
    expect(dialogs.length).toBe(1);
    const modalText = dialogs[0].textContent;
    expect(modalText).toContain(`v${expectedReport.contentVersionWatermark}`);
    expect(modalText).toContain(`v${expectedReport.currentEngineVersion}`);
    for (const change of expectedReport.pendingContentChanges) {
      expect(modalText).toContain(change.title);
      expect(modalText).toContain(change.description);
      expect(modalText).toContain(change.required ? 'REQUIRED' : 'RECOMMENDED');
    }

    // Click Dismiss -> closes modal while leaving warning pill visible in DevModeBadge
    const dismissButton = dom.findElements(
      dialogs[0],
      (el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Dismiss'
    )[0];
    expect(dismissButton).toBeDefined();

    React.act(() => {
      dismissButton.click();
    });

    expect(
      dom.findElements(dom.document.body, (el) => el.getAttribute('role') === 'dialog').length
    ).toBe(0);

    // Badge warning pill is still visible; clicking it re-opens DevMigrationModal
    const badgePill = dom.findElements(
      container,
      (el) => el.tagName === 'BUTTON' && el.textContent.includes('Pending Migration')
    )[0];
    expect(badgePill).toBeDefined();

    React.act(() => {
      badgePill.click();
    });

    expect(
      dom.findElements(dom.document.body, (el) => el.getAttribute('role') === 'dialog').length
    ).toBe(1);

    React.act(() => {
      root.unmount();
    });
  });

  it('copies AI migration prompt to clipboard and updates watermark on Mark as Migrated', async () => {
    storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.1');
    setSessionUnlockTime(Date.now());

    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const root = createRoot(container);

    const expectedReport = getPendingMigrations('0.1.1', storage);
    const expectedPrompt = generateAiMigrationPrompt(expectedReport);

    React.act(() => {
      root.render(
        React.createElement(
          MigrationProvider,
          { storage },
          React.createElement(
            DeveloperModeProvider,
            null,
            React.createElement(DevModeBadge),
            React.createElement(DevMigrationModal)
          )
        )
      );
    });

    // Open modal via DevModeBadge pill
    const badgePill = dom.findElements(
      container,
      (el) => el.tagName === 'BUTTON' && el.textContent.includes('Pending Migration')
    )[0];
    React.act(() => {
      badgePill.click();
    });

    const dialog = dom.findElements(
      dom.document.body,
      (el) => el.getAttribute('role') === 'dialog'
    )[0];
    expect(dialog).toBeDefined();

    // Click "Copy AI Migration Prompt"
    const copyButton = dom.findElements(
      dialog,
      (el) => el.tagName === 'BUTTON' && el.textContent.includes('Copy AI Migration Prompt')
    )[0];
    expect(copyButton).toBeDefined();

    await React.act(async () => {
      copyButton.click();
      await Promise.resolve();
    });

    expect(clipboardWriteMock).toHaveBeenCalledTimes(1);
    expect(clipboardWriteMock).toHaveBeenCalledWith(expectedPrompt);
    expect(copyButton.textContent).toContain('Copied');

    // Click "Mark as Migrated"
    const markButton = dom.findElements(
      dialog,
      (el) => el.tagName === 'BUTTON' && el.textContent.includes('Mark as Migrated')
    )[0];
    expect(markButton).toBeDefined();

    React.act(() => {
      markButton.click();
    });

    // Storage watermark updated to currentEngineVersion
    expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe(expectedReport.currentEngineVersion);

    // Modal closed
    expect(
      dom.findElements(dom.document.body, (el) => el.getAttribute('role') === 'dialog').length
    ).toBe(0);

    // Warning pill removed from DevModeBadge
    expect(
      dom.findElements(
        container,
        (el) => el.tagName === 'BUTTON' && el.textContent.includes('Pending Migration')
      ).length
    ).toBe(0);

    // Success confirmation toast shown
    const successToasts = dom.findElements(
      dom.document.body,
      (el) =>
        el.getAttribute('role') === 'status' &&
        el.textContent.includes(expectedReport.currentEngineVersion)
    );
    expect(successToasts.length).toBeGreaterThanOrEqual(1);

    React.act(() => {
      root.unmount();
    });
  });

  it('does not show warning pill or toast when watermark is current, and fires toast on PIN unlock', async () => {
    const ledger = getMigrationLedger();
    const latestVersion = ledger[ledger.length - 1].version;

    // 1. Up-to-date watermark -> no toast and no warning pill
    storage.setItem(FOLIO_CONTENT_VERSION_KEY, latestVersion);
    setSessionUnlockTime(Date.now());

    const container1 = dom.document.createElement('div');
    dom.document.body.appendChild(container1);
    const root1 = createRoot(container1);

    React.act(() => {
      root1.render(
        React.createElement(
          MigrationProvider,
          { storage },
          React.createElement(DeveloperModeProvider, null, React.createElement(DevModeBadge))
        )
      );
    });

    expect(
      dom.findElements(
        dom.document.body,
        (el) => el.getAttribute('role') === 'status' && el.textContent.includes('content migration')
      ).length
    ).toBe(0);
    expect(
      dom.findElements(
        container1,
        (el) => el.tagName === 'BUTTON' && el.textContent.includes('Pending Migration')
      ).length
    ).toBe(0);

    React.act(() => {
      root1.unmount();
    });

    // 2. Outdated watermark + PIN unlock transition -> fires [Review] toast
    clearSessionUnlockTime();
    storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.0');
    const pinHash = await hashPin('1234', 'migration_test_salt');
    setEngineConfig({ securitySalt: 'migration_test_salt', expectedPinHash: pinHash });

    let devRef: ReturnType<typeof useDeveloperMode> | null = null;
    const DevProbe: React.FC = () => {
      devRef = useDeveloperMode();
      return null;
    };

    const container2 = dom.document.createElement('div');
    dom.document.body.appendChild(container2);
    const root2 = createRoot(container2);

    React.act(() => {
      root2.render(
        React.createElement(
          MigrationProvider,
          { storage },
          React.createElement(DeveloperModeProvider, null, React.createElement(DevProbe))
        )
      );
    });

    expect(devRef!.isDevMode).toBe(false);
    expect(
      dom.findElements(
        dom.document.body,
        (el) => el.getAttribute('role') === 'status' && el.textContent.includes('content migration')
      ).length
    ).toBe(0);

    await React.act(async () => {
      const ok = await devRef!.submitPin('1234');
      expect(ok).toBe(true);
    });

    expect(devRef!.isDevMode).toBe(true);
    const toasts = dom.findElements(
      dom.document.body,
      (el) => el.getAttribute('role') === 'status'
    );
    expect(toasts.length).toBeGreaterThanOrEqual(1);
    expect(toasts[0].textContent).toContain('content migration(s) pending');
    expect(
      dom.findElements(
        toasts[0],
        (el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Review'
      ).length
    ).toBe(1);

    React.act(() => {
      root2.unmount();
    });
  });
});

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  buildMigrationDoctorReport,
  runMigrationDoctor,
} from '../src/diagnostics/migrationDoctor';

describe('Task 1.13: CLI Doctor & AI Migration Agent Rules', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const binScript = path.join(repoRoot, 'bin/folio-engine.js');
  const tempDirs: string[] = [];

  function makeConsumerWorkspace(engineVersion: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-mig-113-'));
    tempDirs.push(dir);
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'consumer-app', version: '1.0.0' }, null, 2),
      'utf-8'
    );
    fs.mkdirSync(path.join(dir, 'node_modules/@devcabs/folio-engine'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'node_modules/@devcabs/folio-engine/package.json'),
      JSON.stringify({ name: '@devcabs/folio-engine', version: engineVersion }, null, 2),
      'utf-8'
    );
    return dir;
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects installed engine version and pending migrations in consumer workspace', () => {
    const workspace = makeConsumerWorkspace('0.1.1');
    const report = buildMigrationDoctorReport({ cwd: workspace });

    expect(report.installedEngine?.version).toBe('0.1.1');
    expect(report.status).toBe('migrations-pending');
    expect(report.pendingVersions).toContain('0.1.2');
    expect(report.pendingVersions).toContain('0.1.3');
    expect(report.pendingVersions).toContain('0.1.4');
    expect(report.agentPrompt).toContain('AI Migration Prompt');
  });

  it('outputs machine-readable JSON when invoked with --format json', () => {
    const workspace = makeConsumerWorkspace('0.1.2');
    const logs: string[] = [];

    const code = runMigrationDoctor({
      cwd: workspace,
      format: 'json',
      log: (line) => logs.push(line),
    });

    expect(code).toBe(0);
    const json = JSON.parse(logs.join('\n'));
    expect(json.installedEngine.version).toBe('0.1.2');
    expect(json.pendingVersions).toContain('0.1.3');
  });

  it('executes bin/folio-engine.js doctor, check, changelog, and version commands cleanly', () => {
    const workspace = makeConsumerWorkspace('0.1.1');

    const doctor = spawnSync(binScript, ['doctor'], { cwd: workspace, encoding: 'utf-8' });
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain('0.1.1');

    const check = spawnSync(binScript, ['check', '--format', 'json'], {
      cwd: workspace,
      encoding: 'utf-8',
    });
    expect(check.status).toBe(0);
    expect(JSON.parse(check.stdout).pendingVersions).toContain('0.1.2');

    const changelog = spawnSync(binScript, ['changelog'], { cwd: repoRoot, encoding: 'utf-8' });
    expect(changelog.status).toBe(0);
    expect(changelog.stdout).toContain('0.1.4');

    const version = spawnSync(binScript, ['version'], { cwd: repoRoot, encoding: 'utf-8' });
    expect(version.status).toBe(0);
    expect(version.stdout).toMatch(/\d+\.\d+\.\d+/);
  });
});

import {
  generateChangelog,
  parseChangelogArgs,
  runChangelogCli,
} from '../scripts/generate-changelog';
import { verifyLedgerReleaseGate, runLedgerReleaseGate } from '../scripts/deploy';

describe('Task 1.14: Hard Deploy Gate & Auto-Changelog Compilation', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const realLedgerPath = path.join(repoRoot, 'src', 'migrations', 'ledger.ts');
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('generates formatted CHANGELOG.md directly from FOLIO_MIGRATION_LEDGER', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-mig-114-'));
    tempDirs.push(dir);
    const outPath = path.join(dir, 'CHANGELOG.md');

    const options = parseChangelogArgs(['--output', outPath]);
    const code = runChangelogCli(options);

    expect(code).toBe(0);
    const written = fs.readFileSync(outPath, 'utf-8');
    expect(written).toBe(generateChangelog());
    expect(written).toContain('# Changelog');
    expect(written).toContain('## v0.1.4');
    expect(written).toContain('### Breaking Changes');
    expect(written).toContain('### Content Changes');

    // --verify passes when file matches generated output
    const verifyCode = runChangelogCli(parseChangelogArgs(['--verify', '--output', outPath]), {
      writeStdout: () => { },
      writeStderr: () => { },
    });
    expect(verifyCode).toBe(0);
  });

  it('blocks release when target version is missing from FOLIO_MIGRATION_LEDGER', () => {
    const result = verifyLedgerReleaseGate({
      currentVersion: '99.99.99',
      bumpType: 'patch', // targets 99.99.100 which is not in ledger.ts
      ledgerPath: realLedgerPath,
    });

    expect(result.valid).toBe(false);
    expect(result.targetVersion).toBe('99.99.100');
    expect(result.reason).toBe('missing-entry');
  });

  it('passes pre-release gate when target version entry is present and valid', () => {
    const result = verifyLedgerReleaseGate({
      currentVersion: '0.1.3',
      bumpType: 'patch', // targets 0.1.4 which is in ledger.ts with non-empty fields
      ledgerPath: realLedgerPath,
    });

    expect(result.valid).toBe(true);
    expect(result.targetVersion).toBe('0.1.4');
  });
});

describe('Task 1.15: End-to-End Verification & Quality Gates', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  let storage: StorageAdapter;
  const tempDirs: string[] = [];

  beforeEach(() => {
    resetEngineConfig();
    storage = createInMemoryAdapter();
  });

  afterEach(() => {
    resetEngineConfig();
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('validates watermark storage get/set/clear lifecycle with isolated StorageAdapter', () => {
    // Initial get falls back to 0.0.0
    expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBeNull();
    expect(getContentVersionWatermark(undefined, storage)).toBe('0.0.0');

    // Set updates stored watermark monotonically
    setContentVersionWatermark('0.1.3', storage);
    expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('0.1.3');
    expect(getContentVersionWatermark(undefined, storage)).toBe('0.1.3');

    // removeItem clears key and reverts watermark + pending diffs
    storage.removeItem(FOLIO_CONTENT_VERSION_KEY);
    expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBeNull();
    expect(getContentVersionWatermark(undefined, storage)).toBe('0.0.0');
    const afterRemoveReport = getPendingMigrations(undefined, storage);
    expect(afterRemoveReport.hasPendingContentChanges).toBe(true);
    expect(afterRemoveReport.unappliedVersions.length).toBeGreaterThanOrEqual(4);

    // clear() resets all stored keys cleanly
    setContentVersionWatermark('0.1.4', storage);
    expect(getContentVersionWatermark(undefined, storage)).toBe('0.1.4');
    storage.clear?.();
    expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBeNull();
    expect(getContentVersionWatermark(undefined, storage)).toBe('0.0.0');
  });

  it('throws on invalid bump target and exits non-zero when deploy gate encounters missing/invalid version', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-mig-115-'));
    tempDirs.push(dir);
    const mockLedgerPath = path.join(dir, 'ledger.ts');
    fs.writeFileSync(
      mockLedgerPath,
      `export const FOLIO_MIGRATION_LEDGER = [{
        version: '0.1.0',
        releaseDate: '2026-10-01',
        title: 'Base',
        summary: 'Base',
        breakingChanges: ['None'],
        codeActions: [],
        contentChanges: [{ id: 'base', title: 'Base', required: false, description: 'Base' }],
      }];`,
      'utf-8'
    );

    // Invalid bump throws
    expect(() =>
      verifyLedgerReleaseGate({
        currentVersion: '0.1.0',
        bumpType: 'invalid-bump',
        ledgerPath: mockLedgerPath,
      })
    ).toThrow(/Unknown bump type/);

    // Missing target version blocks via runLedgerReleaseGate with diagnostic message
    const errors: string[] = [];
    const passed = runLedgerReleaseGate({
      currentVersion: '0.1.0',
      bumpType: 'patch', // targets 0.1.1 which is absent from mock ledger
      ledgerPath: mockLedgerPath,
      writeError: (msg) => errors.push(msg),
    });
    expect(passed).toBe(false);
    expect(errors.join('\n')).toContain('DEPLOY BLOCKED: Missing migration ledger entry for v0.1.1!');

    // CLI script exits non-zero on invalid version bump argument
    const deployScript = path.join(repoRoot, 'scripts', 'deploy.ts');
    const cliResult = spawnSync(process.execPath, [tsxCli, deployScript, 'invalid-bump'], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    expect(cliResult.status).toBe(1);
    expect(cliResult.stderr).toContain('Invalid version bump target');
  });

  it('passes token purity check (npm run test:tokens) with zero errors', () => {
    const tokenScript = path.join(repoRoot, 'scripts', 'verify-token-aliases.ts');
    const result = spawnSync(process.execPath, [tsxCli, tokenScript], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('100% token purity and alias verification passed!');
  });

  it('builds library entry points (dist/folio.js, dist/edge.js, dist/diagnostics.js, dist/style.css) cleanly', () => {
    const viteBin = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
    const tscBin = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

    const viteBuild = spawnSync(process.execPath, [viteBin, 'build', '-c', 'vite.config.lib.ts'], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    expect(viteBuild.status).toBe(0);

    const tscBuild = spawnSync(process.execPath, [tscBin, '-p', 'tsconfig.lib.json'], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    expect(tscBuild.status).toBe(0);

    const expectedArtifacts = [
      'dist/folio.js',
      'dist/folio.cjs',
      'dist/edge.js',
      'dist/edge.cjs',
      'dist/diagnostics.js',
      'dist/diagnostics.cjs',
      'dist/style.css',
      'dist/index.d.ts',
      'dist/edge.d.ts',
      'dist/diagnostics.d.ts',
    ];

    for (const relPath of expectedArtifacts) {
      const fullPath = path.join(repoRoot, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      expect(fs.statSync(fullPath).size).toBeGreaterThan(0);
    }
  }, 60000);
});

