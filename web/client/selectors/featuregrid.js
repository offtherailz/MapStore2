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
    )),
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
    },
    resultsSelector: (state) => ({
        features: get(state, "query.result.features")
    }),
    paginationInfoSelector: (state) => ({
        startIndex: get(state, "query.filterObj.pagination.startIndex"),
        maxFeatures: get(state, "query.filterObj.pagination.maxFeatures"),
        resultSize: get(state, "query.result.features.length"),
        totalFeatures: get(state, "query.result.totalFeatures")
    }),
    describeSelector: (state) => ({
        describe: get(state, `query.featureTypes.${get(state, "query.filterObj.featureTypeName")}.original`)
    }),
    featureLoadingSelector: (state) => ({
        featureLoading: get(state, "query.featureLoading")
    })
};
