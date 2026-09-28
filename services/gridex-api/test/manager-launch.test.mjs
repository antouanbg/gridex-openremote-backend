import test from 'node:test';
import assert from 'node:assert/strict';
import { ManagerLaunch } from '../src/manager-launch.mjs';

const principal = { subject: '11111111-1111-4111-8111-111111111111', realm: 'novacom',
  emailVerified: true, permissions: [] };

function fixture(state = { active: true, admin: true }) {
  const records = new Map();
  const pool = { async query(sql, values) {
    if (sql.startsWith('DELETE FROM manager_launch_sessions')) {
      if (!sql.includes('WHERE')) records.clear();
      else if (sql.includes('subject=$1')) {
        for (const [key, row] of records) if (row.subject === values[0] && row.realm === values[1]) records.delete(key);
      }
      return { rows: [] };
    }
    if (sql.includes('FROM organisation_memberships m') && !sql.includes('manager_launch_sessions'))
      return { rows: state.active && state.admin ? [{ '?column?': 1 }] : [] };
    if (sql.startsWith('INSERT INTO manager_launch_sessions')) {
      records.set(values[0], { subject: values[1], realm: values[2], consumed: false });
      return { rows: [] };
    }
    if (sql.startsWith('UPDATE manager_launch_sessions')) {
      const row = records.get(values[0]);
      if (!row || row.consumed) return { rows: [] };
      row.consumed = true; row.sessionHash = values[1];
      return { rows: [{ realm: row.realm }] };
    }
    if (sql.includes('SELECT s.realm FROM manager_launch_sessions')) {
      const row = [...records.values()].find(item => item.sessionHash === values[0]);
      return { rows: row && state.active && state.admin ? [{ realm: row.realm }] : [] };
    }
    throw Error(`Unexpected SQL: ${sql}`);
  } };
  return new ManagerLaunch(pool, 'https://auth.example.test');
}

test('issue only for a verified current organisation administrator', async () => {
  await assert.rejects(fixture({ admin: false }).issue(principal), { status: 403 });
  await assert.rejects(fixture().issue({ ...principal, emailVerified: false }), { status: 403 });
  const issued = await fixture().issue(principal);
  assert.match(issued.url, /^https:\/\/auth\.example\.test\/manager\/launch\?ticket=[A-Za-z0-9_-]{43}$/);
  assert.equal(issued.expiresInSeconds, 60);
});

test('one-time ticket becomes an HttpOnly host-only session and rejects another realm', async () => {
  const access = fixture();
  const issued = await access.issue(principal);
  const ticket = new URL(issued.url).searchParams.get('ticket');
  const { cookie, realm } = await access.consume(ticket);
  assert.equal(realm, 'novacom');
  assert.match(cookie, /^__Host-gridex-manager=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Strict;/);
  assert.ok(!cookie.includes('Domain='));
  await assert.rejects(access.consume(ticket), { status: 401 });
  assert.equal(await access.check(cookie, '/manager/?realm=novacom'), 'novacom');
  await assert.rejects(access.check(cookie, '/manager/?realm=gridex'), { status: 403 });
  await assert.rejects(access.check(cookie, '/api/gridex/asset/query'), { status: 403 });
  await assert.rejects(access.check(cookie, '/api/master/asset/query'), { status: 403 });
  assert.equal(await access.check(cookie, '/api/novacom/asset/query'), 'novacom');
  await assert.rejects(access.check('', '/manager/?realm=novacom'), { status: 401 });
});

test('newly provisioned organisation realms use the same exact-realm gate', async () => {
  const access = fixture();
  const issued = await access.issue({ ...principal, realm: 'solar-west' });
  const { cookie } = await access.consume(new URL(issued.url).searchParams.get('ticket'));
  assert.equal(await access.check(cookie, '/manager/?realm=solar-west'), 'solar-west');
  assert.equal(await access.check(cookie, '/api/solar-west/asset/query'), 'solar-west');
  await assert.rejects(access.check(cookie, '/api/novacom/asset/query'), { status: 403 });
  await assert.rejects(access.check(cookie, '/api/master/asset/query'), { status: 403 });
});

test('suspended or revoked administrator loses even an issued Manager session', async () => {
  const state = { active: true, admin: true };
  const access = fixture(state);
  const issued = await access.issue(principal);
  const { cookie } = await access.consume(new URL(issued.url).searchParams.get('ticket'));
  state.active = false;
  await assert.rejects(access.check(cookie, '/manager/?realm=novacom'), { status: 403 });
});

test('portal sign-out revokes previously issued Manager sessions', async () => {
  const access = fixture();
  const issued = await access.issue(principal);
  const { cookie } = await access.consume(new URL(issued.url).searchParams.get('ticket'));
  await access.revoke(principal.subject, principal.realm);
  await assert.rejects(access.check(cookie, '/manager/?realm=novacom'), { status: 403 });
});
