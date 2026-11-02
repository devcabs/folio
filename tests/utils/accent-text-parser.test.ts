import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { validateAccentedText, parseAccentedText } from '../../src/utils/accentTextParser';
import { verifyEngineWiring } from '../../src/diagnostics/verifyEngineSetup';

describe('Accent Text Parser & Diagnostics', () => {
  describe('validateAccentedText', () => {
    it('returns valid for plain text without delimiters', () => {
      const res = validateAccentedText('Plain hero title without accents');
      expect(res.valid).toBe(true);
      expect(res.warnings).toHaveLength(0);
    });

    it('returns valid for single-asterisk enclosed text', () => {
      const res = validateAccentedText('Responsableng *estudyante* na may Galing');
      expect(res.valid).toBe(true);
      expect(res.warnings).toHaveLength(0);
    });

    it('returns valid for double-asterisk enclosed text', () => {
      const res = validateAccentedText('Responsableng **estudyante** na may Galing');
      expect(res.valid).toBe(true);
      expect(res.warnings).toHaveLength(0);
    });

    it('flags unclosed asterisk delimiter as warning', () => {
      const res = validateAccentedText('Responsableng *estudyante na may Galing');
      expect(res.valid).toBe(false);
      expect(res.warnings.some((w) => w.includes('Unclosed asterisk delimiter'))).toBe(true);
    });

    it('flags empty asterisk delimiters', () => {
      const res = validateAccentedText('Responsableng **** na may Galing');
      expect(res.valid).toBe(false);
      expect(res.warnings.some((w) => w.includes('Empty accent delimiter'))).toBe(true);
    });
  });

  describe('parseAccentedText', () => {
    it('returns raw string when no asterisks present', () => {
      const result = parseAccentedText('Normal Title');
      expect(result).toBe('Normal Title');
    });

    it('returns non-string nodes directly', () => {
      const node = React.createElement('div', null, 'Hello');
      expect(parseAccentedText(node)).toBe(node);
    });

    it('parses single-asterisk accent into span with given class', () => {
      const result = parseAccentedText('Responsableng *estudyante* na may Galing', {
        accentClassName: 'flourish-class',
      });

      // result is a React fragment with children
      expect(React.isValidElement(result)).toBe(true);
      const children = React.Children.toArray((result as React.ReactElement<{ children: React.ReactNode }>).props.children);
      expect(children).toHaveLength(3);
      expect(children[0]).toBe('Responsableng ');

      const span = children[1] as React.ReactElement<{ className: string; children: React.ReactNode }>;
      expect(span.type).toBe('span');
      expect(span.props.className).toBe('flourish-class');
      expect(span.props.children).toBe('estudyante');

      expect(children[2]).toBe(' na may Galing');
    });

    it('parses double-asterisk accent into span with given class', () => {
      const result = parseAccentedText('Responsableng **estudyante** na may Galing', {
        accentClassName: 'flourish-class',
      });

      expect(React.isValidElement(result)).toBe(true);
      const children = React.Children.toArray((result as React.ReactElement<{ children: React.ReactNode }>).props.children);
      expect(children).toHaveLength(3);
      expect(children[0]).toBe('Responsableng ');

      const span = children[1] as React.ReactElement<{ className: string; children: React.ReactNode }>;
      expect(span.type).toBe('span');
      expect(span.props.className).toBe('flourish-class');
      expect(span.props.children).toBe('estudyante');

      expect(children[2]).toBe(' na may Galing');
    });

    it('handles multiple accented words in a single title', () => {
      const result = parseAccentedText('*First* and *Second*', {
        accentClassName: 'accent-style',
      });

      const children = React.Children.toArray((result as React.ReactElement<{ children: React.ReactNode }>).props.children);
      expect(children).toHaveLength(3);

      const span1 = children[0] as React.ReactElement<{ children: React.ReactNode }>;
      expect(span1.props.children).toBe('First');

      expect(children[1]).toBe(' and ');

      const span2 = children[2] as React.ReactElement<{ children: React.ReactNode }>;
      expect(span2.props.children).toBe('Second');
    });

    it('gracefully falls back on unclosed delimiter and invokes onWarn callback', () => {
      const warnSpy = vi.fn();
      const result = parseAccentedText('Responsableng *estudyante na may Galing', {
        onWarn: warnSpy,
      });

      expect(warnSpy).toHaveBeenCalled();
      // Should not throw and should render text cleanly
      expect(result).toBe('Responsableng *estudyante na may Galing');
    });
  });

  describe('verifyEngineWiring Diagnostics Integration', () => {
    it('adds warning when heroTitle contains unclosed asterisks', () => {
      const result = verifyEngineWiring({
        appId: 'test-app',
        appNamespace: 'test',
        branding: {
          appName: 'Test App',
          heroTitle: 'Responsableng *estudyante na may Galing',
        },
      });

      expect(
        result.warnings.some((w) => w.includes('heroTitle accent syntax warning'))
      ).toBe(true);
    });

    it('has zero heroTitle warnings when asterisks are well-formed', () => {
      const result = verifyEngineWiring({
        appId: 'test-app',
        appNamespace: 'test',
        branding: {
          appName: 'Test App',
          heroTitle: 'Responsableng *estudyante* na may Galing, Husay at Talino',
        },
      });

      expect(
        result.warnings.some((w) => w.includes('heroTitle accent syntax warning'))
      ).toBe(false);
    });
  });
});
