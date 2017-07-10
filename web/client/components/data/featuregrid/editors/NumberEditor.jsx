const React = require('react');
const PropTypes = require('prop-types');
const { editors } = require('react-data-grid');
const ReactDOM = require('react-dom');

class DropDownEditor extends editors.EditorBase {
    static propTypes = {
      value: PropTypes.symbol,
      onBlur: PropTypes.func,
      options: PropTypes.arrayOf(React.PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.shape({
              id: PropTypes.string,
              title: PropTypes.string,
              value: PropTypes.string,
              text: PropTypes.string
            })
        ])).isRequired
    };

    onClick() {
        this.getInputNode().focus();
    }

    onDoubleClick() {
        this.getInputNode().focus();
    }
    getInputNode() {
        return ReactDOM.findDOMNode(this);
    }
    renderOptions() {
        let options = [];
        this.props.options.forEach(function(name) {
            if (typeof name === 'string') {
                options.push(<option key={name} value={name}>{name}</option>);
            } else {
                options.push(<option key={name.id} value={name.value} title={name.title} >{name.text || name.value}</option>);
            }
        }, this);
        return options;
    }
    render() {
        return (<select style={this.getStyle()} defaultValue={this.props.value} onBlur={this.props.onBlur} onChange={this.onChange} >
            {this.renderOptions()}
            </select>);
    }
}


module.exports = DropDownEditor;
