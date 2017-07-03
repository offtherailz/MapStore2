const {head, get} = require('lodash');
const {layersSelector} = require('./layers');
const getLayerById = (state, id) => head(layersSelector(state).filter(l => l.id === id));
const getTitle = (layer = {}) => layer.title || layer.name;
const getSelectedId = state => get(state, "featuregrid.selectedLayer");
const getCustomAttributeSettings = (state, att) => get(state, `featuregrid.attributes[${att.name || att.attribute}]`);
module.exports = {
  getTitleSelector: state => getTitle(
    getLayerById(
        state,
        getSelectedId(state)
    )
    ),
    getCustomizedAttributes: state => {
        return (get(state, `query.featureTypes.${get(state, "query.filterObj.featureTypeName")}.attributes`) || []).map(att => {
            const custom = getCustomAttributeSettings(state, att);
            if (custom) {
                return {
                    ...att,
                    ...custom
                };
            }
            return att;
        });
    }
};
