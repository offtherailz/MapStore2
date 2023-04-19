
import React from 'react';
import { changeLayerProperties } from '../../../actions/layers';
import LayerFields from '../../../components/TOC/fragments/LayerFields';
import {connect} from 'react-redux';
/**
 * Utility function to check if the node allows to show fields tab
 * @param {object} node the node of the TOC (including layer properties)
 * @returns {boolean} true if the node allows to show fields
 */
export const hasFields = ({type, search = {}} = {}) =>
    type === 'wfs' // pure WFS layer
        || (type === 'wms' && search.type === 'wfs'); // WMS backed by WFS (search)


export default connect(
    () => ({}),
    {
        updateLayerProperties: changeLayerProperties
    }
)(({element = {}, updateLayerProperties = () => {}, ...props}) => {
    const layer = element;
    const updateFields = (fields) => {
        updateLayerProperties(layer.id, {fields});
    };
    return <LayerFields {...props} layer={layer} updateFields={updateFields}/>;
});
