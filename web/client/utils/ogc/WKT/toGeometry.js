
const parsePoint = (coordinates) => {
    const [x, y] = coordinates.split(' ').map(parseFloat);
    return {
        type: 'Point',
        coordinates: [x, y]
    };
};

const parseLineString = (coordinates) => {
    const points = coordinates.split(',').map(point => {
        const [x, y] = point.trim().split(' ').map(parseFloat);
        return [x, y];
    });
    return {
        type: 'LineString',
        coordinates: points
    };
};

const parsePolygon = (coordinates) => {
    const rings = coordinates.split('),').map(ring => {
        const points = ring.replace('(', '').trim().split(',').map(point => {
            const [x, y] = point.trim().split(' ').map(parseFloat);
            return [x, y];
        });
        return points;
    });
    return {
        type: 'Polygon',
        coordinates: rings
    };
};
const parseMultiPoint = (coordinates) => {
    const points = coordinates.split(',').map(point => {
        const [x, y] = point.trim().split(' ').map(parseFloat);
        return [x, y];
    });
    return {
        type: 'MultiPoint',
        coordinates: points
    };
};

const parseMultiLineString = (coordinates) => {
    const lines = coordinates.split('),').map(line => {
        const points = line.replace('(', '').trim().split(',').map(point => {
            const [x, y] = point.trim().split(' ').map(parseFloat);
            return [x, y];
        });
        return points;
    });
    return {
        type: 'MultiLineString',
        coordinates: lines
    };
};

const parseMultiPolygon = (coordinates) => {
    const polygons = coordinates.split(')),').map(polygon => {
        const rings = polygon.replace('(', '').trim().split('),').map(ring => {
            const points = ring.replace('(', '').trim().split(',').map(point => {
                const [x, y] = point.trim().split(' ').map(parseFloat);
                return [x, y];
            });
            return points;
        });
        return rings;
    });
    return {
        type: 'MultiPolygon',
        coordinates: polygons
    };
};
let toGeometry;
const parseGeometryCollection = (coordinates) => {
    const geometries = coordinates.split('),').map(geometry => {
        const type = geometry.substring(0, geometry.indexOf('(')).trim().toUpperCase();
        const coords = geometry.substring(geometry.indexOf('(') + 1).trim();
        return toGeometry(`${type}(${coords})`);
    });
    return {
        type: 'GeometryCollection',
        geometries: geometries
    };
};

toGeometry = (rawWkt) => {
    // Remove any leading or trailing white spaces from the WKT
    let wkt = rawWkt.trim();

    // Determine the geometry type based on the initial keyword
    const type = wkt.substring(0, wkt.indexOf('(')).trim().toUpperCase();

    // Extract the coordinates from the inner part of the WKT
    const coordinates = wkt.substring(wkt.indexOf('(') + 1, wkt.lastIndexOf(')')).trim();

    // Parse the coordinates based on the geometry type
    let result;
    switch (type) {
    case 'POINT':
        result = parsePoint(coordinates);
        break;
    case 'LINESTRING':
        result = parseLineString(coordinates);
        break;
    case 'POLYGON':
        result = parsePolygon(coordinates);
        break;
        // Add support for additional geometry types here
    case 'MULTIPOINT':
        result = parseMultiPoint(coordinates);
        break;
    case 'MULTILINESTRING':
        result = parseMultiLineString(coordinates);
        break;
    case 'MULTIPOLYGON':
        result = parseMultiPolygon(coordinates);
        break;
    case 'GEOMETRYCOLLECTION':
        result = parseGeometryCollection(coordinates);
        break;
    default:
        throw new Error(`Not supported geometry: ${type}`);
    }

    return result;
};
/**
 * Convert a WKT string to a geojson geometry
 * @name toGeometry
 * @memberof utils.ogc.Filter.WKT
 * @param {string} wkt the wkt string
 * @return {object} the geojson geometry
 */
export default toGeometry;
