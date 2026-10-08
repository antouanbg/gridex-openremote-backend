import java.nio.file.*;
import java.util.zip.*;
import java.nio.charset.StandardCharsets;

/** Pinned OpenRemote theme compatibility fix; never changes authentication. */
public class PatchLoginTheme {
    static String patch(String source) {
        String marker = "                    <#if usernameEditDisabled??>";
        if (source.indexOf(marker) < 0 || source.indexOf(marker) != source.lastIndexOf(marker))
            throw new IllegalStateException("Upstream login template changed; review required");
        return source.replace(marker, """
                    <#if usernameHidden??>
                        <#-- Keycloak has already bound the reauthentication identity.
                             Show that identity, NOT the untrusted login_hint. -->
                        <input id="username" name="username" type="text"
                               value="${auth.attemptedUsername}" readonly autocomplete="username"/>
                        <a id="reset-login" href="${url.loginRestartFlowUrl}">${msg("restartLoginTooltip")}</a>
                    <#elseif usernameEditDisabled??>""")
            .replace("<label for=\"username\">", "<label for=\"username\" class=\"active\">")
            .replace("realm.rememberMe && !usernameEditDisabled??", "realm.rememberMe && !usernameEditDisabled?? && !usernameHidden??");
    }
    public static void main(String[] args) throws Exception {
        Path source = Path.of(args[0]);
        Path output = Path.of(args[1]);
        boolean found = false;
        try (ZipInputStream in = new ZipInputStream(Files.newInputStream(source));
             ZipOutputStream out = new ZipOutputStream(Files.newOutputStream(output))) {
            for (ZipEntry entry; (entry = in.getNextEntry()) != null;) {
                byte[] bytes = in.readAllBytes();
                if (entry.getName().equals("theme/openremote/login/login.ftl")) {
                    bytes = patch(new String(bytes, StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8);
                    found = true;
                }
                out.putNextEntry(new ZipEntry(entry.getName()));
                out.write(bytes);
                out.closeEntry();
            }
        }
        if (!found) throw new IllegalStateException("Missing pinned login template");
    }
}
