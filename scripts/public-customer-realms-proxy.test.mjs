import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCustomerRealms, customerRealmLocation, oldRealmLocation } from './public-customer-realms-proxy.mjs';

const base = `server_name auth.gridex.tech;
        # BEGIN GRIDEX PUBLIC MANAGER
        # END GRIDEX PUBLIC MANAGER
${oldRealmLocation}
        location /auth/resources/ {
            proxy_pass http://$auth_backend;
        }
        location / { return 404; }
        # BEGIN GRIDEX PUBLIC DOCS`;

test('add customer realm route without altering Manager, resources or Docs', () => {
  const updated = addCustomerRealms(base);
  assert.ok(updated.includes(customerRealmLocation));
  assert.equal(updated.replace(`\n${customerRealmLocation}`, ''), base);
  assert.match(updated, /location \/auth\/realms\/novacom\//);
  assert.doesNotMatch(updated, /location ~ \^\/auth\/realms/);
  assert.throws(() => addCustomerRealms(updated));
});

test('refuse an unexpected or duplicate public auth layout', () => {
  assert.throws(() => addCustomerRealms(base.replace(oldRealmLocation, '')));
  assert.throws(() => addCustomerRealms(base.replace('auth.gridex.tech', 'other.example')));
  assert.throws(() => addCustomerRealms(base.replace('location /auth/resources/ {', 'location /other/ {')));
});
