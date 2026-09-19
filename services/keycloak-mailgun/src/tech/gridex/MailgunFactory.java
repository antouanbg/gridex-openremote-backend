package tech.gridex;
import org.keycloak.Config;
import org.keycloak.email.*;
import org.keycloak.models.*;
public final class MailgunFactory implements EmailSenderProviderFactory {
    public String getId() { return "mailgun"; }
    public EmailSenderProvider create(KeycloakSession session) { return new MailgunSender(); }
    public void init(Config.Scope config) {}
    public void postInit(KeycloakSessionFactory factory) {}
    public void close() {}
}
