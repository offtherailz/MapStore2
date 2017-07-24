const {get} = require('lodash');


module.exports = {
    clear: () => [],
    selectedFeatures: (state) => get(state, "featuregrid.select")

};
