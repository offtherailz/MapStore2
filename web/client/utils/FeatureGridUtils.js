const {getFeatureTypeProperties, isGeometryType} = require('./ogc/WFS/base');
const getRow = (i, rows) => rows[i];
module.exports = {
    featureTypeToGridColumns: (describe, columnSettings = {}) =>
        (getFeatureTypeProperties(describe) || []).filter( e => !isGeometryType(e)).filter(e => !(columnSettings[e.name] && columnSettings[e.name].hide)).map( (desc) => ({
                sortable: true,
                key: desc.name,
                width: 200,
                name: desc.name,
                resizable: true
        })),
    getRow,
    /**
     * Create a column from the configruation. Maps the events to call a function with the whole property
     * @param  {array} toolColumns Array of the tools configurations
     * @param  {array} rows        Data rows
     * @return {array}             Array of the columns to use in react-data-grid, with proper event bindings.
     */
    getToolColumns: (toolColumns = [], rowGetter = () => {}, describe, actionOpts) => toolColumns.map(tool => ({
        ...tool,
        events: tool.events && Object.keys(tool.events).reduce( (events, key) => ({
            ...events,
            [key]: (evt, opts) => tool.events[key](rowGetter(opts.rowIdx), opts, describe, actionOpts)
        }), {})
        })
    )

};
