import test from 'node:test';
import assert from 'node:assert/strict';
import { computePopoverPosition } from './popoverPosition.ts';

test('computePopoverPosition: posicionamento padrão abaixo do botão com alinhamento inicial', () => {
  const triggerRect = { top: 40, bottom: 76, left: 100, right: 180, width: 80, height: 36 };
  const popoverSize = { width: 200, height: 120 };
  const viewport = { width: 1024, height: 768 };

  const pos = computePopoverPosition(triggerRect, popoverSize, viewport);

  assert.equal(pos.placement, 'bottom');
  assert.equal(pos.top, 76 + 6); // bottom + offset (6 default)
  assert.equal(pos.left, 100);
});

test('computePopoverPosition: clamping na borda direita em tela mobile (360px)', () => {
  const triggerRect = { top: 50, bottom: 86, left: 240, right: 320, width: 80, height: 36 };
  const popoverSize = { width: 288, height: 200 };
  const viewport = { width: 360, height: 640 };

  const pos = computePopoverPosition(triggerRect, popoverSize, viewport);

  assert.equal(pos.placement, 'bottom');
  // Maximum allowed left: 360 - 288 - 8 = 64
  assert.equal(pos.left, 64);
  assert.ok(pos.left + popoverSize.width <= viewport.width - 8);
  assert.ok(pos.left >= 8);
});

test('computePopoverPosition: clamping na borda esquerda', () => {
  const triggerRect = { top: 60, bottom: 96, left: 2, right: 82, width: 80, height: 36 };
  const popoverSize = { width: 240, height: 150 };
  const viewport = { width: 800, height: 600 };

  const pos = computePopoverPosition(triggerRect, popoverSize, viewport);

  assert.equal(pos.placement, 'bottom');
  // Minimum allowed left: 8
  assert.equal(pos.left, 8);
});

test('computePopoverPosition: inversão (placement: top) perto do rodapé do viewport', () => {
  const triggerRect = { top: 520, bottom: 556, left: 120, right: 200, width: 80, height: 36 };
  const popoverSize = { width: 220, height: 160 };
  const viewport = { width: 800, height: 600 };
  const offset = 6;

  // Space below: 600 - 556 = 44 < (160 + 6) => Invert to 'top'
  const pos = computePopoverPosition(triggerRect, popoverSize, viewport, offset);

  assert.equal(pos.placement, 'top');
  assert.equal(pos.top, 520 - offset - 160); // 354
  assert.equal(pos.left, 120);
});

test('computePopoverPosition: suporta align="end" com clamping em tela ampla e custom offset', () => {
  const triggerRect = { top: 50, bottom: 86, left: 600, right: 680, width: 80, height: 36 };
  const popoverSize = { width: 288, height: 200 };
  const viewport = { width: 1280, height: 800 };
  const offset = 10;

  const pos = computePopoverPosition(triggerRect, popoverSize, viewport, offset, 'end');

  assert.equal(pos.placement, 'bottom');
  assert.equal(pos.top, 86 + 10);
  // Aligns right edge to triggerRect.right: 680 - 288 = 392
  assert.equal(pos.left, 392);
});
