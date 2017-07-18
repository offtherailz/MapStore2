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
const changedGeometriesSelector = state => state && state.draw && state.draw.tempFeatures;
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
    modeSelector: (state) => state && state.featuregrid && state.featuregrid.mode,
    selectedFeaturesSelector,
    selectedFeatureSelector,
    selectedFeaturesCount: state => (selectedFeaturesSelector(state) || []).length,
    changesSelector,
    toChangesMap,
    changesMapSelector: (state) => toChangesMap(changesSelector(state)),
    hasChangesSelector: state => changesSelector(state) && changesSelector(state).length > 0,
    hasGeometrySelector: state => selectedFeatureSelector(state) && !!selectedFeatureSelector(state).geometry,
    newFeaturesSelector: state => newFeaturesSelector(state),
    isCreatingSelector: state => newFeaturesSelector(state).length === 0,
    changedGeometriesSelector: state => changedGeometriesSelector(state),
    isEditingGeomSelector: state => changedGeometriesSelector(state).length > 0,
    geomTypeSelectedFeatureSelector: state => geomTypeSelectedFeatureSelector(state),
    isSimpleGeomSelector: state => isSimpleGeomType(geomTypeSelectedFeatureSelector(state))
};
