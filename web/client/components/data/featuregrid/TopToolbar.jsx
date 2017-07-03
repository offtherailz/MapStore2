const React = require('react');
const {Button, ButtonToolbar, Grid, Row, Col, Glyphicon} = require('react-bootstrap');
require("./toolbarstyle.css");
module.exports = (props = {
    onDownloadToggle: () => {}
}) => {
    return (<Grid className="featuregrid-top-toolbar" fluid style={{width: "100%"}}>
        <Row>
            <Col md={4}>
                <ButtonToolbar>
                    <Button className="square-button" onClick={props.onDownloadToggle}><Glyphicon glyph="download"/></Button>
                    <Button className="square-button" onClick={props.onSettingsToggle}><Glyphicon glyph="cog"/></Button>
                    </ButtonToolbar>
            </Col>
            <Col md={4}>
                <h3 className="text-center text-primary">{props.title}</h3>
            </Col>
            <Col md={4}>
                <Button onClick={props.onClose} style={{"float": "right"}} className="m-square-btn no-border"><Glyphicon glyph="1-close"/></Button>
            </Col>
        </Row>
    </Grid>);
};
