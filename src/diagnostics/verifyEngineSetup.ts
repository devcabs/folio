/**
 * Folio Engine - Diagnostic Verification Suite & Self-Audit Tooling
 * Location: src/diagnostics/verifyEngineSetup.ts
 *
 * Implements automated validation of engine wiring, config contracts,
 * and data payload schemas (Canvas AST, Vector Charts, Edge KV payloads).
 */

import { EngineConfigSchema, getEngineConfig, type EngineConfig } from '../config/engine.config';
import { PublicNodePayloadSchema, type PublicNodePayload } from '../types/edge';
import type { SectionElement, CanvasLeafElement, SubsectionElement } from '../types/canvas';
import { validateAccentedText } from '../utils/accentTextParser';

export interface DiagnosticResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates that an Edge KV node payload adheres to contracts:
 * 1. Schema conformance (Zod).
 * 2. Referential integrity: Every chart element in the canvas AST must exist in chartDatasets.
 * 3. Structural uniqueness: No duplicated element IDs.
 */
export function validateNodePayload(payload: unknown): DiagnosticResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsed = PublicNodePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => {
      errors.push(`[Schema] ${issue.path.join('.')}: ${issue.message}`);
    });
    return { ok: false, errors, warnings };
  }

  const nodePayload = parsed.data as PublicNodePayload;
  const chartDatasets = nodePayload.chartDatasets || {};
  const seenIds = new Set<string>();

  function inspectElement(el: CanvasLeafElement, secTitle: string) {
    if (!el.id) {
      errors.push(`[AST] Element in "${secTitle}" is missing an 'id'.`);
    } else if (seenIds.has(el.id)) {
      errors.push(`[AST] Duplicate element id detected: "${el.id}".`);
    } else {
      seenIds.add(el.id);
    }

    if (el.type === 'chart') {
      if (!el.chartId) {
        errors.push(`[Chart] Chart element "${el.id}" is missing 'chartId'.`);
      } else if (!chartDatasets[el.chartId]) {
        warnings.push(
          `[Chart] Chart "${el.chartId}" is referenced in canvas section "${secTitle}" but not found in chartDatasets.`
        );
      }
    }
  }

  if (nodePayload.canvas && Array.isArray(nodePayload.canvas.sections)) {
    nodePayload.canvas.sections.forEach((sec: SectionElement, idx: number) => {
      if (!sec.id) {
        errors.push(`[AST] Section at index ${idx} is missing an 'id'.`);
      } else if (seenIds.has(sec.id)) {
        errors.push(`[AST] Duplicate section id detected: "${sec.id}".`);
      } else {
        seenIds.add(sec.id);
      }

      if (!sec.title || sec.title.trim().length === 0) {
        warnings.push(`[AST] Section "${sec.id || idx}" has an empty title.`);
      }

      if (Array.isArray(sec.elements)) {
        sec.elements.forEach((child) => {
          if (child.type === 'subsection') {
            const sub = child as SubsectionElement;
            if (!sub.id) {
              errors.push(`[AST] Subsection in "${sec.title || sec.id}" is missing an 'id'.`);
            } else if (seenIds.has(sub.id)) {
              errors.push(`[AST] Duplicate subsection id detected: "${sub.id}".`);
            } else {
              seenIds.add(sub.id);
            }
            if (Array.isArray(sub.elements)) {
              sub.elements.forEach((leaf) => inspectElement(leaf, `${sec.title} > ${sub.title}`));
            }
          } else {
            inspectElement(child as CanvasLeafElement, sec.title);
          }
        });
      }
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Verifies that host DOM and styling prerequisites are properly loaded:
 * 1. Checks that engine CSS tokens (e.g. --canvas-bg) are computed.
 * 2. Validates active EngineConfig against EngineConfigSchema.
 */
export function verifyEngineWiring(customConfig?: Partial<EngineConfig>): DiagnosticResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const configToTest = customConfig ? { ...getEngineConfig(), ...customConfig } : getEngineConfig();
  const configParsed = EngineConfigSchema.safeParse(configToTest);
  if (!configParsed.success) {
    configParsed.error.issues.forEach((issue) => {
      errors.push(`[Config] ${issue.path.join('.')}: ${issue.message}`);
    });
  }

  // Accent syntax validation on heroTitle
  if (configToTest.branding?.heroTitle) {
    const accentResult = validateAccentedText(configToTest.branding.heroTitle);
    if (!accentResult.valid && accentResult.warnings.length > 0) {
      accentResult.warnings.forEach((warn) => {
        warnings.push(`[Branding] heroTitle accent syntax warning: ${warn}`);
      });
    }
  }

  // DOM / CSS Token verification in browser environments
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const computed = window.getComputedStyle(document.documentElement);
    const canvasBg = computed.getPropertyValue('--canvas-bg').trim();
    const fontMono = computed.getPropertyValue('--font-mono').trim();

    if (!canvasBg && !fontMono) {
      warnings.push(
        "[Styles] Folio Engine stylesheet not detected! Ensure you import '@devcabs/folio-engine/style.css' in your main entry point."
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Runs a complete diagnostic self-check and prints a clean, formatted report.
 */
export function runEngineSelfAudit(): boolean {
  const wiring = verifyEngineWiring();

  if (typeof console !== 'undefined') {
    if (!wiring.ok) {
      console.error('❌ [Folio Engine] Wiring verification failed:\n' + wiring.errors.join('\n'));
    }
    if (wiring.warnings.length > 0) {
      console.warn('⚠️ [Folio Engine] Wiring warnings:\n' + wiring.warnings.join('\n'));
    }
    if (wiring.ok && wiring.warnings.length === 0) {
      console.log('✅ [Folio Engine] Configuration and stylesheet wiring verified successfully.');
    }
  }

  return wiring.ok;
}
