import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { addCustomerRealms } from './public-customer-realms-proxy.mjs';

test('legacy customer installer cannot restore hard-coded realm routing', () => {
  assert.throws(() => addCustomerRealms(''), /versioned proxy template/);
});

test('proxy forwards slug-shaped future realms but never master/admin', () => {
  const template = fs.readFileSync(new URL('../deploy/public-https/nginx.conf.template', import.meta.url), 'utf8');
  assert.ok(template.includes('location ~ "^/auth/realms/[a-z][a-z0-9-]{2,30}/" {'));
  assert.match(template, /location \^~ \/auth\/realms\/master\/ \{ return 404; \}/);
  assert.match(template, /location \^~ \/api\/master\/ \{ return 404; \}/);
  assert.doesNotMatch(template, /location \/auth\/realms\/novacom\//);
  assert.doesNotMatch(template, /location \/auth\/admin\//);
});
