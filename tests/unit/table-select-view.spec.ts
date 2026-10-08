import { expect, test } from '@playwright/test';

import { resolveTableSelectView } from '@/app/[locale]/device/pos/utils/tables';
import { splitAreaDecor, type DeviceTableArea, type TableAreaElement } from '@/types/table';

const table = (id: string, x: number, y: number) => ({
  id,
  areaId: 'a',
  label: id,
  seats: null,
  shape: 'rect' as const,
  x,
  y,
  width: 80,
  height: 80,
  rotation: 0,
  sortOrder: 0,
});

const area = (id: string, placed: boolean): DeviceTableArea => ({
  id,
  name: id,
  sortOrder: 0,
  width: 1200,
  height: 800,
  gridSize: 20,
  decor: [],
  tables: placed ? [table(`${id}1`, 0, 0), table(`${id}2`, 200, 100)] : [table(`${id}1`, 0, 0), table(`${id}2`, 0, 0)],
});

const withPlan = area('plan', true);
const withoutPlan = area('flat', false);

test.describe('resolveTableSelectView', () => {
  test('free table numbers always use the keypad', () => {
    expect(resolveTableSelectView('free', 'map', [withPlan], 'plan')).toBe('number');
    expect(resolveTableSelectView('free', undefined, [withPlan], 'plan')).toBe('number');
  });

  test('the device setting wins', () => {
    expect(resolveTableSelectView('predefined', 'number', [withPlan], 'plan')).toBe('number');
    expect(resolveTableSelectView('predefined', 'list', [withPlan], 'plan')).toBe('list');
    expect(resolveTableSelectView('predefined', 'map', [withoutPlan, withPlan], null)).toBe('map');
  });

  test('map falls back to the list while no area has a floor plan', () => {
    expect(resolveTableSelectView('predefined', 'map', [withoutPlan], null)).toBe('list');
  });

  test('without a setting: map if the default area has a plan, else list', () => {
    expect(resolveTableSelectView('predefined', undefined, [withPlan], 'plan')).toBe('map');
    expect(resolveTableSelectView('predefined', null, [withPlan, withoutPlan], 'flat')).toBe('list');
    expect(resolveTableSelectView('predefined', undefined, [withPlan], null)).toBe('list');
    expect(resolveTableSelectView('predefined', 'grid', [withPlan], 'plan')).toBe('map');
  });
});

test('splitAreaDecor separates rectangles, polyline walls and zones', () => {
  const decor: TableAreaElement[] = [
    { id: 'r', type: 'wall', x: 0, y: 0, width: 100, height: 20, rotation: 0 },
    { id: 'w', type: 'wall', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    { id: 'z', type: 'zone', zoneType: 'blocked', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
    { id: 'b', type: 'bar', x: 0, y: 0, width: 100, height: 40, rotation: 0, label: 'Theke' },
  ];
  const parts = splitAreaDecor(decor);
  expect(parts.rects.map((d) => d.id)).toEqual(['r', 'b']);
  expect(parts.walls.map((d) => d.id)).toEqual(['w']);
  expect(parts.zones.map((d) => d.id)).toEqual(['z']);
  expect(splitAreaDecor(undefined)).toEqual({ rects: [], walls: [], zones: [] });
});
