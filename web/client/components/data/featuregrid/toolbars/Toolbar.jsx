const React = require('react');
const {Button, ButtonGroup, Glyphicon, Tooltip, OverlayTrigger} = require('react-bootstrap');
require("./toolbar.css");
const hideStyle = {
    width: 0,
    padding: 0,
    borderWidth: 0
};
const normalStyle = {
};
const Message = require('../../../I18N/Message');
const getStyle = (visible) => visible ? normalStyle : hideStyle;
module.exports = ({events = {}, mode = "VIEW", selectedCount, hasChanges, hasGeometry, hasNewFeatures, isSimpleGeom} = {}) =>
    (<ButtonGroup id="featuregrid-toolbar" className="featuregrid-toolbar-margin">
        <OverlayTrigger placement="top" overlay={<Tooltip id="fe-edit-mode"><Message msgId="featuregrid.toolbar.editMode"/></Tooltip>}>
            <Button key="edit-mode" style={getStyle(mode === "VIEW")} className="square-button" onClick={events.switchEditMode}><Glyphicon glyph="pencil"/></Button>
        </OverlayTrigger>
        <OverlayTrigger placement="top" overlay={<Tooltip id="fe-back-view"><Message msgId="featuregrid.toolbar.quitEditMode"/></Tooltip>}>
            <Button key="back-view" style={getStyle(mode === "EDIT" && !hasChanges)} className="square-button" onClick={events.switchViewMode}><Glyphicon glyph="arrow-left"/></Button>
        </OverlayTrigger>
        <OverlayTrigger placement="top" overlay={<Tooltip id="fe-add-feature"><Message msgId="featuregrid.toolbar.addNewFeatures"/></Tooltip>}>
            <Button key="add-feature" style={getStyle(mode === "EDIT" && selectedCount <= 0)} className="square-button" onClick={events.createFeature}><Glyphicon glyph="row-add"/></Button>
        </OverlayTrigger>
        <OverlayTrigger placement="top" overlay={<Tooltip id="fe-edit-feature"><Message msgId="featuregrid.toolbar.editFeature"/></Tooltip>}>
            <Button key="edit-feature" style={getStyle(mode === "EDIT" && selectedCount === 1 && !isSimpleGeom)}
                className="square-button" onClick={events.startEditingFeature}><Glyphicon glyph="pencil-edit"/></Button>
        </OverlayTrigger>
        <OverlayTrigger placement="top" overlay={<Tooltip id="fe-draw-feature"><Message msgId="featuregrid.toolbar.drawFeature"/></Tooltip>}>
            <Button key="draw-feature" style={getStyle(mode === "EDIT" && selectedCount === 1 && (!hasGeometry || hasGeometry && !isSimpleGeom))} className="square-button" onClick={events.startDrawingFeature}><Glyphicon glyph="pencil-add"/></Button>
        </OverlayTrigger>
        <OverlayTrigger placement="top" overlay={<Tooltip id="fe-remove-features"><Message msgId="featuregrid.toolbar.deleteSelectedFeatures"/></Tooltip>}>
            <Button key="remove-features" style={getStyle(mode === "EDIT" && selectedCount > 0)} className="square-button" onClick={events.deleteFeatures}><Glyphicon glyph="trash-square"/></Button>
        </OverlayTrigger>
        <OverlayTrigger placement="top" overlay={<Tooltip id="fe-save-features"><Message msgId="featuregrid.toolbar.saveChanges"/></Tooltip>}>
            <Button key="save-feature" style={getStyle(mode === "EDIT" && hasChanges || hasNewFeatures)} className="square-button" onClick={events.saveChanges}><Glyphicon glyph="floppy-disk"/></Button>
        </OverlayTrigger>
        <OverlayTrigger placement="top" overlay={<Tooltip id="fe-cancel-editing"><Message msgId="featuregrid.toolbar.cancelChanges"/></Tooltip>}>
            <Button key="cancel-editing" style={getStyle(mode === "EDIT" && hasChanges || hasNewFeatures)}
                className="square-button" onClick={events.clearFeatureEditing}><Glyphicon glyph="1-close"/></Button>
        </OverlayTrigger>
        <OverlayTrigger placement="top" overlay={<Tooltip id="fe-delete-geometry"><Message msgId="featuregrid.toolbar.deleteGeometry"/></Tooltip>}>
            <Button key="delete-geometry" style={getStyle(mode === "EDIT" && hasGeometry && selectedCount === 1)} className="square-button" onClick={events.deleteGeometry}><Glyphicon glyph="polygon-trash"/></Button>
        </OverlayTrigger>
        <OverlayTrigger placement="top" overlay={<Tooltip id="fe-download-grid"><Message msgId="featuregrid.toolbar.downloadGridData"/></Tooltip>}>
            <Button key="download-grid" style={getStyle(mode === "VIEW")} className="square-button" onClick={events.download}><Glyphicon glyph="features-grid-download"/></Button>
        </OverlayTrigger>
        <OverlayTrigger placement="top" overlay={<Tooltip id="fe-grid-settings"><Message msgId="featuregrid.toolbar.hideShowColumns"/></Tooltip>}>
            <Button key="grid-settings" className="square-button" style={getStyle(selectedCount <= 1 && mode === "VIEW")} onClick={events.settings}><Glyphicon glyph="features-grid-set"/></Button>
        </OverlayTrigger>
    </ButtonGroup>);
