const React = require('react');
const extent = require('turf-extent');
const {zoomToExtent} = require('../../actions/map');
const {Glyphicon} = require('react-bootstrap');
module.exports = [{
        name: '',
        width: 35,
        locked: true,
        events: {
            onClick: (p, opts, describe, {crs}= {}) => zoomToExtent(extent(p), crs || "EPSG:4326")
        },
        formatter: () => <Glyphicon glyph="zoom-in" />
}];
