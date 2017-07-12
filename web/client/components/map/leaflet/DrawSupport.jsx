const PropTypes = require('prop-types');
const React = require('react');
const L = require('leaflet');
// const {head, last} = require('lodash');
require('leaflet-draw');
const {isSimpleGeomType} = require('../../../utils/MapUtils');

const CoordinatesUtils = require('../../../utils/CoordinatesUtils');

const defaultStyle = {
    color: '#ffcc33',
    opacity: 1,
    weight: 3,
    fillColor: '#ffffff',
    fillOpacity: 0.2,
    clickable: false,
    editing: {
        fill: 1
    }
};

class DrawSupport extends React.Component {
    static displayName = 'DrawSupport';

    static propTypes = {
        map: PropTypes.object,
        drawOwner: PropTypes.string,
        drawStatus: PropTypes.string,
        drawMethod: PropTypes.string,
        options: PropTypes.object,
        features: PropTypes.array,
        onChangeDrawingStatus: PropTypes.func,
        onGeometryChanged: PropTypes.func,
        onEndDrawing: PropTypes.func,
        messages: PropTypes.object
    };

    static defaultProps = {
        map: null,
        drawOwner: null,
        drawStatus: null,
        drawMethod: null,
        features: null,
        onChangeDrawingStatus: () => {},
        onGeometryChanged: () => {},
        onEndDrawing: () => {}
    };

    componentWillReceiveProps(newProps) {
        let drawingStrings = this.props.messages || this.context.messages ? this.context.messages.drawLocal : false;
        if (drawingStrings) {
            L.drawLocal = drawingStrings;
        }
        if (this.props.drawStatus !== newProps.drawStatus || newProps.drawStatus === "replace" || this.props.drawMethod !== newProps.drawMethod || this.props.features !== newProps.features) {
            switch (newProps.drawStatus) {
            case "create": this.addGeojsonLayer({features: newProps.features, projection: newProps.options && newProps.options.featureProjection || "EPSG:4326"}); break;
            case "start": this.addDrawInteraction(newProps); break;
            case "edit": this.addEditInteraction(newProps); break;
            case "stop": {
                this.removeDrawInteraction();
                this.removeEditInteraction();
            } break;
            case "replace": this.replaceFeatures(newProps); break;
            case "clean": this.clean(); break;
            default :
                return;
            }
        }
    }

    onDrawStart = () => {
        this.drawing = true;
    };

    onDrawCreated = (evt) => {
        this.drawing = false;
        const layer = evt.layer;
        // let drawn geom stay on the map
        let geoJesonFt = layer.toGeoJSON();
        let bounds;
        if (evt.layerType === "marker") {
            bounds = L.latLngBounds(geoJesonFt.geometry.coordinates, geoJesonFt.geometry.coordinates);
        } else {
            bounds = layer.getBounds();
        }
        let extent = this.boundsToOLExtent(bounds);
        let center = bounds.getCenter();
        center = [center.lng, center.lat];
        let radius = layer.getRadius ? layer.getRadius() : 0;
        let coordinates = geoJesonFt.geometry.coordinates;
        let projection = "EPSG:4326";
        let type = geoJesonFt.geometry.type;
        if (evt.layerType === "circle") {
            // Circle needs to generate path and needs to be projected before
            // When GeometryDetails update circle it's in charge to generete path
            // but for first time we need to do this!
            geoJesonFt.projection = "EPSG:4326";
            projection = "EPSG:3857";
            extent = CoordinatesUtils.reprojectBbox(extent, "EPSG:4326", projection);
            center = CoordinatesUtils.reproject(center, "EPSG:4326", projection);
            geoJesonFt.radius = radius;
            coordinates = CoordinatesUtils.calculateCircleCoordinates(center, radius, 100);
            center = [center.x, center.y];
            type = "Polygon";
        }
        // We always draw geoJson feature
        this.drawLayer.addData(geoJesonFt);
        // Geometry respect query form panel needs
        let geometry = {
            type: type,
            extent: extent,
            center: center,
            coordinates: coordinates,
            radius: radius,
            projection: projection
        };
        /*if (this.props.options.editEnabled) {
            let addedLayer = last(this.drawLayer.getLayers());
            addedLayer.on('edit', (e) => this.onUpdateGeom(e.target, this.props));
            addedLayer.on('moveend', (e) => this.onUpdateGeom(e.target, this.props));
            addedLayer.editing.enable();
        }*/
        if (this.props.options && this.props.options.stopAfterDrawing) {
            this.props.onChangeDrawingStatus('stop', this.props.drawMethod, this.props.drawOwner);
        }
        this.props.onEndDrawing(geometry, this.props.drawOwner);
    };

    onUpdateGeom = (feature, props) => {
        const newGeoJsonFt = this.convertFeaturesToGeoJson(feature, props);
        props.onGeometryChanged([newGeoJsonFt]);
    };

    render() {
        return null;
    }

    addLayer = (newProps) => {
        this.clean();

        let vector = L.geoJson(null, {
            pointToLayer: function(feature, latLng) {
                let center = CoordinatesUtils.reproject({x: latLng.lng, y: latLng.lat}, feature.projection || "EPSG:4326", "EPSG:4326");
                return L.circle(L.latLng(center.y, center.x), feature.radius || 5);
            },
            style: {
                color: '#ffcc33',
                opacity: 1,
                weight: 3,
                fillColor: '#ffffff',
                fillOpacity: 0.2,
                clickable: false
            }
        });
        this.props.map.addLayer(vector);
        // Immediatly draw passed features
        if (newProps.features && newProps.features.length > 0) {

            vector.addData(this.convertFeaturesPolygonToPoint(newProps.features, this.props.drawMethod));
        }
        this.drawLayer = vector;
    };

    addGeojsonLayer = ({features, projection}) => {
        this.clean();
        let geoJsonLayerGroup = L.geoJson(features, {style: defaultStyle, pointToLayer: (f, latLng) => {
            let center = CoordinatesUtils.reproject({x: latLng.lng, y: latLng.lat}, projection, "EPSG:4326");
            return L.marker(L.latLng(center.y, center.x));
        }});
        this.drawLayer = geoJsonLayerGroup.addTo(this.props.map);
    };


    replaceFeatures = (newProps) => {
        if (!this.drawLayer) {
            this.addGeojsonLayer({features: newProps.features, projection: newProps.options && newProps.options.featureProjection || "EPSG:4326"});
        } else {
            this.drawLayer.clearLayers();
            this.drawLayer.addData(this.convertFeaturesPolygonToPoint(newProps.features, this.props.drawMethod));
        }
    };

    addDrawInteraction = (newProps) => {
        /*if (!this.drawLayer) {
            this.addLayer(newProps);
        } else {
            this.drawLayer.clearLayers();
            this.addLayer(newProps);
            if (newProps.features && newProps.features.length > 0) {
                this.drawLayer.addData(this.convertFeaturesPolygonToPoint(newProps.features, this.props.drawMethod));
            }
        }*/
        this.addLayer(newProps);

        this.removeDrawInteraction();

        this.props.map.on('draw:created', this.onDrawCreated, this);
        this.props.map.on('draw:drawstart', this.onDrawStart, this);

        if (newProps.drawMethod === 'LineString' || newProps.drawMethod === 'Bearing' || newProps.drawMethod === 'MultiLineString') {
            this.drawControl = new L.Draw.Polyline(this.props.map, {
                shapeOptions: {
                    color: '#000000',
                    weight: 2,
                    fillColor: '#ffffff',
                    fillOpacity: 0.2
                },
                repeatMode: true
            });
        } else if (newProps.drawMethod === 'Polygon' || newProps.drawMethod === 'MultiPolygon') {
            this.drawControl = new L.Draw.Polygon(this.props.map, {
                shapeOptions: {
                    color: '#000000',
                    weight: 2,
                    fillColor: '#ffffff',
                    fillOpacity: 0.2,
                    dashArray: [5, 5],
                    guidelineDistance: 5
                },
                repeatMode: true
            });
        } else if (newProps.drawMethod === 'BBOX') {
            this.drawControl = new L.Draw.Rectangle(this.props.map, {
                draw: false,
                shapeOptions: {
                    color: '#000000',
                    weight: 2,
                    fillColor: '#ffffff',
                    fillOpacity: 0.2,
                    dashArray: [5, 5]
                },
                repeatMode: true
            });
        } else if (newProps.drawMethod === 'Circle') {
            this.drawControl = new L.Draw.Circle(this.props.map, {
                shapeOptions: {
                    color: '#000000',
                    weight: 2,
                    fillColor: '#ffffff',
                    fillOpacity: 0.2,
                    dashArray: [5, 5]
                },
                repeatMode: true
            });
        } else if (newProps.drawMethod === 'Point' || newProps.drawMethod === 'MultiPoint') {
            this.drawControl = new L.Draw.Marker(this.props.map, {
                shapeOptions: {
                    color: '#000000',
                    weight: 2,
                    fillColor: '#ffffff',
                    fillOpacity: 0.2
                },
                repeatMode: true
            });
        }

        // start the draw control
        this.drawControl.enable();
    };

    addEditInteraction = (newProps) => {
        this.addGeojsonLayer({features: newProps.features, projection: newProps.options && newProps.options.featureProjection || "EPSG:4326"});

        /*if (newProps.options.drawEnabled) {
            this.addDrawInteraction(newProps);
        }*/
        let allLayers = this.drawLayer.getLayers();
        allLayers.forEach(l => {
            l.on('edit', (e) => this.onUpdateGeom(e.target, newProps));
            l.on('moveend', (e) => this.onUpdateGeom(e.target, newProps));
            l.editing.enable();
        });

        this.editControl = new L.Control.Draw({
                edit: {
                    featureGroup: this.drawLayer,
                    poly: {
                        allowIntersection: false
                    },
                    edit: true
                },
                draw: {
                    polygon: {
                        allowIntersection: false,
                        showArea: true
                    }
                }
            });
    }

    removeDrawInteraction = () => {
        if (this.drawControl !== null && this.drawControl !== undefined) {
            // Needed if missing disable() isn't warking
            if (this.props.options && this.props.options.stopAfterDrawing) {
                this.drawControl.setOptions({repeatMode: false});
            }
            this.drawControl.disable();
            this.drawControl = null;
            this.props.map.off('draw:created', this.onDrawCreated, this);
            this.props.map.off('draw:drawstart', this.onDrawStart, this);
        }
    };

    removeEditInteraction = () => {
        if (this.drawLayer) {
            let allLayers = this.drawLayer.getLayers();
            allLayers.forEach(l => {
                l.off('edit');
                l.off('moveend');
                l.editing.disable();
            });
            this.editControl = null;
        }
    };

    clean = () => {
        this.removeEditInteraction();
        this.removeDrawInteraction();

        if (this.drawLayer) {
            this.drawLayer.clearLayers();
            this.props.map.removeLayer(this.drawLayer);
            this.drawLayer = null;
        }
    };

    boundsToOLExtent = (bounds) => {
        return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    };

    convertFeaturesPolygonToPoint = (features, method) => {
        return method === 'Circle' ? features.map((f) => {
            return {...f, type: "Point"};
        }) : features;

    };
    fromLeafletFeature = (feature) => {
        return feature;
    };

    convertFeaturesToGeoJson = (featureEdited, props) => {
        let geom;
        if (!isSimpleGeomType(props.drawMethod)) {
            let newFeatures = this.drawLayer.getLayers().map(f => f.toGeoJSON());
            geom = {
                type: props.drawMethod,
                coordinates: newFeatures.reduce((p, c) => {
                    return p.concat([c.geometry.coordinates]);
                }, [])
            };
        } else {
            geom = featureEdited.toGeoJSON().geometry;
        }
        return {geometry: geom, type: "Feature"};
    };
}


module.exports = DrawSupport;
