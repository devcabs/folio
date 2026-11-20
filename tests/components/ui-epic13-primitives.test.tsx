import { createRef } from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { PageIcon, Input, FormField, Button, InlineAlert } from '../../src/components/ui';

describe('Epic 13 Canonical UI Primitives & Token Gate', () => {
  afterEach(() => {
    cleanup();
  });

  describe('PageIcon', () => {
    it('renders an svg with aria-hidden="true" by default and respects custom size and className', () => {
      const { container } = render(<PageIcon size={20} className="custom-page-icon" />);
      const svg = container.querySelectorAll('svg')[0];
      expect(svg).toBeDefined();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.getAttribute('width')).toBe('20');
      expect(svg?.getAttribute('height')).toBe('20');
      expect(svg?.getAttribute('class')).toContain('custom-page-icon');
    });
  });

  describe('Input', () => {
    it('renders an accessible input, forwards ref, and supports disabled and invalid states', () => {
      const ref = createRef<HTMLInputElement>();
      const { container } = render(
        <Input
          ref={ref}
          id="page-title-input"
          aria-label="Page Title"
          invalid
          disabled
          defaultValue="About"
        />
      );

      const input = container.querySelectorAll('input')[0] as HTMLInputElement;
      expect(input).toBeDefined();
      expect(ref.current).toBe(input);
      expect(input.getAttribute('aria-label')).toBe('Page Title');
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('disabled')).not.toBeNull();
      expect(input.getAttribute('value') ?? input.value).toBe('About');
    });

    it('applies monospace styling class when monospace prop is true', () => {
      const { container } = render(<Input aria-label="Slug" monospace />);
      const input = container.querySelectorAll('input')[0];
      expect(input).toBeDefined();
      expect(input.getAttribute('class') ?? input.className).toMatch(/monospace/i);
    });
  });

  describe('FormField', () => {
    it('associates label with child control, displays required indicator, hint, and role="alert" error', () => {
      const { container } = render(
        <FormField
          id="slug-field"
          label="URL Slug"
          required
          hint="Lowercase letters, numbers, and hyphens only."
          error="Slug is already taken"
        >
          <Input id="slug-field" invalid />
        </FormField>
      );

      const label = container.querySelectorAll('label')[0];
      const input = container.querySelectorAll('input')[0];
      expect(label.getAttribute('for')).toBe('slug-field');
      expect(input.getAttribute('id')).toBe('slug-field');
      expect(screen.getByText('*')).toBeDefined();
      expect(screen.getByText('Lowercase letters, numbers, and hyphens only.')).toBeDefined();

      const alert = screen.getByRole('alert');
      expect(alert.textContent).toBe('Slug is already taken');
    });

    it('omits role="alert" when error is null or empty', () => {
      render(
        <FormField id="clean-field" label="Title" error={null}>
          <Input id="clean-field" />
        </FormField>
      );

      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('Button danger variant', () => {
    it('renders danger variant with data-variant="danger" and supports disabled', () => {
      render(
        <Button variant="danger" disabled>
          Delete Page
        </Button>
      );

      const btn = screen.getByRole('button', { name: 'Delete Page' }) as HTMLButtonElement;
      expect(btn.getAttribute('data-variant')).toBe('danger');
      expect(btn.getAttribute('disabled')).not.toBeNull();
    });

    it('renders InlineAlert variant="error" with role="alert"', () => {
      render(
        <InlineAlert variant="error">
          Deleting this page will also remove 2 child subpages.
        </InlineAlert>
      );

      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('Deleting this page will also remove 2 child subpages.');
    });
  });

  describe('Static CSS Token Purity', () => {
    it('contains zero hardcoded hex, rgb(), rgba(), hsl(), or hsla() values in Input.module.css and FormField.module.css', () => {
      const rootDir = process.cwd();
      const cssFiles = [
        path.join(rootDir, 'src', 'components', 'ui', 'Input.module.css'),
        path.join(rootDir, 'src', 'components', 'ui', 'FormField.module.css'),
      ];
      const hardcodedColorRegex = /#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/;

      for (const filePath of cssFiles) {
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).not.toMatch(hardcodedColorRegex);
      }
    });
  });
});
