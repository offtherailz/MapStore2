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
const {resultsSelector, describeSelector} = require('../selectors/query');
const {modeSelector, changesSelector, newFeaturesSelector, hasChangesSelector} = require('../selectors/featuregrid');
const { toChangesMap, createNewAndEditingFilter} = require('../utils/FeatureGridUtils');
const {getPanels, getHeader, getFooter, getDialogs} = require('./featuregrid/panels/index');
const BorderLayout = require('../components/layout/BorderLayout');
const EMPTY_ARR = [];
const EMPTY_OBJ = [];
const {gridTools, gridEvents, pageEvents, toolbarEvents} = require('./featuregrid/index');

const FeatureDock = (props = {
    tools: EMPTY_OBJ,
    dialogs: EMPTY_OBJ,
    select: EMPTY_ARR
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
            {getDialogs(props.tools)}
            <Grid
                changes={props.changes}
                editable={props.mode === "EDIT"}
                gridOpts={{
                    rowSelection: {
                        showCheckbox: props.mode === "EDIT",
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
    state => get(state, "featuregrid.attributes"),
    state => get(state, "featuregrid.tools"),
    state => get(state, 'featuregrid.select') || [],
    modeSelector,
    changesSelector,
    newFeaturesSelector,
    hasChangesSelector,
    () => true, // TODO add focusOnEdit selector and state to configure
    (open, features = EMPTY_ARR, describe, attributes, tools, select, mode, changes, newFeatures = EMPTY_ARR, hasChanges, focusOnEdit) => ({
        open,
        features: (newFeatures.length > 0 ? [...newFeatures, ...features] : features).filter(focusOnEdit ? createNewAndEditingFilter(hasChanges, newFeatures, changes) : () => true),
        describe,
        attributes,
        tools,
        select,
        mode,
        changes: toChangesMap(changes)
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
