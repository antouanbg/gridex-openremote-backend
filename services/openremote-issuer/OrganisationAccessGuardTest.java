/* SPDX-License-Identifier: AGPL-3.0-or-later */
package org.openremote.manager.security;
import com.nimbusds.jwt.JWTClaimsSet;
import org.openremote.container.security.TokenPrincipal;
import org.openremote.model.security.Realm;
import jakarta.security.enterprise.AuthenticationException;
import java.util.Date;
public class OrganisationAccessGuardTest {
  static void check(boolean value) { if(!value) throw new AssertionError(); }
  public static void main(String[] args) throws Exception {
    double now=Math.floor(System.currentTimeMillis()/1000.0);
    Realm tenant=new Realm().setName("customer").setEnabled(true);
    Realm pilot=new Realm().setName("gridex").setEnabled(true);
    TokenPrincipal old=new TokenPrincipal(new JWTClaimsSet.Builder().subject("fixture").issuer("https://auth.invalid/realms/customer").issueTime(new Date((long)(now-30)*1000)).build());
    check(OrganisationAccessGuard.allows(tenant,old));
    tenant.setEnabled(false);check(!OrganisationAccessGuard.allows(tenant,old));
    check(!OrganisationAccessGuard.allows(tenant,null));check(OrganisationAccessGuard.allows(pilot,null));
    tenant.setNotBefore(now-1).setEnabled(true);check(!OrganisationAccessGuard.allows(tenant,old));
    TokenPrincipal fresh=new TokenPrincipal(new JWTClaimsSet.Builder().subject("fixture").issuer("https://auth.invalid/realms/customer").issueTime(new Date((long)now*1000)).build());
    check(OrganisationAccessGuard.allows(tenant,fresh));
    OrganisationAccessGuard guard=new OrganisationAccessGuard((realm,token)->old,realm->realm.equals("gridex")?pilot:tenant);
    try { guard.verify("customer","fixture");throw new AssertionError(); }catch(AuthenticationException expected){}
    try { guard.verify("gridex","fixture");throw new AssertionError(); }catch(AuthenticationException expected){}
    System.out.println("Organisation access guard: disabled, anonymous, old/fresh token and realm isolation passed");
  }
}
