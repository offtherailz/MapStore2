const {head, get} = require('lodash');
const {layersSelector} = require('./layers');
const getLayerById = (state, id) => head(layersSelector(state).filter(l => l.id === id));
const getTitle = (layer = {}) => layer.title || layer.name;
const getSelectedId = state => get(state, "featuregrid.selectedLayer");
module.exports = {
  getTitleSelector: state => getTitle(
    getLayerById(
        state,
        getSelectedId(state)
    )
    )
};
