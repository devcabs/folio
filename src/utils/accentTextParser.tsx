import React from 'react';

export interface AccentValidationResult {
  valid: boolean;
  warnings: string[];
}

/**
 * Validates accent text syntax (e.g. *word* or **word**).
 * Detects unclosed delimiters, empty tags, or malformed syntax.
 */
export function validateAccentedText(text: string): AccentValidationResult {
  const warnings: string[] = [];
  if (!text || typeof text !== 'string') {
    return { valid: true, warnings };
  }

  // Count asterisks
  const asteriskCount = (text.match(/\*/g) || []).length;
  if (asteriskCount % 2 !== 0) {
    warnings.push(
      `Unclosed asterisk delimiter detected in "${text}". Expected matching opening and closing '*'.`
    );
  }

  // Check for empty tags like ****, ** **, or * *
  if (/\*{4}/.test(text) || /\*{2}\s+\*{2}/.test(text) || /\*\s+\*/.test(text)) {
    warnings.push(
      `Empty accent delimiter detected in "${text}". Accent delimiters must wrap non-empty text.`
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

export interface ParseAccentedTextOptions {
  accentClassName?: string;
  onWarn?: (warning: string) => void;
}

/**
 * Parses a string containing *accent* or **accent** tags into React elements.
 * Unaccented segments remain plain text.
 * Accented segments are wrapped in a span with `accentClassName`.
 *
 * If delimiters are unclosed or malformed:
 * - Emits a warning via `options.onWarn` or console.warn in dev mode
 * - Gracefully falls back to rendering as plain text so the UI never crashes
 */
export function parseAccentedText(
  input: string | React.ReactNode,
  options?: ParseAccentedTextOptions
): React.ReactNode {
  if (typeof input !== 'string') {
    return input;
  }

  if (!input.includes('*')) {
    return input;
  }

  const { valid, warnings } = validateAccentedText(input);
  if (!valid && warnings.length > 0) {
    warnings.forEach((w) => {
      if (options?.onWarn) {
        options.onWarn(w);
      } else if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        const isDev =
          (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ??
          (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');
        if (isDev) {
          console.warn(`⚠️ [Folio Engine] ${w}`);
        }
      }
    });
  }

  // Regex to match paired *text* or **text**
  // Captures: 1: delimiter (* or **), 2: content (must not begin or end with whitespace)
  const regex = /(\*{1,2})([^\s*](?:[^*]*?[^\s*])?)\1/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    const [fullMatch, , content] = match;
    const matchIndex = match.index;

    // Text before match
    if (matchIndex > lastIndex) {
      nodes.push(input.substring(lastIndex, matchIndex));
    }

    // Accented text
    nodes.push(
      <span
        key={`accent-${matchIndex}`}
        className={options?.accentClassName}
      >
        {content}
      </span>
    );

    lastIndex = matchIndex + fullMatch.length;
  }

  // Trailing text after last match
  if (lastIndex < input.length) {
    nodes.push(input.substring(lastIndex));
  }

  if (nodes.length === 0) {
    return input;
  }

  return nodes.length === 1 ? nodes[0] : <>{nodes}</>;
}
