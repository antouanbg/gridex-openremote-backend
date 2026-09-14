// Execute from the API directory/container against a migrated disposable database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { InvitationService } from './src/invitations.mjs';
const pool = new pg.Pool();
const org = randomUUID(), site = randomUUID(), other = randomUUID(), admin = randomUUID();
let serial = 0;
const subjects = new Map();
const identity = { async prepareUser(email) {
  if (!subjects.has(email)) subjects.set(email, `synthetic-${++serial}`);
  return { subject: subjects.get(email), created: true };
}, async sendActions() {} }; // Explicit fake delivery: NOT a real email test.
const service = new InvitationService(pool, identity);
const owner = { subject: admin };
const make = email => service.create(owner, org, { email, role: 'viewer', siteIds: [site] });
const user = email => ({ subject: subjects.get(email), email, emailVerified: true });
try {
  await pool.query(`INSERT INTO organisations(id,name,openremote_realm) VALUES($1,'Synthetic invitation test',$2)`, [org, org]);
  await pool.query(`INSERT INTO sites(id,organisation_id,name,timezone,openremote_realm)
    VALUES($1,$2,'Allowed','UTC','test'),($3,$2,'Not granted','UTC','test')`, [site, org, other]);
  await pool.query(`INSERT INTO organisation_memberships(organisation_id,subject,role,all_sites) VALUES($1,$2,'administrator',true)`, [org, admin]);
  await assert.rejects(service.create({ subject: 'intruder' }, org, { email: 'x@example.invalid', role: 'viewer', siteIds: [site] }), { status: 403 });
  const email = 'invited@example.invalid';
  const invite = await make(email);
  assert.equal((await pool.query('SELECT count(*)::int n FROM organisation_memberships WHERE subject=$1', [subjects.get(email)])).rows[0].n, 0);
  await assert.rejects(service.accept({ ...user(email), emailVerified: false }, invite.id), { status: 403 });
  await assert.rejects(service.accept({ ...user(email), email: 'wrong@example.invalid' }, invite.id), { status: 404 });
  const concurrent = await Promise.allSettled([service.accept(user(email), invite.id), service.accept(user(email), invite.id)]);
  assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1);
  const scope = (await pool.query('SELECT role,all_sites FROM organisation_memberships WHERE subject=$1', [subjects.get(email)])).rows[0];
  assert.deepEqual(scope, { role: 'viewer', all_sites: false });
  assert.deepEqual((await pool.query('SELECT site_id FROM membership_site_grants WHERE subject=$1', [subjects.get(email)])).rows.map(r => r.site_id), [site]);
  const revoked = await make('revoked@example.invalid');
  await service.revoke(owner, org, revoked.id);
  await assert.rejects(service.accept(user('revoked@example.invalid'), revoked.id), { status: 404 });
  const expired = await make('expired@example.invalid');
  await pool.query(`UPDATE organisation_invitations SET expires_at=now()-interval '1 second' WHERE id=$1`, [expired.id]);
  await assert.rejects(service.accept(user('expired@example.invalid'), expired.id), { status: 404 });
  identity.sendActions = async () => { throw new Error('Synthetic SMTP failure'); };
  await assert.rejects(make('failure@example.invalid'), { code: 'invitation_delivery_failed' });
  assert.equal((await pool.query('SELECT count(*)::int n FROM organisation_memberships WHERE subject=$1', [subjects.get('failure@example.invalid')])).rows[0].n, 0);
  console.log('PASS PostgreSQL: unauthorized inviter, verified email, matching identity, concurrent single acceptance, exact grants, revocation, expiry, failed delivery grants nothing. Delivery was fake.');
} finally {
  await pool.query(`DELETE FROM audit_events WHERE resource_type='invitation' AND resource_id IN
    (SELECT id::text FROM organisation_invitations WHERE organisation_id=$1)`, [org]);
  await pool.query('DELETE FROM organisation_invitations WHERE organisation_id=$1', [org]);
  await pool.query('DELETE FROM organisation_memberships WHERE organisation_id=$1', [org]);
  await pool.query('DELETE FROM sites WHERE organisation_id=$1', [org]);
  await pool.query('DELETE FROM organisations WHERE id=$1', [org]);
  await pool.end();
}
