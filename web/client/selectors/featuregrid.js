const {head, get} = require('lodash');
const {layersSelector} = require('./layers');
const getLayerById = (state, id) => head(layersSelector(state).filter(l => l.id === id));
const getTitle = (layer = {}) => layer.title || layer.name;
const getSelectedId = state => get(state, "featuregrid.selectedLayer");
const getCustomAttributeSettings = (state, att) => get(state, `featuregrid.attributes[${att.name || att.attribute}]`);
const {attributesSelector} = require('./query');
const selectedFeaturesSelector = state => state && state.featuregrid && state.featuregrid.select;
const changesSelector = state => state && state.featuregrid && state.featuregrid.changes;
const newFeaturesSelector = state => state && state.featuregrid && state.featuregrid.newFeatures;
const drawStatusSelector = state => state && state.featuregrid && state.featuregrid.drawStatus;
const selectedFeatureSelector = state => head(selectedFeaturesSelector(state));
const geomTypeSelectedFeatureSelector = state => selectedFeatureSelector(state) && selectedFeatureSelector(state).geometry && selectedFeatureSelector(state).geometry.type;
const {isSimpleGeomType} = require('../utils/MapUtils');
/* eslint-disable */
const toChangesMap = (changesArray) => changesArray.reduce((changes, c) => ({
    ...changes,
    [c.id]: {
        ...changes[c.id],
        ...c.updated
    }
}), {});
/* eslint-enable */

const hasGeometrySelectedFeature = (state) => {
    let ft = selectedFeatureSelector(state);
    if (ft) {
        let changes = toChangesMap(changesSelector(state));
        if (changes[ft.id] && changes[ft.id].geometry === null) {
            return false;
        }
        return true;
    }
    return false;
};

module.exports = {
  getTitleSelector: state => getTitle(
    getLayerById(
        state,
        getSelectedId(state)
    )),
    getCustomizedAttributes: state => {
        return (attributesSelector(state) || []).map(att => {
            const custom = getCustomAttributeSettings(state, att);
            if (custom) {
                return {
                    ...att,
                    ...custom
                };
            }
            return att;
        });
    },
    modeSelector: state => state && state.featuregrid && state.featuregrid.mode,
    selectedFeaturesSelector,
    selectedFeatureSelector,
    selectedFeaturesCount: state => (selectedFeaturesSelector(state) || []).length,
    changesSelector,
    toChangesMap,
    changesMapSelector: state => toChangesMap(changesSelector(state)),
    hasChangesSelector: state => changesSelector(state) && changesSelector(state).length > 0,
    hasGeometrySelector: state => hasGeometrySelectedFeature(state),
    newFeaturesSelector,
    isCreatingSelector: state => newFeaturesSelector(state).length === 0,
    drawStatusSelector,
    geomTypeSelectedFeatureSelector,
    isSimpleGeomSelector: state => isSimpleGeomType(geomTypeSelectedFeatureSelector(state))
};
