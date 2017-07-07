const React = require('react');
const {Button, ButtonGroup, Glyphicon} = require('react-bootstrap');
const hideStyle = {
    display: "none"
};
const normalStyle = {
};
const getStyle = (visible) => visible ? normalStyle : hideStyle;
module.exports = ({events = {}, mode = "VIEW", selectedCount} = {}) =>
    (<ButtonGroup className="featuregrid-toolbar-margin">
        <Button key="edit-mode" style={getStyle(mode === "VIEW")} className="square-button" onClick={events.switchEditMode}><Glyphicon glyph="edit"/></Button>
        <Button key="back-view" style={getStyle(mode === "EDIT")} className="square-button" onClick={events.switchViewMode}><Glyphicon glyph="arrow-left"/></Button>
        <Button key="add-feature" style={getStyle(mode === "EDIT" && selectedCount <= 0)} className="square-button" onClick={events.createFeature}><Glyphicon glyph="plus"/></Button>
        <Button key="edit-feature" style={getStyle(mode === "EDIT" && selectedCount === 1)} className="square-button" onClick={events.editFeature}><Glyphicon glyph="edit"/></Button>
        <Button key="remove-features" style={getStyle(mode === "EDIT" && selectedCount > 0)} className="square-button" onClick={events.deleteFeatures}><Glyphicon glyph="1-close"/></Button>
        <Button key="save-feature" style={getStyle(mode === "EDITING_FEATURE" || mode === "CREATING_FEATURE")} className="square-button" onClick={events.saveFeature}><Glyphicon glyph="save"/></Button>
        <Button key="cancel-editing" style={getStyle(mode === "EDITING_FEATURE" || mode === "CREATING_FEATURE")} className="square-button" onClick={events.clearFeatureEditing}><Glyphicon glyph="1-close"/></Button>
        <Button key="delete-geometry" style={getStyle(mode === "EDITING_FEATURE" || mode === "CREATING_FEATURE")} className="square-button" onClick={events.deleteGeometry}><Glyphicon glyph="delete"/></Button>
        <Button style={getStyle(mode === "VIEW")} className="square-button" onClick={events.download}><Glyphicon glyph="download"/></Button>
        <Button className="square-button" style={getStyle(selectedCount <= 1 && (mode === "VIEW" || mode === "EDIT"))} onClick={events.settings}><Glyphicon glyph="cog"/></Button>
    </ButtonGroup>);
