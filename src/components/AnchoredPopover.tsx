import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { computePopoverPosition, PopoverPosition } from '../utils/popoverPosition';

export interface AnchoredPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  offset?: number;
  align?: 'start' | 'end';
  id?: string;
  role?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  'data-testid'?: string;
}

export const AnchoredPopover: React.FC<AnchoredPopoverProps> = ({
  isOpen,
  onClose,
  triggerRef,
  children,
  className = '',
  offset = 6,
  align = 'start',
  id,
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
  'data-testid': testId,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  // Synchronize position on open, window resize, and scroll
  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const triggerEl = triggerRef.current;
      const popoverEl = popoverRef.current;
      if (!triggerEl) return;

      const triggerRect = triggerEl.getBoundingClientRect();
      const popoverSize = {
        width: popoverEl ? popoverEl.offsetWidth || popoverEl.getBoundingClientRect().width : 0,
        height: popoverEl ? popoverEl.offsetHeight || popoverEl.getBoundingClientRect().height : 0,
      };
      const viewport = {
        width: typeof window !== 'undefined' ? window.innerWidth : 1024,
        height: typeof window !== 'undefined' ? window.innerHeight : 768,
      };

      const computed = computePopoverPosition(triggerRect, popoverSize, viewport, offset, align);
      setPosition(computed);
    };

    updatePosition();

    window.addEventListener('resize', updatePosition, { passive: true });
    window.addEventListener('scroll', updatePosition, { capture: true, passive: true });

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, { capture: true });
    };
  }, [isOpen, triggerRef, offset, align]);

  // Handle Escape key and outside pointerdown
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        triggerRef.current?.focus();
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;

      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  // Preserve theme from closest themed ancestor or documentElement
  const activeTheme =
    triggerRef.current?.closest('[data-theme]')?.getAttribute('data-theme') ||
    document.documentElement.getAttribute('data-theme') ||
    undefined;

  const style: React.CSSProperties = {
    position: 'fixed',
    top: `${position ? position.top : -9999}px`,
    left: `${position ? position.left : -9999}px`,
    zIndex: 'var(--z-popover, 80)',
    visibility: position ? 'visible' : 'hidden',
  };

  return createPortal(
    <div
      ref={popoverRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-testid={testId}
      data-theme={activeTheme}
      data-placement={position?.placement || 'bottom'}
      className={`anchored-popover-portal no-print print:hidden ${className}`.trim()}
      style={style}
    >
      {children}
    </div>,
    document.body,
  );
};
