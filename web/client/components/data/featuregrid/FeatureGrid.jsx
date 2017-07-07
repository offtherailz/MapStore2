/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const PropTypes = require('prop-types');
const AdaptiveGrid = require('../../misc/AdaptiveGrid');

const {featureTypeToGridColumns, getToolColumns, getRow, getGridEvents} = require('../../../utils/FeatureGridUtils');

/**
 * A component that gets the describeFeatureType and the features to display
 * attributes
 * @class
 * @memberof components.data.featuregrid
 * @prop {geojson[]} features array of geojson features
 * @prop {object} describeFeatureType the describeFeatureType in json format
 * @prop {Component} gridComponent the grid component, if different from AdaptiveGrid
 * @prop {object} gridOptions to pass to the grid
 * @prop {object} gridEvents an object with events for the grid. Note: onRowsSelected, onRowsDeselected and onRowsToggled will be associated automatically from this object
 * to the rowSelection tool. If checkbox are enabled, onRowsSelected and onRowsDeselected will be triggered. If showCheckbox is false, onRowsToggled will be triggered.
 * @prop {object[]} tools. a list of tools. the format is the react-data-grid column format but with the following differences:
 * - The events are automatically binded to call the related callback with the feature as first parameter, second argument is the same, no original event is passed. describeFeatureType as third
 */
class FeatureGrid extends React.Component {
    static propTypes = {
        gridOpts: PropTypes.object,
        updates: PropTypes.object,
        selectBy: PropTypes.object,
        features: PropTypes.array,
        editable: PropTypes.bool,
        gridComponent: PropTypes.func,
        describeFeatureType: PropTypes.object,
        columnSettings: PropTypes.object,
        gridOptions: PropTypes.object,
        actionOpts: PropTypes.object,
        tools: PropTypes.array,
        gridEvents: PropTypes.object
    };
    static childContextTypes = {
        shouldHighlight: React.PropTypes.func
    };
    static defaultProps = {
        gridComponent: AdaptiveGrid,
        updates: {},
        gridEvents: {},
        gridOpts: {},
        describeFeatureType: {},
        columnSettings: {},
        features: [],
        tools: [],
        editable: false
    };
    getChildContext() {
        return {
            shouldHighlight: () => {
                return true;/* this.state.updates.hasOwnProperty(id) &&
                    this.state.updates[id].hasOwnProperty(key);*/
            }
        };
    }
    render() {
        const Grid = this.props.gridComponent;
        const rows = this.props.features;
        const rowGetter = (i) => {
            let feature = {...getRow(i, rows)};
            feature.get = key => feature.properties && feature.properties[key] ? feature.properties[key] : feature[key];
            return feature;
        };
        // bind proper events and setup the colums array
        const columns = getToolColumns(this.props.tools, rowGetter, this.props.describeFeatureType, this.props.actionOpts)
            .concat(featureTypeToGridColumns(this.props.describeFeatureType, this.props.columnSettings, this.props.editable));
        // bind and get proper grid events from gridEvents object
        let {
            onRowsSelected = () => {},
            onRowsDeselected = () => {},
            onRowsToggled = () => {},
            ...gridEvents} = getGridEvents(this.props.gridEvents, rowGetter, this.props.describeFeatureType, this.props.actionOpts);

        // setup gridOpts setting app selection events binded
        let {rowSelection, ...gridOpts} = this.props.gridOpts;

        gridOpts = {
            ...gridOpts,
            rowSelection: rowSelection ? {
                ...rowSelection,
                onRowsSelected,
                onRowsDeselected
            } : null
        };

        // set selection by row click if checkbox are not present is enabled
        if (rowSelection) {
            gridEvents.onRowClick = (rowIdx, row) => onRowsToggled([{rowIdx, row}]);
        }
        return (<Grid
          enableCellSelect={this.props.editable}
          selectBy={this.props.selectBy}
          {...gridEvents}
          {...gridOpts}
          columns={columns}
          minHeight={600}
          rowGetter={rowGetter}
          rowsCount={rows.length}
        />);
    }
}
module.exports = FeatureGrid;
