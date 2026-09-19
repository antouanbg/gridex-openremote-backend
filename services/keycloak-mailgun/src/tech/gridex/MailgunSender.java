package tech.gridex;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import org.keycloak.email.*;

/** Keycloak owns action tokens/templates; this provider only transports rendered email. */
public final class MailgunSender implements EmailSenderProvider {
    private static final HttpClient CLIENT = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build();
    private static String setting(String name) { return System.getenv().getOrDefault("GRIDEX_MAILGUN_" + name, ""); }
    private static boolean address(String v) { return v.matches("[^\\s@,;<>]+@[^\\s@,;<>]+\\.[^\\s@,;<>]+"); }
    public void validate(Map<String,String> ignored) throws EmailException {
        if (!Set.of("EU", "US").contains(setting("REGION")) || !setting("DOMAIN").matches("[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}")
            || setting("API_KEY").isBlank() || setting("FROM").isBlank() || setting("FROM").matches("(?s).*[\\r\\n].*"))
            throw new EmailException("Mailgun configuration incomplete");
        for (String bcc : setting("BCC").split(",")) if (!bcc.isBlank() && !address(bcc.trim())) throw new EmailException("Invalid Mailgun BCC");
    }
    private static String encode(String v) { return URLEncoder.encode(v, StandardCharsets.UTF_8); }
    public void send(Map<String,String> ignored, String to, String subject, String text, String html) throws EmailException {
        validate(ignored);
        if (to == null || !address(to) || subject == null || subject.matches("(?s).*[\\r\\n].*")) throw new EmailException("Invalid email message");
        String body = form(to,subject,text,html);
        String base = setting("REGION").equals("EU") ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
        HttpRequest req = HttpRequest.newBuilder(URI.create(base+"/v3/"+setting("DOMAIN")+"/messages"))
            .timeout(Duration.ofSeconds(15)).header("Content-Type", "application/x-www-form-urlencoded")
            .header("Authorization", "Basic " + Base64.getEncoder().encodeToString(("api:"+setting("API_KEY")).getBytes(StandardCharsets.UTF_8)))
            .POST(HttpRequest.BodyPublishers.ofString(body)).build();
        try {
            int status = CLIENT.send(req, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status != 200) throw new EmailException("Mailgun rejected email: HTTP " + status);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); throw new EmailException("Email delivery status unknown; inspect provider before retry");
        } catch (java.io.IOException e) { throw new EmailException("Email delivery status unknown; inspect provider before retry"); }
    }
    static String form(String to, String subject, String text, String html) {
        Map<String,String> fields = new LinkedHashMap<>();
        fields.put("from", setting("FROM")); fields.put("to", to); fields.put("subject", subject);
        if (text != null) fields.put("text", text);
        if (html != null) fields.put("html", html);
        if (!setting("BCC").isBlank()) fields.put("bcc", setting("BCC"));
        fields.put("o:tracking", "no"); fields.put("o:tracking-clicks", "no"); fields.put("o:tracking-opens", "no");
        return fields.entrySet().stream().map(e -> encode(e.getKey()) + "=" + encode(e.getValue())).reduce((a,b) -> a+"&"+b).orElseThrow();
    }
    public void close() {}
}
