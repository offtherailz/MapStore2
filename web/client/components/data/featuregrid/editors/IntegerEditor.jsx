const React = require('react');
const PropTypes = require('prop-types');
const { editors } = require('react-data-grid');

const processValue = (obj, func) => Object.keys(obj).reduce((acc, curr) => ({...acc, [curr]: func(obj[curr])}), {});

class IntegerEditor extends editors.EditorBase {
    static propTypes = {
      value: PropTypes.number,
      onBlur: PropTypes.func,
      inputProps: PropTypes.object
    };

    constructor(props) {
        super(props);
        this.getValue = () => {
            const updated = super.getValue();
            processValue(updated, v => parseInt(v, 10));
        };
    }

    render() {
        return (<input
            {...this.props.inputProps}
            ref={(node) => this.input = node}
            type="number"
            onBlur={this.props.onBlur}
            className="form-control"
            defaultValue={this.props.value}
             />);
    }
}

module.exports = IntegerEditor;
