'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import { pageRangeIndices, selectPageRanges, gridOrder, bookletSheets, buildPrintHtml } from './print-layout.mjs';

test('page range filtering uses one-based UI selections converted to zero-based inclusive ranges', () => {
  assert.deepEqual(pageRangeIndices(6, [{ from: 0, to: 0 }, { from: 2, to: 2 }, { from: 4, to: 4 }]), [0, 2, 4]);
  assert.deepEqual(pageRangeIndices(6, [{ from: 1, to: 3 }]), [1, 2, 3]);
  assert.deepEqual(pageRangeIndices(3, [{ from: 9, to: 12 }]), []);
  assert.deepEqual(pageRangeIndices(4, []), [0, 1, 2, 3]);
});

test('All, odd, even, current, and validated custom page ranges are selected correctly', () => {
  assert.equal(selectPageRanges(6, { range: 'all' }), undefined);
  assert.deepEqual(selectPageRanges(6, { range: 'odd' }), [{ from: 0, to: 0 }, { from: 2, to: 2 }, { from: 4, to: 4 }]);
  assert.deepEqual(selectPageRanges(6, { range: 'even' }), [{ from: 1, to: 1 }, { from: 3, to: 3 }, { from: 5, to: 5 }]);
  assert.deepEqual(selectPageRanges(6, { range: 'current', currentPage: 99 }), [{ from: 5, to: 5 }]);
  assert.deepEqual(selectPageRanges(6, { range: 'custom', customRange: '1-3, 5, 99, 3-2, bad, 0' }), [{ from: 0, to: 2 }, { from: 4, to: 4 }]);
  assert.deepEqual(selectPageRanges(0, { range: 'current', currentPage: 0 }), []);
});

test('grid order produces distinct horizontal and vertical placement for partial grids', () => {
  assert.deepEqual(gridOrder(6, 'horizontal').positions, [
    { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
    { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
  ]);
  assert.deepEqual(gridOrder(6, 'vertical').positions, [
    { row: 0, col: 0 }, { row: 1, col: 0 }, { row: 0, col: 1 },
    { row: 1, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 2 },
  ]);
  assert.equal(gridOrder(16, 'vertical').positions.length, 16);
  assert.deepEqual(gridOrder(4, 'horizontal-reversed').positions, [
    { row: 0, col: 1 }, { row: 0, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 0 },
  ]);
  assert.deepEqual(gridOrder(4, 'vertical-reversed').positions, [
    { row: 1, col: 0 }, { row: 0, col: 0 }, { row: 1, col: 1 }, { row: 0, col: 1 },
  ]);
});

test('booklet imposes padded outer-to-inner spreads and honors subset and right binding', () => {
  const pages = ['1', '2', '3', '4', '5', '6', '7', '8'];
  assert.deepEqual(bookletSheets(pages, 'both', 1, 2, 'left'), [
    { side: 'front', pages: ['8', '1'] }, { side: 'back', pages: ['2', '7'] },
    { side: 'front', pages: ['6', '3'] }, { side: 'back', pages: ['4', '5'] },
  ]);
  assert.deepEqual(bookletSheets(pages, 'front', 1, 1, 'right'), [{ side: 'front', pages: ['1', '8'] }]);
  assert.deepEqual(bookletSheets(['1','2','3'], 'both', 1, 1, 'left'), [
    { side: 'front', pages: [null, '1'] }, { side: 'back', pages: ['2', '3'] },
  ]);
  assert.deepEqual(bookletSheets(pages, 'back', 2, 2, 'left'), [
    { side: 'back', pages: ['4', '5'] },
  ]);
  assert.deepEqual(bookletSheets(pages, 'both', 2, 1, 'left'), []);
});

test('print HTML creates poster tiles, ordered multiple grids, booklet spreads, orientation, and labels', () => {
  const pages = ['data:image/png;base64,AA==', 'data:image/png;base64,BB==', 'data:image/png;base64,CC=='];
  const base = { paperSize: 'A4', sourceSize: [210, 297], autoCenter: true, autoRotate: true };
  const rotated = buildPrintHtml({ ...base, mode: 'size', landscape: true, sizing: 'fit' }, pages.slice(0, 1));
  assert.match(rotated, /class="fit rotated"/);
  assert.ok(rotated.includes(".pagebox img.fit.rotated{width:var(--bh)!important;height:var(--bw)!important}"));
  const notCentered = buildPrintHtml({ ...base, mode: 'size', autoCenter: false }, pages.slice(0, 1));
  assert.doesNotMatch(notCentered, /class="pagebox center"/);

  const poster = buildPrintHtml({ ...base, mode: 'poster', posterScale: 250, posterOverlap: 10, posterCutMarks: true, posterLabels: true }, pages.slice(0, 1));
  assert.match(poster, /@page\{size:210mm 297mm/);
  assert.match(poster, /class="marks"/);
  assert.match(poster, /Page 1 · 1,1/);
  assert.ok((poster.match(/class="sheet tile"/g) || []).length > 1);

  const multiple = buildPrintHtml({ ...base, mode: 'multiple', pagesPerSheet: 4, multiplePageOrder: 'vertical', landscape: true }, pages);
  assert.match(multiple, /@page\{size:297mm 210mm/);
  assert.match(multiple, /grid-row:2;grid-column:1/);

  const booklet = buildPrintHtml({ ...base, mode: 'booklet', bookletSubset: 'front', bookletFrom: 1, bookletTo: 1, bookletBinding: 'right' }, pages);
  assert.match(booklet, /Page 1/);
  assert.match(booklet, /Page 1/);
  assert.match(booklet, /class=.blank./);
  assert.equal((booklet.match(/class="sheet spread"/g) || []).length, 1);
});

test('print HTML escapes image sources and labels', () => {
  const html = buildPrintHtml({ paperSize: 'A4', sourceSize: [210,297], mode: 'size' }, ['data:image/png;base64,"><script>']);
  assert.ok(!html.includes('src="data:image/png;base64,"><script>"'));
});
