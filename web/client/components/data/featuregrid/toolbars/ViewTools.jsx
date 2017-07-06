const React = require('react');
const {Button, ButtonGroup, Glyphicon} = require('react-bootstrap');
module.exports = (props) =>
    (<ButtonGroup className="featuregrid-toolbar-margin">
        <Button className="square-button" onClick={props.onDownloadToggle}><Glyphicon glyph="download"/></Button>
        <Button className="square-button" onClick={props.onSettingsToggle}><Glyphicon glyph="cog"/></Button>
    </ButtonGroup>);
