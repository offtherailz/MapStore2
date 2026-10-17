#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# seed-geoserver.sh — publish the PostGIS fixture tables as WMS/WFS layers.
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
LAYERS=(e2e_points e2e_edit e2e_events e2e_stats e2e_empty e2e_multigeom)

# The datastore connects over the compose network, so the host is the service name.
PG_HOST="postgres"
PG_PORT="5432"
PG_DATABASE="gisdata"
PG_USER="postgres"
PG_PASSWORD="postgres"

rest() {
    local method="$1" path="$2" body="${3:-}" type="${4:-application/json}"
    if [[ -n "$body" ]]; then
        curl -sS -o /dev/null -w "%{http_code}" -u "${GS_USER}:${GS_PASSWORD}" \
            -X "$method" -H "Content-Type: ${type}" \
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

FEATURE_TYPES="/rest/workspaces/${WORKSPACE}/datastores/${STORE}/featuretypes"

for layer in "${LAYERS[@]}"; do
    if exists "${FEATURE_TYPES}/${layer}"; then
        echo "  layer ${WORKSPACE}:${layer} already published"
    else
        echo "  publishing layer ${WORKSPACE}:${layer}"
        rest POST "${FEATURE_TYPES}" \
            "{\"featureType\":{\"name\":\"${layer}\",\"nativeName\":\"${layer}\",\"srs\":\"EPSG:4326\",\"enabled\":true}}" > /dev/null
    fi
done

# The features of e2e_events carry a time: WMS and WFS expose it as the time dimension.
echo "  enabling the time dimension of ${WORKSPACE}:e2e_events"
rest PUT "${FEATURE_TYPES}/e2e_events" "$(cat <<JSON
{
  "featureType": {
    "metadata": {
      "entry": [{
        "@key": "time",
        "dimensionInfo": { "enabled": true, "attribute": "event_time", "presentation": "LIST", "units": "ISO8601" }
      }]
    }
  }
}
JSON
)" > /dev/null

# ISO metadata document of e2e_points, served by GeoServer itself and linked from the capabilities.
echo "  publishing the metadata of ${WORKSPACE}:e2e_points"
rest PUT "/rest/resource/www/e2e/e2e_points_metadata.xml" "$(cat <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:citation>
        <gmd:CI_Citation>
          <gmd:title><gco:CharacterString>E2E cities metadata</gco:CharacterString></gmd:title>
        </gmd:CI_Citation>
      </gmd:citation>
      <gmd:abstract><gco:CharacterString>Italian cities used by the E2E suites</gco:CharacterString></gmd:abstract>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
</gmd:MD_Metadata>
XML
)" "application/xml" > /dev/null
rest PUT "${FEATURE_TYPES}/e2e_points" "$(cat <<JSON
{
  "featureType": {
    "metadataLinks": {
      "metadataLink": [
        { "type": "text/xml", "metadataType": "ISO19115:2003", "content": "${GS_URL}/www/e2e/e2e_points_metadata.xml" },
        { "type": "text/html", "metadataType": "ISO19115:2003", "content": "${GS_URL}/www/e2e/e2e_points_metadata.xml" }
      ]
    }
  }
}
JSON
)" > /dev/null

# Style classifying the cities by category, for the legend and its filters.
STYLE="e2e_points_by_category"
if exists "/rest/workspaces/${WORKSPACE}/styles/${STYLE}"; then
    echo "  style ${WORKSPACE}:${STYLE} already present"
else
    echo "  publishing style ${WORKSPACE}:${STYLE}"
    rest POST "/rest/workspaces/${WORKSPACE}/styles?name=${STYLE}" "$(cat <<'SLD'
<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>e2e_points_by_category</Name>
    <UserStyle>
      <Title>E2E cities by category</Title>
      <FeatureTypeStyle>
        <Rule>
          <Name>capital</Name>
          <Title>Capital</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>category</ogc:PropertyName><ogc:Literal>capital</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PointSymbolizer><Graphic><Mark><WellKnownName>circle</WellKnownName><Fill><CssParameter name="fill">#d7191c</CssParameter></Fill></Mark><Size>12</Size></Graphic></PointSymbolizer>
        </Rule>
        <Rule>
          <Name>city</Name>
          <Title>City</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>category</ogc:PropertyName><ogc:Literal>city</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PointSymbolizer><Graphic><Mark><WellKnownName>square</WellKnownName><Fill><CssParameter name="fill">#2b83ba</CssParameter></Fill></Mark><Size>10</Size></Graphic></PointSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
SLD
)" "application/vnd.ogc.sld+xml" > /dev/null
    rest POST "/rest/layers/${WORKSPACE}:e2e_points/styles" "{\"style\":{\"name\":\"${WORKSPACE}:${STYLE}\"}}" > /dev/null
fi

# Anonymous WFS-T on the editing tables only: MapStore sends the transactions without
# GeoServer credentials.
ACL="$(curl -sS -u "${GS_USER}:${GS_PASSWORD}" "${GS_URL}/rest/security/acl/layers.json")"
for layer in e2e_edit e2e_stats; do
    if [[ "$ACL" == *"${WORKSPACE}.${layer}.w"* ]]; then
        echo "  write rule of ${WORKSPACE}:${layer} already present"
    else
        echo "  opening ${WORKSPACE}:${layer} to WFS-T"
        rest POST "/rest/security/acl/layers" "{\"${WORKSPACE}.${layer}.w\":\"*\"}" > /dev/null
    fi
done

# Verify through the public capabilities, which is what MapStore actually reads.
CAPABILITIES="$(curl -sS "${GS_URL}/${WORKSPACE}/wfs?service=WFS&version=1.1.0&request=GetCapabilities")"
for layer in "${LAYERS[@]}"; do
    if [[ "$CAPABILITIES" == *"${WORKSPACE}:${layer}"* ]]; then
        echo "  ${WORKSPACE}:${layer} advertised in WFS capabilities"
    else
        echo "  ✖ ${WORKSPACE}:${layer} missing from WFS capabilities" >&2
        exit 1
    fi
done
