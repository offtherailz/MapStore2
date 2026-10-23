/**
 * Copyright 2022, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import ReactDOM from "react-dom";
import CommonAdvancedSettings from "../CommonAdvancedSettings";
import expect from "expect";
import TestUtils from "react-dom/test-utils";

describe('Test common advanced settings', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });
    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });
    it('creates the component with defaults', () => {
        ReactDOM.render(<CommonAdvancedSettings service={{type: "wms"}}/>, document.getElementById("container"));
        const advancedSettingPanel = document.getElementsByClassName("mapstore-switch-panel");
        expect(advancedSettingPanel).toBeTruthy();
    });
    it('test wms advanced options', () => {
        ReactDOM.render(<CommonAdvancedSettings service={{type: "wms"}}/>, document.getElementById("container"));
        const advancedSettingPanel = document.getElementsByClassName("mapstore-switch-panel");
        expect(advancedSettingPanel).toBeTruthy();
        const fields = document.querySelectorAll(".form-group");
        expect(fields.length).toBe(2);
    });
    it('test wfs advanced options', () => {
        ReactDOM.render(<CommonAdvancedSettings service={{type: "wfs"}}/>, document.getElementById("container"));
        const advancedSettingPanel = document.getElementsByClassName("mapstore-switch-panel");
        expect(advancedSettingPanel).toBeTruthy();
        const fields = document.querySelectorAll(".form-group");
        expect(fields.length).toBe(4);
        const version = document.querySelector('[data-qa="wfs-version"]');
        expect(version.querySelector('.Select-value-label').textContent).toBe('wfsVersion.detect');
        expect(version.querySelector('[data-qa="wfs-version-detect"]')).toBe(null);
    });
    it('test wfs version of the service', () => {
        const action = { onChangeServiceProperty: () => {} };
        const spyOn = expect.spyOn(action, 'onChangeServiceProperty');
        ReactDOM.render(<CommonAdvancedSettings service={{type: "wfs", wfsVersion: "1.1.0"}} onChangeServiceProperty={action.onChangeServiceProperty}/>, document.getElementById("container"));
        const version = document.querySelector('[data-qa="wfs-version"]');
        expect(version.querySelector('.Select-value-label').textContent).toBe('WFS 1.1.0');
        TestUtils.Simulate.mouseDown(version.querySelector('.Select-control'), { button: 0 });
        const options = [...version.querySelectorAll('.Select-option')];
        expect(options.map(option => option.textContent)).toEqual(['wfsVersion.detect', 'WFS 2.0.0', 'WFS 1.1.0']);
        TestUtils.Simulate.mouseDown(options[1]);
        expect(spyOn.calls.map(call => call.arguments)).toEqual([['wfsVersion', '2.0.0']]);
    });
    it('test wms advanced options onChangeServiceProperty autoreload', () => {
        const action = {
            onChangeServiceProperty: () => {}
        };
        const spyOn = expect.spyOn(action, 'onChangeServiceProperty');
        ReactDOM.render(<CommonAdvancedSettings
            onChangeServiceProperty={action.onChangeServiceProperty}
            service={{type: "wfs", autoload: false}}
        />, document.getElementById("container"));
        const advancedSettingPanel = document.getElementsByClassName("mapstore-switch-panel");
        expect(advancedSettingPanel).toBeTruthy();
        const fields = document.querySelectorAll(".form-group");
        expect(fields.length).toBe(4);
        const autoload = document.querySelectorAll('input[type="checkbox"]')[0];
        const formGroup = document.querySelectorAll('.form-group')[0];
        expect(formGroup.textContent.trim()).toBe('catalog.autoload');
        expect(autoload).toExist();
        TestUtils.Simulate.change(autoload, { "target": { "checked": true }});
        expect(spyOn).toHaveBeenCalled();
        expect(spyOn.calls[0].arguments).toEqual([ 'autoload', true ]);
    });
    it('test component onChangeServiceProperty fetchMetadata', () => {
        const action = {
            onChangeServiceProperty: () => {}
        };
        const spyOn = expect.spyOn(action, 'onChangeServiceProperty');
        ReactDOM.render(<CommonAdvancedSettings
            onChangeServiceProperty={action.onChangeServiceProperty}
            service={{type: "cog", fetchMetadata: false}}
        />, document.getElementById("container"));
        const advancedSettingsPanel = document.getElementsByClassName("mapstore-switch-panel");
        expect(advancedSettingsPanel).toBeTruthy();
        const fetchMetadata = document.querySelectorAll('input[type="checkbox"]')[1];
        const formGroup = document.querySelectorAll('.form-group')[2];
        expect(formGroup.textContent.trim()).toBe('catalog.fetchMetadata.label');
        expect(fetchMetadata).toExist();
        TestUtils.Simulate.change(fetchMetadata, { "target": { "checked": true }});
        expect(spyOn).toHaveBeenCalled();
        expect(spyOn.calls[0].arguments).toEqual([ 'fetchMetadata', true ]);

        // Unset fetchMetadata
        TestUtils.Simulate.change(fetchMetadata, { "target": { "checked": false }});
        expect(spyOn).toHaveBeenCalled();
        expect(spyOn.calls[1].arguments).toEqual([ 'fetchMetadata', false ]);
    });
    it('test showing/hiding interactive legend checkbox for WFS', () => {
        ReactDOM.render(<CommonAdvancedSettings
            service={{type: "wfs"}}
        />, document.getElementById("container"));
        const interactiveLegendCheckboxInput = document.querySelector(".wfs-vector-interactive-legend .checkbox input[data-qa='display-interactive-legend-option']");
        expect(interactiveLegendCheckboxInput).toBeTruthy();
        const interactiveLegendLabel = document.querySelector(".wfs-vector-interactive-legend .checkbox span");
        expect(interactiveLegendLabel).toBeTruthy();
        expect(interactiveLegendLabel.innerHTML).toEqual('layerProperties.enableInteractiveLegendInfo.label');
    });
    it('test showing/hiding interactive legend checkbox for vector', () => {
        ReactDOM.render(<CommonAdvancedSettings
            service={{type: "vector"}}
        />, document.getElementById("container"));
        const interactiveLegendCheckboxInput = document.querySelector(".wfs-vector-interactive-legend .checkbox input[data-qa='display-interactive-legend-option']");
        expect(interactiveLegendCheckboxInput).toBeTruthy();
        const interactiveLegendLabel = document.querySelector(".wfs-vector-interactive-legend .checkbox span");
        expect(interactiveLegendLabel).toBeTruthy();
        expect(interactiveLegendLabel.innerHTML).toEqual('layerProperties.enableInteractiveLegendInfo.label');
    });
    it('test FlatGeobuf max features in view input', () => {
        const action = {
            onChangeServiceProperty: () => {}
        };
        const spyOn = expect.spyOn(action, 'onChangeServiceProperty');
        ReactDOM.render(<CommonAdvancedSettings
            onChangeServiceProperty={action.onChangeServiceProperty}
            service={{type: "flatgeobuf", layerOptions: { maxFeaturesInView: 7 }}}
        />, document.getElementById("container"));
        const maxFeaturesInView = document.querySelector("[data-qa='catalog-max-features-in-view']");
        expect(maxFeaturesInView).toBeTruthy();
        expect(maxFeaturesInView.value).toBe('7');
        expect(document.querySelector('.mapstore-info-popover')).toBeTruthy();
        TestUtils.Simulate.change(maxFeaturesInView, { "target": { "value": '15' }});
        expect(spyOn.calls[0].arguments).toEqual([
            'layerOptions',
            {
                maxFeaturesInView: 15
            }
        ]);
        TestUtils.Simulate.change(maxFeaturesInView, { "target": { "value": '' }});
        expect(spyOn.calls[1].arguments).toEqual([
            'layerOptions',
            {
                maxFeaturesInView: undefined
            }
        ]);
    });

    it('test if thumbnail checkbox is checked when globalHideThumbnail is true', () => {
        ReactDOM.render(
            <CommonAdvancedSettings
                globalHideThumbnail
                service={{ type: "csw" }}
            />, document.getElementById("container"));

        const thumbnailCheckbox = document.querySelector('.checkbox input');
        expect(thumbnailCheckbox).toBeTruthy();
        expect(thumbnailCheckbox.checked).toBeFalsy();
    });
    it('test if thumbnail checkbox is checked when globalHideThumbnail is false', () => {
        ReactDOM.render(
            <CommonAdvancedSettings
                globalHideThumbnail={false}
                service={{ type: "csw" }}
            />, document.getElementById("container"));

        const thumbnailCheckbox = document.querySelector('.checkbox input');
        expect(thumbnailCheckbox).toBeTruthy();
        expect(thumbnailCheckbox.checked).toBeTruthy();
    });
    it('test if thumbnail checkbox is checked when service.hideThumbnail is false', () => {
        ReactDOM.render(
            <CommonAdvancedSettings
                globalHideThumbnail
                service={{ type: "csw", hideThumbnail: false }}
            />, document.getElementById("container"));

        const thumbnailCheckbox = document.querySelector('.checkbox input');
        expect(thumbnailCheckbox).toBeTruthy();
        expect(thumbnailCheckbox.checked).toBeTruthy();
    });
    it('test if thumbnail checkbox is not checked when service.hideThumbnail is true', () => {
        ReactDOM.render(
            <CommonAdvancedSettings
                globalHideThumbnail
                service={{ type: "csw", hideThumbnail: true }}
            />, document.getElementById("container"));

        const thumbnailCheckbox = document.querySelector('.checkbox input');
        expect(thumbnailCheckbox).toBeTruthy();
        // here the priority for service hideThumbnail
        expect(thumbnailCheckbox.checked).toBeFalsy();
    });

});
