FROM openremote/manager:1.30.0@sha256:dcf6c4554a99c9afc3c0fc8d03d8d896d376b36c3f49d31e8a35c38c065355aa AS upstream
FROM eclipse-temurin:21-jdk@sha256:92a2a4d7a928d057e7bd999c418d66c26a34eb9a0442f3ab67721c3f88110b2d AS build
WORKDIR /patch
COPY --from=upstream /opt/app/lib /patch/lib
ADD https://raw.githubusercontent.com/openremote/openremote/1.30.0/container/src/main/java/org/openremote/container/security/TokenVerifierImpl.java TokenVerifierImpl.java
RUN echo 'a4fb70531c7ecad84078c456d4d9c235cbb70feafb78c480f2f3382edfb1e7da  TokenVerifierImpl.java' | sha256sum -c -
# Exact, operator-configured issuer per realm; no token-derived URL or JWKS.
# Preserve upstream signature, expiry, audience and cross-realm validation.
RUN sed -i 's@final String expectedIssuer = keycloakPublicUrl + "/realms/" + realm;@final String expectedIssuer = System.getenv().getOrDefault("OR_KEYCLOAK_ISSUER_" + realm.toUpperCase(java.util.Locale.ROOT), keycloakPublicUrl + "/realms/" + realm);@' TokenVerifierImpl.java \
 && grep -q 'OR_KEYCLOAK_ISSUER_' TokenVerifierImpl.java \
 && javac -cp 'lib/*' -d classes TokenVerifierImpl.java
COPY IssuerTest.java .
RUN javac --add-modules jdk.httpserver -cp 'classes:lib/*' -d classes IssuerTest.java \
 && OR_KEYCLOAK_ISSUER_GRIDEX=https://auth.example.test/auth/realms/gridex java --add-modules jdk.httpserver -cp 'classes:lib/*' org.openremote.container.security.IssuerTest \
 && jar uf lib/openremote-container-1.30.0.jar -C classes org/openremote/container/security/TokenVerifierImpl.class
FROM upstream
COPY --from=build /patch/lib/openremote-container-1.30.0.jar /opt/app/lib/openremote-container-1.30.0.jar
# Retain the AGPL upstream header and the exact modified source in the image.
COPY --from=build /patch/TokenVerifierImpl.java /opt/gridex-source/TokenVerifierImpl.java
