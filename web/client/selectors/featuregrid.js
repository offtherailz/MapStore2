const {head, get} = require('lodash');
const {layersSelector} = require('./layers');
const getLayerById = (state, id) => head(layersSelector(state).filter(l => l.id === id));
const getTitle = (layer = {}) => layer.title || layer.name;
const getSelectedId = state => get(state, "featuregrid.selectedLayer");
const getCustomAttributeSettings = (state, att) => get(state, `featuregrid.attributes[${att.name || att.attribute}]`);
const {attributesSelector} = require('./query');
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
    selectedFeaturesCount: (state) => state && state.featuregrid && state.featuregrid.select && state.featuregrid.select.length || 0
};
