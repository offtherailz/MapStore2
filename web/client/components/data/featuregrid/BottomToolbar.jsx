const React = require('react');
const {Button, ButtonToolbar, Glyphicon} = require('react-bootstrap');
const toPage = ({startIndex, maxFeatures = 1, totalFeatures, resultSize} = {}) => ({
    page: Math.ceil(startIndex / maxFeatures),
    resultSize,
    size: maxFeatures,
    total: totalFeatures,
    maxPages: Math.ceil(totalFeatures / maxFeatures) - 1
});
module.exports = (props = {
    onPageChange: () => {}
}) => {
    const {page, size, resultSize, maxPages, total} = toPage(props);
    return (<ButtonToolbar>
        <span>Page {page + 1} of {maxPages + 1} Results { page * size + 1 } - {page * size + resultSize} of {total}</span>
        <Button
            onClick={() => props.onPageChange(0)}
            disabled={page === 0}
            className="no-border"><Glyphicon glyph="step-backward"/></Button>
        <Button
            onClick={() => props.onPageChange(page - 1)}
            disabled={page === 0}
            className="no-border"><Glyphicon glyph="chevron-left"/></Button>
        <Button
            onClick={() => props.onPageChange(page + 1)}
            className="no-border"
            disabled={page >= maxPages}
        ><Glyphicon glyph="chevron-right"/></Button>
        <Button
            onClick={() => props.onPageChange(maxPages)}
            className="no-border"
            disabled={page >= maxPages}
        ><Glyphicon glyph="step-forward"/></Button>

    </ButtonToolbar>);
};
