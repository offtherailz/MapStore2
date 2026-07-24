# LDAP activation via Spring profile (prototype)

Activate LDAP (and LDAP direct mode) at runtime through a Spring profile, instead of
building a dedicated Maven `ldap` profile. One security context ships in every build;
the LDAP beans are created only when the profile is active.

## How it works

- The base `geostore-spring-security.xml` no longer declares the `authenticationManager`
  inline. It imports a profile file:

  ```xml
  <import resource="classpath*:geostore-security-profiles.xml"/>
  ```

- `geostore-security-profiles.xml` holds one block per integration:
  - `profile="!ldap"` — authentication manager with the internal DB provider only (default).
  - `profile="ldap"` — authentication manager with DB + LDAP providers, plus `contextSource`,
    `geostoreLdapProvider` and `ldapInitializer`.
  - `profile="ldap-direct"` — overrides `userDAO`/`userGroupDAO` with the LDAP DAOs
    (enable together with `ldap`).

With the profile off, none of the LDAP beans exist, so the application never contacts LDAP.

## Activation

Set the Spring active profiles. In precedence order the value can come from:

- JVM system property: `-Dspring.profiles.active=ldap`
- Environment variable: `SPRING_PROFILES_ACTIVE=ldap`
- Tomcat `setenv.sh` / `CATALINA_OPTS`
- Servlet context-param in `web.xml` (baked in the WAR, needs a rebuild)

Direct mode: `spring.profiles.active=ldap,ldap-direct`.

LDAP connection parameters stay in `ldap.properties` (classpath or `${datadir.location}/ldap.properties`),
unchanged.

### From the data directory

`spring.profiles.active` is read from the Spring `Environment` while the XML is parsed, which
is before the data-dir property files are loaded. To drive the profile from a data-dir file,
add a small `ApplicationContextInitializer` (registered in `web.xml` via `contextInitializerClasses`)
that reads the file and calls `setActiveProfiles(...)` before refresh. Not included in this
prototype.

## Non-blocking behaviour

`ldapInitializer` (`LDAPInit`) runs a group pre-sync that connects to LDAP. It is declared with
`lazy-init="true"`, so an unreachable LDAP endpoint does not stop the application from starting;
groups are synchronized on first login instead.

Observed behaviour:

| Scenario | Result |
| --- | --- |
| default profile | app starts, LDAP never contacted, internal users work |
| `ldap`, LDAP reachable | LDAP and internal users authenticate |
| `ldap`, LDAP down at startup | app starts, internal users work, LDAP logins rejected |
| LDAP goes down at runtime | LDAP logins rejected, internal users work, recovers automatically when LDAP returns, no restart |

Recommended production fix (GeoStore side): make `LDAPInit.afterPropertiesSet()` resilient
(catch `CommunicationException`, log an error, do not rethrow). That keeps the startup sync when
LDAP is reachable while never blocking the boot, and removes the need for `lazy-init`.

## Testing with cargo

Build once, then start with or without the profile. Use dedicated cargo ports if another cargo
container is already running on the host.

```bash
# build
mvn -f product/pom.xml -DskipTests package

# default (no LDAP)
mvn -f product/pom.xml -DskipTests cargo:run

# LDAP on
SPRING_PROFILES_ACTIVE=ldap mvn -f product/pom.xml -DskipTests cargo:run \
  -Dcargo.rmi.port=8206 -Dcargo.tomcat.ajp.port=8010
```

A lightweight LDAP server for tests is the `acme-ldap` jar described in
`docs/developer-guide/integrations/users/ldap.md` (port 10389, users `bill`/`hello` ADMIN,
`bob`/`secret`, `alice`/`foobar`). The default `ldap.properties` already points to it.

## Migration from the Maven `ldap` profile

1. Drop `-Pldap` from the build. A single WAR now serves every integration.
2. Set `spring.profiles.active=ldap` (or `ldap,ldap-direct`) at runtime.
3. Projects that override `geostore-spring-security.xml`: align the base to the version that
   imports `geostore-security-profiles.xml`, and add the profile file.

The Maven `ldap` profile and the duplicated `web/src/config/ldap` / `product/config/ldap`
security files can then be removed.

## Prototype scope

- Prototype (this branch, MapStore side): base import + `geostore-security-profiles.xml` +
  build wiring in `product/pom.xml`. Fragment placed on the classpath for the test.
- Proper home (GeoStore): the profile file and the resilient `LDAPInit` belong in GeoStore,
  next to the existing `security-integration-*.xml`, so other GeoStore-based apps benefit.
  MapStore then only consumes them and removes the Maven `ldap` profile.
