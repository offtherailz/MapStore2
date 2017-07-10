const React = require('react');
const {connect} = require('react-redux');
const {bindActionCreators} = require('redux');
const {createSelector, createStructuredSelector} = require('reselect');
const {paginationInfo, featureLoadingSelector} = require('../../../selectors/query');
const {getTitleSelector, modeSelector, selectedFeaturesCount} = require('../../../selectors/featuregrid');
const {toolbarEvents, pageEvents} = require('../index');

const Toolbar = connect(
    createStructuredSelector({
        mode: modeSelector,
        selectedCount: selectedFeaturesCount
    }),
    (dispatch) => ({events: bindActionCreators(toolbarEvents, dispatch)})
)(require('../../../components/data/featuregrid/toolbars/Toolbar'));


const Header = connect(
    createSelector(
        getTitleSelector,
        (title) => ({title})),
    {
        onClose: toolbarEvents.onClose
    }
)(require('../../../components/data/featuregrid/Header'));

// loading={props.featureLoading} totalFeatures={props.totalFeatures} resultSize={props.resultSize}/
const Footer = connect(
        createSelector(
            createStructuredSelector(paginationInfo),
            featureLoadingSelector,
            (pagination, loading) => ({
                ...pagination,
                loading
            })),
    pageEvents
)(require('../../../components/data/featuregrid/Footer'));

const panels = {
    settings: require('./AttributeSelector')
};
const panelDefaultProperties = {
    settings: {
        style: {overflow: "auto", flex: "0 0 12em", boxShadow: "inset 0px 0px 10px rgba(0, 0, 0, 0.4)"}
    }
};
module.exports = {
    getPanels: (tools = {}) =>
        Object.keys(tools)
            .filter(t => tools[t] && panels[t])
            .map(t => {
                const Panel = panels[t];
                return <Panel {...(panelDefaultProperties[t] || {})} />;
            }),
    getHeader: () => {
        return <Header ><Toolbar /></Header>;
    },
    getFooter: () => {
        return <Footer />;

    }
};
