/*
 * Copyright 2024, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Button, ControlLabel, FormControl, FormGroup, Glyphicon } from 'react-bootstrap';
import Message from '../../../components/I18N/Message';
import Toolbar from '../../../components/misc/toolbar/Toolbar';
import BorderLayout from '../../../components/layout/BorderLayout';
import localizedProps from '../../../components/misc/enhancers/localizedProps';
import withTooltip from '../../../components/data/featuregrid/enhancers/withTooltip';

const LocalizedFormControl = localizedProps('placeholder')(FormControl);
const TooltipButton = localizedProps('tooltip')(withTooltip(Button));

const parseViewParams = (str = '') =>
    (str || '').split(';').reduce((acc, pair) => {
        const [k, ...v] = pair.split(':');
        if (k) acc[k.trim()] = v.join(':');
        return acc;
    }, {});

const serializeViewParams = (map) =>
    Object.entries(map)
        .filter(([k]) => k)
        .map(([k, v]) => `${k}:${v}`)
        .join(';');

/**
 * Panel for configuring the `viewParamsConfig` array of a layer and setting current viewparam values.
 * Intended for use inside the Fields tab of TOCItemsSettings.
 *
 * @prop {object} element the layer object — must contain `id`, optionally `viewParamsConfig` and `params.viewparams`
 * @prop {function} onChange callback `(key, value)` from TOCItemsSettings tab system
 * @prop {function} onToggle callback to close this panel and return to the fields view
 * @memberof components.TOC
 */
const ViewParamsSection = ({ element = {}, onChange = () => {}, onToggle = () => {}, embedded = false }) => {
    const [newKey, setNewKey] = useState('');
    const [newLabel, setNewLabel] = useState('');

    const config = element.viewParamsConfig || [];
    const valuesMap = parseViewParams(element.params?.viewparams);

    const updateConfig = (newConfig) => onChange('viewParamsConfig', newConfig);

    const updateValues = (newMap) => {
        const serialized = serializeViewParams(newMap);
        const { viewparams: _dropped, ...restParams } = element.params || {};
        onChange({ params: serialized ? { ...restParams, viewparams: serialized } : restParams });
    };

    const remove = (idx) => {
        const removed = config[idx];
        const newConfig = config.filter((_, i) => i !== idx);
        updateConfig(newConfig);
        if (removed) {
            const newMap = { ...valuesMap };
            delete newMap[removed.key];
            updateValues(newMap);
        }
    };

    const setParamValue = (key, value) => {
        const newMap = { ...valuesMap };
        if (value) {
            newMap[key] = value;
        } else {
            delete newMap[key];
        }
        updateValues(newMap);
    };

    const updateLabel = (idx, label) =>
        updateConfig(config.map((entry, i) => i === idx ? { ...entry, label } : entry));

    const add = () => {
        if (!newKey.trim()) return;
        updateConfig([...config, { key: newKey.trim(), label: newLabel.trim() || newKey.trim() }]);
        setNewKey('');
        setNewLabel('');
    };

    const onKeyDown = (e) => { if (e.key === 'Enter') add(); };

    const rows = (<>
        {config.length === 0 && (
            <div className="layer-fields-row" style={{ color: '#999', fontStyle: 'italic' }}>
                <Message msgId="layerProperties.viewParams.empty" />
            </div>
        )}
        {config.map((entry, idx) => (
            <div key={idx} className="layer-fields-row">
                <FormGroup style={{ flex: 2 }}>
                    <FormControl disabled value={entry.key} />
                </FormGroup>
                <FormGroup style={{ flex: 3 }}>
                    <LocalizedFormControl
                        type="text"
                        placeholder="layerProperties.viewParams.labelPlaceholder"
                        value={entry.label || ''}
                        onChange={e => updateLabel(idx, e.target.value)}
                    />
                </FormGroup>
                <FormGroup style={{ flex: 3 }}>
                    <LocalizedFormControl
                        type="text"
                        placeholder="layerProperties.viewParams.valuePlaceholder"
                        value={valuesMap[entry.key] || ''}
                        onChange={e => setParamValue(entry.key, e.target.value)}
                    />
                </FormGroup>
                <FormGroup style={{ flexShrink: 0 }}>
                    <TooltipButton
                        className="square-button"
                        bsStyle="primary"
                        tooltip="layerProperties.viewParams.removeTooltip"
                        onClick={() => remove(idx)}
                    >
                        <Glyphicon glyph="trash" />
                    </TooltipButton>
                </FormGroup>
            </div>
        ))}
        <div className="layer-fields-row">
            <FormGroup style={{ flex: 2 }}>
                <LocalizedFormControl
                    type="text"
                    placeholder="layerProperties.viewParams.keyPlaceholder"
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    onKeyDown={onKeyDown}
                />
            </FormGroup>
            <FormGroup style={{ flex: 3 }}>
                <LocalizedFormControl
                    type="text"
                    placeholder="layerProperties.viewParams.labelPlaceholder"
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={onKeyDown}
                />
            </FormGroup>
            <FormGroup style={{ flex: 3 }} />
            <FormGroup style={{ flexShrink: 0 }}>
                <TooltipButton
                    className="square-button"
                    bsStyle="primary"
                    disabled={!newKey.trim()}
                    tooltip="layerProperties.viewParams.addTooltip"
                    onClick={add}
                >
                    <Glyphicon glyph="plus" />
                </TooltipButton>
            </FormGroup>
        </div>
    </>);

    const columnLabels = (
        <div key="row-labels" className="layer-fields-row-header">
            <FormGroup style={{ flex: 2 }}>
                <ControlLabel><Message msgId="layerProperties.viewParams.key" /></ControlLabel>
            </FormGroup>
            <FormGroup style={{ flex: 3 }}>
                <ControlLabel><Message msgId="layerProperties.viewParams.label" /></ControlLabel>
            </FormGroup>
            <FormGroup style={{ flex: 3 }}>
                <ControlLabel><Message msgId="layerProperties.viewParams.value" /></ControlLabel>
            </FormGroup>
            <FormGroup style={{ flexShrink: 0, width: 34 }} />
        </div>
    );

    if (embedded) {
        return (
            <div className="layer-fields">
                {columnLabels}
                {rows}
            </div>
        );
    }

    return (
        <BorderLayout
            className="layer-fields"
            header={<div key="row-header" className="layer-fields-header">
                <div key="row-toolbar" className="layer-fields-toolbar">
                    <Toolbar
                        key="toolbar"
                        btnDefaultProps={{ className: 'square-button', bsStyle: 'primary' }}
                        buttons={[{
                            glyph: 'filter',
                            active: true,
                            tooltipId: 'layerProperties.viewParams.close',
                            onClick: onToggle
                        }]}
                    />
                </div>
                {columnLabels}
            </div>}
        >
            {rows}
        </BorderLayout>
    );
};

ViewParamsSection.propTypes = {
    element: PropTypes.object,
    onChange: PropTypes.func,
    onToggle: PropTypes.func,
    embedded: PropTypes.bool
};

export default ViewParamsSection;
