import React from 'react';
import PropTypes from 'prop-types';
import { ControlLabel, FormControl, FormGroup, Alert, Glyphicon, Button } from 'react-bootstrap';
import Message from '../../../I18N/Message';
import LoadingSpinner from '../../../misc/LoadingSpinner';
import LocalizedInput from '../../../misc/LocalizedInput';
import Toolbar from '../../../misc/toolbar/Toolbar';
import BorderLayout from '../../../layout/BorderLayout';
import withConfirm from '../../../misc/withConfirm';
import withTooltip from '../../../data/featuregrid/enhancers/withTooltip';
import localizedProps from '../../../misc/enhancers/localizedProps';


const ConfirmButton = localizedProps("tooltip")(withTooltip(withConfirm(Button)));

/**
 * Fields component.
 * Shows the fields of a layer and allows to edit the alias and display the type (not editable) It is used in TOCItemsSettings
 * For the moment it is used only for WFS layers (or WMS backed by WFS). In the future it will be used for all vector layers
 * For each field it shows a row with the field name, the alias and the type.
 * The alias is optional (if empty the name will be used), it can be edited and it can be localized.
 * The type is not editable and it is shown only for information. (in the future it will be editable for some layer types)
 * @memberof components.TOC
 * @prop {object[]} fields the fields of the layer. It is an array of objects with the following properties:
 * - name: the name of the field
 * - alias: the alias of the field
 * - type: the type of the field
 * @prop {function} onLoadFields callback to reload the fields of the layer (for instance in case of WFS it will perform a new DescribeFeatureType request to reload the fields)
 * @prop {function} onChange callback to be called when the alias of a field is changed
 * @prop {function} onClear callback to be called when the customization of the fields is cleared
 * @prop {boolean} loading true if the fields are loading
 * @prop {boolean} error true if there is an error loading the fields
 * @name Fields
 */
const Fields = ({fields = [], onLoadFields = () => {}, onChange = () => {}, onClear = () => {}, loading = true, error }) => {
    const [showImport, setShowImport] = React.useState(false);
    return (<BorderLayout
        className="layer-fields"
        header={<div key="row-header" className="layer-fields-header">
            <div key="row-toolbar" className="layer-fields-toolbar">
                <Toolbar key="toolbar" btnDefaultProps={{ className: 'square-button-md', bsStyle: 'primary' }}
                    buttons={[{
                        glyph: 'refresh',
                        disabled: loading,
                        tooltipId: 'layerProperties.fields.refresh',
                        onClick: onLoadFields
                    }, {
                        disabled: loading,
                        tooltipId: 'layerProperties.fields.import',
                        onClick: () => setShowImport(true)
                    }, {
                        disabled: loading,
                        tooltipId: 'layerProperties.fields.export',
                        onClick: () => {
                            const blob = new Blob([JSON.stringify(fields, null, 2)], {type: "application/json"});
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.download = 'fields.json';
                            a.href = url;
                            a.click();
                        }
                    }, {
                        disabled: loading,
                        tooltipId: 'layerProperties.fields.clearCustomization',
                        Element: () => (<ConfirmButton
                            tooltip="layerProperties.fields.clearCustomization"
                            disabled={loading}
                            bsStyle="primary"
                            confirmContent={<Message msgId="layerProperties.fields.clearCustomizationConfirm"/>}
                            className="square-button-md"
                            onClick={onClear}>
                            <Glyphicon
                                glyph="clear-brush" />
                        </ConfirmButton>)


                    }]}
                />
            </div>
            <div key="row-labels" className="layer-fields-row layer-fields-row-header">
                <FormGroup className="layer-field-name">
                    <ControlLabel><Message msgId="layerProperties.fields.name"/></ControlLabel>
                </FormGroup>
                <FormGroup className="layer-field-alias">
                    <ControlLabel><Message msgId="layerProperties.fields.alias"/></ControlLabel>
                </FormGroup>
                <FormGroup className="layer-field-type">
                    <ControlLabel><Message msgId="layerProperties.fields.type"/></ControlLabel>
                </FormGroup>
            </div>
        </div>}
        footer={<div key="row-footer" className="layer-fields-footer">
            {loading && <div className="layer-field-loading"><LoadingSpinner key="loading" loadingError={error} loading={loading} /><Message msgId="loading" /></div>}
            {error && <Alert bsStyle="danger" className="layer-fields-error"><Message msgId="layerProperties.fields.error"/></Alert>}
        </div>}
    >
        {fields.map(({name, alias, type}) => {
            return (<div key={`field-${name}`} className="layer-fields-row">
                <FormGroup className="layer-field-name">
                    <FormControl disabled value={name} />
                </FormGroup>
                <FormGroup className="layer-field-alias">
                    <LocalizedInput disabled={loading} onChange={(value) => onChange(name, "alias", value)} value={alias} />
                </FormGroup>
                <FormGroup className="layer-field-type">
                    <FormControl disabled value={type}/>
                </FormGroup>
            </div>);
        })}
    </BorderLayout>
    );
};

Fields.propTypes = {
    fields: PropTypes.array,
    onLoadFields: PropTypes.func,
    onChange: PropTypes.func,
    onClear: PropTypes.func,
    loading: PropTypes.bool,
    error: PropTypes.bool
};

export default Fields;
