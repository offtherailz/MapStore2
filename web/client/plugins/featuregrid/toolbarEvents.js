const {toggleControl} = require('../../actions/controls');
const {closeResponse} = require('../../actions/wfsquery');
const {toggleTool, toggleEditMode, toggleViewMode, saveChanges, clearChanges, startEditingGeometry} = require('../../actions/featuregrid');

module.exports = {
    saveChanges: () => saveChanges(),
    clearFeatureEditing: () => clearChanges(),
    deleteFeatures: () => toggleTool("deleteConfirm"),
    download: () => toggleControl("wfsdownload"),
    settings: () => toggleTool("settings"),
    switchEditMode: () => toggleEditMode(),
    startEditingGeometry: () => startEditingGeometry(),
    switchViewMode: () => toggleViewMode(),
    onClose: () => closeResponse()
};
