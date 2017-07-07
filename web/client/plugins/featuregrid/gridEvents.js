const {sort, selectFeatures, deselectFeatures, toggleSelection} = require('../../actions/featuregrid');
module.exports = {
    onGridSort: (sortBy, sortOrder) => sort(sortBy, sortOrder),
    onGridRowsUpdated: ({fromRow, toRow, updated}) => ({type: "FEATURES_MODIFIED", fromRow, toRow, updated}),
    onRowsToggled: (rows, rowGetter) => toggleSelection(rows.map(r => rowGetter(r.rowIdx))),
    onRowsSelected: (rows, rowGetter) => selectFeatures(rows.map(r => rowGetter(r.rowIdx)), true),
    onRowsDeselected: (rows, rowGetter) => deselectFeatures(rows.map(r => rowGetter(r.rowIdx)))
};
