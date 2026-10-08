import freemarker.template.*;
import freemarker.core.HTMLOutputFormat;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.ZipFile;

public class LoginThemeTest {
    public static void main(String[] args) throws Exception {
        String source;
        try (ZipFile zip = new ZipFile(args[0])) {
            source = new String(zip.getInputStream(zip.getEntry("theme/openremote/login/login.ftl")).readAllBytes(), StandardCharsets.UTF_8);
        }
        String patched = PatchLoginTheme.patch(source);
        String fragment = patched.substring(patched.indexOf("<#if usernameHidden??>"), patched.indexOf("<label for=\"username\""));
        Configuration cfg = new Configuration(Configuration.VERSION_2_3_32);
        cfg.setOutputFormat(HTMLOutputFormat.INSTANCE);
        cfg.setTemplateExceptionHandler(TemplateExceptionHandler.RETHROW_HANDLER);
        Template template = new Template("login", new StringReader(fragment), cfg);
        Map<String,Object> data = new HashMap<>();
        data.put("login", Map.of("username", "hint@example.invalid"));
        data.put("auth", Map.of("attemptedUsername", "bound@example.invalid"));
        data.put("url", Map.of("loginRestartFlowUrl", "/restart"));
        data.put("messagesPerField", Map.of("existsError", (TemplateMethodModelEx) values -> false));
        data.put("msg", (TemplateMethodModelEx) values -> "Restart login");
        StringWriter fresh = new StringWriter(); template.process(data, fresh);
        require(fresh.toString().contains("value=\"hint@example.invalid\""), "Fresh hint lost");
        require(!fresh.toString().contains("readonly"), "Fresh identity locked");
        data.put("usernameHidden", true);
        StringWriter again = new StringWriter(); template.process(data, again);
        require(again.toString().contains("value=\"bound@example.invalid\" readonly"), "Bound identity missing");
        require(!again.toString().contains("hint@example.invalid"), "Hint impersonates bound identity");
        require(again.toString().contains("href=\"/restart\""), "Restart missing");
        data.put("login", Map.of());
        String originalFragment = source.substring(source.indexOf("<#if usernameEditDisabled??>"), source.indexOf("<label for=\"username\""));
        StringWriter original = new StringWriter();
        new Template("original", new StringReader(originalFragment), cfg).process(data, original);
        require(original.toString().contains("value=\"\""), "Original defect not reproduced");
        StringWriter repaired = new StringWriter(); template.process(data, repaired);
        require(repaired.toString().contains("value=\"bound@example.invalid\" readonly"), "Empty login model regression");
        data.put("auth", Map.of("attemptedUsername", "<script>"));
        StringWriter escaped = new StringWriter(); template.process(data, escaped);
        require(!escaped.toString().contains("<script>"), "Identity not escaped");
        require(patched.contains("name=\"password\""), "Password removed");
        System.out.println("LOGIN_THEME_OK fresh hint, bound identity, mismatched hint, restart, escaping, password preserved");
    }
    static void require(boolean value, String message) { if (!value) throw new AssertionError(message); }
}
