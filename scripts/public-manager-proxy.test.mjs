import {test} from 'node:test';
import assert from 'node:assert/strict';
import {managerLocations,addManager} from './public-manager-proxy.mjs';
test('reject malformed origins',()=>{for(const x of ['http://auth.example.test','https://auth.example.test/path',"https://auth.example.test/';"])assert.throws(()=>managerLocations(x));});
test('bootstrap is synthetic, scoped and without upstream master',()=>{
 const s=managerLocations('https://auth.example.test');
 assert.match(s,/"realm":"gridex"/); assert.match(s,/"consoleAutoEnable":false/);
 for(const p of ['info','configuration/manager']) {
  const block=s.split('location = /api/master/'+p+' {')[1].split('\n        }')[0];
  assert.match(block,/return 200/); assert.doesNotMatch(block,/proxy_pass/);
 }
 assert.doesNotMatch(s,/location \/api\/gridex\/ \{/);
 assert.match(s,/http_origin/); assert.match(s,/proxy_set_header Forwarded ''/);
});
test('preserve unrelated proxy and refuse duplicate or mismatched layout',()=>{
 const base='server_name auth.example.test;\n        location /auth/realms/gridex/ {\n proxy_pass http://$auth_backend;\n}';
 const output=addManager(base,'https://auth.example.test');
 assert.ok(output.endsWith('        location /auth/realms/gridex/ {\n proxy_pass http://$auth_backend;\n}'));
 assert.throws(()=>addManager(output,'https://auth.example.test'));
 assert.throws(()=>addManager(base,'https://other.example.test'));
});
