const React = require('react');
const {Button, ButtonToolbar, Glyphicon} = require('react-bootstrap');

module.exports = () => {

    return (<ButtonToolbar>
        <Button>
        <Glyphicon glyph="arrow-left"/> Back to Search</Button>

    </ButtonToolbar>);
};
