import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { IconButton } from '../../src/components/ui/IconButton';
import { Modal, ModalActions } from '../../src/components/ui/Modal';
import { InlineAlert } from '../../src/components/ui/InlineAlert';
import { DocumentIcon, EditIcon, TrashIcon } from '../../src/components/ui/Icons';
import iconButtonStyles from '../../src/components/ui/IconButton.module.css';
import inlineAlertStyles from '../../src/components/ui/InlineAlert.module.css';

describe('Subtask 12.2: Canonical IconButton, ModalActions, InlineAlert & Shared Icons', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('IconButton', () => {
    it('renders a native button with mandatory aria-label and triggers onClick', () => {
      const onClick = vi.fn();
      render(
        <IconButton aria-label="Close dialog" onClick={onClick}>
          ✕
        </IconButton>
      );

      const btn = screen.getByRole('button', { name: 'Close dialog' });
      expect(btn.getAttribute('type')).toBe('button');
      expect(btn.className).toContain(iconButtonStyles.iconBtn);
      fireEvent.click(btn);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('applies variant and size classes and respects disabled state', () => {
      const onClick = vi.fn();
      render(
        <IconButton
          aria-label="Delete item"
          variant="danger"
          size="xs"
          shape="square"
          disabled
          onClick={onClick}
        >
          <TrashIcon />
        </IconButton>
      );

      const btn = screen.getByRole('button', { name: 'Delete item' }) as HTMLButtonElement;
      expect(btn.hasAttribute('disabled')).toBe(true);
      expect(btn.className).toContain(iconButtonStyles.variantDanger);
      expect(btn.className).toContain(iconButtonStyles.sizeXs);
      expect(btn.className).toContain(iconButtonStyles.shapeSquare);
      fireEvent.click(btn);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Modal footer & ModalActions', () => {
    it('renders Modal footer slot and canonical IconButton close trigger', () => {
      const onClose = vi.fn();
      render(
        <Modal
          isOpen
          onClose={onClose}
          title="Confirm Action"
          footer={
            <ModalActions left={<span>Hint</span>}>
              <button type="button">Cancel</button>
              <button type="button">Save</button>
            </ModalActions>
          }
        >
          <p>Body content</p>
        </Modal>
      );

      expect(screen.getByText('Body content')).toBeDefined();
      expect(screen.getByText('Hint')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
      const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
      expect(closeBtn.className).toContain(iconButtonStyles.iconBtn);
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('InlineAlert', () => {
    it('uses role="alert" for error and warning variants', () => {
      const { rerender } = render(
        <InlineAlert variant="error" title="Error">
          Something failed.
        </InlineAlert>
      );

      const alert = screen.getByRole('alert');
      expect(alert.className).toContain(inlineAlertStyles.variantError);
      expect(alert.textContent).toContain('Error');
      expect(alert.textContent).toContain('Something failed.');

      rerender(<InlineAlert variant="warning">Careful now.</InlineAlert>);
      const warning = screen.getByRole('alert');
      expect(warning.className).toContain(inlineAlertStyles.variantWarning);
    });

    it('uses role="status" for info and success variants and supports explicit role override', () => {
      const { rerender } = render(<InlineAlert variant="info">Checking...</InlineAlert>);
      expect(screen.getByRole('status').className).toContain(inlineAlertStyles.variantInfo);

      rerender(<InlineAlert variant="success">Verified!</InlineAlert>);
      expect(screen.getByRole('status').className).toContain(inlineAlertStyles.variantSuccess);

      rerender(
        <InlineAlert variant="info" role="alert">
          Urgent info
        </InlineAlert>
      );
      expect(screen.getByRole('alert').textContent).toContain('Urgent info');
    });
  });

  describe('Shared Icons', () => {
    it('renders DocumentIcon, EditIcon, and TrashIcon with aria-hidden="true"', () => {
      const { container } = render(
        <div>
          <DocumentIcon size={24} className="doc-cls" />
          <EditIcon size={16} />
          <TrashIcon size={16} />
        </div>
      );

      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBe(3);
      expect(svgs[0].getAttribute('width')).toBe('24');
      expect(svgs[0].getAttribute('height')).toBe('24');
      expect(svgs[0].getAttribute('aria-hidden')).toBe('true');
      expect(svgs[0].getAttribute('class')).toContain('doc-cls');
      expect(svgs[1].getAttribute('aria-hidden')).toBe('true');
      expect(svgs[2].getAttribute('aria-hidden')).toBe('true');
    });
  });
});
