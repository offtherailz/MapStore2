var context = require.context('../web/client/epics', true, /-test\.jsx?$/);
context.keys().forEach(context);
module.exports = context;
