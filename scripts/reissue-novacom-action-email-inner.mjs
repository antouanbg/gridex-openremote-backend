// Run once inside the existing API container through stdin, never print secrets.
// Еднократно в наличния API контейнер през stdin; без извеждане на тайни.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadConfig } from '/app/src/config.mjs';
import { OpenRemoteRealmSetup } from '/app/src/organisation-onboarding.mjs';

const mode = process.env.GRIDEX_ACTION_MODE;
if (!['inspect', 'send'].includes(mode)) throw Error('Set GRIDEX_ACTION_MODE=inspect or send');
const config = loadConfig();
if (!config.realmSetupEnabled || !config.database || config.portalOrigin !== 'https://gridex.tech')
  throw Error('Expected existing private onboarding configuration');
const pool = new pg.Pool({ ...config.database, max: 1 });
const setup = new OpenRemoteRealmSetup(config);
const realm = 'novacom';
const action = 'organisation_invitation.action_email_resend_attempted';
let claimed = false;

try {
  const { rows } = await pool.query(`SELECT id,organisation_id,realm,email,subject,created_by,state,
      expires_at>now() AS unexpired FROM organisation_onboarding_invitations
      WHERE realm=$1`, [realm]);
  if (rows.length !== 1 || rows[0].state !== 'sent' || !rows[0].unexpired || !rows[0].subject)
    throw Error('Expected exactly one valid pending invitation');
  const invitation = rows[0];
  const organisation = await pool.query('SELECT 1 FROM organisations WHERE id=$1 OR openremote_realm=$2',
    [invitation.organisation_id, realm]);
  if (organisation.rowCount) throw Error('Organisation has already been activated');
  const prior = await pool.query(`SELECT 1 FROM audit_events WHERE resource_type='organisation_onboarding'
    AND resource_id=$1 AND action=$2 LIMIT 1`, [invitation.id, action]);
  if (prior.rowCount) throw Error('A resend has already been attempted; inspect provider before another attempt');
  await setup.verifyRealm(realm);
  const user = await setup.kc(`/${realm}/users/${encodeURIComponent(invitation.subject)}`, await setup.token());
  if (user?.id !== invitation.subject || !user.enabled || user.emailVerified
      || user.email?.toLowerCase() !== invitation.email.toLowerCase())
    throw Error('Pending Keycloak identity does not match the invitation');

  if (mode === 'inspect') {
    console.log('NOVACOM_RESEND_READY pending=1 realm_verified=1 identity_matches=1 prior_attempt=0');
    process.exitCode = 0;
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query(`SELECT state,subject,email,expires_at>now() AS unexpired
        FROM organisation_onboarding_invitations WHERE id=$1 FOR UPDATE`, [invitation.id]);
      const item = locked.rows[0];
      const duplicate = await client.query(`SELECT 1 FROM audit_events
        WHERE resource_type='organisation_onboarding' AND resource_id=$1 AND action=$2 LIMIT 1`,
      [invitation.id, action]);
      if (!item || item.state !== 'sent' || !item.unexpired || item.subject !== invitation.subject
          || item.email !== invitation.email || duplicate.rowCount)
        throw Error('Pending invitation changed or resend was already attempted');
      await client.query(`INSERT INTO audit_events(subject,action,resource_type,resource_id,result,request_id)
        VALUES($1,$2,'organisation_onboarding',$3,'pending',$4)`,
      [invitation.created_by, action, invitation.id, randomUUID()]);
      await client.query(`UPDATE organisation_onboarding_invitations
        SET expires_at=now()+interval '24 hours' WHERE id=$1`, [invitation.id]);
      await client.query('COMMIT');
      claimed = true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }

    // A timeout can mean Mailgun accepted the message. Never retry automatically.
    await setup.sendActions(realm, invitation.subject);
    await pool.query(`UPDATE organisation_onboarding_invitations
      SET delivered_at=now(),last_error_code=NULL WHERE id=$1 AND state='sent'`, [invitation.id]);
    await pool.query(`INSERT INTO audit_events(subject,action,resource_type,resource_id,result,request_id)
      VALUES($1,'organisation_invitation.action_email_reissued','organisation_onboarding',$2,'success',$3)`,
    [invitation.created_by, invitation.id, randomUUID()]);
    console.log('NOVACOM_ACTION_EMAIL_REISSUED once=1 existing_invitation=1');
  }
} catch {
  if (claimed) console.error('RESEND_OUTCOME_UNCONFIRMED; inspect Mailgun and audit, do not retry blindly');
  else console.error('RESEND_NOT_STARTED; pending invitation or identity check failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
