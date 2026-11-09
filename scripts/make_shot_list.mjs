#!/usr/bin/env node
// Generates docs/dataset/shot_list.csv: the exact list of photos to take for the detector dataset
// (see docs/DATASET_COLLECTION.md). The list is fully determined by the tables below, so run it again after
// changing them:   node scripts/make_shot_list.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../docs/dataset/shot_list.csv');

const LOCATIONS = [
  { name: 'table', light: 'lamp' },
  { name: 'floor', light: 'window' },
  { name: 'bin', light: 'dim' },
  { name: 'outdoor', light: 'daylight' },
];
const LIGHT = Object.fromEntries(LOCATIONS.map((l) => [l.name, l.light]));
// Three shots per object: one per angle, and distances alternate between the two sets.
const SETS = {
  1: [['top', 'near'], ['side', 'far'], ['45', 'near']],
  2: [['top', 'far'], ['side', 'near'], ['45', 'far']],
};

// Objects per class: [item, condition]. Order matters: object number = position + 1.
const CLASSES = {
  plastic: [
    ['500 ml clear PET bottle', 'clean'], ['1.5 L PET bottle', 'clean'], ['coloured soft-drink bottle (leave it wet)', 'wet'],
    ['shampoo or detergent bottle (crush it first)', 'crushed'], ['food tub with lid', 'clean'], ['yoghurt or milk cup (not rinsed)', 'dirty'],
    ['bubble-tea cup (crush it first)', 'crushed'], ['cooking-oil bottle', 'clean'], ['knotted plastic bag (food-stained)', 'dirty'],
    ['takeaway container with sauce residue', 'dirty'], ['cup with lid', 'clean'], ['trigger spray bottle (not an aerosol)', 'clean'],
  ],
  paper: [
    ['newspaper', 'clean'], ['stack of A4 sheets', 'clean'], ['magazine (slightly damp)', 'wet'], ['envelope (crumpled)', 'crushed'],
    ['notebook', 'clean'], ['paper bag with stains', 'dirty'], ['flyer or leaflet (crumpled)', 'crushed'], ['poster sheet', 'clean'],
    ['bakery paper bag', 'clean'], ['old exercise book (stained)', 'dirty'],
  ],
  cardboard: [
    ['shoebox', 'clean'], ['delivery carton', 'clean'], ['cereal box (slightly damp)', 'wet'], ['egg carton (squashed)', 'crushed'],
    ['instant-noodle carton', 'clean'], ['pizza box (greasy)', 'dirty'], ['tissue box (squashed)', 'crushed'], ['flattened box', 'crushed'],
    ['toilet-roll tube', 'clean'], ['corrugated sheet', 'clean'],
  ],
  metal: [
    ['drink can (100plus or Coke)', 'clean'], ['sardine tin', 'clean'], ['Milo tin (leave it wet)', 'wet'], ['drink can (crush it first)', 'crushed'],
    ['aluminium foil tray', 'clean'], ['condensed-milk tin (residue left)', 'dirty'], ['second drink can, another brand (crush it first)', 'crushed'],
    ['canned-food tin (corn or beans)', 'clean'], ['crumpled aluminium foil (food-stained)', 'dirty'], ['cooking-oil tin (oily)', 'dirty'],
    ['handful of bottle caps', 'clean'], ['coffee tin', 'clean'],
  ],
  glass: [
    ['clear beverage bottle', 'clean'], ['jam jar', 'clean'], ['green bottle (leave it wet)', 'wet'], ['brown bottle', 'clean'], ['sauce bottle', 'clean'],
    ['coffee jar (residue left)', 'dirty'], ['oil bottle', 'clean'], ['cosmetic jar', 'clean'], ['pasta-sauce jar (residue left)', 'dirty'],
    ['intact drinking glass (stained)', 'dirty'], ['small spice jar', 'clean'], ['tall clear water bottle', 'clean'],
  ],
  trash: [
    ['snack wrapper', 'dirty'], ['polystyrene takeaway box', 'dirty'], ['polystyrene cup (leave it wet)', 'wet'], ['used tissue (crumpled)', 'crushed'],
    ['food-soiled paper napkin', 'dirty'], ['rubber glove', 'clean'], ['sauce sachet (crumpled)', 'crushed'], ['instant-noodle cup (polystyrene)', 'dirty'],
    ['handful of candy wrappers', 'clean'], ['old toothbrush', 'clean'],
  ],
  biological: [
    ['banana peel', 'fresh'], ['orange peel', 'fresh'], ['vegetable scraps (cut)', 'wet'], ['leftover rice', 'wet'],
    ['eggshell', 'dry'], ['coffee grounds', 'wet'], ['cooked chicken bones', 'dirty'], ['fruit core', 'fresh'],
  ],
};
const ORDER = ['plastic', 'metal', 'glass', 'paper', 'cardboard', 'trash', 'biological'];

const pad = (n, w) => String(n).padStart(w, '0');
function splitOfObject(count, k) {
  const test = count === 8 ? 1 : 2; // biological has only 8 objects
  const val = count === 8 ? 1 : count === 12 ? 2 : 1;
  if (k > count - test) return 'test';
  if (k > count - test - val) return 'val';
  return 'train';
}
function splitOfGroup(i, n, valN, testN) {
  return i >= n - testN ? 'test' : i >= n - testN - valN ? 'val' : 'train';
}

const rows = [];
const add = (r) => rows.push({ ...r, shot_id: pad(rows.length + 1, 3), done: '', notes: '' });

// 1. Single-item photos: 3 shots per object.
for (const cls of ['plastic', 'paper', 'cardboard', 'metal', 'glass', 'trash', 'biological']) {
  const objs = CLASSES[cls];
  objs.forEach(([item, condition], idx) => {
    const k = idx + 1;
    const loc = LOCATIONS[idx % 4].name;
    const set = SETS[Math.floor(idx / 4) % 2 === 0 ? 1 : 2];
    set.forEach(([angle, dist], s) => {
      add({
        filename: `${cls}_o${pad(k, 2)}_s${s + 1}_${loc}-${angle}-${dist}.jpg`, photo_type: 'single', class: cls, object_id: `o${pad(k, 2)}`, shot_no: s + 1,
        location: loc, lighting: LIGHT[loc], angle, distance: dist, condition, item, items_needed: '', expected_boxes: 1, split: splitOfObject(objs.length, k),
      });
    });
  });
}

// Objects available per split, for building mixed and pile photos from objects already photographed alone.
const bySplit = { train: {}, val: {}, test: {} };
for (const cls of ORDER) {
  const objs = CLASSES[cls];
  objs.forEach(([item], idx) => {
    const sp = splitOfObject(objs.length, idx + 1);
    (bySplit[sp][cls] ??= []).push({ id: `${cls}_o${pad(idx + 1, 2)}`, item });
  });
}
const use = {};
function pick(split, cls) {
  const list = bySplit[split][cls];
  const key = `${split}:${cls}`;
  use[key] = (use[key] ?? 0) + 1;
  const o = list[(use[key] - 1) % list.length];
  return `${o.id} (${o.item.replace(/ \(.*\)$/, '')})`;
}
let pointer = 0;
function takeClasses(n) {
  const res = [];
  for (let i = 0; i < n; i++) res.push(ORDER[pointer++ % ORDER.length]);
  return res;
}

// 2. Mixed photos: 2 to 4 items on a table or floor.
const MIX_ANGLES = ['45', 'top', 'side'];
for (let i = 0; i < 40; i++) {
  const size = 2 + (i % 3);
  const classes = takeClasses(size);
  const split = splitOfGroup(i, 40, 6, 6);
  const loc = ['table', 'floor'][i % 2];
  const dist = ['near', 'far'][Math.floor(i / 2) % 2];
  const angle = MIX_ANGLES[i % 3];
  add({
    filename: `mixed_m${pad(i + 1, 3)}_${loc}-${angle}-${dist}_${classes.join('-')}.jpg`, photo_type: 'mixed', class: 'multi', object_id: `m${pad(i + 1, 3)}`, shot_no: 1,
    location: loc, lighting: LIGHT[loc], angle, distance: dist, condition: 'mixed', item: '', items_needed: classes.map((c) => pick(split, c)).join('; '), expected_boxes: size, split,
  });
}

// 3. Pile photos: 5 to 7 items together in a bag, bin or on the floor.
const PILE_LOC = ['bin', 'bin', 'floor', 'outdoor'];
for (let i = 0; i < 20; i++) {
  const size = [5, 6, 7, 6][i % 4];
  const classes = takeClasses(size);
  const split = splitOfGroup(i, 20, 3, 3);
  const loc = PILE_LOC[i % 4];
  const angle = ['top', '45'][i % 2];
  const dist = ['near', 'far'][Math.floor(i / 2) % 2];
  add({
    filename: `pile_p${pad(i + 1, 3)}_${loc}-${angle}-${dist}_${classes.join('-')}.jpg`, photo_type: 'pile', class: 'multi', object_id: `p${pad(i + 1, 3)}`, shot_no: 1,
    location: loc, lighting: LIGHT[loc], angle, distance: dist, condition: 'mixed', item: '', items_needed: classes.map((c) => pick(split, c)).join('; '), expected_boxes: size, split,
  });
}

// 4. Empty photos: surfaces with no waste (so the model learns not to see waste everywhere).
const NONE_LOC = [...Array(10).fill('table'), ...Array(10).fill('floor'), ...Array(5).fill('bin'), ...Array(5).fill('outdoor')];
const NONE_TEXT = { table: 'empty table or counter', floor: 'empty tiled or wooden floor', bin: 'empty bin or open empty bag', outdoor: 'empty ground, grass or pavement' };
for (let i = 0; i < 30; i++) {
  const loc = NONE_LOC[i];
  const angle = ['top', 'side', '45'][i % 3];
  const dist = ['far', 'near'][i % 2];
  add({
    filename: `none_n${pad(i + 1, 3)}_${loc}-${angle}-${dist}.jpg`, photo_type: 'none', class: 'none', object_id: `n${pad(i + 1, 3)}`, shot_no: 1,
    location: loc, lighting: LIGHT[loc], angle, distance: dist, condition: '', item: '', items_needed: `no waste in frame; ${NONE_TEXT[loc]}`, expected_boxes: 0, split: splitOfGroup(i, 30, 4, 5),
  });
}

const COLS = ['shot_id', 'filename', 'photo_type', 'class', 'object_id', 'shot_no', 'location', 'lighting', 'angle', 'distance', 'condition', 'item', 'items_needed', 'expected_boxes', 'split', 'done', 'notes'];
const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, [COLS.join(','), ...rows.map((r) => COLS.map((c) => q(r[c] ?? '')).join(','))].join('\n') + '\n');

// Summary
const tally = {};
for (const r of rows) {
  const key = r.photo_type === 'single' ? r.class : r.photo_type;
  tally[key] ??= { photos: 0, boxes: 0, train: 0, val: 0, test: 0 };
  tally[key].photos++;
  tally[key].boxes += r.expected_boxes;
  tally[key][r.split]++;
}
console.table(tally);
console.log(`Total: ${rows.length} photos, ${rows.reduce((n, r) => n + r.expected_boxes, 0)} boxes -> ${path.relative(process.cwd(), out)}`);
const names = new Set(rows.map((r) => r.filename));
if (names.size !== rows.length) throw new Error('Duplicate file names in the shot list.');
