import test from 'node:test';
import assert from 'node:assert/strict';
import {PostgresRepository} from '../src/repository.mjs';

test('membership display name remains scoped by subject, active organisation and realm',async()=>{
  const repository=Object.create(PostgresRepository.prototype);
  repository.pool={query:async(sql,args)=>{
    assert.deepEqual(args,['member','own-realm']);
    assert.match(sql,/o\.name AS "organisationName"/);
    assert.match(sql,/o\.status='active'/);
    assert.match(sql,/m\.subject=\$1/);
    assert.match(sql,/o\.openremote_realm=\$2/);
    return {rows:[{organisationId:'own',organisationName:'Own organisation',role:'administrator',allSites:true}]};
  }};
  assert.deepEqual(await repository.getMemberships('member','own-realm'),[
    {organisationId:'own',organisationName:'Own organisation',role:'administrator',allSites:true}
  ]);
});
