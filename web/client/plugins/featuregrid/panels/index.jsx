const React = require('react');
const {connect} = require('react-redux');
const {createSelector} = require('reselect');
const {getTitleSelector, paginationInfoSelector, featureLoadingSelector} = require('../../../selectors/featuregrid');
const {toolbarEvents, pageEvents} = require('../index');
const ViewTools = connect( () => ({}),
    toolbarEvents
)(require('../../../components/data/featuregrid/toolbars/ViewTools'));


const Header = connect(
    createSelector(getTitleSelector, (title) => ({title})), {
        onClose: toolbarEvents.onClose
    }
)(require('../../../components/data/featuregrid/Header'));
// loading={props.featureLoading} totalFeatures={props.totalFeatures} resultSize={props.resultSize}/
const Footer = connect(createSelector(paginationInfoSelector, featureLoadingSelector, (pagination, loading) => ({
    ...pagination,
    loading: loading.featureLoading
})),
    pageEvents
)(require('../../../components/data/featuregrid/Footer'));

const panels = {
    settings: require('./AttributeSelector')
};
const panelDefaultProperties = {
    settings: {
        style: {overflow: "auto", flex: "0 0 12em", boxShadow: "inset 0px 0px 10px lightgrey"}
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
        return <Header toolbar={<ViewTools />} ><ViewTools /></Header>;
    },
    getFooter: () => {
        return <Footer />;

    }
};
