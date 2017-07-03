const React = require('react');
const panels = {
  settings: require('./AttributeSelector')
};
const panelDefaultProperties = {
    settings: {
        style: {overflow: "auto", flex: "0 0 12em", boxShadow: "inset 0px 0px 10px lightgrey"}
    }
};
module.exports = {
    getPanels: (tools = {}) =>
        Object.keys(tools)
            .filter(t => tools[t] && panels[t])
            .map(t => {
                const Panel = panels[t];
                return <Panel {...(panelDefaultProperties[t] || {})} />;
    })
};
