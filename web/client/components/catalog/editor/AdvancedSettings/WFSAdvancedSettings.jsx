/*
 * Copyright 2024, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import { FormGroup, ControlLabel } from 'react-bootstrap';
import Select from 'react-select';

import Message from '../../../I18N/Message';
import CommonAdvancedSettings from './CommonAdvancedSettings';

const WFS_VERSION_OPTIONS = [
    { value: '2.0.0', label: 'WFS 2.0.0' },
    { value: '1.1.0', label: 'WFS 1.1.0' },
    { value: '', labelKey: 'catalog.wfsVersion.autoDetect' }
];

const getVersionOption = (value) => {
    const v = value ?? '';
    return WFS_VERSION_OPTIONS.find(o => o.value === v) ?? WFS_VERSION_OPTIONS[0];
};

/**
 * Advanced settings panel for WFS catalog sources.
 * Extends CommonAdvancedSettings with a WFS protocol version selector.
 * The selected version is stored as service.layerOptions.search.wfsVersion
 * and propagated to all layers added from this service.
 */
export default function WFSAdvancedSettings({ service = {}, onChangeServiceProperty, ...rest }) {
    const currentVersion = service.layerOptions?.search?.wfsVersion;
    const versionOption = getVersionOption(currentVersion);

    const handleVersionChange = (opt) => {
        onChangeServiceProperty('layerOptions', {
            ...service.layerOptions,
            search: {
                ...(service.layerOptions?.search ?? {}),
                wfsVersion: opt.value || undefined
            }
        });
    };

    const options = WFS_VERSION_OPTIONS.map(o =>
        o.labelKey ? { ...o, label: <Message msgId={o.labelKey} /> } : o
    );

    return (
        <CommonAdvancedSettings service={service} onChangeServiceProperty={onChangeServiceProperty} {...rest}>
            <FormGroup controlId="wfsVersion" key="wfsVersion">
                <ControlLabel><Message msgId="catalog.wfsVersion.label" /></ControlLabel>
                <Select
                    clearable={false}
                    options={options}
                    value={{ ...versionOption, label: versionOption.labelKey ? <Message msgId={versionOption.labelKey} /> : versionOption.label }}
                    onChange={handleVersionChange}
                />
            </FormGroup>
        </CommonAdvancedSettings>
    );
}
