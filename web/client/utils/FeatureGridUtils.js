
const {getFeatureTypeProperties, isGeometryType, isValidValueForPropertyName, getPropertyDesciptor} = require('./ogc/WFS/base');
const getRow = (i, rows) => rows[i];
const getDefaultFeatureProjection = () => "EPSG:4326";
const {changeDrawingStatus} = require('../actions/draw');

const {isLeaflet} = require('../selectors/maptype');
const {selectedFeatureSelector} = require('../selectors/featuregrid');
const {reprojectGeoJson} = require('./CoordinatesUtils');
const {isSimpleGeomType, getSimpleGeomType} = require('./MapUtils');
const assign = require('object-assign');
const Rx = require('rxjs');
module.exports = {
    featureTypeToGridColumns: (describe, columnSettings = {}, editing, {getEditor = () => {}} = {}) =>
        (getFeatureTypeProperties(describe) || []).filter( e => !isGeometryType(e)).filter(e => !(columnSettings[e.name] && columnSettings[e.name].hide)).map( (desc) => ({
                sortable: true,
                key: desc.name,
                width: 200,
                name: desc.name,
                resizable: true,
                editable: editing,
                editor: getEditor(desc)
        })),
    getRow,
    /**
     * Create a column from the configruation. Maps the events to call a function with the whole property
     * @param  {array} toolColumns Array of the tools configurations
     * @param  {array} rows        Data rows
     * @return {array}             Array of the columns to use in react-data-grid, with proper event bindings.
     */
    getToolColumns: (toolColumns = [], rowGetter = () => {}, describe, actionOpts) => toolColumns.map(tool => ({
        ...tool,
        events: tool.events && Object.keys(tool.events).reduce( (events, key) => ({
            ...events,
            [key]: (evt, opts) => tool.events[key](rowGetter(opts.rowIdx), opts, describe, actionOpts)
        }), {})
        })
    ),
    /**
     * Maps every grid event to a function that passes all the arguments, plus the rowgetter, describe and actionOpts passed
     * @param  {Object} [gridEvents={}] The functions to call
     * @param  {function} rowGetter     the method to retrieve the feature
     * @param  {object} describe        the describe feature type
     * @param  {object} actionOpts      some options
     * @return {object}                 The events with the additional parameters
     */
    getGridEvents: (gridEvents = {}, rowGetter, describe, actionOpts) => Object.keys(gridEvents).reduce((events, currentEventKey) => ({
        ...events,
        [currentEventKey]: (...args) => gridEvents[currentEventKey](...args, rowGetter, describe, actionOpts)
    }), {}),
    isProperty: (k, d) => !!getPropertyDesciptor(k, d),
    isValidValueForPropertyName,
    getDefaultFeatureProjection: getDefaultFeatureProjection(),
    drawSupportStartEditingGeometry: (state) => {
        const defaultFeatureProj = getDefaultFeatureProjection();
        let drawOptions = {
            featureProjection: defaultFeatureProj,
            stopAfterDrawing: false,
            editEnabled: true,
            drawEnabled: false
        };
        let newFeatures;
        let feature = selectedFeatureSelector(state); // just to be sure there is one feature selected for the editing
        if (!isLeaflet(state)) {
            feature = reprojectGeoJson(feature, defaultFeatureProj, state.map.present.projection);
        } else {
            if (!isSimpleGeomType(feature.geometry.type)) {
                newFeatures = feature.geometry.coordinates.map((coords, idx) => {
                    return assign({}, {
                            type: 'Feature',
                            properties: {...feature.properties},
                            id: feature.geometry.type + idx,
                            geometry: {
                                coordinates: coords,
                                type: getSimpleGeomType(feature.geometry.type)
                            }
                        });
                });
                return Rx.Observable.of(changeDrawingStatus("edit", feature.geometry.type, "featureGrid", isLeaflet(state) ? [{type: "FeatureCollection", features: newFeatures}] : [feature.geometry], drawOptions));
            }
        }
        return Rx.Observable.of(changeDrawingStatus("edit", feature.geometry.type, "featureGrid", isLeaflet(state) ? [feature] : [feature.geometry], drawOptions));
    },
    drawSupportReset: () => {
        return Rx.Observable.of(changeDrawingStatus("clean", "", "featureeditor", [], {}));
    }
};
