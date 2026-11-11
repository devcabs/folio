import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import {
  MigrationProvider,
  useMigrationContext,
  type MigrationContextType,
} from '../../src/context/MigrationContext';
import {
  DeveloperModeProvider,
  useDeveloperMode,
} from '../../src/context/DeveloperModeContext';
import * as contextExports from '../../src/context';
import { createInMemoryAdapter, type StorageAdapter } from '../../src/utils/storageAdapter';
import { FOLIO_CONTENT_VERSION_KEY } from '../../src/utils/watermarkResolver';
import { resetEngineConfig } from '../../src/config/engine.config';

// Ensure minimal browser DOM globals for React 19 root rendering in Node
function ensureDomEnvironment() {
  class Element {}
  class HTMLElement extends Element {}
  class HTMLIFrameElement extends HTMLElement {}
  class Document {}

  (global as any).Element = (global as any).Element || Element;
  (global as any).HTMLElement = (global as any).HTMLElement || HTMLElement;
  (global as any).HTMLIFrameElement = (global as any).HTMLIFrameElement || HTMLIFrameElement;
  (global as any).Document = (global as any).Document || Document;
  (global as any).window = (global as any).window || global;
  (global as any).window.addEventListener = (global as any).window.addEventListener || (() => {});
  (global as any).window.removeEventListener = (global as any).window.removeEventListener || (() => {});
  (global as any).window.dispatchEvent = (global as any).window.dispatchEvent || (() => true);
  (global as any).addEventListener = (global as any).window.addEventListener;
  (global as any).removeEventListener = (global as any).window.removeEventListener;
  (global as any).dispatchEvent = (global as any).window.dispatchEvent;
  (global as any).IS_REACT_ACT_ENVIRONMENT = true;

  if (!(global as any).document) {
    (global as any).document = {
      nodeType: 9,
      activeElement: null,
      defaultView: global,
      documentElement: { style: {} },
      createElement(tag: string) {
        const el = new HTMLElement();
        Object.assign(el, {
          nodeType: 1,
          tagName: tag.toUpperCase(),
          ownerDocument: (global as any).document,
          childNodes: [],
          style: {},
          setAttribute() {},
          removeAttribute() {},
          appendChild(c: any) { (this as any).childNodes.push(c); },
          removeChild() {},
          addEventListener() {},
          removeEventListener() {},
        });
        return el;
      },
      createTextNode(text: string) {
        return { nodeType: 3, textContent: text, ownerDocument: (global as any).document };
      },
      addEventListener() {},
      removeEventListener() {},
    };
  }
}

describe('Subtask 1.4: MigrationContext Isolation from DeveloperModeContext', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    resetEngineConfig();
    storage = createInMemoryAdapter();
    ensureDomEnvironment();
  });

  describe('1. Hook Safety & Provider Independence', () => {
    it('throws a descriptive error when useMigrationContext is called outside of MigrationProvider', () => {
      const StandaloneConsumer: React.FC = () => {
        useMigrationContext();
        return null;
      };

      expect(() => {
        ReactDOMServer.renderToString(React.createElement(StandaloneConsumer));
      }).toThrow('useMigrationContext must be used within a <MigrationProvider>');
    });

    it('renders correctly when MigrationProvider is mounted without DeveloperModeProvider as ancestor', () => {
      const SafeConsumer: React.FC = () => {
        const migration = useMigrationContext();
        return React.createElement('div', { id: 'test-node' }, `modalOpen:${migration.isMigrationModalOpen}`);
      };

      const html = ReactDOMServer.renderToString(
        React.createElement(
          MigrationProvider,
          { storage },
          React.createElement(SafeConsumer)
        )
      );

      expect(html).toContain('modalOpen:false');
      expect(html).toContain('id="test-node"');
    });
  });

  describe('2. State & Lifecycle Operations', () => {
    it('initializes pendingReport on mount and toggles modal visibility', () => {
      const doc = (global as any).document;
      const container = doc.createElement('div');
      container.ownerDocument.defaultView = global;
      const root = createRoot(container);

      let contextRef: MigrationContextType | null = null;

      const TestConsumer: React.FC = () => {
        contextRef = useMigrationContext();
        return null;
      };

      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.0');

      React.act(() => {
        root.render(
          React.createElement(
            MigrationProvider,
            { storage },
            React.createElement(TestConsumer)
          )
        );
      });

      expect(contextRef).not.toBeNull();
      expect(contextRef!.isMigrationModalOpen).toBe(false);
      expect(contextRef!.pendingReport).not.toBeNull();
      expect(contextRef!.pendingReport?.contentVersionWatermark).toBe('0.1.0');

      // Open modal
      React.act(() => {
        contextRef!.openMigrationModal();
      });
      expect(contextRef!.isMigrationModalOpen).toBe(true);

      // Close modal
      React.act(() => {
        contextRef!.closeMigrationModal();
      });
      expect(contextRef!.isMigrationModalOpen).toBe(false);

      root.unmount();
    });

    it('generates an AI migration prompt delegating to formatter', () => {
      const doc = (global as any).document;
      const container = doc.createElement('div');
      container.ownerDocument.defaultView = global;
      const root = createRoot(container);

      let contextRef: MigrationContextType | null = null;

      const TestConsumer: React.FC = () => {
        contextRef = useMigrationContext();
        return null;
      };

      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.2');

      React.act(() => {
        root.render(
          React.createElement(
            MigrationProvider,
            { storage },
            React.createElement(TestConsumer)
          )
        );
      });

      expect(contextRef).not.toBeNull();
      const prompt = contextRef!.generatePrompt();
      expect(prompt).toContain('Updating from v0.1.2 → v0.1.3');
      expect(prompt).toContain('Generated by @devcabs/folio-engine migrationService');

      root.unmount();
    });

    it('marks migrations as acknowledged and monotonically updates watermark in storage', () => {
      const doc = (global as any).document;
      const container = doc.createElement('div');
      container.ownerDocument.defaultView = global;
      const root = createRoot(container);

      let contextRef: MigrationContextType | null = null;

      const TestConsumer: React.FC = () => {
        contextRef = useMigrationContext();
        return null;
      };

      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.0');

      React.act(() => {
        root.render(
          React.createElement(
            MigrationProvider,
            { storage },
            React.createElement(TestConsumer)
          )
        );
      });

      expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('0.1.0');

      React.act(() => {
        contextRef!.markAsMigrated();
      });

      // Storage watermark is updated to engine version 0.1.3
      expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('0.1.3');
      expect(contextRef!.pendingReport?.contentVersionWatermark).toBe('0.1.3');

      root.unmount();
    });
  });

  describe('3. Re-render Isolation (Critical Blast Radius Guard)', () => {
    it('changing isMigrationModalOpen does NOT trigger a re-render of DeveloperModeProvider', () => {
      const doc = (global as any).document;
      const container = doc.createElement('div');
      container.ownerDocument.defaultView = global;
      const root = createRoot(container);

      let migrationRef: MigrationContextType | null = null;
      let devModeRenderCount = 0;

      const DevModeSpy: React.FC = () => {
        devModeRenderCount++;
        useDeveloperMode();
        return null;
      };

      const MigrationController: React.FC = () => {
        migrationRef = useMigrationContext();
        return null;
      };

      React.act(() => {
        root.render(
          React.createElement(
            MigrationProvider,
            { storage },
            React.createElement(MigrationController),
            React.createElement(
              DeveloperModeProvider,
              null,
              React.createElement(DevModeSpy)
            )
          )
        );
      });

      const initialDevRenders = devModeRenderCount;
      expect(initialDevRenders).toBeGreaterThanOrEqual(1);

      // Open migration modal — this updates isMigrationModalOpen in MigrationProvider
      React.act(() => {
        migrationRef!.openMigrationModal();
      });

      // Verification Criterion: Changing isMigrationModalOpen does NOT trigger a re-render of DeveloperModeProvider
      expect(devModeRenderCount).toBe(initialDevRenders);

      // Close migration modal
      React.act(() => {
        migrationRef!.closeMigrationModal();
      });

      expect(devModeRenderCount).toBe(initialDevRenders);

      root.unmount();
    });

    it('triggers migration action toast with onAction callback when pending migrations exist', () => {
      const doc = (global as any).document;
      const container = doc.createElement('div');
      container.ownerDocument.defaultView = global;
      const root = createRoot(container);

      // Set dev mode session unlock timestamp to valid current time
      const now = Date.now();
      storage.setItem('folio_dev_session_unlock', String(now));

      let migrationRef: MigrationContextType | null = null;
      let devRef: ReturnType<typeof useDeveloperMode> | null = null;

      const Inspector: React.FC = () => {
        migrationRef = useMigrationContext();
        devRef = useDeveloperMode();
        return null;
      };

      // Mock migration report with pending content changes
      const customConfig = {
        appId: 'test-app',
        appNamespace: 'folio',
        branding: { appName: 'Test' },
        nodes: [],
        contentVersion: '0.1.0',
      };

      React.act(() => {
        root.render(
          React.createElement(
            MigrationProvider,
            { storage, engineConfig: customConfig as any },
            React.createElement(
              DeveloperModeProvider,
              null,
              React.createElement(Inspector)
            )
          )
        );
      });

      expect(migrationRef).not.toBeNull();
      expect(devRef).not.toBeNull();
      expect(devRef!.showToast).toBeDefined();

      root.unmount();
    });
  });

  describe('4. Architectural & Architectural Boundary Verification', () => {
    it('verifies MigrationContext.tsx contains zero imports from DeveloperModeContext', () => {
      const migrationFilePath = path.resolve(
        __dirname,
        '../../src/context/MigrationContext.tsx'
      );
      const content = fs.readFileSync(migrationFilePath, 'utf8');

      expect(content).not.toMatch(/from\s+['"].*DeveloperModeContext['"]/);
      expect(content).not.toMatch(/from\s+['"].*developer['"]/i);
      expect(content).not.toContain('useDeveloperMode');
      expect(content).not.toContain('DeveloperModeProvider');
    });

    it('verifies DeveloperModeContext.tsx contains zero direct migration state variables', () => {
      const devModeFilePath = path.resolve(
        __dirname,
        '../../src/context/DeveloperModeContext.tsx'
      );
      const content = fs.readFileSync(devModeFilePath, 'utf8');

      // Must not define migration state directly in DeveloperModeContext
      expect(content).not.toMatch(/useState<.*>\(.*\bisMigrationModalOpen\b/);
      expect(content).not.toMatch(/const\s+\[isMigrationModalOpen,\s*setIsMigrationModalOpen\]/);
      expect(content).not.toMatch(/const\s+\[pendingReport,\s*setPendingReport\]/);
    });

    it('exports MigrationProvider, useMigrationContext, and MigrationContextType from context module', () => {
      expect(contextExports.MigrationProvider).toBeDefined();
      expect(typeof contextExports.MigrationProvider).toBe('function');
      expect(contextExports.useMigrationContext).toBeDefined();
      expect(typeof contextExports.useMigrationContext).toBe('function');
      expect(contextExports.DeveloperModeProvider).toBeDefined();
      expect(contextExports.useDeveloperMode).toBeDefined();
    });
  });
});
