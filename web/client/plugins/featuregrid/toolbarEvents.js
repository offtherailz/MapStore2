const {toggleControl} = require('../../actions/controls');
const {toggleTool, toggleEditMode, toggleViewMode, saveChanges, createNewFeatures, startEditingFeature, startDrawingFeature, deleteGeometry} = require('../../actions/featuregrid');

module.exports = {
    createFeature: () => createNewFeatures([{}]),
    saveChanges: () => saveChanges(),
    clearFeatureEditing: () => toggleTool("clearConfirm"),
    deleteGeometry: () => deleteGeometry(),
    deleteFeatures: () => toggleTool("deleteConfirm"),
    download: () => toggleControl("wfsdownload"),
    settings: () => toggleTool("settings"),
    switchEditMode: () => toggleEditMode(),
    startEditingFeature: () => startEditingFeature(),
    startDrawingFeature: () => startDrawingFeature(),
    switchViewMode: () => toggleViewMode(),
    onClose: () => toggleTool("featureCloseConfirm")
};
