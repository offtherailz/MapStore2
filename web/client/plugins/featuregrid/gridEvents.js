const {sort} = require('../../actions/featuregrid');

module.exports = {
    onGridSort: (sortBy, sortOrder) => sort(sortBy, sortOrder)
};
