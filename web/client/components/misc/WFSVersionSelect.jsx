/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ControlLabel, FormGroup, Glyphicon, InputGroup } from 'react-bootstrap';
import Select from 'react-select';

import Message from '../I18N/Message';
import useIsMounted from '../../hooks/useIsMounted';

const VERSIONS = ['2.0.0', '1.1.0'];

/**
 * Selector of the WFS version used for the requests of a layer or of the layers of a catalog service.
 * The empty option keeps the version undefined: the legacy 1.1.0 requests for a layer, the detection for a service.
 * @prop {string} value the selected version
 * @prop {string} emptyLabelId message id of the option for an undefined version
 * @prop {function} onChange called with the selected version, undefined for the empty option
 * @prop {function} [onDetect] returns a promise of the version supported by the service, it shows a detect button
 */
const WFSVersionSelect = ({ value, emptyLabelId, onChange, onDetect }) => {
    const [detecting, setDetecting] = useState(false);
    const isMounted = useIsMounted();
    const options = [
        { value: '', label: <Message msgId={emptyLabelId} /> },
        ...VERSIONS.map(version => ({ value: version, label: `WFS ${version}` }))
    ];
    const detect = () => {
        setDetecting(true);
        onDetect()
            .then(version => isMounted(() => version && onChange(version)))
            .finally(() => isMounted(() => setDetecting(false)));
    };
    const select = (
        <Select
            clearable={false}
            searchable={false}
            options={options}
            value={value ?? ''}
            onChange={option => onChange(option?.value || undefined)} />
    );
    return (
        <FormGroup className="ms-wfs-version" data-qa="wfs-version">
            <ControlLabel><Message msgId="wfsVersion.label" /></ControlLabel>
            {onDetect
                ? <InputGroup>
                    {select}
                    <InputGroup.Addon
                        className="btn"
                        data-qa="wfs-version-detect"
                        onClick={detecting ? undefined : detect}>
                        <Glyphicon glyph={detecting ? 'hourglass' : 'refresh'} />
                    </InputGroup.Addon>
                </InputGroup>
                : select}
        </FormGroup>
    );
};

WFSVersionSelect.propTypes = {
    value: PropTypes.string,
    emptyLabelId: PropTypes.string,
    onChange: PropTypes.func,
    onDetect: PropTypes.func
};

WFSVersionSelect.defaultProps = {
    emptyLabelId: 'wfsVersion.default',
    onChange: () => {}
};

export default WFSVersionSelect;
