/* SPDX-License-Identifier: AGPL-3.0-or-later */
import java.nio.file.*;
public class PatchOrganisationAccess {
  static void patch(String file, String from, String to) throws Exception {
    Path path=Path.of(file);String text=Files.readString(path);
    if(text.indexOf(from)<0 || text.indexOf(from)!=text.lastIndexOf(from)) throw new IllegalStateException("Patch anchor changed: "+file);
    Files.writeString(path,text.replace(from,to));
  }
  public static void main(String[] args) throws Exception {
    patch("ManagerKeycloakIdentityProvider.java", "    super.init(container);",
      "    super.init(container);\n    tokenVerifier = new OrganisationAccessGuard(tokenVerifier, this::getRealm);");
    patch("RealmResourceImpl.java", "      identityService.getIdentityProvider().updateRealm(realm);",
      "      identityService.getIdentityProvider().updateRealm(realm);\n"+
      "      if (!Boolean.TRUE.equals(realm.getEnabled())) container.getService(org.openremote.manager.event.ClientEventService.class).closeRealmSessions(realmName);");
    patch("ClientEventService.java", "  public void closeWebsocketSession(String sessionKey) {",
      "  public void closeRealmSessions(String realm) {\n"+
      "    sessionChannels.forEach((key, channel) -> {\n"+
      "      if (realm.equals(channel.getAttribute(REALM_PARAM_NAME))) closeWebsocketChannel(key, channel);\n"+
      "    });\n  }\n\n"+
      "  protected boolean organisationSessionAllowed(WebSocketChannel channel) {\n"+
      "    if (channel == null) return false;\n"+
      "    String realm = (String) channel.getAttribute(REALM_PARAM_NAME);\n"+
      "    AuthContext identity = (AuthContext) channel.getAttribute(AUTH_CONTEXT);\n"+
      "    return org.openremote.manager.security.OrganisationAccessGuard.allows(identityService.getIdentityProvider().getRealm(realm), identity);\n"+
      "  }\n\n  public void closeWebsocketSession(String sessionKey) {");
    patch("ClientEventService.java", "    // Wrap subscription event in triggered wrapper for client to easily route it",
      "    if (!organisationSessionAllowed(sessionChannels.get(sessionKey))) { closeWebsocketSession(sessionKey); return; }\n"+
      "    // Wrap subscription event in triggered wrapper for client to easily route it");
    patch("ClientEventService.java", "    exchange.getIn().setHeader(AUTH_CONTEXT, authContext);\n    exchange.getIn().setHeader(REALM_PARAM_NAME, realm);",
      "    if (webSocketChannel != null && !organisationSessionAllowed(webSocketChannel)) {\n"+
      "      closeWebsocketSession(getSessionKey(exchange)); exchange.setRouteStop(true); return;\n    }\n"+
      "    exchange.getIn().setHeader(AUTH_CONTEXT, authContext);\n    exchange.getIn().setHeader(REALM_PARAM_NAME, realm);");
  }
}
