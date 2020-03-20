/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React, { useState, useEffect} from 'react';
import { isEqual, isNil } from 'lodash';

import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/lint/json-lint';
import 'codemirror/mode/javascript/javascript';

import Message from "../../../I18N/Message";
import HTML from "../../../I18N/HTML";

import { FormGroup, Checkbox, Col, ControlLabel } from "react-bootstrap";
import InfoPopover from '../../../widgets/widget/InfoPopover';

// TODO: add variants
const INITIAL_CODE_VALUE = `{
    "options": {}
}`;
/**
 * Advanced settings form, used by TMS
 * @prop {object} service the service to edit
 * @prop {function} onChangeServiceProperty handler (key, value) to change a property of service.
 */
export default ({
    service = {},
    onChangeServiceProperty = () => { }
}) => {
    const [code, setCode] = useState(INITIAL_CODE_VALUE);
    const [valid, setValid] = useState(true);
    // parse code and set options
    useEffect(() => {
        try {
            const config = JSON.parse(code);
            const {options, variants} = config;
            setValid(true);
            if (!isEqual(options, service.options)) {
                onChangeServiceProperty("options", options);
            }
            if (!isEqual(variants, service.variants)) {
                onChangeServiceProperty("variants", variants);
            }
        } catch (e) {
            setValid(false);
            if (service.options) {
                onChangeServiceProperty("options", undefined);
            }
            if (service.variants) {
                onChangeServiceProperty("variants", undefined);
            }

        }
    }, [code]);
    return (<div>
        <FormGroup controlId="autoload" key="autoload">
            <Col xs={12}>
                <Checkbox key="autoload" value="autoload" onChange={(e) => onChangeServiceProperty("autoload", e.target.checked)}
                    checked={!isNil(service.autoload) ? service.autoload : false}>
                    <Message msgId="catalog.autoload" />
                </Checkbox>
                {service.provider === "tms"
                    ? <Checkbox key="forceDefaultTileGrid" value="forceDefaultTileGrid" onChange={(e) => onChangeServiceProperty("forceDefaultTileGrid", e.target.checked)}
                        checked={!isNil(service.forceDefaultTileGrid) ? service.forceDefaultTileGrid : false}>
                        <Message msgId="catalog.tms.forceDefaultTileGrid" />&nbsp;<InfoPopover text={<Message msgId="catalog.tms.forceDefaultTileGridDescription" />} />
                    </Checkbox>
                    : null}
            </Col>
            {!service.provider || service.provider === "custom"
                ? <Col>
                    <ControlLabel><Message msgId="catalog.tms.customTMSConfiguration" />&nbsp;&nbsp;<InfoPopover text={<HTML msgId="catalog.tms.customTMSConfigurationHint" />} /></ControlLabel>
                    <CodeMirror
                        options={{
                            theme: 'lesser-dark',
                            mode: 'application/json',
                            lineNumbers: true,
                            styleSelectedText: true,
                            indentUnit: 2,
                            tabSize: 2
                        }}
                        value={code}
                        onBeforeChange={(_, __, value) => {
                            setCode(value);
                        }}
                    />
                </Col>
                : null}
        </FormGroup>
    </div>);
};
