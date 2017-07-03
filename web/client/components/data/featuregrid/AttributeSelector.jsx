const React = require('react');
const {Checkbox} = require('react-bootstrap');

module.exports = (props = {
    onChange: () => {}
    }) => (
    <div style={props.style}>
        {props.attributes.map( attr =>
            (<Checkbox
                key={attr.attribute}
                checked={!attr.hide}
                onChange={() => props.onChange(attr.attribute, !attr.hide ) }>
                {attr.label || attr.attribute}
            </Checkbox>)
        )}
    </div>
);
