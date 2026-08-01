#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# e2e-docker.sh — Build and run Playwright E2E tests in Docker, by profile.
#
# Run from the repository root (npm run e2e:docker).
#
# Usage:
#   ./e2e-docker.sh [OPTIONS]
#
# Options:
#   --profiles  <list>      Comma-separated profiles to run. Default: base,geoserver,oidc,ldap
#   --list-profiles         Print available profiles and exit
#   --skip-build            Skip the Maven WAR build (reuse product/target/mapstore.war)
#   --no-fast-fail          Disable fast-fail on startup errors; wait full timeout
#   --headed                Run tests in headed (browser visible) mode
#   -h, --help              Show this help message
#
# Profiles:
#   base        Plain stack on http://localhost:8081/mapstore/
#   geoserver   base + local GeoServer 8082 publishing the PostGIS fixture layer
#   oidc        Auth stack on http://localhost/mapstore/ with Keycloak OpenID login
#   ldap        Auth stack on http://localhost/mapstore/ with an LDAP-profile WAR
#
# The oidc and ldap profiles reuse the committed auth stack
# (docker/docker-compose.auth.yml) and its sample fixtures, so no credentials
# have to be supplied. Compose variables come from
# utility/e2e-test-runner/profiles/auth/.env.e2e, never from the developer's ./.env.
#
# Environment variables (all optional):
#   E2E_SERVICES_JSON       Override service URLs, e.g. '{"geoserver":"http://..."}'
#   E2E_IDENTITIES_JSON     Override the named test identities for the profile
#   E2E_FEATURES            Override the profile feature gates
#   MS_USER / MS_PASSWORD   Override the administrator credentials
#   GEOSERVER_ADMIN_USER    GeoServer administrator, used to seed the PostGIS layer
#   GEOSERVER_ADMIN_PASSWORD
#
# Examples:
#   ./e2e-docker.sh
#   ./e2e-docker.sh --profiles base --headed
#   ./e2e-docker.sh --profiles base,geoserver --skip-build
#   ./e2e-docker.sh --no-fast-fail --profiles ldap
# ---------------------------------------------------------------------------

set -euo pipefail

# ── defaults ──────────────────────────────────────────────────────────────────
PROFILES="base,geoserver,oidc,ldap"
SKIP_BUILD=false
FAST_FAIL=true
HEADED_MODE=false
LIST_PROFILES=false

RUNNER_DIR="utility/e2e-test-runner"
TMP_ROOT="${RUNNER_DIR}/.tmp"
AUTH_ENV_FILE="${RUNNER_DIR}/profiles/auth/.env.e2e"

# The E2E containers are renamed by the profile overlays, so the stack can run next
# to a developer stack started from the same compose files.
MAPSTORE_CONTAINER="e2e-mapstore"
GEOSERVER_CONTAINER="e2e-geoserver"
KEYCLOAK_CONTAINER="e2e-keycloak"

# ── argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case $1 in
        --profiles)       PROFILES="$2"; shift 2 ;;
        --list-profiles)  LIST_PROFILES=true; shift ;;
        --skip-build)     SKIP_BUILD=true; shift ;;
        --no-fast-fail)   FAST_FAIL=false; shift ;;
        --headed)         HEADED_MODE=true; shift ;;
        -h|--help)
            sed -n '/^# Usage/,/^# ---/p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

# ── profile definitions ───────────────────────────────────────────────────────
#   Each profile specifies:
#     MAVEN     — Maven -P flag added to -Pprinting (empty = standard build)
#     COMPOSE   — space-separated list of compose files, relative to the repo root
#     SUITES    — default test suites
#     ENV       — extra environment variables (KEY=VALUE pairs, space separated,
#                 so JSON values must not contain spaces)
#     BASE_URL  — MapStore URL the suites run against
#     ENV_FILE  — compose --env-file, empty when the profile needs none
#     DATADIR   — true when a generated datadir must be mounted (auth profiles)
#     WAIT_GS   — wait for GeoServer on 8082 and publish the PostGIS fixture layer
#     WAIT_KC   — wait for the Keycloak realm to be importable

declare -A PROFILE_MAVEN PROFILE_COMPOSE PROFILE_SUITES PROFILE_ENV \
           PROFILE_BASE_URL PROFILE_ENV_FILE PROFILE_DATADIR \
           PROFILE_WAIT_GS PROFILE_WAIT_KC
AVAILABLE_PROFILES=(base geoserver oidc ldap)

BASE_COMPOSE="docker-compose.yml ${RUNNER_DIR}/profiles/base/docker-compose.e2e.yml"
AUTH_COMPOSE="docker-compose.yml docker/docker-compose.auth.yml ${RUNNER_DIR}/profiles/auth/docker-compose.e2e.yml"
CORE_SUITES="smoke,auth,homepage,maps"

PROFILE_MAVEN[base]=""
PROFILE_COMPOSE[base]="$BASE_COMPOSE"
PROFILE_SUITES[base]="$CORE_SUITES"
PROFILE_ENV[base]="E2E_FEATURES="
PROFILE_BASE_URL[base]="http://localhost:8081/mapstore/"
PROFILE_ENV_FILE[base]=""
PROFILE_DATADIR[base]=false
PROFILE_WAIT_GS[base]=false
PROFILE_WAIT_KC[base]=false

PROFILE_MAVEN[geoserver]=""
PROFILE_COMPOSE[geoserver]="$BASE_COMPOSE ${RUNNER_DIR}/profiles/geoserver/docker-compose.e2e.yml"
PROFILE_SUITES[geoserver]="smoke,geoserver"
PROFILE_ENV[geoserver]="E2E_FEATURES=geoserverIntegration,geoserverDb E2E_SERVICES_JSON={\"geoserver\":\"http://localhost:8082/geoserver\"}"
PROFILE_BASE_URL[geoserver]="http://localhost:8081/mapstore/"
PROFILE_ENV_FILE[geoserver]=""
PROFILE_DATADIR[geoserver]=false
PROFILE_WAIT_GS[geoserver]=true
PROFILE_WAIT_KC[geoserver]=false

# Keycloak OpenID: standard WAR, GeoStore generic OIDC provider, DB user store.
PROFILE_MAVEN[oidc]=""
PROFILE_COMPOSE[oidc]="$AUTH_COMPOSE"
# No OIDC spec yet: the profile only proves the stack starts and the login form works.
PROFILE_SUITES[oidc]="smoke"
PROFILE_ENV[oidc]="E2E_FEATURES=oidc E2E_IDENTITIES_JSON={\"oidcAdmin\":{\"username\":\"kcadmin\",\"password\":\"changeme-kcadmin-pw-123\",\"role\":\"ADMIN\",\"provider\":\"keycloak\"},\"oidcUser\":{\"username\":\"kcuser\",\"password\":\"changeme-kcuser-pw-123\",\"role\":\"USER\",\"provider\":\"keycloak\"}}"
PROFILE_BASE_URL[oidc]="http://localhost/mapstore/"
PROFILE_ENV_FILE[oidc]="$AUTH_ENV_FILE"
PROFILE_DATADIR[oidc]=true
PROFILE_WAIT_GS[oidc]=false
PROFILE_WAIT_KC[oidc]=true

# LDAP: -Pldap WAR, so the user store is the directory. The administrator is the
# LDAP admin, not the GeoStore one, and account management suites do not apply.
PROFILE_MAVEN[ldap]="ldap"
PROFILE_COMPOSE[ldap]="$AUTH_COMPOSE"
PROFILE_SUITES[ldap]="smoke,ldap"
PROFILE_ENV[ldap]="E2E_FEATURES=ldap MS_USER=ldapadmin MS_PASSWORD=changeme-ldapadmin-pw-123 E2E_IDENTITIES_JSON={\"ldapAdmin\":{\"username\":\"ldapadmin\",\"password\":\"changeme-ldapadmin-pw-123\",\"role\":\"ADMIN\"},\"ldapUser\":{\"username\":\"ldapuser\",\"password\":\"changeme-ldapuser-pw-123\",\"role\":\"USER\"}}"
PROFILE_BASE_URL[ldap]="http://localhost/mapstore/"
PROFILE_ENV_FILE[ldap]="$AUTH_ENV_FILE"
PROFILE_DATADIR[ldap]=true
PROFILE_WAIT_GS[ldap]=false
PROFILE_WAIT_KC[ldap]=true

if [[ "$LIST_PROFILES" == "true" ]]; then
    printf '%s\n' "${AVAILABLE_PROFILES[@]}"
    exit 0
fi

if [[ ! -f docker-compose.yml ]]; then
    echo "Error: run this script from the repository root (npm run e2e:docker)." >&2
    exit 1
fi

# ── helpers ───────────────────────────────────────────────────────────────────

log()  { echo ""; echo "▶ $*"; }
pass() { echo "✔ $*"; }
fail() { echo "✖ $*" >&2; }

save_profile_logs() {
    local cargs="$1" profile="$2"
    local log_file="e2e-docker-logs-${profile}.txt"
    # shellcheck disable=SC2086
    docker compose $cargs logs --no-color > "$log_file" 2>&1 || true
    echo "  Logs saved to $log_file"
}

compose_args() {
    local files=($1)
    local env_file="${2:-}"
    local args=()
    if [[ -n "$env_file" ]]; then
        args+=("--env-file" "$env_file")
    fi
    for f in "${files[@]}"; do
        args+=("-f" "$f")
    done
    echo "${args[@]}"
}

# Build the datadir mounted by the auth profiles, keeping only the configuration
# files the profile actually needs. The developer's ./datadir is never touched.
prepare_datadir() {
    local profile="$1"
    local dir="${TMP_ROOT}/datadir-${profile}"

    rm -rf "$dir"
    mkdir -p "$dir"
    cp -R docker/sample-datadir/. "$dir/"

    case "$profile" in
        ldap)
            # No OpenID provider: drop the Keycloak overrides and the login patch.
            rm -f "$dir/mapstore-ovr.properties" "$dir/configs/localConfig.json.patch"
            ;;
        oidc)
            # DB user store, no LDAP connection.
            rm -f "$dir/ldap.properties"
            ;;
    esac
}

# Poll an HTTP endpoint until it answers, failing fast when the container dies.
wait_http() {
    local label="$1" container="$2" url="$3" max_seconds="$4" baseline="$5"
    local elapsed=0 interval=5 warned=false
    log "Waiting for ${label} at ${url} (timeout: ${max_seconds}s) …"
    while [[ $elapsed -lt $max_seconds ]]; do
        if curl -fsS "$url" > /dev/null 2>&1; then
            if [[ $elapsed -gt $baseline ]]; then
                echo "⚠ ${label} took ${elapsed}s to start (expected ~${baseline}s)."
            fi
            pass "${label} is ready (${elapsed}s)"
            return 0
        fi
        local state
        state=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
        if [[ "$state" == "exited" || "$state" == "dead" ]]; then
            fail "${label} container stopped unexpectedly (state: ${state}, ${elapsed}s)"
            docker logs "$container" 2>&1 | tail -10 >&2 || true
            return 1
        fi
        if [[ $elapsed -gt $baseline && "$warned" == false ]]; then
            echo "⚠ ${label} startup slower than the ${baseline}s baseline. Continuing to wait …"
            warned=true
        fi
        sleep "$interval"
        elapsed=$(( elapsed + interval ))
    done
    fail "${label} did not become ready within ${max_seconds}s"
    docker logs "$container" 2>&1 | grep -E "SEVERE|ERROR" | tail -5 >&2 || true
    return 1
}

# MapStore needs a richer check than wait_http: Tomcat answers with an error page
# when the WAR fails to deploy, and Spring context failures only show in the logs.
wait_mapstore() {
    local url="$1" max_seconds="${2:-300}"
    local elapsed=0 interval=5 warned=false
    log "Waiting for MapStore at $url (timeout: ${max_seconds}s) …"
    while [[ $elapsed -lt $max_seconds ]]; do
        local http_code
        http_code=$(curl -o /dev/null -s -w "%{http_code}" "$url" 2>/dev/null || true)
        [[ -z "$http_code" ]] && http_code="000"

        if [[ "$http_code" == "200" || "$http_code" == "302" ]]; then
            if [[ $elapsed -gt 120 ]]; then
                echo "⚠ MapStore took ${elapsed}s to start (expected ~20-30s). Consider checking resource constraints."
            fi
            pass "MapStore is ready (${elapsed}s)"
            return 0
        fi

        if [[ "$FAST_FAIL" == "true" ]]; then
            # A non-transient HTTP status means the WAR is deployed but broken.
            if [[ "$http_code" != "000" && "$http_code" != "502" && "$http_code" != "503" && "$http_code" != "504" ]]; then
                fail "MapStore returned HTTP $http_code — WAR likely failed to start (${elapsed}s)"
                echo "  Last error in logs:" >&2
                docker logs "$MAPSTORE_CONTAINER" 2>&1 | grep -E "SEVERE|ERROR|Exception" | tail -5 >&2 || true
                return 1
            fi

            local state
            state=$(docker inspect --format='{{.State.Status}}' "$MAPSTORE_CONTAINER" 2>/dev/null || echo "unknown")
            if [[ "$state" == "exited" || "$state" == "dead" ]]; then
                fail "MapStore container stopped unexpectedly (state: $state, ${elapsed}s)"
                docker logs "$MAPSTORE_CONTAINER" 2>&1 | tail -10 >&2 || true
                return 1
            fi

            local fatal_line
            fatal_line=$(docker logs "$MAPSTORE_CONTAINER" 2>&1 | grep -E \
                "Context initialization failed|ClassNotFoundException|BeanCreationException.*Initialization of bean failed" \
                | tail -1 || true)
            if [[ -n "$fatal_line" ]]; then
                fail "MapStore startup failed — fatal error in logs (${elapsed}s):"
                echo "  $fatal_line" >&2
                docker logs "$MAPSTORE_CONTAINER" 2>&1 | grep -E "SEVERE|ERROR|Caused by" | tail -15 >&2 || true
                return 1
            fi
        fi

        if [[ $elapsed -gt 120 && "$warned" == false ]]; then
            echo "⚠ Startup taking longer than expected (${elapsed}s > 120s baseline). Continuing to wait …"
            warned=true
        fi
        sleep "$interval"
        elapsed=$(( elapsed + interval ))
    done
    fail "MapStore did not become ready within ${max_seconds}s"
    docker logs "$MAPSTORE_CONTAINER" 2>&1 | grep -E "SEVERE|ERROR" | tail -5 >&2 || true
    return 1
}

wait_geoserver() {
    wait_http "GeoServer" "$GEOSERVER_CONTAINER" "http://localhost:8082/geoserver/web/" "${1:-120}" 30
}

# The realm discovery document is the first thing MapStore needs from Keycloak.
wait_keycloak() {
    wait_http "Keycloak realm" "$KEYCLOAK_CONTAINER" \
        "http://localhost/keycloak/realms/mapstore/.well-known/openid-configuration" \
        "${1:-120}" 40
}

teardown_stack() {
    local cargs="$1" profile="$2"
    CURRENT_CARGS=""  # clear before down so the trap does not fire again
    # shellcheck disable=SC2086
    docker compose $cargs down -v --timeout 30 || true
    rm -rf "${TMP_ROOT}/datadir-${profile}"
}

# ── cleanup trap ─────────────────────────────────────────────────────────────
# Ensure the Docker stack is torn down even if the script is interrupted (Ctrl+C).
CURRENT_CARGS=""
CURRENT_PROFILE=""
cleanup() {
    local cargs="$CURRENT_CARGS" profile="$CURRENT_PROFILE"
    CURRENT_CARGS=""  # prevent re-entry
    if [[ -n "$cargs" ]]; then
        echo ""
        echo "⚠ Interrupted — tearing down Docker stack (Ctrl+C again will be ignored) …"
        trap '' INT TERM  # ignore further signals during teardown
        # shellcheck disable=SC2086
        docker compose $cargs down -v --timeout 30 2>/dev/null || true
        [[ -n "$profile" ]] && rm -rf "${TMP_ROOT}/datadir-${profile}"
    fi
}
trap cleanup EXIT INT TERM

# ── main loop ─────────────────────────────────────────────────────────────────

IFS=',' read -ra PROFILE_LIST <<< "$PROFILES"
FAILED=()
LAST_MAVEN_BUILD="__unset__"
FRONTEND_BUILT=false
FIRST_PROFILE=true

for raw_profile in "${PROFILE_LIST[@]}"; do
    profile="${raw_profile// /}"

    if [[ -z "${PROFILE_COMPOSE[$profile]+x}" ]]; then
        fail "Unknown profile '$profile'. Allowed: ${AVAILABLE_PROFILES[*]}"
        exit 1
    fi

    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "  Profile: $profile"
    echo "════════════════════════════════════════════════════════════"

    # First profile gets extra time: it also builds the Docker image.
    MAPSTORE_TIMEOUT=300
    if [[ "$FIRST_PROFILE" == "true" ]]; then
        MAPSTORE_TIMEOUT=$((300 + 120))
        FIRST_PROFILE=false
    fi

    MAVEN="${PROFILE_MAVEN[$profile]}"
    SUITES="${PROFILE_SUITES[$profile]}"
    WAIT_GS="${PROFILE_WAIT_GS[$profile]}"
    WAIT_KC="${PROFILE_WAIT_KC[$profile]}"
    CARGS=$(compose_args "${PROFILE_COMPOSE[$profile]}" "${PROFILE_ENV_FILE[$profile]}")
    CURRENT_CARGS="$CARGS"  # used by the cleanup trap
    CURRENT_PROFILE="$profile"

    # ── build WAR ────────────────────────────────────────────────────────────
    if [[ "$SKIP_BUILD" == false ]] && [[ "$MAVEN" != "$LAST_MAVEN_BUILD" ]]; then
        if [[ "$FRONTEND_BUILT" == false ]]; then
            log "Building front-end bundle …"
            npm run fe:build
            FRONTEND_BUILT=true
        fi

        log "Building WAR (Maven profile: printing${MAVEN:+,$MAVEN}) …"
        if [[ -n "$MAVEN" ]]; then
            mvn --batch-mode -pl product -am -Pprinting,"${MAVEN}" -DskipTests package
        else
            mvn --batch-mode -pl product -am -Pprinting -DskipTests package
        fi
        LAST_MAVEN_BUILD="$MAVEN"
    fi

    # ── generated datadir ────────────────────────────────────────────────────
    if [[ "${PROFILE_DATADIR[$profile]}" == true ]]; then
        log "Preparing datadir for profile '$profile' …"
        prepare_datadir "$profile"
        export DATADIR_PATH="./${TMP_ROOT}/datadir-${profile}"
        echo "  DATADIR_PATH=$DATADIR_PATH"
    else
        unset DATADIR_PATH || true
    fi

    # ── start stack ───────────────────────────────────────────────────────────
    # A run killed before its teardown leaves containers behind: they answer the
    # readiness checks and then disappear when compose recreates them, so the suites
    # fail with connection errors. Start from a known empty stack instead.
    log "Removing leftovers from a previous run …"
    # shellcheck disable=SC2086
    docker compose $CARGS down -v --remove-orphans > /dev/null 2>&1 || true

    log "Starting Docker stack …"
    # shellcheck disable=SC2086
    docker compose $CARGS up -d --build

    # ── wait for services ─────────────────────────────────────────────────────
    STARTUP_OK=true

    if [[ "$WAIT_KC" == true ]]; then
        wait_keycloak || STARTUP_OK=false
    fi

    if [[ "$STARTUP_OK" == true ]]; then
        wait_mapstore "${PROFILE_BASE_URL[$profile]}" "$MAPSTORE_TIMEOUT" || STARTUP_OK=false
    fi

    if [[ "$STARTUP_OK" == true && "$WAIT_GS" == true ]]; then
        wait_geoserver || STARTUP_OK=false
        if [[ "$STARTUP_OK" == true ]]; then
            log "Publishing the PostGIS fixture layer …"
            bash "${RUNNER_DIR}/profiles/geoserver/seed-geoserver.sh" || STARTUP_OK=false
        fi
    fi

    if [[ "$STARTUP_OK" != true ]]; then
        log "Collecting Docker logs …"
        save_profile_logs "$CARGS" "$profile"
        teardown_stack "$CARGS" "$profile"
        fail "Profile '$profile' failed during startup"
        FAILED+=("$profile")
        continue
    fi

    # ── run tests ─────────────────────────────────────────────────────────────
    log "Running suites: $SUITES"

    # Profile defaults first, caller overrides last: later assignments win in env.
    EXTRA_ENV="${PROFILE_ENV[$profile]}"
    [[ -n "${MS_USER:-}" ]]              && EXTRA_ENV+=" MS_USER=${MS_USER}"
    [[ -n "${MS_PASSWORD:-}" ]]          && EXTRA_ENV+=" MS_PASSWORD=${MS_PASSWORD}"
    [[ -n "${MS_USER_STANDARD:-}" ]]     && EXTRA_ENV+=" MS_USER_STANDARD=${MS_USER_STANDARD}"
    [[ -n "${MS_PASSWORD_STANDARD:-}" ]] && EXTRA_ENV+=" MS_PASSWORD_STANDARD=${MS_PASSWORD_STANDARD}"
    [[ -n "${E2E_FEATURES:-}" ]]         && EXTRA_ENV+=" E2E_FEATURES=${E2E_FEATURES}"
    [[ -n "${E2E_SERVICES_JSON:-}" ]]    && EXTRA_ENV+=" E2E_SERVICES_JSON=${E2E_SERVICES_JSON}"
    [[ -n "${E2E_IDENTITIES_JSON:-}" ]]  && EXTRA_ENV+=" E2E_IDENTITIES_JSON=${E2E_IDENTITIES_JSON}"

    set +e
    # shellcheck disable=SC2086
    env BASE_URL="${PROFILE_BASE_URL[$profile]}" $EXTRA_ENV \
        npm run e2e -- --suites "$SUITES" $([ "$HEADED_MODE" = "true" ] && echo "--headed" || true)
    PROFILE_EXIT=$?
    set -e

    if [[ $PROFILE_EXIT -ne 0 ]]; then
        FAILED+=("$profile")
        fail "Profile '$profile' failed (exit $PROFILE_EXIT)"
        log "Collecting Docker logs …"
        save_profile_logs "$CARGS" "$profile"
    else
        pass "Profile '$profile' passed"
    fi

    # ── stop stack ────────────────────────────────────────────────────────────
    log "Stopping Docker stack …"
    teardown_stack "$CARGS" "$profile"
done

# ── final status ──────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
if [[ ${#FAILED[@]} -eq 0 ]]; then
    pass "All profiles passed: ${PROFILES}"
    exit 0
else
    fail "Failed profiles: ${FAILED[*]}"
    exit 1
fi
