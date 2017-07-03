const React = require('react');
const {Checkbox} = require('react-bootstrap');

module.exports = (props = {
    onChange: () => {}
    }) => (
    <div style={props.style}>
        <h4 className="text-center"><strong>Columns</strong></h4>
        <div>
        {props.attributes.map( attr =>
            (<Checkbox
                key={attr.attribute}
                checked={!attr.hide}
                onChange={() => props.onChange(attr.attribute, !attr.hide ) }>
                {attr.label || attr.attribute}
            </Checkbox>)
        )}
        </div>
    </div>
);
