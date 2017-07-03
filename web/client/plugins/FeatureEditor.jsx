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
const BottomToolbar = require('../components/data/featuregrid/BottomToolbar');
const TopToolbar = require('../components/data/featuregrid/TopToolbar');
const {getPanels} = require('./featuregrid/panels/index');
const BorderLayout = require('../components/layout/BorderLayout');

const {getTitleSelector} = require('../selectors/featuregrid');
const {gridTools, gridEvents, pageEvents, toolbarEvents} = require('./featuregrid/index');

const FeatureDock = (props = {
    tools: {}
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
            header={<TopToolbar {...props.toolbarEvents} title={props.title}/>}
            columns={getPanels(props.tools)}
            footer={<BottomToolbar {...props.pageEvents} {...props.pagination} loading={props.featureLoading} totalFeatures={props.totalFeatures} resultSize={props.resultSize}/>
            }>
            <Grid
            key={"feature-grid-container"}
            columnSettings={props.attributes}
            {...props.gridEvents}
            describeFeatureType={props.describe}
            features={props.features}
            minHeight={600}
            tools={props.gridTools}
         /></BorderLayout>}
    </Dock>);
};
const selector = createSelector(
    getTitleSelector,
    state => get(state, "query.open"),
    (state) => ({
        describe: get(state, `query.featureTypes.${get(state, "query.filterObj.featureTypeName")}.original`),
        featureLoading: get(state, "query.featureLoading"),
        features: get(state, "query.result.features"),
        resultSize: get(state, "query.result.features.length"),
        totalFeatures: get(state, "query.result.totalFeatures"),
        pagination: get(state, "query.filterObj.pagination")
    }),
    state => get(state, `featuregrid.attributes`),
    state => get(state, "featuregrid.tools"),
    (title, open, results, attributes, tools) => ({
        title,
        open,
        ...results,
        attributes,
        tools
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
         featuregrid: require('../reducers/featuregrid')
     }
 };
