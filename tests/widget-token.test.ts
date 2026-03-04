import assert from 'node:assert/strict';
import test from 'node:test';
import { signWidgetToken, verifyWidgetToken } from '../lib/widgetToken';

test('widget token signs and verifies', () => {
  process.env.WIDGET_SIGNING_SECRET = 'test-secret';
  process.env.WIDGET_TOKEN_REQUIRED = 'false';

  const token = signWidgetToken({ businessId: 'demo_barber', host: 'example.com', ttlSeconds: 60 });
  assert.ok(token);

  const ok = verifyWidgetToken(token, { businessId: 'demo_barber', host: 'example.com' });
  assert.equal(ok.ok, true);
});

test('widget token rejects business mismatch', () => {
  process.env.WIDGET_SIGNING_SECRET = 'test-secret';
  process.env.WIDGET_TOKEN_REQUIRED = 'false';

  const token = signWidgetToken({ businessId: 'demo_barber', host: 'example.com', ttlSeconds: 60 });
  const bad = verifyWidgetToken(token, { businessId: 'other_biz', host: 'example.com' });
  assert.equal(bad.ok, false);
});

test('widget token required without secret fails', () => {
  delete process.env.WIDGET_SIGNING_SECRET;
  process.env.WIDGET_TOKEN_REQUIRED = 'true';

  const result = verifyWidgetToken(null, { businessId: 'demo_barber', host: 'example.com' });
  assert.equal(result.ok, false);
});
