/*
 * Copyright 2024, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect } from 'react';
import { Button, ControlLabel, FormControl, FormGroup, Glyphicon, InputGroup } from 'react-bootstrap';
import Select from 'react-select';
import Spinner from 'react-spinkit';

import Message from '../../../I18N/Message';
import SwitchPanel from '../../../misc/switch/SwitchPanel';
import axios from '../../../../libs/ajax';

const WFS_VERSION_OPTIONS = [
    { value: '1.1.0', label: 'WFS 1.1.0' },
    { value: '2.0.0', label: 'WFS 2.0.0' }
];

const detectVersionFromCaps = (xmlText) => {
    try {
        const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
        const versions = Array.from(doc.querySelectorAll('ServiceTypeVersion'))
            .map(el => el.textContent.trim())
            .filter(v => ['1.0.0', '1.1.0', '2.0.0'].includes(v));
        if (versions.includes('2.0.0')) return '2.0.0';
        if (versions.includes('1.1.0')) return '1.1.0';
    } catch (e) { /* ignore parse errors */ }
    return '1.1.0';
};

function TypeNameField({ element, onChange }) {
    const [editing, setEditing] = useState(false);
    const [localName, setLocalName] = useState(element.name || '');

    useEffect(() => {
        if (!editing) {
            setLocalName(element.name || '');
        }
    }, [element.name, editing]);

    const confirm = () => {
        if (localName !== element.name) {
            onChange('name', localName);
        }
        setEditing(false);
    };

    return (
        <FormGroup>
            <ControlLabel><Message msgId="layerProperties.wfsTypeName.label" /></ControlLabel>
            <InputGroup>
                <FormControl
                    value={localName}
                    type="text"
                    disabled={!editing}
                    onChange={e => setLocalName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && editing) confirm(); }}
                />
                <InputGroup.Addon className="btn" onClick={() => editing ? confirm() : setEditing(true)}>
                    <Glyphicon glyph={editing ? 'ok' : 'pencil'} />
                </InputGroup.Addon>
            </InputGroup>
        </FormGroup>
    );
}

/**
 * Renders WFS connection settings (URL, TypeName, version) for WFS and WMS layers.
 * - WFS layers: URL field + TypeName inline-edit + version selector with re-detect button.
 * - WMS layers with linked WFS (search.type === 'wfs'): collapsible panel with URL + version.
 */
export default function WFSConnectionSettings({ element = {}, onChange }) {
    const [detecting, setDetecting] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const search = element.search ?? {};
    const isWfsLayer = element.type === 'wfs';

    const currentVersion = search.wfsVersion || '1.1.0';
    const versionOption = WFS_VERSION_OPTIONS.find(o => o.value === currentVersion) ?? WFS_VERSION_OPTIONS[0];

    const updateSearch = patch => onChange('search', { ...search, ...patch });

    const handleRedetect = () => {
        if (!search.url) return;
        setDetecting(true);
        const sep = search.url.includes('?') ? '&' : '?';
        axios.get(`${search.url}${sep}service=WFS&request=GetCapabilities`)
            .then(res => updateSearch({ wfsVersion: detectVersionFromCaps(res.data) }))
            .catch(() => {})
            .finally(() => setDetecting(false));
    };

    const urlField = (
        <FormGroup>
            <ControlLabel><Message msgId="layerProperties.wfsUrl.label" /></ControlLabel>
            <FormControl
                type="text"
                key={`url-${search.url}`}
                defaultValue={search.url || ''}
                onBlur={e => { if (e.target.value !== search.url) updateSearch({ url: e.target.value }); }}
            />
        </FormGroup>
    );

    const versionField = (
        <FormGroup>
            <ControlLabel><Message msgId="layerProperties.wfsVersion.label" /></ControlLabel>
            <div style={{ display: 'flex', gap: '4px' }}>
                <div style={{ flex: 1 }}>
                    <Select
                        clearable={false}
                        options={WFS_VERSION_OPTIONS}
                        value={versionOption}
                        onChange={opt => updateSearch({ wfsVersion: opt.value })}
                    />
                </div>
                <Button
                    bsSize="sm"
                    disabled={detecting || !search.url}
                    title="Re-detect WFS version from server capabilities"
                    onClick={handleRedetect}
                    style={{ height: 36 }}
                >
                    {detecting
                        ? <Spinner noFadeIn style={{ width: 18, height: 18 }} spinnerName="circle" />
                        : <Glyphicon glyph="refresh" />
                    }
                </Button>
            </div>
        </FormGroup>
    );

    if (isWfsLayer) {
        return (
            <div>
                {urlField}
                <TypeNameField element={element} onChange={onChange} />
                {versionField}
            </div>
        );
    }

    return (
        <SwitchPanel
            title={<Message msgId="layerProperties.wfsLinkedService.label" />}
            expanded={expanded}
            onSwitch={setExpanded}
        >
            {urlField}
            {versionField}
        </SwitchPanel>
    );
}
