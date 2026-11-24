import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BENTO_TWO_COLUMN_MEDIA_QUERY,
  isFullWidthBentoCard,
  partitionBentoCardSegments,
  shouldUseTwoColumnMasonry,
} from './bentoLayout.ts';

interface MockCard {
  id: string;
  code: string;
  colSpan: 1 | 2;
}

const isFullCard = (card: MockCard) => card.colSpan === 2;

test('partitionBentoCardSegments handles WoD main tab sequence (full -> half -> half -> half -> half)', () => {
  const cards: MockCard[] = [
    { id: 'card_identidade', code: '//CHRONICLE_ID', colSpan: 2 },
    { id: 'card_atributos', code: '//ATTRIBUTES', colSpan: 1 },
    { id: 'card_combate', code: '//VITAL_STATUS', colSpan: 1 },
    { id: 'card_skills', code: '//SKILLS_&_POOLS', colSpan: 1 },
    { id: 'card_inventario', code: '//INVENTORY', colSpan: 1 },
  ];

  const segments = partitionBentoCardSegments(cards, isFullCard);

  assert.equal(segments.length, 2);
  assert.deepEqual(segments[0], {
    type: 'full',
    items: [{ card: cards[0], originalIndex: 0 }],
  });
  assert.deepEqual(segments[1], {
    type: 'columns',
    left: [
      { card: cards[1], originalIndex: 1 }, // //ATTRIBUTES
      { card: cards[3], originalIndex: 3 }, // //SKILLS_&_POOLS stacked directly below //ATTRIBUTES
    ],
    right: [
      { card: cards[2], originalIndex: 2 }, // //VITAL_STATUS
      { card: cards[4], originalIndex: 4 }, // //INVENTORY
    ],
  });
});

test('partitionBentoCardSegments handles multiple full cards interleaved with half cards and resets column parity', () => {
  const cards: MockCard[] = [
    { id: 'c0', code: '//LEADING_HALF', colSpan: 1 },
    { id: 'c1', code: '//FULL_A', colSpan: 2 },
    { id: 'c2', code: '//FULL_B', colSpan: 2 },
    { id: 'c3', code: '//HALF_1', colSpan: 1 },
    { id: 'c4', code: '//HALF_2', colSpan: 1 },
    { id: 'c5', code: '//HALF_3', colSpan: 1 },
    { id: 'c6', code: '//FULL_C', colSpan: 2 },
    { id: 'c7', code: '//TRAILING_HALF', colSpan: 1 },
  ];

  const segments = partitionBentoCardSegments(cards, isFullCard);

  assert.equal(segments.length, 5);
  assert.deepEqual(segments[0], {
    type: 'columns',
    left: [{ card: cards[0], originalIndex: 0 }],
    right: [],
  });
  assert.deepEqual(segments[1], {
    type: 'full',
    items: [
      { card: cards[1], originalIndex: 1 },
      { card: cards[2], originalIndex: 2 },
    ],
  });
  assert.deepEqual(segments[2], {
    type: 'columns',
    left: [
      { card: cards[3], originalIndex: 3 },
      { card: cards[5], originalIndex: 5 },
    ],
    right: [{ card: cards[4], originalIndex: 4 }],
  });
  assert.deepEqual(segments[3], {
    type: 'full',
    items: [{ card: cards[6], originalIndex: 6 }],
  });
  assert.deepEqual(segments[4], {
    type: 'columns',
    left: [{ card: cards[7], originalIndex: 7 }],
    right: [],
  });
});

test('partitionBentoCardSegments places a single isolated half card in left with empty right', () => {
  const cards: MockCard[] = [{ id: 'solo', code: '//SOLO', colSpan: 1 }];

  const segments = partitionBentoCardSegments(cards, isFullCard);

  assert.deepEqual(segments, [
    {
      type: 'columns',
      left: [{ card: cards[0], originalIndex: 0 }],
      right: [],
    },
  ]);
});

test('partitionBentoCardSegments preserves exact originalIndex and handles empty input', () => {
  assert.deepEqual(partitionBentoCardSegments<MockCard>([], isFullCard), []);

  const cards: MockCard[] = [
    { id: 'a', code: '//A', colSpan: 2 },
    { id: 'b', code: '//B', colSpan: 1 },
    { id: 'c', code: '//C', colSpan: 1 },
    { id: 'd', code: '//D', colSpan: 1 },
    { id: 'e', code: '//E', colSpan: 2 },
    { id: 'f', code: '//F', colSpan: 1 },
  ];

  const segments = partitionBentoCardSegments(cards, isFullCard);
  const recoveredIndices = segments
    .flatMap((seg) =>
      seg.type === 'full' ? seg.items : [...seg.left, ...seg.right],
    )
    .map((item) => item.originalIndex)
    .sort((x, y) => x - y);

  assert.deepEqual(recoveredIndices, [0, 1, 2, 3, 4, 5]);
});

test('BENTO_TWO_COLUMN_MEDIA_QUERY matches desktop >=64rem/1024px and landscape 560px-932px breakpoints', () => {
  assert.match(BENTO_TWO_COLUMN_MEDIA_QUERY, /min-width:\s*64rem/);
  assert.match(BENTO_TWO_COLUMN_MEDIA_QUERY, /min-width:\s*1024px/);
  assert.match(BENTO_TWO_COLUMN_MEDIA_QUERY, /max-width:\s*932px/);
  assert.match(BENTO_TWO_COLUMN_MEDIA_QUERY, /min-width:\s*560px/);
  assert.match(BENTO_TWO_COLUMN_MEDIA_QUERY, /orientation:\s*landscape/);
});

test('shouldUseTwoColumnMasonry enables masonry only when 2-column matches and not printing', () => {
  assert.equal(shouldUseTwoColumnMasonry(true, false), true);
  assert.equal(shouldUseTwoColumnMasonry(true, true), false);
  assert.equal(shouldUseTwoColumnMasonry(false, false), false);
  assert.equal(shouldUseTwoColumnMasonry(false, true), false);
});

test('isFullWidthBentoCard treats card_wod_dossier and colSpan >= 2 as full-width and isolates it in masonry segments', () => {
  assert.equal(isFullWidthBentoCard({ id: 'card_wod_dossier', colSpan: 1 }), true);
  assert.equal(isFullWidthBentoCard({ id: 'card_wod_dossier' }), true);
  assert.equal(isFullWidthBentoCard({ id: 'card_disciplinas', colSpan: 2 }), true);
  assert.equal(isFullWidthBentoCard({ id: 'card_antecedentes', colSpan: 1 }), false);

  const cards = [
    { id: 'card_disciplinas', colSpan: 1 },
    { id: 'card_antecedentes', colSpan: 1 },
    { id: 'card_wod_dossier', colSpan: 1 },
    { id: 'card_anotacoes', colSpan: 2 },
  ];

  const segments = partitionBentoCardSegments(cards, isFullWidthBentoCard);
  assert.deepEqual(segments, [
    {
      type: 'columns',
      left: [{ card: { id: 'card_disciplinas', colSpan: 1 }, originalIndex: 0 }],
      right: [{ card: { id: 'card_antecedentes', colSpan: 1 }, originalIndex: 1 }],
    },
    {
      type: 'full',
      items: [
        { card: { id: 'card_wod_dossier', colSpan: 1 }, originalIndex: 2 },
        { card: { id: 'card_anotacoes', colSpan: 2 }, originalIndex: 3 },
      ],
    },
  ]);
});
