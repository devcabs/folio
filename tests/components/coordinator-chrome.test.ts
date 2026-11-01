import * as fs from 'node:fs';
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  DevPinModal,
  DevPublishModal,
  DevLockBlockedModal,
  DevExitConfirmModal,
  DevModeBadge,
  DevActionAffordance,
  UniversalEditModal,
} from "../../src/components/dev";
import { HistoryHubModal } from "../../src/components/history";
import {
  DevHelpTooltip,
  EditableText,
  PageTitle,
  SectionTitle,
} from "../../src/components/ui";
import {
  DeveloperModeProvider,
  useDeveloperMode,
} from "../../src/context/DeveloperModeContext";
import {
  UndoRedoProvider,
} from "../../src/context/UndoRedoContext";
import {
  getDevSalt,
  hashPin,
  verifyPin,
  isDesktopDevice,
  SESSION_DURATION_MS,
  LOCKOUT_DURATION_MS,
  MAX_ATTEMPTS,
} from "../../src/utils/devSecurity";
import {
  setEngineConfig,
  resetEngineConfig,
} from "../../src/config/engine.config";

describe("Task 18.8: Coordinator Chrome, Modals & Workflows", () => {
  beforeEach(() => {
    resetEngineConfig();
  });

  afterEach(() => {
    resetEngineConfig();
  });

  describe("Component & Modal Exports", () => {
    it("exports all coordinator modals and chrome widgets as defined React components", () => {
      expect(DevPinModal).toBeDefined();
      expect(['function', 'object']).toContain(typeof DevPinModal);

      expect(DevPublishModal).toBeDefined();
      expect(['function', 'object']).toContain(typeof DevPublishModal);

      expect(DevLockBlockedModal).toBeDefined();
      expect(['function', 'object']).toContain(typeof DevLockBlockedModal);

      expect(DevExitConfirmModal).toBeDefined();
      expect(['function', 'object']).toContain(typeof DevExitConfirmModal);

      expect(DevModeBadge).toBeDefined();
      expect(['function', 'object']).toContain(typeof DevModeBadge);

      expect(DevActionAffordance).toBeDefined();
      expect(['function', 'object']).toContain(typeof DevActionAffordance);

      expect(UniversalEditModal).toBeDefined();
      expect(['function', 'object']).toContain(typeof UniversalEditModal);

      expect(HistoryHubModal).toBeDefined();
      expect(['function', 'object']).toContain(typeof HistoryHubModal);
    });

    it("exports UI affordances and contextual tooltips cleanly", () => {
      expect(DevHelpTooltip).toBeDefined();
      expect(['function', 'object']).toContain(typeof DevHelpTooltip);

      expect(EditableText).toBeDefined();
      expect(['function', 'object']).toContain(typeof EditableText);

      expect(PageTitle).toBeDefined();
      expect(['function', 'object']).toContain(typeof PageTitle);

      expect(SectionTitle).toBeDefined();
      expect(['function', 'object']).toContain(typeof SectionTitle);
    });

    it("exports context providers and hooks", () => {
      expect(DeveloperModeProvider).toBeDefined();
      expect(['function', 'object']).toContain(typeof DeveloperModeProvider);

      expect(useDeveloperMode).toBeDefined();
      expect(['function', 'object']).toContain(typeof useDeveloperMode);

      expect(UndoRedoProvider).toBeDefined();
      expect(['function', 'object']).toContain(typeof UndoRedoProvider);
    });
  });

  describe("Uniform Edit Button Standard", () => {
    it("enforces canonical ✎ Edit affordance label across all button instances", () => {
      const affordanceSrc = fs.readFileSync("src/components/dev/DevActionAffordance.tsx", "utf8");
      
      // All edit trigger buttons must strictly render "✎ Edit"
      const editButtons = affordanceSrc.match(/✎ Edit/g);
      expect(editButtons).not.toBeNull();
      expect(editButtons!.length).toBeGreaterThanOrEqual(4);

      // Must not contain domain-specific custom labels like "Edit Hero Narrative" or "Edit Hook"
      expect(affordanceSrc).not.toMatch(/Edit Hero Narrative/i);
      expect(affordanceSrc).not.toMatch(/Edit Hook/i);
      expect(affordanceSrc).not.toMatch(/Edit Chapter/i);
      expect(affordanceSrc).not.toMatch(/Edit Pillar/i);
    });
  });

  describe("Configurable PIN Salt & Cryptographic Parameterization", () => {
    it("defaults to engine namespace salt without institutional hardcoding", () => {
      expect(getDevSalt()).toBe("folio_dev_salt_v1");
      expect(SESSION_DURATION_MS).toBe(30 * 60 * 1000);
      expect(LOCKOUT_DURATION_MS).toBe(60 * 1000);
      expect(MAX_ATTEMPTS).toBe(5);
    });

    it("dynamically parameterizes salt via setEngineConfig", async () => {
      setEngineConfig({ securitySalt: "tenant_custom_salt_xyz" });
      expect(getDevSalt()).toBe("tenant_custom_salt_xyz");

      const hash1 = await hashPin("1234", "salt_a");
      const hash2 = await hashPin("1234", "salt_b");
      expect(hash1).not.toBe(hash2);

      const customHash = await hashPin("9999");
      expect(customHash).toBeDefined();
      expect(customHash.length).toBe(64); // SHA-256 hex digest length
    });

    it("verifies PIN correctly against dynamic target hashes", async () => {
      const pin = "4321";
      const salt = "test_engine_salt";
      const expectedHash = await hashPin(pin, salt);

      setEngineConfig({ securitySalt: salt, expectedPinHash: expectedHash });

      // Correct PIN matches
      const isCorrect = await verifyPin("4321");
      expect(isCorrect).toBe(true);

      // Wrong PIN fails
      const isWrong = await verifyPin("0000");
      expect(isWrong).toBe(false);

      // Non-4-digit input fails fast
      expect(await verifyPin("123")).toBe(false);
      expect(await verifyPin("12345")).toBe(false);
      expect(await verifyPin("")).toBe(false);
    });
  });

  describe("Device Viewport Responsiveness Heuristics", () => {
    it("evaluates desktop readiness function safely in test environment", () => {
      expect(['function', 'object']).toContain(typeof isDesktopDevice);
      // Under node/vitest without window, safely returns false or respects mock
      const result = isDesktopDevice();
      expect(typeof result).toBe("boolean");
    });
  });
});
