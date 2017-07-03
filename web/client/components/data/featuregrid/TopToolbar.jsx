const React = require('react');
const {Button, ButtonGroup, Grid, Row, Col, Glyphicon} = require('react-bootstrap');
require("./toolbarstyle.css");
module.exports = (props = {
    onDownloadToggle: () => {}
}) => {
    return (<Grid className="bg-body" fluid style={{width: "100%"}}>
        <Row className="flex-center">
            <Col md={4}>
                <ButtonGroup className="featuregrid-toolbar-margin">
                    <Button className="square-button" onClick={props.onDownloadToggle}><Glyphicon glyph="download"/></Button>
                    <Button className="square-button" onClick={props.onSettingsToggle}><Glyphicon glyph="cog"/></Button>
                </ButtonGroup>
            </Col>
            <Col md={4}>
                <div className="text-center text-primary"><b>{props.title}</b></div>
            </Col>
            <Col md={4}>
                <Button onClick={props.onClose} style={{"float": "right"}} className="square-button no-border featuregrid-top-toolbar-margin">
                    <Glyphicon glyph="1-close"/>
                </Button>
            </Col>
        </Row>
    </Grid>);
};
