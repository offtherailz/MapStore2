const React = require('react');
const {Button, Glyphicon, Grid, Row, Col} = require('react-bootstrap');
const Spinner = require('react-spinkit');
const toPage = ({startIndex = 0, maxFeatures = 1, totalFeatures = 0, resultSize} = {}) => ({
    page: Math.ceil(startIndex / maxFeatures),
    resultSize,
    size: maxFeatures,
    total: totalFeatures,
    maxPages: Math.ceil(totalFeatures / maxFeatures) - 1
});
module.exports = (props = {
    onPageChange: () => {}
}) => {
    const {page = 0, size = 0, resultSize = 0, maxPages = 0, total = 0} = toPage(props);
    return (<Grid className="bg-body data-grid-bottom-toolbar" fluid style={{width: "100%"}}>
        <Row className="featuregrid-toolbar-margin">
            <Col md={3}>
                <span>{ page * size + 1 } - {page * size + resultSize} of {total}</span>
            </Col>
            <Col className="text-center" md={6}>
                <Button
                    key="first-page"
                    onClick={() => props.onPageChange(0)}
                    disabled={page === 0}
                    className="no-border first-page"><Glyphicon glyph="step-backward"/></Button>
                <Button
                    key="prev-page"
                    onClick={() => props.onPageChange(page - 1)}
                    disabled={page === 0}
                    className="no-border prev-page"><Glyphicon glyph="chevron-left"/></Button>
                <span key="page-info">Page {page + 1} of {maxPages + 1} </span>
                <Button
                    key="next-page"
                    onClick={() => props.onPageChange(page + 1)}
                    className="no-border next-page"
                    disabled={page >= maxPages}
                ><Glyphicon glyph="chevron-right"/></Button>
                <Button
                    key="last-page"
                    onClick={() => props.onPageChange(maxPages)}
                    className="no-border last-page"
                    disabled={page >= maxPages}
                ><Glyphicon glyph="step-forward"/></Button>
        </Col><Col md={3}>
            {props.loading ? <Spinner style={{"float": "right"}} spinnerName="circle" noFadeIn/> : <div />}
        </Col>
    </Row></Grid>);
};
