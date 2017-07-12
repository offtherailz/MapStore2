const {toggleControl} = require('../../actions/controls');
const {closeResponse} = require('../../actions/wfsquery');
const {toggleTool, toggleEditMode, toggleViewMode, saveChanges, editFeature} = require('../../actions/featuregrid');

module.exports = {
    saveChanges: () => saveChanges(),
    deleteFeatures: () => toggleTool("deleteConfirm"),
    download: () => toggleControl("wfsdownload"),
    settings: () => toggleTool("settings"),
    switchEditMode: () => toggleEditMode(),
    editFeature: () => editFeature(),
    switchViewMode: () => toggleViewMode(),
    onClose: () => closeResponse()
};
