const {featureTypeToGridColumns, getToolColumns, getRow, getGridEvents, applyChanges, createNewAndEditingFilter} = require('../../../../utils/FeatureGridUtils');
const {compose, withPropsOnChange, withHandlers, defaultProps} = require('recompose');
const featuresToGrid = compose(
    defaultProps({
        columns: [],
        features: [],
        newFeatures: [],
        changes: {},
        focusOnEdit: true,
        editors: require('../editors')
    }),
    withPropsOnChange("showDragHandle", ({showDragHandle = false} = {}) => ({
        className: showDragHandle ? 'feature-grid-drag-handle-show' : 'feature-grid-drag-handle-hide'
    })),
    withPropsOnChange(
        ["features", "newFeatures", "changes"],
        props => ({
            rows: ( [...props.newFeatures, ...props.features] : props.features)
                .filter(props.focusOnEdit ? createNewAndEditingFilter(props.changes && Object.keys(props.changes).length > 0, props.newFeatures, props.changes) : () => true)
                .map(orig => {
                    const featureChanges = orig && props.changes && props.changes[orig.id] || {};
                    const result = applyChanges(orig, featureChanges);
                    return {...result,
                        get: key => {
                            return result.properties && result.properties[key] ? result.properties[key] : result[key];
                        }
                    };
                })
        })
    ),
    withPropsOnChange(
        ["features", "newFeatures", "changes", "focusOnEdit"],
        props => ({
            rowsCount: props.rows && props.rows.length || 0
        })
    ),
    withHandlers({rowGetter: props => i => getRow(i, props.rows)}),
    withPropsOnChange(
        ["describeFeatureType", "columnSettings", "tools", "actionOpts", "mode"],
        props => ({
            columns: getToolColumns(props.tools, props.rowGetter, props.describeFeatureType, props.actionOpts)
                .concat(featureTypeToGridColumns(props.describeFeatureType, props.columnSettings, props.mode === "EDIT", {
                    getEditor: ({localType=""} = {}) => props.editors[localType]
                }))
            })
    ),
    withPropsOnChange(
        ["gridOpts", "describeFeatureType", "actionOpts", "mode", "select"],
        props => {
            // bind proper events and setup the colums array
            // bind and get proper grid events from gridEvents object
            let {
                onRowsSelected = () => {},
                onRowsDeselected = () => {},
                onRowsToggled = () => {},
                ...gridEvents} = getGridEvents(props.gridEvents, props.rowGetter, props.describeFeatureType, props.actionOpts);

            // setup gridOpts setting app selection events binded
            let gridOpts = props.gridOpts;
            gridOpts = {
                ...gridOpts,
                enableCellSelect: props.mode === "EDIT",
                rowSelection: {
                    showCheckbox: props.mode === "EDIT",
                    selectBy: {
                        keys: {
                            rowKey: 'id',
                            values: props.select.map(f => f.id)
                        }
                    },
                    onRowsSelected,
                    onRowsDeselected
                }
            };

            // set selection by row click if checkbox are not present is enabled
            gridEvents.onRowClick = (rowIdx, row) => onRowsToggled([{rowIdx, row}]);

            return {
                ...gridEvents,
                ...gridOpts
            };
        }
    )
);
module.exports = {
    featuresToGrid
};
