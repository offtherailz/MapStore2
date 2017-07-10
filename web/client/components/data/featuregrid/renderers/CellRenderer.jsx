const React = require('react');
const PropTypes = require('prop-types');
const {Cell} = require('react-data-grid');

class CellRenderer extends React.Component {
    static propTypes = {
        rowData: PropTypes.object,
        column: PropTypes.object
    };
    static contextTypes = {
      isModified: PropTypes.func
    };
    constructor(props) {
        super(props);
        this.setScrollLeft = (scrollBy) => this.refs.cell.setScrollLeft(scrollBy);
    }
    render() {
        const hl = this.context.isModified(this.props.rowData.id, this.props.column.key);
        return <Cell {...this.props} ref="cell" className={ hl ? 'modified' : ''}/>;
    }
}

module.exports = CellRenderer;
