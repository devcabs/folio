import { createRef, act } from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  FormField,
  Input,
  Textarea,
  Select,
  Checkbox,
  SegmentedControl,
  ValueLabelToggle,
} from '../../src/components/ui';

function getReactProps(el: any): Record<string, any> | undefined {
  const propKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  return propKey ? el[propKey] : undefined;
}

describe('Subtask 12.3: Canonical Form Primitives', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('FormField', () => {
    it('links label htmlFor to child control and automatically wires aria-describedby for hint and error', () => {
      const { container } = render(
        <FormField
          id="email-field"
          label="Email Address"
          required
          hint="We will never share your email."
          error="Please enter a valid email."
          labelAction={<button type="button">Reset</button>}
        >
          <Input id="email-field" invalid />
        </FormField>
      );

      const label = container.querySelectorAll('label')[0];
      const input = container.querySelectorAll('input')[0];
      expect(label.getAttribute('for')).toBe('email-field');
      expect(input.getAttribute('id')).toBe('email-field');
      expect(screen.getByText('*')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDefined();

      const hintEl = screen.getByText('We will never share your email.');
      const errorEl = screen.getByRole('alert');
      expect(errorEl.textContent).toBe('Please enter a valid email.');
      expect(hintEl.getAttribute('id')).toBe('email-field-hint');
      expect(errorEl.getAttribute('id')).toBe('email-field-error');

      const describedBy = input.getAttribute('aria-describedby') || '';
      expect(describedBy).toContain('email-field-error');
      expect(describedBy).toContain('email-field-hint');
    });

    it('preserves existing aria-describedby on child control and omits error when null', () => {
      const { container } = render(
        <FormField id="name-field" label="Display Name" hint="Shown publicly." error={null}>
          <Input id="name-field" aria-describedby="external-note" />
        </FormField>
      );

      const input = container.querySelectorAll('input')[0];
      const describedBy = input.getAttribute('aria-describedby') || '';
      expect(describedBy).toContain('external-note');
      expect(describedBy).toContain('name-field-hint');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('Input', () => {
    it('forwards ref, sets aria-invalid, supports valid state, and honors disabled', () => {
      const ref = createRef<HTMLInputElement>();
      const { container, rerender } = render(
        <Input ref={ref} aria-label="Username" valid defaultValue="alice" />
      );

      const input = container.querySelectorAll('input')[0] as HTMLInputElement;
      expect(ref.current).toBe(input);
      expect(input.className).toMatch(/valid/i);
      expect(input.getAttribute('aria-invalid')).toBeNull();

      rerender(<Input ref={ref} aria-label="Username" invalid disabled defaultValue="alice" />);
      const updated = container.querySelectorAll('input')[0] as HTMLInputElement;
      expect(updated.getAttribute('aria-invalid')).toBe('true');
      expect(updated.className).toMatch(/invalid/i);
      expect(updated.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('Textarea', () => {
    it('forwards ref, sets aria-invalid, supports monospace, and honors disabled', () => {
      const ref = createRef<HTMLTextAreaElement>();
      const { container } = render(
        <Textarea
          ref={ref}
          aria-label="Summary"
          invalid
          monospace
          disabled
          defaultValue="Editorial notes"
        />
      );

      const textarea = container.querySelectorAll('textarea')[0] as HTMLTextAreaElement;
      expect(ref.current).toBe(textarea);
      expect(textarea.getAttribute('aria-invalid')).toBe('true');
      expect(textarea.className).toMatch(/invalid/i);
      expect(textarea.className).toMatch(/monospace/i);
      expect(textarea.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('Select', () => {
    it('forwards ref, sets aria-invalid, honors disabled, and fires onChange', () => {
      const ref = createRef<HTMLSelectElement>();
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Select ref={ref} aria-label="Status" value="draft" onChange={onChange}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </Select>
      );

      const select = container.querySelectorAll('select')[0] as HTMLSelectElement;
      expect(ref.current).toBe(select);

      act(() => {
        getReactProps(select)?.onChange?.({ target: { value: 'published' } });
      });
      expect(onChange).toHaveBeenCalledTimes(1);

      rerender(
        <Select ref={ref} aria-label="Status" value="draft" invalid disabled onChange={onChange}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </Select>
      );
      const updated = container.querySelectorAll('select')[0] as HTMLSelectElement;
      expect(updated.getAttribute('aria-invalid')).toBe('true');
      expect(updated.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('Checkbox & ValueLabelToggle', () => {
    it('toggles checked via label association and change event, and respects disabled', () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Checkbox
          id="agree-box"
          checked={false}
          onChange={onChange}
          label="Show values on bars"
          hint="Displays numeric labels."
        />
      );

      const label = container.querySelectorAll('label')[0];
      const checkbox = container.querySelectorAll('input')[0] as HTMLInputElement;
      expect(label.getAttribute('for')).toBe('agree-box');
      expect(checkbox.getAttribute('type')).toBe('checkbox');
      expect(checkbox.getAttribute('id')).toBe('agree-box');
      expect(screen.getByText('Displays numeric labels.')).toBeDefined();

      act(() => {
        getReactProps(checkbox)?.onChange?.({ target: { checked: true } });
      });
      expect(onChange).toHaveBeenCalledWith(true);

      // Disabled prevents change
      onChange.mockClear();
      rerender(
        <Checkbox
          id="agree-box"
          checked={false}
          onChange={onChange}
          label="Show values on bars"
          disabled
        />
      );
      const disabledBox = container.querySelectorAll('input')[0] as HTMLInputElement;
      expect(disabledBox.hasAttribute('disabled')).toBe(true);
      act(() => {
        getReactProps(disabledBox)?.onChange?.({ target: { checked: true } });
      });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('ValueLabelToggle delegates to Checkbox with backward-compatible defaults', () => {
      const onChange = vi.fn();
      const { container } = render(<ValueLabelToggle checked={true} onChange={onChange} />);

      const checkbox = container.querySelectorAll('input')[0] as HTMLInputElement;
      expect(checkbox.getAttribute('id')).toBe('cfg-show-values');
      expect(screen.getByText('Show values on bars')).toBeDefined();
      act(() => {
        getReactProps(checkbox)?.onChange?.({ target: { checked: false } });
      });
      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe('SegmentedControl', () => {
    it('renders radiogroup with aria-checked options and invokes onChange', () => {
      const onChange = vi.fn();
      render(
        <SegmentedControl<'p' | 'blockquote'>
          aria-label="Typography Style"
          value="p"
          onChange={onChange}
          options={[
            { value: 'p', label: 'Body Paragraph' },
            { value: 'blockquote', label: 'Editorial Quote' },
          ]}
        />
      );

      const group = screen.getByRole('radiogroup', { name: 'Typography Style' });
      expect(group).toBeDefined();

      const bodyRadio = screen.getByRole('radio', { name: 'Body Paragraph' });
      const quoteRadio = screen.getByRole('radio', { name: 'Editorial Quote' });
      expect(bodyRadio.getAttribute('aria-checked')).toBe('true');
      expect(quoteRadio.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(quoteRadio);
      expect(onChange).toHaveBeenCalledWith('blockquote');

      // Keyboard ArrowRight from first option selects second option
      onChange.mockClear();
      act(() => {
        getReactProps(bodyRadio)?.onKeyDown?.({
          key: 'ArrowRight',
          preventDefault: vi.fn(),
        });
      });
      expect(onChange).toHaveBeenCalledWith('blockquote');
    });

    it('respects disabled control and disabled option', () => {
      const onChange = vi.fn();
      render(
        <SegmentedControl<'a' | 'b'>
          aria-label="Mode"
          value="a"
          onChange={onChange}
          options={[
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta', disabled: true },
          ]}
        />
      );

      const betaRadio = screen.getByRole('radio', { name: 'Beta' }) as HTMLButtonElement;
      expect(betaRadio.hasAttribute('disabled')).toBe(true);
      fireEvent.click(betaRadio);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Static CSS Token Purity', () => {
    it('contains zero hardcoded hex, rgb(), rgba(), hsl(), or hsla() values across all form primitive CSS modules', () => {
      const rootDir = process.cwd();
      const cssFiles = [
        path.join(rootDir, 'src', 'components', 'ui', 'FormField.module.css'),
        path.join(rootDir, 'src', 'components', 'ui', 'Input.module.css'),
        path.join(rootDir, 'src', 'components', 'ui', 'Textarea.module.css'),
        path.join(rootDir, 'src', 'components', 'ui', 'Select.module.css'),
        path.join(rootDir, 'src', 'components', 'ui', 'Checkbox.module.css'),
        path.join(rootDir, 'src', 'components', 'ui', 'SegmentedControl.module.css'),
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
