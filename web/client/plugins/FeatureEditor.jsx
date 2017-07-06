/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const {connect} = require('react-redux');
const {createSelector} = require('reselect');
const {bindActionCreators} = require('redux');
const {get} = require('lodash');
const Dock = require('react-dock').default;
const Grid = require('../components/data/featuregrid/FeatureGrid');
const {resultsSelector, describeSelector} = require('../selectors/featuregrid');
const {getPanels, getHeader, getFooter} = require('./featuregrid/panels/index');
const BorderLayout = require('../components/layout/BorderLayout');

const {gridTools, gridEvents, pageEvents, toolbarEvents} = require('./featuregrid/index');

const FeatureDock = (props = {
    tools: {},
    select: []
}) => {
    const dockProps = {
        dimMode: "none",
        dockSize: 0.35,
        fluid: true,
        isVisible: props.open,
        maxDockSize: 1.0,
        minDockSize: 0.1,
        position: "bottom",
        setDockSize: () => {},
        toolbar: null,
        toolbarHeight: 40,
        wrappedComponent: {},
        toolbarEvents: {},
        zIndex: 1030
    };
    // columns={[<aside style={{backgroundColor: "red", flex: "0 0 12em"}}>column-selector</aside>]}
    return (<Dock {...dockProps} >
        {props.open &&
        <BorderLayout
            key={"feature-grid-container"}
            header={getHeader()}
            columns={getPanels(props.tools)}
            footer={getFooter()}>
            <Grid
                gridOpts={{
                    rowSelection: {
                        showCheckbox: false,
                        selectBy: {
                            keys: {
                                rowKey: 'id',
                                values: props.select.map(f => f.id)
                            }
                        }
                    }
                }}
                key={"feature-grid-container"}
                columnSettings={props.attributes}
                gridEvents={props.gridEvents}
                describeFeatureType={props.describe}
                features={props.features}
                minHeight={600}
                tools={props.gridTools}
         /></BorderLayout>}
    </Dock>);
};
const selector = createSelector(
    state => get(state, "query.open"),
    resultsSelector,
    describeSelector,
    state => get(state, `featuregrid.attributes`),
    state => get(state, "featuregrid.tools"),
    state => get(state, 'featuregrid.select') || [],
    (open, results, describe, attributes, tools, select) => ({
        open,
        ...results,
        ...describe,
        attributes,
        tools,
        select
    })
);
const EditorPlugin = connect(selector, (dispatch) => ({
    gridEvents: bindActionCreators(gridEvents, dispatch),
    pageEvents: bindActionCreators(pageEvents, dispatch),
    toolbarEvents: bindActionCreators(toolbarEvents, dispatch),
    gridTools: gridTools.map((t) => ({
        ...t,
        events: bindActionCreators(t.events, dispatch)
    }))
}))(FeatureDock);
module.exports = {
     FeatureEditorPlugin: EditorPlugin,
     epics: require('../epics/featuregrid'),
     reducers: {
         featuregrid: require('../reducers/featuregrid'),
         highlight: require('../reducers/featuregrid')
     }
 };
