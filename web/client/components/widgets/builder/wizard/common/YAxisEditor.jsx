/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import { Col, FormControl, ControlLabel } from 'react-bootstrap';

import Message from '../../../../I18N/Message';
import HTML from '../../../../I18N/HTML';

import DisposablePopover from '../../../../misc/popover/DisposablePopover';
import FormulaInput from './FormulaInput';
import {AXIS_TYPES, AxisTypeSelect} from './common.jsx';

import SwitchButton from '../../../../misc/switch/SwitchButton';

export default (yAxisOpts, data, onChange = () => {}) => {
    const {yAxis, formula} = data ?? {}; // TODO: think about multiple values and backward- compatibility.
    return (<><Col componentClass={"label"} sm={12}>
        <Message msgId="widgets.advanced.yAxis" />
    </Col>
    <Col componentClass={ControlLabel} sm={6}>
        <Message msgId="widgets.advanced.xAxisType" />
    </Col>
    <Col sm={6}>
        <AxisTypeSelect
            value={yAxisOpts?.type || '-'}
            options={AXIS_TYPES}
            onChange={(val) => {
                onChange("yAxisOpts.type", val && val.value);
            }}
        />
    </Col>
    <Col componentClass={ControlLabel} sm={6}>
        <Message msgId="widgets.advanced.hideLabels" />
    </Col>
    <Col sm={6}>
        <SwitchButton
            checked={yAxis || yAxis === false ? !yAxis : true}
            onChange={(val) => { onChange("yAxis", !val); }}
        />
    </Col>
    <Col componentClass={ControlLabel} sm={12}>
        <Message msgId="widgets.advanced.format" />
    </Col>
    <Col sm={4}>
        <ControlLabel>
            <Message msgId="widgets.advanced.prefix" />
            <FormControl placeholder="e.g.: ~" disabled={yAxis === false} value={yAxisOpts?.tickPrefix} type="text" onChange={e => onChange("yAxisOpts.tickPrefix", e.target.value)} />
        </ControlLabel>
    </Col>
    <Col sm={4}>
        <ControlLabel>
            <Message msgId="widgets.advanced.format" />
        </ControlLabel>
        <DisposablePopover placement="top" title={<Message msgId="widgets.advanced.examples"/>} text={<HTML msgId="widgets.advanced.formatExamples" />} />
        <FormControl placeholder="e.g.: .2s" disabled={yAxis === false} value={yAxisOpts?.format} type="text" onChange={e => onChange("yAxisOpts.format", e.target.value)} />
    </Col>
    <Col sm={4}>
        <ControlLabel><Message msgId="widgets.advanced.suffix" /></ControlLabel>
        <FormControl placeholder="e.g.: W" disabled={yAxis === false} value={yAxisOpts?.tickSuffix} type="text" onChange={e => onChange("yAxisOpts.tickSuffix", e.target.value)} />
    </Col>
    </>);
};
