const isArray = require('lodash/isArray');
const isGML2 = (version) => version.indexOf("2.") === 0;
const isGML32 = (version) => version === "3.2";
let _gmlIdCounter = 0;
const nextGmlId = () => `gml${++_gmlIdCounter}`;
const closePolygon = (coords) => {
    if (coords.length >= 3) {
        const first = coords[0];
        const last = coords[coords.length - 1];
        if ((first[0] !== last[0]) || (first[1] !== last[1])) {
            return coords.concat([coords[0]]);
        }
    }
    return coords;
};
const pointElement = (coordinates, srsName, version) => {
    const gml2 = isGML2(version);
    let gmlPoint = '<gml:Point srsDimension="2"';
    if (isGML32(version)) gmlPoint += ` gml:id="${nextGmlId()}"`;
    gmlPoint += srsName ? ' srsName="' + srsName + '">' : '>';
    if (gml2) {
        gmlPoint += '<gml:coord><X>' + coordinates[0] + '</X><Y>' + coordinates[1] + '</Y></gml:coord>';
    } else {
        gmlPoint += '<gml:pos>' + coordinates.join(" ") + '</gml:pos>';
    }


    gmlPoint += '</gml:Point>';
    return gmlPoint;
};

const polygonElement = (coordinates, srsName, version) => {
    const gml2 = isGML2(version);
    let gmlPolygon = '<gml:Polygon';
    if (isGML32(version)) gmlPolygon += ` gml:id="${nextGmlId()}"`;
    gmlPolygon += srsName ? ' srsName="' + srsName + '">' : '>';

    // ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Array of LinearRing coordinate array. The first element in the array represents the exterior ring.
    // Any subsequent elements represent interior rings (or holes).
    // ///////////////////////////////////////////////////////////////////////////////////////////////////////

    const normalizedCoords = coordinates.length && isArray(coordinates[0]) && coordinates[0].length && isArray(coordinates[0][0]) ? coordinates : [coordinates];
    normalizedCoords.forEach((element, index) => {
        let coords = closePolygon(element).map((coordinate) => {
            return coordinate[0] + (gml2 ? "," : " ") + coordinate[1];
        });
        const exterior = (gml2 ? "outerBoundaryIs" : "exterior");
        const interior = (gml2 ? "innerBoundaryIs" : "interior");
        gmlPolygon +=
            (index < 1 ? '<gml:' + exterior + '>' : '<gml:' + interior + '>') +
                    '<gml:LinearRing>' +
                    (gml2 ? '<gml:coordinates>' : '<gml:posList>') +
                            coords.join(" ") +
                    (gml2 ? '</gml:coordinates>' : '</gml:posList>') +
                    '</gml:LinearRing>' +
            (index < 1 ? '</gml:' + exterior + '>' : '</gml:' + interior + '>');
    });

    gmlPolygon += '</gml:Polygon>';
    return gmlPolygon;
};
const lineStringElement = (coordinates, srsName, version) => {
    const gml2 = isGML2(version);
    let gml = '<gml:LineString';
    if (isGML32(version)) gml += ` gml:id="${nextGmlId()}"`;
    gml += srsName ? ' srsName="' + srsName + '">' : '>';

    // ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Array of LinearRing coordinate array. The first element in the array represents the exterior ring.
    // Any subsequent elements represent interior rings (or holes).
    // ///////////////////////////////////////////////////////////////////////////////////////////////////////

    let coords = coordinates.map((coordinate) => {
        return coordinate[0] + (gml2 ? "," : " ") + coordinate[1];
    });
    gml += (gml2 ? '<gml:coordinates>' : '<gml:posList>') +
              coords.join(" ") +
                (gml2 ? '</gml:coordinates>' : '</gml:posList>');

    gml += '</gml:LineString>';
    return gml;
};


/**
 * Processes the geometry in geojson format to provide the GML version of it
 * @param  {string} version  GML version
 * @param  {object} geometry the geometry in GeoJSON format
 * @return {string}          the GML version of the Geometry
 */
const processOGCGeometry = (version, geometry) => {
    let ogc = '';
    const srsName = geometry.projection || "EPSG:4326";
    const gml32 = isGML32(version);
    switch (geometry.type) {
    case "Point":
        ogc += pointElement(geometry.coordinates, srsName, version);
        break;
    case "MultiPoint": {
        const mpId = gml32 ? ` gml:id="${nextGmlId()}"` : '';
        ogc += `<gml:MultiPoint${mpId} srsName="${srsName}">`;
        geometry.coordinates.forEach((element) => {
            if (element) {
                ogc += "<gml:pointMember>";
                ogc += pointElement(element, srsName, version);
                ogc += "</gml:pointMember>";
            }
        });
        ogc += '</gml:MultiPoint>';
        break;
    }
    case "LineString":
        ogc += lineStringElement(geometry.coordinates, srsName, version);
        break;
    case "MultiLineString": {
        const multyLineTagName = gml32 ? "MultiCurve" : "MultiLineString";
        const lineMemberTagName = gml32 ? "curveMember" : "lineStringMember";
        const mlId = gml32 ? ` gml:id="${nextGmlId()}"` : '';
        ogc += `<gml:${multyLineTagName}${mlId} srsName="${srsName}">`;
        geometry.coordinates.forEach((element) => {
            if (element) {
                ogc += "<gml:" + lineMemberTagName + ">";
                ogc += lineStringElement(element, srsName, version);
                ogc += "</gml:" + lineMemberTagName + ">";
            }
        });
        ogc += '</gml:' + multyLineTagName + '>';
        break;
    }
    case "Polygon":
        ogc += polygonElement(geometry.coordinates, srsName, version);
        break;
    case "MultiPolygon": {
        const multyPolygonTagName = gml32 ? "MultiSurface" : "MultiPolygon";
        const polygonMemberTagName = gml32 ? "surfaceMembers" : "polygonMember";
        const mpgId = gml32 ? ` gml:id="${nextGmlId()}"` : '';
        ogc += `<gml:${multyPolygonTagName}${mpgId} srsName="${srsName}">`;
        geometry.coordinates.forEach((element) => {
            if (element) {
                ogc += "<gml:" + polygonMemberTagName + ">";
                ogc += polygonElement(element, srsName, version);
                ogc += "</gml:" + polygonMemberTagName + ">";
            }
        });
        ogc += '</gml:' + multyPolygonTagName + '>';
        break;
    }
    default:
        break;
    }
    return ogc;
};

module.exports = {
    closePolygon,
    pointElement,
    polygonElement,
    lineStringElement,
    processOGCGeometry
};
