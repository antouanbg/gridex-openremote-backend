/* GrideX extension to OpenRemote. SPDX-License-Identifier: AGPL-3.0-or-later */
package org.openremote.manager.security;

import java.util.function.Function;
import jakarta.security.enterprise.AuthenticationException;
import org.openremote.container.security.AuthContext;
import org.openremote.container.security.TokenPrincipal;
import org.openremote.container.security.TokenVerifier;
import org.openremote.model.security.Realm;

/** Fail closed for disabled realms and tokens minted before the latest suspension. */
public final class OrganisationAccessGuard implements TokenVerifier {
  private final TokenVerifier delegate;
  private final Function<String, Realm> realms;
  public OrganisationAccessGuard(TokenVerifier delegate, Function<String, Realm> realms) {
    this.delegate = delegate;
    this.realms = realms;
  }
  public static boolean allows(Realm realm, AuthContext identity) {
    if (realm == null || !realm.isActive(System.currentTimeMillis())) return false;
    Double cutoff = realm.getNotBefore();
    if (cutoff != null && cutoff > 0 && identity != null) {
      if (!(identity instanceof TokenPrincipal principal)
          || principal.getClaims().getIssueTime() == null
          || principal.getClaims().getIssueTime().getTime() / 1000.0 <= cutoff) return false;
    }
    return true;
  }
  @Override
  public TokenPrincipal verify(String realm, String token) throws AuthenticationException {
    TokenPrincipal principal = delegate.verify(realm, token);
    if (!allows(realms.apply(realm), principal)
        || !allows(realms.apply(principal.getAuthenticatedRealmName()), principal))
      throw new AuthenticationException("Organisation access suspended or token revoked");
    return principal;
  }
}
