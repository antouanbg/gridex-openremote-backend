FROM openremote/manager:1.30.0@sha256:dcf6c4554a99c9afc3c0fc8d03d8d896d376b36c3f49d31e8a35c38c065355aa AS upstream
FROM eclipse-temurin:21-jdk@sha256:92a2a4d7a928d057e7bd999c418d66c26a34eb9a0442f3ab67721c3f88110b2d AS build
WORKDIR /patch
COPY --from=upstream /opt/app/lib /patch/lib
ADD https://raw.githubusercontent.com/openremote/openremote/1.30.0/container/src/main/java/org/openremote/container/security/TokenVerifierImpl.java TokenVerifierImpl.java
RUN echo 'a4fb70531c7ecad84078c456d4d9c235cbb70feafb78c480f2f3382edfb1e7da  TokenVerifierImpl.java' | sha256sum -c -
# Exact, operator-configured issuer per realm; no token-derived URL or JWKS.
# Preserve upstream signature, expiry, audience and cross-realm validation.
COPY PatchTokenIssuer.java .
RUN java PatchTokenIssuer.java \
 && grep -q 'OR_KEYCLOAK_PUBLIC_ISSUER_BASE' TokenVerifierImpl.java \
 && javac -cp 'lib/*' -d classes TokenVerifierImpl.java
COPY IssuerTest.java .
RUN javac --add-modules jdk.httpserver -cp 'classes:lib/*' -d classes IssuerTest.java \
 && OR_KEYCLOAK_PUBLIC_ISSUER_BASE=https://auth.example.test/auth java --add-modules jdk.httpserver -cp 'classes:lib/*' org.openremote.container.security.IssuerTest \
 && jar uf lib/openremote-container-1.30.0.jar -C classes org/openremote/container/security/TokenVerifierImpl.class
# Pin and verify upstream sources before applying the organisation access guard.
ADD https://raw.githubusercontent.com/openremote/openremote/1.30.0/manager/src/main/java/org/openremote/manager/security/ManagerKeycloakIdentityProvider.java ManagerKeycloakIdentityProvider.java
ADD https://raw.githubusercontent.com/openremote/openremote/1.30.0/manager/src/main/java/org/openremote/manager/event/ClientEventService.java ClientEventService.java
ADD https://raw.githubusercontent.com/openremote/openremote/1.30.0/manager/src/main/java/org/openremote/manager/security/RealmResourceImpl.java RealmResourceImpl.java
RUN echo '6d55a842621f4ee6d7e2754598e35668b4623f8bfe294e88cb8e7a2bb2a82413  ManagerKeycloakIdentityProvider.java' | sha256sum -c - \
 && echo 'da7cc3b45fb823ebf4f8d955ac87efc2cd9f37ce82ba54bda74147f8ae3fef9a  ClientEventService.java' | sha256sum -c - \
 && echo '58e90758bb3152101853ba1b9adaf2a04b042722eb96d3cf8dec47ded50dd304  RealmResourceImpl.java' | sha256sum -c -
COPY PatchOrganisationAccess.java OrganisationAccessGuard.java OrganisationAccessGuardTest.java ./
RUN java PatchOrganisationAccess.java \
 && javac -cp 'classes:lib/*' -d classes OrganisationAccessGuard.java ManagerKeycloakIdentityProvider.java ClientEventService.java RealmResourceImpl.java OrganisationAccessGuardTest.java \
 && java -cp 'classes:lib/*' org.openremote.manager.security.OrganisationAccessGuardTest \
 && jar uf lib/openremote-manager-1.30.0.jar -C classes org/openremote/manager
FROM upstream
COPY --from=build /patch/lib/openremote-container-1.30.0.jar /opt/app/lib/openremote-container-1.30.0.jar
# Retain the AGPL upstream header and the exact modified source in the image.
COPY --from=build /patch/TokenVerifierImpl.java /opt/gridex-source/TokenVerifierImpl.java
COPY --from=build /patch/PatchTokenIssuer.java /opt/gridex-source/PatchTokenIssuer.java
COPY --from=build /patch/lib/openremote-manager-1.30.0.jar /opt/app/lib/openremote-manager-1.30.0.jar
COPY --from=build /patch/ManagerKeycloakIdentityProvider.java /patch/ClientEventService.java /patch/RealmResourceImpl.java /patch/OrganisationAccessGuard.java /opt/gridex-source/
