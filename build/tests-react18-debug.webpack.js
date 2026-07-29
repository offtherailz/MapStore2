var polluters = require.context('../web/client/plugins/tocitemssettings', true, /-test\.jsx?$/);
polluters.keys().forEach(polluters);
var mv = require.context('../web/client/product', true, /__tests__\/MapViewer-test\.jsx?$/);
mv.keys().forEach(mv);
module.exports = mv;
