import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { managerLocations, addManager } from './public-manager-proxy.mjs';

test('legacy public Manager installer cannot reopen anonymous access', () => {
  assert.throws(() => managerLocations('https://auth.example.test'), /template/);
  assert.throws(() => addManager('', 'https://auth.example.test'), /disabled/);
});

test('versioned proxy protects Manager and both customer and platform API routes', () => {
  const config = readFileSync(new URL('../deploy/public-https/nginx.conf.template', import.meta.url), 'utf8');
  for (const path of ['location = /manager/ {', 'location /manager/ {', 'location /shared/ {',
    'location = /api/master/info {', 'location = /api/master/configuration/manager {',
    'location ~ "^/api/[a-z][a-z0-9-]{2,30}/asset/query$" {',
    'location ~ "^/api/[a-z][a-z0-9-]{2,30}/console/register$" {',
    'location = /websocket/events {']) {
    const block = config.split(path)[1]?.split('\n        }')[0];
    assert.ok(block, path);
    assert.match(block, /auth_request \/_manager_authorize;/, path);
  }
  assert.match(config, /location = \/manager \{ return 404; \}/);
  const internalCheck = config.split('location = /_manager_authorize {')[1]?.split('\n        }')[0];
  assert.match(internalCheck, /proxy_set_header Origin "";/);
  assert.match(config, /location ~ "\^\/api\/\[a-z\]\[a-z0-9-\]\{2,30\}\/console\/register\$" \{[\s\S]*?limit_except POST \{ deny all; \}/);
  assert.doesNotMatch(config, /location \/api\/master\/ \{/);
});
