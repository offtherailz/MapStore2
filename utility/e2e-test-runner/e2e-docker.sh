#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# e2e-docker.sh — Build and run Playwright E2E tests in Docker, by profile.
#
# Usage:
#   ./e2e-docker.sh [OPTIONS]
#
# Options:
#   --profiles  <list>      Comma-separated profiles to run. Default: base,geoserver,ldap
#   --list-profiles         Print available profiles and exit
#   --skip-build            Skip the Maven WAR build (reuse product/target/mapstore.war)
#   --no-fast-fail          Disable fast-fail on startup errors; wait full timeout
#   --headed                Run tests in headed (browser visible) mode
#   -h, --help              Show this help message
#
# Environment variables (can also be set in .env files):
#   MS_USER_STANDARD        LDAP standard user (required when running the ldap profile)
#   MS_PASSWORD_STANDARD    LDAP standard password
#   E2E_SERVICES_JSON       Override service URLs, e.g. '{"geoserver":"http://..."}'
#                           (defaults to the Docker network address for each profile)
#
# Examples:
#   ./e2e-docker.sh
#   ./e2e-docker.sh --profiles base --headed
#   ./e2e-docker.sh --profiles base,geoserver --skip-build
#   ./e2e-docker.sh --no-fast-fail --profiles ldap
#   MS_USER_STANDARD=ldapuser MS_PASSWORD_STANDARD=secret ./e2e-docker.sh --profiles ldap
# ---------------------------------------------------------------------------

set -euo pipefail

# ── defaults ──────────────────────────────────────────────────────────────────
PROFILES="base,geoserver,ldap"
SKIP_BUILD=false
FAST_FAIL=true
HEADED_MODE=false
LIST_PROFILES=false

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
#     MAVEN   — Maven -P flag (empty = standard build; "ldap" = -Pldap)
#     COMPOSE — space-separated list of compose files
#     SUITES  — default test suites
#     ENV     — extra environment variables (KEY=VALUE pairs, space-separated)
#     WAIT_GS — whether to also wait for GeoServer on port 8082

declare -A PROFILE_MAVEN PROFILE_COMPOSE PROFILE_SUITES PROFILE_ENV PROFILE_WAIT_GS
AVAILABLE_PROFILES=(base geoserver ldap)

PROFILE_MAVEN[base]=""
PROFILE_COMPOSE[base]="docker-compose.yml utility/e2e-test-runner/profiles/base/docker-compose.e2e.yml"
PROFILE_SUITES[base]="auth,smoke,homepage,maps"
PROFILE_ENV[base]="E2E_FEATURES="
PROFILE_WAIT_GS[base]=false

PROFILE_MAVEN[geoserver]=""
PROFILE_COMPOSE[geoserver]="docker-compose.yml utility/e2e-test-runner/profiles/base/docker-compose.e2e.yml utility/e2e-test-runner/profiles/geoserver/docker-compose.e2e.yml"
PROFILE_SUITES[geoserver]="auth,smoke,homepage,maps,geoserver"
PROFILE_ENV[geoserver]="E2E_FEATURES=geoserverIntegration E2E_SERVICES_JSON={\"geoserver\":\"http://localhost:8082/geoserver\"}"
PROFILE_WAIT_GS[geoserver]=true

PROFILE_MAVEN[ldap]="ldap"
PROFILE_COMPOSE[ldap]="docker-compose.yml utility/e2e-test-runner/profiles/base/docker-compose.e2e.yml utility/e2e-test-runner/profiles/ldap/docker-compose.e2e.yml"
PROFILE_SUITES[ldap]="auth,smoke,homepage,maps,ldap"
PROFILE_ENV[ldap]="E2E_FEATURES=ldap"
PROFILE_WAIT_GS[ldap]=false

if [[ "$LIST_PROFILES" == "true" ]]; then
    printf '%s\n' "${AVAILABLE_PROFILES[@]}"
    exit 0
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
    local args=()
    for f in "${files[@]}"; do
        args+=("-f" "$f")
    done
    echo "${args[@]}"
}

# Wait for MapStore: fast-fail if the container exits, Tomcat returns a non-transient
# error, or the logs contain a fatal Spring context failure.
wait_mapstore() {
    local url="$1" max_seconds="${2:-300}"
    local elapsed=0 interval=5 start_time warned=false
    start_time=$(date +%s)
    log "Waiting for MapStore at $url (timeout: ${max_seconds}s) …"
    while [[ $elapsed -lt $max_seconds ]]; do
        # ── HTTP check ──────────────────────────────────────────────────────
        local http_code
        http_code=$(curl -o /dev/null -s -w "%{http_code}" "$url" 2>/dev/null || true)
        [[ -z "$http_code" ]] && http_code="000"
        if [[ "$http_code" == "200" || "$http_code" == "302" ]]; then
            # Warn if took longer than normal
            if [[ $elapsed -gt 120 ]]; then
                echo "⚠ MapStore took ${elapsed}s to start (expected ~20-30s). Consider checking resource constraints."
            fi
            pass "MapStore is ready (${elapsed}s)"
            return 0
        elif [[ "$http_code" != "000" && "$http_code" != "503" && "$http_code" != "502" && "$http_code" != "504" ]]; then
            if [[ "$FAST_FAIL" == "true" ]]; then
                echo -e "\033[1;31m✖ MapStore returned HTTP $http_code — WAR likely failed to start (${elapsed}s)\033[0m" >&2
                echo "  Last error in logs:" >&2
                docker logs mapstore 2>&1 | grep -E "SEVERE|ERROR|Exception" | tail -5 >&2 || true
                return 1
            fi
        # ── container state ─────────────────────────────────────────────────
        local state
        state=$(docker inspect --format='{{.State.Status}}' mapstore 2>/dev/null || echo "unknown")
        if [[ "$state" == "exited" || "$state" == "dead" ]]; then
            if [[ "$FAST_FAIL" == "true" ]]; then
                echo -e "\033[1;31m✖ MapStore container stopped unexpectedly (state: $state, ${elapsed}s)\033[0m" >&2
                echo "  Last lines of logs:" >&2
                docker logs mapstore 2>&1 | tail -10 >&2 || true
                return 1
            fi
        fi
        # ── fatal log pattern ────────────────────────────────────────────────
        # Detect Spring context failures (ClassNotFoundException, BeanCreation…)
        if [[ "$FAST_FAIL" == "true" ]]; then
            local fatal_line
            fatal_line=$(docker logs mapstore 2>&1 | grep -E \
                "Context initialization failed|ClassNotFoundException|BeanCreationException.*Initialization of bean failed" \
                | tail -1 || true)
            if [[ -n "$fatal_line" ]]; then
                echo -e "\033[1;31m✖ MapStore startup failed — fatal error detected in logs (${elapsed}s):\033[0m" >&2
                echo "  $fatal_line" >&2
                echo "  Full error context:" >&2
                docker logs mapstore 2>&1 | grep -A 5 -B 5 "$(echo \"$fatal_line\" | head -c 50)" | tail -15 >&2 || true
                return 1
            fi
        fi
        fi
        # ── warn if past normal startup time ─────────────────────────────────
        if [[ $elapsed -gt 120 && "$warned" == false ]]; then
            echo "⚠ Startup taking longer than expected (${elapsed}s > 120s baseline). Continuing to wait …"
            warned=true
        fi
        sleep "$interval"
        elapsed=$(( elapsed + interval ))
    done
    echo -e "\033[1;31m✖ MapStore did not become ready within ${max_seconds}s\033[0m" >&2
    echo "  Last error lines:" >&2
    docker logs mapstore 2>&1 | grep -E "SEVERE|ERROR" | tail -5 >&2 || true
    return 1
}

wait_geoserver() {
    local url="$1" max_seconds="${2:-60}"
    local elapsed=0 interval=5 warned=false
    log "Waiting for GeoServer at $url (timeout: ${max_seconds}s) …"
    while [[ $elapsed -lt $max_seconds ]]; do
        if curl -fsS "$url" > /dev/null 2>&1; then
            if [[ $elapsed -gt 30 ]]; then
                echo "⚠ GeoServer took ${elapsed}s to start (expected ~10-15s). Consider checking resource constraints."
            fi
            pass "GeoServer is ready (${elapsed}s)"
            return 0
        fi
        local state
        state=$(docker inspect --format='{{.State.Status}}' geoserver 2>/dev/null || echo "unknown")
        if [[ "$state" == "exited" || "$state" == "dead" ]]; then
            echo -e "\033[1;31m✖ GeoServer container stopped unexpectedly (state: $state, ${elapsed}s)\033[0m" >&2
            echo "  Last lines of logs:" >&2
            docker logs geoserver 2>&1 | tail -10 >&2 || true
            return 1
        fi
        if [[ $elapsed -gt 30 && "$warned" == false ]]; then
            echo "⚠ GeoServer startup taking longer than expected (${elapsed}s > 30s baseline). Continuing to wait …"
            warned=true
        fi
        sleep "$interval"
        elapsed=$(( elapsed + interval ))
    done
    echo -e "\033[1;31m✖ GeoServer did not become ready within ${max_seconds}s\033[0m" >&2
    echo "  Last error lines:" >&2
    docker logs geoserver 2>&1 | grep -E "SEVERE|ERROR" | tail -5 >&2 || true
    return 1
}

# ── cleanup trap ─────────────────────────────────────────────────────────────
# Ensure the Docker stack is torn down even if the script is interrupted (Ctrl+C).
CURRENT_CARGS=""
cleanup() {
    local cargs="$CURRENT_CARGS"
    CURRENT_CARGS=""  # prevent re-entry
    if [[ -n "$cargs" ]]; then
        echo ""
        echo "⚠ Interrupted — tearing down Docker stack (Ctrl+C again will be ignored) …"
        trap '' INT TERM  # ignore further signals during teardown
        # shellcheck disable=SC2086
        docker compose $cargs down -v --timeout 30 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

# ── main loop ─────────────────────────────────────────────────────────────────

IFS=',' read -ra PROFILE_LIST <<< "$PROFILES"
FAILED=()
LAST_MAVEN_BUILD="__unset__"
FRONTEND_BUILT=false
FIRST_PROFILE=true
MAPSTORE_TIMEOUT=300

for raw_profile in "${PROFILE_LIST[@]}"; do
    profile="${raw_profile// /}"

    if [[ -z "${PROFILE_COMPOSE[$profile]+x}" ]]; then
        fail "Unknown profile '$profile'. Allowed: base, geoserver, ldap"
        exit 1
    fi

    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "  Profile: $profile"
    echo "════════════════════════════════════════════════════════════"

    profile_started_at=$(date +%s)

    # Calculate timeout: first profile gets extra 120s for Docker image build/push
    MAPSTORE_TIMEOUT=300
    if [[ "$FIRST_PROFILE" == "true" ]]; then
        MAPSTORE_TIMEOUT=$((300 + 120))
        FIRST_PROFILE=false
    fi

    MAVEN="${PROFILE_MAVEN[$profile]}"
    CFILES="${PROFILE_COMPOSE[$profile]}"
    SUITES="${PROFILE_SUITES[$profile]}"
    WAIT_GS="${PROFILE_WAIT_GS[$profile]}"
    CARGS=$(compose_args "$CFILES")
    CURRENT_CARGS="$CARGS"  # used by the cleanup trap

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

    # ── start stack ───────────────────────────────────────────────────────────
    log "Starting Docker stack …"
    # shellcheck disable=SC2086
    docker compose $CARGS up -d --build

    # ── wait for services ─────────────────────────────────────────────────────
    wait_mapstore "http://localhost:8081/mapstore/" "$MAPSTORE_TIMEOUT" || {
        log "Collecting Docker logs …"
        save_profile_logs "$CARGS" "$profile"
        CURRENT_CARGS=""
        # shellcheck disable=SC2086
        docker compose $CARGS down -v --timeout 30 || true
        fail "Profile '$profile' failed during MapStore startup"
        FAILED+=("$profile")
        continue
    }

    if [[ "$WAIT_GS" == true ]]; then
        wait_geoserver "http://localhost:8082/geoserver/web/" 60 || {
            log "Collecting Docker logs …"
            save_profile_logs "$CARGS" "$profile"
            CURRENT_CARGS=""
            # shellcheck disable=SC2086
            docker compose $CARGS down -v --timeout 30 || true
            fail "Profile '$profile' failed during GeoServer startup"
            FAILED+=("$profile")
            continue
        }
    fi

    # ── run tests ─────────────────────────────────────────────────────────────
    log "Running suites: $SUITES"

    # Build env for this profile; pass through LDAP credentials if set in shell
    EXTRA_ENV="${PROFILE_ENV[$profile]}"
    [[ -n "${MS_USER_STANDARD:-}" ]]     && EXTRA_ENV+=" MS_USER_STANDARD=${MS_USER_STANDARD}"
    [[ -n "${MS_PASSWORD_STANDARD:-}" ]] && EXTRA_ENV+=" MS_PASSWORD_STANDARD=${MS_PASSWORD_STANDARD}"
    [[ -n "${E2E_FEATURES:-}" ]]         && EXTRA_ENV+=" E2E_FEATURES=${E2E_FEATURES}"
    # Allow caller to override E2E_SERVICES_JSON entirely
    [[ -n "${E2E_SERVICES_JSON:-}" ]]    && EXTRA_ENV+=" E2E_SERVICES_JSON=${E2E_SERVICES_JSON}"

    set +e
    # shellcheck disable=SC2086
    env BASE_URL=http://localhost:8081/mapstore/ $EXTRA_ENV \
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
    CURRENT_CARGS=""  # clear before down so the trap doesn't fire again
    # shellcheck disable=SC2086
    docker compose $CARGS down -v --timeout 30 || true
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
