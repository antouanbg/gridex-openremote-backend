import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/** Fail-closed source patch against the pinned OpenRemote 1.30.0 verifier. */
public final class PatchTokenIssuer {
  public static void main(String[] args) throws Exception {
    Path file = Path.of("TokenVerifierImpl.java");
    String source = Files.readString(file, StandardCharsets.UTF_8);
    String original = "    final String expectedIssuer = keycloakPublicUrl + \"/realms/\" + realm;";
    if (source.indexOf(original) < 0 || source.indexOf(original) != source.lastIndexOf(original)) {
      throw new IllegalStateException("Pinned issuer source changed; review before building");
    }
    String replacement = """
        // The public base is operator-controlled, never read from token claims.
        // Keep the local master issuer separate from every public customer realm.
        final String publicIssuerBase = System.getenv("OR_KEYCLOAK_PUBLIC_ISSUER_BASE");
        if (!Constants.MASTER_REALM.equals(realm)
            && (publicIssuerBase == null
                || !publicIssuerBase.matches("https?://[A-Za-z0-9.-]+(?::[0-9]{1,5})?/auth")
                || !realm.matches("[a-z][a-z0-9-]{0,62}"))) {
          throw new IllegalStateException("Public issuer base or realm is not configured safely");
        }
        final String expectedIssuer = Constants.MASTER_REALM.equals(realm)
            ? System.getenv().getOrDefault("OR_KEYCLOAK_ISSUER_MASTER", keycloakPublicUrl + "/realms/master")
            : publicIssuerBase + "/realms/" + realm;
        """;
    Files.writeString(file, source.replace(original, replacement.stripTrailing()), StandardCharsets.UTF_8);
  }
}
