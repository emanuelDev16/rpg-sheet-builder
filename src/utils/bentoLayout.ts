export interface BentoSegmentItem<T> {
  card: T;
  originalIndex: number;
}

export interface BentoFullSegment<T> {
  type: 'full';
  items: Array<BentoSegmentItem<T>>;
}

export interface BentoColumnsSegment<T> {
  type: 'columns';
  left: Array<BentoSegmentItem<T>>;
  right: Array<BentoSegmentItem<T>>;
}

export type BentoCardSegment<T> = BentoFullSegment<T> | BentoColumnsSegment<T>;

/**
 * Matches the CSS 2-column Bento breakpoints used on screen:
 * - Desktop (`>= 64rem` / `>= 1024px`, aligned with Tailwind `lg:`)
 * - Mobile/tablet landscape (`560px..932px` in landscape orientation)
 */
export const BENTO_TWO_COLUMN_MEDIA_QUERY =
  '(min-width: 64rem), (min-width: 1024px), (max-width: 932px) and (min-width: 560px) and (orientation: landscape)';

/**
 * Resolves whether the Bento container should render segmented 2-column masonry.
 * Printing always falls back to the flat CSS Print Grid.
 */
export function shouldUseTwoColumnMasonry(
  matchesTwoCol: boolean,
  isPrinting: boolean,
): boolean {
  return matchesTwoCol && !isPrinting;
}

/**
 * Returns true when a card must span the full Bento grid width rather than
 * flowing inside the 2-column masonry lanes.
 */
export function isFullWidthBentoCard(card: { id?: string; colSpan?: number }): boolean {
  return card.id === 'card_wod_dossier' || (card.colSpan ?? 1) >= 2;
}

/**
 * Partitions an ordered card list into full-width bands and independent 2-column
 * masonry segments, preserving each card's original array index.
 */
export function partitionBentoCardSegments<T>(
  cards: readonly T[],
  isFullWidth: (card: T) => boolean,
): Array<BentoCardSegment<T>> {
  const segments: Array<BentoCardSegment<T>> = [];

  for (let originalIndex = 0; originalIndex < cards.length; originalIndex += 1) {
    const card = cards[originalIndex];
    const lastSegment = segments[segments.length - 1];

    if (isFullWidth(card)) {
      if (lastSegment && lastSegment.type === 'full') {
        lastSegment.items.push({ card, originalIndex });
      } else {
        segments.push({
          type: 'full',
          items: [{ card, originalIndex }],
        });
      }
      continue;
    }

    if (lastSegment && lastSegment.type === 'columns') {
      const localIndex = lastSegment.left.length + lastSegment.right.length;
      if (localIndex % 2 === 0) {
        lastSegment.left.push({ card, originalIndex });
      } else {
        lastSegment.right.push({ card, originalIndex });
      }
    } else {
      segments.push({
        type: 'columns',
        left: [{ card, originalIndex }],
        right: [],
      });
    }
  }

  return segments;
}
