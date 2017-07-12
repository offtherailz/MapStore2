/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const ol = require('openlayers');
const {concat, head} = require('lodash');
const PropTypes = require('prop-types');
const assign = require('object-assign');
const uuid = require('uuid');
const {isSimpleGeomType, getSimpleGeomType} = require('../../../utils/MapUtils');

/**
 * Comment that allows to draw and edit geometries as (Point, LineString, Polygon, Circle, Multi(Polygon-LineString-Point)
*/

class DrawSupport extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        drawOwner: PropTypes.string,
        drawStatus: PropTypes.string,
        drawMethod: PropTypes.string,
        options: PropTypes.object,
        features: PropTypes.array,
        onChangeDrawingStatus: PropTypes.func,
        onGeometryChanged: PropTypes.func,
        onEndDrawing: PropTypes.func
    };

    static defaultProps = {
        map: null,
        drawOwner: null,
        drawStatus: null,
        drawMethod: null,
        features: null,
        options: {
            stopAfterDrawing: true
        },
        onChangeDrawingStatus: () => {},
        onGeometryChanged: () => {},
        onEndDrawing: () => {}
    };

    componentWillReceiveProps(newProps) {
        if (this.drawLayer) {
            this.updateFeatureStyles(newProps.features);
        }

        if (!newProps.drawStatus && this.selectInteraction) {
            this.selectInteraction.getFeatures().clear();
        }

        switch (newProps.drawStatus) {
            case "create": this.addLayer(newProps); break;
            case "start":/* only starts draw*/ this.addInteractions(newProps); break;
            case "edit": this.addDrawAndEditInteractions(newProps); break;
            case "stop": /* only stops draw*/ this.removeDrawInteraction(); break;
            case "replace": this.replaceFeatures(newProps); break;
            case "clean": this.clean(); break;
            case "cleanAndContinueDrawing": this.cleanAndContinueDrawing(); break;
            default : return;
        }
    }

    render() {
        return null;
    }

    updateFeatureStyles = (features) => {
        if (features && features.length > 0) {
            features.map(f => {
                if (f.style) {
                    let olFeature = this.toOlFeature(f);
                    if (olFeature) {
                        olFeature.setStyle(this.toOlStyle(f.style, f.selected));
                    }
                }
            });
        }
    };

    addLayer = (newProps, addInteraction) => {
        this.geojson = new ol.format.GeoJSON();
        this.drawSource = new ol.source.Vector();
        this.drawLayer = new ol.layer.Vector({
            source: this.drawSource,
            zIndex: 100000000,
            style: this.toOlStyle(newProps.style)
        });

        this.props.map.addLayer(this.drawLayer);

        if (addInteraction) {
            this.addInteractions(newProps);
        }

        this.addFeatures(newProps);
    };

    addFeatures = ({features, drawMethod, options}) => {
        features.forEach((g) => {
            const feature = new ol.Feature({
                geometry: this.createOLGeometry(g)
            });
            this.drawSource.addFeature(feature);
        });
        if (features.length === 0 && options.editEnabled) {
            const feature = new ol.Feature({
                geometry: this.createOLGeometry({type: drawMethod, coordinates: null})
            });
            this.drawSource.addFeature(feature);
        }
    };

    replaceFeatures = (newProps) => {
        if (!this.drawLayer) {
            this.addLayer(newProps, true);
        } else {
            this.drawSource.clear();
            this.addFeatures(newProps);
        }
    };

    addDrawInteraction = (drawMethod, startingPoint, maxPoints) => {
        if (this.drawInteraction) {
            this.removeDrawInteraction();
        }
        this.drawInteraction = new ol.interaction.Draw(this.drawPropertiesForGeometryType(drawMethod, maxPoints, this.drawSource));

        this.drawInteraction.on('drawstart', function(evt) {
            this.sketchFeature = evt.feature;
            if (this.selectInteraction) {
                this.selectInteraction.getFeatures().clear();
                this.selectInteraction.setActive(false);
            }
        }, this);

        this.drawInteraction.on('drawend', function(evt) {
            this.sketchFeature = evt.feature;
            this.sketchFeature.set('id', uuid.v1());
            const feature = this.fromOLFeature(this.sketchFeature, startingPoint);

            this.props.onEndDrawing(feature, this.props.drawOwner);
            if (this.props.options.stopAfterDrawing) {
                this.props.onChangeDrawingStatus('stop', this.props.drawMethod, this.props.drawOwner, this.props.features.concat([feature]));
            }
            if (this.selectInteraction) {
                // TODO update also the selected features
                this.addSelectInteraction();
                this.selectInteraction.setActive(true);
            }
        }, this);

        this.props.map.addInteraction(this.drawInteraction);
        this.setDoubleClickZoomEnabled(false);
    };

    handleDrawAndEdit = (drawMethod, startingPoint, maxPoints) => {
        if (this.drawInteraction) {
            this.removeDrawInteraction();
        }
        this.drawInteraction = new ol.interaction.Draw(this.drawPropertiesForGeometryType(getSimpleGeomType(drawMethod), maxPoints, isSimpleGeomType(drawMethod) ? this.drawSource : null ));
        this.drawInteraction.on('drawstart', function(evt) {
            this.sketchFeature = evt.feature;
            if (this.selectInteraction) {
                this.selectInteraction.getFeatures().clear();
                this.selectInteraction.setActive(false);
            }
        }, this);
        this.drawInteraction.on('drawend', function(evt) {
            this.sketchFeature = evt.feature;
            this.sketchFeature.set('id', uuid.v1());
            const feature = this.fromOLFeature(this.sketchFeature, startingPoint);

            if (!isSimpleGeomType(this.props.drawMethod)) {
                let geom = evt.feature.getGeometry();
                switch (this.props.drawMethod) {
                    case "MultiPoint": head(this.drawSource.getFeatures()).getGeometry().appendPoint(geom); break;
                    case "MultiLineString": head(this.drawSource.getFeatures()).getGeometry().appendLineString(geom); break;
                    case "MultiPolygon": {
                        let coords = geom.getCoordinates();
                        coords[0].push(coords[0][0]);
                        geom.setCoordinates(coords);
                        head(this.drawSource.getFeatures()).getGeometry().appendPolygon(geom);
                        break;
                    }
                    default: break;
                }
            }
            this.addModifyInteraction();
            this.props.onGeometryChanged([feature]);

            this.props.onEndDrawing(feature, this.props.drawOwner);
            if (this.props.options.stopAfterDrawing) {
                this.props.onChangeDrawingStatus('stop', this.props.drawMethod, this.props.drawOwner, this.props.features.concat([feature]));
            }
            if (this.selectInteraction) {
                // TODO update also the selected features
                this.addSelectInteraction();
                this.selectInteraction.setActive(true);
            }
        }, this);

        this.props.map.addInteraction(this.drawInteraction);
        this.setDoubleClickZoomEnabled(false);
    };

    drawPropertiesForGeometryType = (geometryType, maxPoints, source) => {
        let drawBaseProps = {
            source,
            type: /** @type {ol.geom.GeometryType} */ geometryType,
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(255, 255, 255, 0.2)'
                }),
                stroke: new ol.style.Stroke({
                    color: 'rgba(0, 0, 0, 0.5)',
                    lineDash: [10, 10],
                    width: 2
                }),
                image: new ol.style.Circle({
                    radius: 5,
                    stroke: new ol.style.Stroke({
                        color: 'rgba(0, 0, 0, 0.7)'
                    }),
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 255, 255, 0.2)'
                    })
                })
            }),
            features: new ol.Collection(),
            condition: ol.events.condition.always
        };
        let roiProps = {};
        switch (geometryType) {
            case "BBOX": {
                roiProps.type = "LineString";
                roiProps.maxPoints = 2;
                roiProps.geometryFunction = function(coordinates, geometry) {
                    let geom = geometry;
                    if (!geom) {
                        geom = new ol.geom.Polygon(null);
                    }
                    let start = coordinates[0];
                    let end = coordinates[1];
                    geom.setCoordinates(
                        [
                            [
                                start,
                                    [start[0], end[1]],
                                end,
                                [end[0],
                                    start[1]], start
                            ]
                        ]);
                    return geom;
                };
                break;
            }
            case "Circle": {
                roiProps.maxPoints = 100;
                roiProps.geometryFunction = ol.interaction.Draw.createRegularPolygon(roiProps.maxPoints);
                break;
            }
            case "Point": case "LineString": case "Polygon": case "MultiPoint": case "MultiLineString": case "MultiPolygon": {
                if (geometryType === "LineString") {
                    roiProps.maxPoints = maxPoints;
                }
                roiProps.type = geometryType;
                roiProps.geometryFunction = (coordinates, geometry) => {
                    let geom = geometry;
                    if (!geom) {
                        geom = this.createOLGeometry({type: geometryType, coordinates: null});
                    }
                    geom.setCoordinates(coordinates);
                    return geom;
                };
                break;
            }
            default : return {};
        }
        return assign({}, drawBaseProps, roiProps);
    };

    setDoubleClickZoomEnabled = (enabled) => {
        let interactions = this.props.map.getInteractions();
        for (let i = 0; i < interactions.getLength(); i++) {
            let interaction = interactions.item(i);
            if (interaction instanceof ol.interaction.DoubleClickZoom) {
                interaction.setActive(enabled);
                break;
            }
        }
    };

    updateFeatureExtent = (event) => {
        const movedFeatures = event.features.getArray();
        const updatedFeatures = this.props.features.map((f) => {
            const moved = head(movedFeatures.filter((mf) => this.fromOLFeature(mf).id === f.id));
            return moved ? assign({}, f, {
                geometry: moved.geometry,
                center: moved.center,
                extent: moved.extent,
                coordinate: moved.coordinates,
                radius: moved.radius
            }) : f;
        });

        this.props.onChangeDrawingStatus('replace', this.props.drawMethod, this.props.drawOwner, updatedFeatures);
    };

    addInteractions = (newProps) => {
        this.clean();
        if (!this.drawLayer) {
            this.addLayer(newProps);
        }
        this.addDrawInteraction(newProps.drawMethod, newProps.options.startingPoint, newProps.options.maxPoints);
        if (newProps.options && newProps.options.editEnabled) {
            this.addSelectInteraction();

            if (this.translateInteraction) {
                this.props.map.removeInteraction(this.translateInteraction);
            }

            this.translateInteraction = new ol.interaction.Translate({
                features: this.selectInteraction.getFeatures()
            });

            this.translateInteraction.on('translateend', this.updateFeatureExtent);
            this.props.map.addInteraction(this.translateInteraction);


            if (this.modifyInteraction) {
                this.props.map.removeInteraction(this.modifyInteraction);
            }

            this.modifyInteraction = new ol.interaction.Modify({
                features: this.selectInteraction.getFeatures()
            });

            this.props.map.addInteraction(this.modifyInteraction);
        }
        this.drawSource.clear();
        if (newProps.features.length > 0 ) {
            this.addFeatures(newProps);
        }
    };

    addDrawAndEditInteractions = (newProps) => {
        if (!this.drawLayer) {
            this.addLayer(newProps);
        } else {
            this.drawSource.clear();
            this.addFeatures(newProps);
        }
        if (newProps.options.editEnabled) {
            this.addModifyInteraction();
        }
        if (newProps.options.drawEnabled) {
            this.handleDrawAndEdit(newProps.drawMethod, newProps.options.startingPoint, newProps.options.maxPoints);
        }
    };

    addSelectInteraction = () => {
        if (this.selectInteraction) {
            this.props.map.removeInteraction(this.selectInteraction);
        }

        this.selectInteraction = new ol.interaction.Select({ layers: [this.drawLayer] });

        this.selectInteraction.on('select', () => {
            let features = this.props.features.map(f => {
                let selectedFeatures = this.selectInteraction.getFeatures().getArray();
                const selected = selectedFeatures.reduce((previous, current) => {
                    return current.get('id') === f.id ? true : previous;
                }, false);

                return assign({}, f, { selected: selected });
            });

            this.props.onChangeDrawingStatus('select', null, this.props.drawOwner, features);
        });

        this.props.map.addInteraction(this.selectInteraction);
    };

    removeDrawInteraction = () => {
        if (this.drawInteraction) {
            this.props.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
            this.sketchFeature = null;
            setTimeout(() => this.setDoubleClickZoomEnabled(true), 250);
        }
    };

    removeInteractions = () => {
        this.removeDrawInteraction();

        if (this.selectInteraction) {
            this.props.map.removeInteraction(this.drawInteraction);
        }

        if (this.modifyInteraction) {
            this.props.map.removeInteraction(this.modifyInteraction);
        }

        if (this.translateInteraction) {
            this.props.map.removeInteraction(this.translateInteraction);
        }
    };

    clean = () => {
        this.removeInteractions();

        if (this.drawLayer) {
            this.props.map.removeLayer(this.drawLayer);
            this.geojson = null;
            this.drawLayer = null;
            this.drawSource = null;
        }
    };

    cleanAndContinueDrawing = () => {
        if (this.drawLayer) {
            this.props.map.removeLayer(this.drawLayer);
            this.geojson = null;
            this.drawLayer = null;
            this.drawSource = null;
        }
    };

    fromOLFeature = (feature, startingPoint) => {
        let geometry = feature.getGeometry();
        let extent = geometry.getExtent();
        let center = ol.extent.getCenter(extent);
        let coordinates = geometry.getCoordinates();
        let radius;

        let type = geometry.getType();
        if (startingPoint) {
            coordinates = concat(startingPoint, coordinates);
            geometry.setCoordinates(coordinates);
        }

        if (this.props.drawMethod === "Circle") {
            radius = Math.sqrt(Math.pow(center[0] - coordinates[0][0][0], 2) + Math.pow(center[1] - coordinates[0][0][1], 2));
        }

        return assign({}, {
            id: feature.get('id'),
            type,
            extent,
            center,
            coordinates,
            radius,
            style: this.fromOlStyle(feature.getStyle()),
            projection: this.props.map.getView().getProjection().getCode()
        });
    };

    toOlFeature = (feature) => {
        return head(this.drawSource.getFeatures().filter((f) => f.get('id') === feature.id));
    };

    fromOlStyle = (olStyle) => {
        if (!olStyle) {
            return {};
        }

        return {
            fillColor: this.rgbToHex(olStyle.getFill().getColor()),
            fillTransparency: olStyle.getFill().getColor()[3],
            strokeColor: olStyle.getStroke().getColor(),
            strokeWidth: olStyle.getStroke().getWidth(),
            text: olStyle.getText().getText()
        };
    };

    toOlStyle = (style, selected) => {
        let color = style && style.fillColor ? style.fillColor : [255, 255, 255, 0.2];
        if (typeof color === 'string') {
            color = this.hexToRgb(color);
        }

        if (style && style.fillTransparency) {
            color[3] = style.fillTransparency;
        }

        let strokeColor = style && style.strokeColor ? style.strokeColor : '#ffcc33';
        if (selected) {
            strokeColor = '#4a90e2';
        }

        return new ol.style.Style({
            fill: new ol.style.Fill({
                color: color
            }),
            stroke: new ol.style.Stroke({
                color: strokeColor,
                width: style && style.strokeWidth ? style.strokeWidth : 2
            }),
            image: new ol.style.Circle({
                radius: style && style.strokeWidth ? style.strokeWidth : 5,
                fill: new ol.style.Fill({ color: style && style.strokeColor ? style.strokeColor : '#ffcc33' })
            }),
            text: new ol.style.Text({
                text: style && style.text ? style.text : '',
                fill: new ol.style.Fill({ color: style && style.strokeColor ? style.strokeColor : '#000' }),
                stroke: new ol.style.Stroke({ color: '#fff', width: 2 }),
                font: style && style.fontSize ? style.fontSize + 'px helvetica' : ''
            })
        });
    };

    hexToRgb = (hex) => {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;

        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.replace(shorthandRegex, function(m, r, g, b) {
            return r + r + g + g + b + b;
        }));
        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
    };

    componentToHex = (c) => {
        var hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };

    rgbToHex = (rgb) => {
        return "#" + this.componentToHex(rgb[0]) + this.componentToHex(rgb[1]) + this.componentToHex(rgb[2]);
    };

    addModifyInteraction = () => {
        if (this.modifyInteraction) {
            this.props.map.removeInteraction(this.modifyInteraction);
        }
        this.modifyInteraction = new ol.interaction.Modify({
                features: new ol.Collection(this.drawLayer.getSource().getFeatures())
            });
        this.modifyInteraction.on('modifyend', (e) => {
            let features = e.features.getArray().map((f) => this.fromOLFeature(f.clone(), null));
            this.props.onGeometryChanged(features);
        });
        this.props.map.addInteraction(this.modifyInteraction);
    }

    createOLGeometry = ({type, coordinates, radius, center}) => {
        let geometry;

        switch (type) {
            case "Point": { geometry = new ol.geom.Point(coordinates); break; }
            case "LineString": { geometry = new ol.geom.LineString(coordinates); break; }
            case "MultiPoint": { geometry = new ol.geom.MultiPoint(coordinates); break; }
            case "MultiLineString": { geometry = new ol.geom.MultiLineString(coordinates); break; }
            case "MultiPolygon": { geometry = new ol.geom.MultiPolygon(coordinates); break; }
            // defaults is Polygon
            default: { geometry = radius && center ?
                    ol.geom.Polygon.fromCircle(new ol.geom.Circle([center.x, center.y], radius), 100) : new ol.geom.Polygon(coordinates);
            }
        }
        return geometry;
    };
}
module.exports = DrawSupport;
