const {toggleControl} = require('../../actions/controls');

module.exports = {
    onDownloadToggle: () => toggleControl("wfsdownload")
};
