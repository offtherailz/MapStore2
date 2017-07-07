const {toggleControl} = require('../../actions/controls');
const {closeResponse} = require('../../actions/wfsquery');
const {toggleTool, toggleEditMode, toggleViewMode} = require('../../actions/featuregrid');

module.exports = {
    download: () => toggleControl("wfsdownload"),
    settings: () => toggleTool("settings"),
    switchEditMode: () => toggleEditMode(),
    switchViewMode: () => toggleViewMode(),
    onClose: () => closeResponse()
};
