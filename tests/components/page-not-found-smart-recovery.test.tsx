import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PageNotFound } from '../../src/components/feedback/PageNotFound';
import type { PageMatchCandidate } from '../../src/types/page';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PAGE_NOT_FOUND_TSX = path.join(ROOT, 'src/components/feedback/PageNotFound.tsx');
const PAGE_NOT_FOUND_CSS = path.join(ROOT, 'src/components/feedback/PageNotFound.module.css');

const SAMPLE_SUGGESTIONS: PageMatchCandidate[] = [
  {
    id: 'page-notes-2026',
    title: '2026 Notes',
    path: '/#/node/access/research/2026-notes',
    breadcrumbLabel: 'Access / Research / 2026 Notes',
    score: 0.92,
  },
  {
    id: 'page-field-guide',
    title: 'Field Guide',
    path: '/#/node/access/research/field-guide',
    breadcrumbLabel: 'Access / Research / Field Guide',
    score: 0.78,
  },
  {
    id: 'page-glossary',
    title: 'Glossary',
    path: '/#/node/access/glossary',
    breadcrumbLabel: 'Access / Glossary',
    score: 0.65,
  },
  {
    id: 'page-metrics',
    title: 'Metrics Overview',
    path: '/#/node/metrics',
    breadcrumbLabel: 'Metrics Overview',
    score: 0.54,
  },
  {
    id: 'page-archive',
    title: 'Archive 2025',
    path: '/#/node/access/archive-2025',
    breadcrumbLabel: 'Access / Archive 2025',
    score: 0.45,
  },
  {
    id: 'page-extra-sixth',
    title: 'Extra Sixth Page',
    path: '/#/node/access/extra-sixth',
    breadcrumbLabel: 'Access / Extra Sixth Page',
    score: 0.35,
  },
];

describe('Subtask 13.8: Smart PageNotFound Fuzzy Recovery UI', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders canonical primary "Back to Home" Button and hides suggestions when none exist', () => {
    const onReturn = vi.fn();
    const { container } = render(<PageNotFound onReturn={onReturn} />);

    expect(screen.getByText('404')).toBeDefined();
    expect(screen.getByText('Page Not Found')).toBeDefined();

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(1);
    const backBtn = screen.getByRole('button', { name: /Back to Home/i });
    expect(backBtn.getAttribute('data-variant')).toBe('primary');

    fireEvent.click(backBtn);
    expect(onReturn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: /Similar pages/i })).toBeNull();
  });

  it('shows "There are no similar pages." when the matcher ran and returned nothing', () => {
    render(<PageNotFound suggestions={[]} />);
    expect(screen.getByText(/There are no similar pages/i)).toBeDefined();
    expect(screen.queryByText(/Were you looking for/i)).toBeNull();
  });

  it('renders up to 5 fuzzy-matched suggestions with title + breadcrumbLabel, zero synthetic score badges, and calls onSelectSuggestion', () => {
    const onSelectSuggestion = vi.fn();

    const { container } = render(
      <PageNotFound
        suggestions={SAMPLE_SUGGESTIONS}
        onSelectSuggestion={onSelectSuggestion}
      />
    );

    const section = screen.getByRole('region', { name: /Similar pages/i });
    expect(section).toBeDefined();
    expect(screen.getByText(/Were you looking for/i)).toBeDefined();

    // First 5 suggestions render with title and breadcrumb trail
    for (const item of SAMPLE_SUGGESTIONS.slice(0, 5)) {
      expect(screen.getByText(item.title)).toBeDefined();
      expect(screen.getByText(item.breadcrumbLabel)).toBeDefined();
    }

    // 6th suggestion is capped out
    expect(screen.queryByText('Extra Sixth Page')).toBeNull();

    // Zero synthetic score badges (e.g. "92% match")
    expect(section.textContent).not.toMatch(/%/);

    // Clicking a suggestion calls onSelectSuggestion with the page ID
    const links = container.querySelectorAll('a');
    expect(links.length).toBe(5);
    fireEvent.click(links[0]);
    expect(onSelectSuggestion).toHaveBeenCalledWith('page-notes-2026');
  });

  it('enforces canonical UI (zero raw <button>), token purity, zero outline policy, whitespace separation, and zero horizontal dividers in CSS', () => {
    const tsxSource = fs.readFileSync(PAGE_NOT_FOUND_TSX, 'utf-8');
    expect(tsxSource).not.toMatch(/<button\b/);

    const cssSource = fs.readFileSync(PAGE_NOT_FOUND_CSS, 'utf-8');
    const colorPattern = /(#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\()/i;
    expect(cssSource).not.toMatch(colorPattern);
    expect(cssSource).toMatch(/outline:\s*none/);
    expect(cssSource).not.toMatch(/\bborder-top\b|\bborder-bottom\b/);
    expect(cssSource).toMatch(/\.suggestionsSection\s*\{[^}]*margin-top:\s*clamp\(/s);
  });
});
