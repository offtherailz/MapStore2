const {toggleControl} = require('../../actions/controls');
const {closeResponse} = require('../../actions/wfsquery');
const {toggleTool, toggleEditMode, toggleViewMode, saveChanges, clearChanges, createNewFeatures, startEditingFeature} = require('../../actions/featuregrid');

module.exports = {
    createFeature: () => createNewFeatures([{}]),
    saveChanges: () => saveChanges(),
    clearFeatureEditing: () => clearChanges(),
    deleteFeatures: () => toggleTool("deleteConfirm"),
    download: () => toggleControl("wfsdownload"),
    settings: () => toggleTool("settings"),
    switchEditMode: () => toggleEditMode(),
    startEditingFeature: () => startEditingFeature(),
    switchViewMode: () => toggleViewMode(),
    onClose: () => closeResponse()
};
