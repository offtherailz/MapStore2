var context = require.context('../web/client/components', true, /(app|I18N|buttons|misc\/toolbar|misc\/combobox|misc\/datetimepicker)\/__tests__\/.*-test\.jsx?$/);
context.keys().forEach(context);
module.exports = context;
