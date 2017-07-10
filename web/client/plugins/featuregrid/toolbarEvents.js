const {toggleControl} = require('../../actions/controls');
const {closeResponse} = require('../../actions/wfsquery');
const {toggleTool, toggleEditMode, toggleViewMode, saveChanges} = require('../../actions/featuregrid');

module.exports = {
    saveChanges: () => saveChanges(),
    deleteFeatures: () => toggleTool("deleteConfirm"),
    download: () => toggleControl("wfsdownload"),
    settings: () => toggleTool("settings"),
    switchEditMode: () => toggleEditMode(),
    switchViewMode: () => toggleViewMode(),
    onClose: () => closeResponse()
};
