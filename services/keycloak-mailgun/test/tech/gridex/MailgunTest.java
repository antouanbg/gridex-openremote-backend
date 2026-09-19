package tech.gridex;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
public class MailgunTest {
 public static void main(String[] args) throws Exception {
  var provider=new MailgunSender(); provider.validate(Map.of());
  String body=MailgunSender.form("owner@example.com","Confirm email","https://example.com/?token=a&b=c","<a href=\"https://example.com/?a=b&c=d\">Verify</a>");
  Map<String,String> fields=new HashMap<>();
  for(String part:body.split("&")) { var p=part.split("=",2); fields.put(URLDecoder.decode(p[0],StandardCharsets.UTF_8),URLDecoder.decode(p[1],StandardCharsets.UTF_8)); }
  if(!fields.get("bcc").equals("support@example.com") || !fields.get("o:tracking").equals("no") || !fields.get("text").endsWith("a&b=c") || !fields.get("html").contains("&c=d")) throw new AssertionError("Email form mismatch");
  try { provider.send(Map.of(),"bad\r\nBcc:other@example.com","subject","body",null); throw new AssertionError("Injection accepted"); }
  catch(org.keycloak.email.EmailException expected) {}
  System.out.println("Mailgun provider form, BCC, action-link encoding and validation passed");
 }
}
