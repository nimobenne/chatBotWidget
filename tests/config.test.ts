import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStoreMode } from '../lib/config';

test('normalizeStoreMode handles plain values', () => {
  assert.equal(normalizeStoreMode('supabase'), 'supabase');
  assert.equal(normalizeStoreMode('json'), 'json');
  assert.equal(normalizeStoreMode('postgres'), 'postgres');
});

test('normalizeStoreMode handles quotes and whitespace', () => {
  assert.equal(normalizeStoreMode('  "supabase"  '), 'supabase');
  assert.equal(normalizeStoreMode(" 'POSTGRES' "), 'postgres');
});

test('normalizeStoreMode handles unsupported values', () => {
  assert.equal(normalizeStoreMode('foobar'), 'unsupported');
});
