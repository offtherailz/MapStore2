const {get} = require('lodash');
module.exports = {
    wfsURL: state => state && state.query && state.query.searchUrl,
    wfsFilter: state => state && state.query && state.query.filterObj,
    attributesSelector: state => get(state, `query.featureTypes.${get(state, "query.filterObj.featureTypeName")}.attributes`),
    resultsSelector: (state) => get(state, "query.result.features"),
    paginationInfo: {
        startIndex: (state) => get(state, "query.filterObj.pagination.startIndex"),
        maxFeatures: (state) => get(state, "query.filterObj.pagination.maxFeatures"),
        resultSize: (state) =>get(state, "query.result.features.length"),
        totalFeatures: (state) => get(state, "query.result.totalFeatures")
    },
    describeSelector: (state) => get(state, `query.featureTypes.${get(state, "query.filterObj.featureTypeName")}.original`),
    featureLoadingSelector: (state) => get(state, "query.featureLoading")
};
