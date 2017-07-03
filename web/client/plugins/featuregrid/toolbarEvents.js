const {toggleControl} = require('../../actions/controls');
const {closeResponse} = require('../../actions/wfsquery');

module.exports = {
    onDownloadToggle: () => toggleControl("wfsdownload"),
    onClose: () => closeResponse()
};
