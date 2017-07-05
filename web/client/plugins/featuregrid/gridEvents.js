const {sort, selectFeatures, deselectFeatures, toggleSelection} = require('../../actions/featuregrid');
module.exports = {
    onGridSort: (sortBy, sortOrder) => sort(sortBy, sortOrder),
onRowsToggled: (rows, rowGetter) => toggleSelection(rows.map(r => rowGetter(r.rowIdx))),
    onRowsSelected: (rows, rowGetter) => selectFeatures(rows.map(r => rowGetter(r.rowIdx)), true),
    onRowsDeselected: (rows, rowGetter) => deselectFeatures(rows.map(r => rowGetter(r.rowIdx)))
};
