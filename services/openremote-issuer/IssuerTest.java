package org.openremote.container.security;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Executable regression test: actual signed JWTs and local JWKS, no live secrets. */
public final class IssuerTest {
  static String token(RSAKey key, String issuer, String audience, long expiry) throws Exception {
    JWTClaimsSet claims = new JWTClaimsSet.Builder().issuer(issuer).subject("probe")
      .audience(audience).expirationTime(new Date(expiry)).issueTime(new Date())
      .claim("preferred_username", "probe").claim("azp", "probe").build();
    SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("probe").build(), claims);
    jwt.sign(new RSASSASigner(key));
    return jwt.serialize();
  }
  static void rejected(TokenVerifierImpl verifier, String realm, String jwt) throws Exception {
    boolean failed = false;
    try { verifier.getJwtProcessor(realm).process(jwt, null); }
    catch (Exception expected) { failed = true; }
    if (!failed) throw new AssertionError("Invalid JWT accepted for " + realm);
  }
  public static void main(String[] args) throws Exception {
    RSAKey key = new RSAKeyGenerator(2048).keyID("probe").generate();
    RSAKey otherKey = new RSAKeyGenerator(2048).keyID("probe").generate();
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    byte[] jwks = new JWKSet(key.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
    server.createContext("/", exchange -> {
      exchange.getResponseHeaders().set("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, jwks.length);
      try (var output = exchange.getResponseBody()) { output.write(jwks); }
    });
    server.start();
    try {
      String local = "https://localhost:8443/auth";
      String publicIssuer = "https://auth.example.test/auth/realms/gridex";
      TokenVerifierImpl verifier = new TokenVerifierImpl("http://127.0.0.1:" + server.getAddress().getPort(), local, false);
      long valid = System.currentTimeMillis() + 300000;
      verifier.getJwtProcessor("gridex").process(token(key, publicIssuer, "openremote", valid), null);
      verifier.getJwtProcessor("master").process(token(key, local + "/realms/master", "openremote", valid), null);
      rejected(verifier, "gridex", token(key, local + "/realms/gridex", "openremote", valid));
      rejected(verifier, "master", token(key, publicIssuer, "openremote", valid));
      rejected(verifier, "other", token(key, publicIssuer, "openremote", valid));
      rejected(verifier, "gridex", token(key, publicIssuer, "untrusted-client", valid));
      rejected(verifier, "gridex", token(key, publicIssuer, "openremote", System.currentTimeMillis() - 300000));
      rejected(verifier, "gridex", token(otherKey, publicIssuer, "openremote", valid));
      System.out.println("Issuer regression: public gridex/local master accepted; wrong issuer, realm, audience, expiry, signature rejected.");
    } finally { server.stop(0); }
  }
}
