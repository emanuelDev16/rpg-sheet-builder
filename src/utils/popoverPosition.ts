export interface RectLike {
  top: number;
  bottom: number;
  left: number;
  right?: number;
  width?: number;
  height?: number;
}

export interface SizeLike {
  width: number;
  height: number;
}

export interface PopoverPosition {
  top: number;
  left: number;
  placement: 'bottom' | 'top';
}

/**
 * Computes viewport-relative fixed coordinates for an anchored popover.
 * - Prefers placement below trigger ('bottom'); inverts to above ('top') if there is no vertical space below.
 * - Applies horizontal clamping to [8, viewport.width - popoverSize.width - 8] to avoid overflowing boundaries.
 */
export function computePopoverPosition(
  triggerRect: RectLike,
  popoverSize: SizeLike,
  viewport: SizeLike,
  offset: number = 6,
  align: 'start' | 'end' = 'start',
): PopoverPosition {
  const fitsBelow = triggerRect.bottom + offset + popoverSize.height <= viewport.height;
  const placement: 'bottom' | 'top' = fitsBelow ? 'bottom' : 'top';

  const top = placement === 'bottom'
    ? triggerRect.bottom + offset
    : triggerRect.top - offset - popoverSize.height;

  const minLeft = 8;
  const maxLeft = Math.max(minLeft, viewport.width - popoverSize.width - 8);

  const idealLeft =
    align === 'end' && typeof triggerRect.right === 'number'
      ? triggerRect.right - popoverSize.width
      : triggerRect.left;

  const left = Math.min(Math.max(idealLeft, minLeft), maxLeft);

  return {
    top: Math.round(top),
    left: Math.round(left),
    placement,
  };
}
