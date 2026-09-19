FROM openremote/keycloak:26.7.3.0@sha256:ed06ad3dd3bcb95bc58ffe59729d5c4064f2276cce43b299949f816c89c2d027 AS upstream
FROM eclipse-temurin:21-jdk@sha256:92a2a4d7a928d057e7bd999c418d66c26a34eb9a0442f3ab67721c3f88110b2d AS compile
COPY --from=upstream /opt/keycloak/lib/lib/main/ /deps/
WORKDIR /build
COPY src/ src/
RUN mkdir classes && javac --release 21 -cp '/deps/*' -d classes src/tech/gridex/*.java && cp -r src/META-INF classes/ && jar --create --file mailgun.jar -C classes .
COPY test/ test/
RUN javac --release 21 -cp '/deps/*:classes' -d tests test/tech/gridex/*.java && GRIDEX_MAILGUN_REGION=EU GRIDEX_MAILGUN_DOMAIN=mg.example.com GRIDEX_MAILGUN_FROM=noreply@example.com GRIDEX_MAILGUN_API_KEY=synthetic GRIDEX_MAILGUN_BCC=support@example.com java -cp '/deps/*:classes:tests' tech.gridex.MailgunTest
FROM upstream
COPY --from=compile --chown=1000:0 /build/mailgun.jar /opt/keycloak/providers/gridex-mailgun.jar
ENV KC_SPI_EMAIL_SENDER__PROVIDER=mailgun
