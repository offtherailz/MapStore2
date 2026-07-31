#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# seed-geoserver.sh — publish the PostGIS fixture table as a WMS/WFS layer.
#
# Idempotent: existing workspace, store and layer are left untouched, so the
# script can be re-run against a warm stack.
#
# Usage: seed-geoserver.sh [GEOSERVER_URL]
#   GEOSERVER_URL defaults to http://localhost:8082/geoserver
#
# Credentials come from GEOSERVER_ADMIN_USER / GEOSERVER_ADMIN_PASSWORD.
# ---------------------------------------------------------------------------

set -euo pipefail

GS_URL="${1:-http://localhost:8082/geoserver}"
GS_USER="${GEOSERVER_ADMIN_USER:-admin}"
GS_PASSWORD="${GEOSERVER_ADMIN_PASSWORD:-geoserver}"
WORKSPACE="e2e"
STORE="gisdata"
LAYER="e2e_points"

# The datastore connects over the compose network, so the host is the service name.
PG_HOST="postgres"
PG_PORT="5432"
PG_DATABASE="gisdata"
PG_USER="postgres"
PG_PASSWORD="postgres"

rest() {
    local method="$1" path="$2" body="${3:-}"
    if [[ -n "$body" ]]; then
        curl -sS -o /dev/null -w "%{http_code}" -u "${GS_USER}:${GS_PASSWORD}" \
            -X "$method" -H "Content-Type: application/json" \
            -d "$body" "${GS_URL}${path}"
    else
        curl -sS -o /dev/null -w "%{http_code}" -u "${GS_USER}:${GS_PASSWORD}" \
            -X "$method" "${GS_URL}${path}"
    fi
}

exists() {
    local path="$1"
    [[ "$(rest GET "$path")" == "200" ]]
}

if exists "/rest/workspaces/${WORKSPACE}"; then
    echo "  workspace ${WORKSPACE} already present"
else
    echo "  creating workspace ${WORKSPACE}"
    rest POST "/rest/workspaces" "{\"workspace\":{\"name\":\"${WORKSPACE}\"}}" > /dev/null
fi

if exists "/rest/workspaces/${WORKSPACE}/datastores/${STORE}"; then
    echo "  datastore ${STORE} already present"
else
    echo "  creating PostGIS datastore ${STORE}"
    rest POST "/rest/workspaces/${WORKSPACE}/datastores" "$(cat <<JSON
{
  "dataStore": {
    "name": "${STORE}",
    "connectionParameters": {
      "entry": [
        { "@key": "dbtype",   "$": "postgis" },
        { "@key": "host",     "$": "${PG_HOST}" },
        { "@key": "port",     "$": "${PG_PORT}" },
        { "@key": "database", "$": "${PG_DATABASE}" },
        { "@key": "user",     "$": "${PG_USER}" },
        { "@key": "passwd",   "$": "${PG_PASSWORD}" },
        { "@key": "Expose primary keys", "$": "true" }
      ]
    }
  }
}
JSON
)" > /dev/null
fi

if exists "/rest/workspaces/${WORKSPACE}/datastores/${STORE}/featuretypes/${LAYER}"; then
    echo "  layer ${WORKSPACE}:${LAYER} already published"
else
    echo "  publishing layer ${WORKSPACE}:${LAYER}"
    rest POST "/rest/workspaces/${WORKSPACE}/datastores/${STORE}/featuretypes" \
        "{\"featureType\":{\"name\":\"${LAYER}\",\"nativeName\":\"${LAYER}\",\"srs\":\"EPSG:4326\",\"enabled\":true}}" > /dev/null
fi

# Verify through the public capabilities, which is what MapStore actually reads.
if curl -sS "${GS_URL}/${WORKSPACE}/wfs?service=WFS&version=1.1.0&request=GetCapabilities" \
    | grep -q "${WORKSPACE}:${LAYER}"; then
    echo "  ${WORKSPACE}:${LAYER} advertised in WFS capabilities"
else
    echo "  ✖ ${WORKSPACE}:${LAYER} missing from WFS capabilities" >&2
    exit 1
fi
