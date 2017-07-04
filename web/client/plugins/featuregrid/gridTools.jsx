const React = require('react');
const bbox = require('@turf/bbox');
const {zoomToExtent} = require('../../actions/map');
const {Glyphicon} = require('react-bootstrap');
module.exports = [{
        name: '',
        key: "__zoom_to_feature__",
        width: 35,
        locked: true,
        events: {
            onClick: (p, opts, describe, {crs}= {}) => zoomToExtent(bbox(p), crs || "EPSG:4326")
        },
        formatter: () => <Glyphicon glyph="zoom-in" />
}];
