/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const PropTypes = require('prop-types');
const React = require('react');
const axios = require('axios');
const ol = require('openlayers');
const {isEqual, find, castArray} = require('lodash');
const {parseStyles} = require('./VectorStyle');
const {transformPolygonToCircle} = require('../../../utils/DrawSupportUtils');
const {createStylesAsync} = require('../../../utils/VectorStyleUtils');
const CoordinatesUtils = require('../../../utils/CoordinatesUtils');


class Feature extends React.Component {
    static propTypes = {
        type: PropTypes.string,
        layerStyle: PropTypes.object,
        style: PropTypes.object,
        properties: PropTypes.object,
        crs: PropTypes.string,
        container: PropTypes.object, // TODO it must be a ol.layer.vector (maybe pass the source is more correct here?)
        features: PropTypes.array,
        geometry: PropTypes.object, // TODO check for geojson format for geometry
        msId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        featuresCrs: PropTypes.string
    };

    static defaultProps = {
        featuresCrs: "EPSG:4326"
    };

    componentDidMount() {
        this.addFeatures(this.props);
    }
    shouldComponentUpdate(nextProps) {
        // TODO check if shallow comparison is enough properties and geometry
        return !isEqual(nextProps.properties, this.props.properties) || !isEqual(nextProps.geometry, this.props.geometry) || (nextProps.features !== this.props.features) || (nextProps.style !== this.props.style) || !isEqual(nextProps.crs, this.props.crs);
    }

    componentWillUpdate(nextProps) {
        // TODO check if shallow comparison is enough properties and geometry
        if (!isEqual(nextProps.properties, this.props.properties) || !isEqual(nextProps.geometry, this.props.geometry) || (nextProps.features !== this.props.features) || (nextProps.style !== this.props.style) || !isEqual(newProps.crs, this.props.crs))) {

            this.removeFromContainer();
            this.addFeatures(nextProps);
        }
    }

    componentWillUnmount() {
        this.removeFromContainer();
    }

    render() {
        return null;
    }

    addFeatures = (props) => {
        const format = new ol.format.GeoJSON();
        let ftGeometry = null;
        let canRender = false;

        if (props.type === "FeatureCollection") {
            ftGeometry = {features: props.features};
            canRender = !!(props.features);
        } else {
            // if type is geometryCollection or a simple geometry, the data will be in geometry prop
            ftGeometry = {geometry: props.geometry};
            canRender = !!(props.geometry && (props.geometry.geometries || props.geometry.coordinates));
        }

        if (props.container && canRender) {
            this._feature = format.readFeatures(
                CoordinatesUtils.reprojectGeoJson({
                        type: props.type,
                        properties: props.properties,
                        id: props.msId,
                        ...ftGeometry
                    },
                    props.featuresCrs,
                    props.crs
                )
            );
            this._feature.map(f => {
                let newF = f;
                if (f.getProperties().isCircle) {
                    newF = transformPolygonToCircle(f, props.crs || 'EPSG:3857');
                    newF.setGeometry(newF.getGeometry().transform(props.crs || 'EPSG:3857', props.featuresCrs));

                }
                return newF;
            }).forEach(
                (f) => f.getGeometry().transform(props.featuresCrs, props.crs || 'EPSG:3857'));

            if (props.style && (props.style !== props.layerStyle)) {
                this._feature.forEach((f) => {
                    let promises = [];
                    let geoJSONFeature = {};
                    if ( props.type === "FeatureCollection") {
                        geoJSONFeature = find(props.features, (ft) => ft.properties.id === f.getProperties().id);
                        promises = createStylesAsync(castArray(geoJSONFeature.style));
                    } else {
                        // TODO Check if this works, it should be a normal geojson Feature
                        promises = createStylesAsync(castArray(props.style));
                        geoJSONFeature = {
                            type: props.type,
                            geometry: props.geometry,
                            properties: props.properties,
                            style: props.style
                        };
                    }

                    axios.all(promises).then((styles) => {
                        f.setStyle(() => parseStyles({...geoJSONFeature, style: styles}));
                    });
                });
            }
            props.container.getSource().addFeatures(this._feature);
        }
    };

    removeFromContainer = () => {
        if (this._feature) {
            if (Array.isArray(this._feature)) {
                const layersSource = this.props.container.getSource();
                this._feature.map((feature) => {
                    let featureId = feature.getId();
                    if (featureId === undefined || !layersSource.getFeatureById(featureId)) {
                        layersSource.removeFeature(feature);
                    } else {
                        layersSource.removeFeature(layersSource.getFeatureById(featureId));
                    }
                });
            } else {
                this.props.container.getSource().removeFeature(this._feature);
            }
        }
    };
}

module.exports = Feature;
