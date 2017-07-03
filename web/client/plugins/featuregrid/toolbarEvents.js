const {toggleControl} = require('../../actions/controls');
const {closeResponse} = require('../../actions/wfsquery');
const {toggleTool} = require('../../actions/featuregrid');

module.exports = {
    onDownloadToggle: () => toggleControl("wfsdownload"),
    onSettingsToggle: () => toggleTool("settings"),
    onClose: () => closeResponse()
};
