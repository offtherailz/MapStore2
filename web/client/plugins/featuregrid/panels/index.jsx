const React = require('react');
const {connect} = require('react-redux');
const {bindActionCreators} = require('redux');
const {createSelector, createStructuredSelector} = require('reselect');
const {paginationInfo, featureLoadingSelector} = require('../../../selectors/query');
const {getTitleSelector, modeSelector, selectedFeaturesCount, hasChangesSelector, hasGeometrySelector, isSimpleGeomSelector, hasNewFeaturesSelector, isDrawingSelector} = require('../../../selectors/featuregrid');
const {deleteFeatures, toggleTool, clearAndClose} = require('../../../actions/featuregrid');
const {closeResponse} = require('../../../actions/wfsquery');

const {toolbarEvents, pageEvents} = require('../index');
const Toolbar = connect(
    createStructuredSelector({
        mode: modeSelector,
        hasChanges: hasChangesSelector,
        hasNewFeatures: hasNewFeaturesSelector,
        hasGeometry: hasGeometrySelector,
        isDrawing: isDrawingSelector,
        isSimpleGeom: isSimpleGeomSelector,
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
const DeleteDialog = connect(
    createSelector(selectedFeaturesCount, (count) => ({count})), {
    onClose: () => toggleTool("deleteConfirm"),
    onConfirm: () => deleteFeatures()
})(require('../../../components/data/featuregrid/dialog/ConfirmDelete'));
const ClearDialog = connect(
    createSelector(selectedFeaturesCount, (count) => ({count})), {
    onClose: () => toggleTool("clearConfirm"),
    onConfirm: () => clearAndClose()
})(require('../../../components/data/featuregrid/dialog/ConfirmClear'));
const FeatureCloseDialog = connect(
    createSelector(selectedFeaturesCount, (count) => ({count})), {
    onClose: () => toggleTool("featureCloseConfirm"),
    onConfirm: () => closeResponse()
})(require('../../../components/data/featuregrid/dialog/ConfirmFeatureClose'));

const panels = {
    settings: require('./AttributeSelector')
};

const dialogs = {
    deleteConfirm: DeleteDialog,
    featureCloseConfirm: FeatureCloseDialog,
    clearConfirm: ClearDialog
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
                return <Panel key={t} {...(panelDefaultProperties[t] || {})} />;
            }),
    getHeader: () => {
        return <Header ><Toolbar /></Header>;
    },
    getFooter: (props) => {
        return (props.focusOnEdit && props.hasChanges || props.newFeatures.length > 0) ? null : <Footer />;
    },
    getDialogs: (tools = {}) => {
        return Object.keys(tools)
            .filter(t => tools[t] && dialogs[t])
            .map(t => {
                const Dialog = dialogs[t];
                return <Dialog key={t} />;
            });
    }
};
