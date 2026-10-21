/*
 * Copyright 2022, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Simulate } from 'react-dom/test-utils';

import DownloadDialog from '../DownloadDialog';

describe('Test for DownloadDialog component', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container" style="height:500px"></div>';
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });

    it('exports the attributes shown by the table widget', () => {
        const actions = { onExport: () => {} };
        const spy = expect.spyOn(actions, 'onExport');
        const downloadLayer = { type: 'wms', id: 'layer', widgetId: 'w1', search: { url: 'http://u.r.l' } };
        ReactDOM.render(<DownloadDialog
            enabled
            service="wfs"
            downloadLayer={downloadLayer}
            attributes={[{ attribute: 'A' }, { attribute: 'B' }, { attribute: 'C' }]}
            customAttributeSettings={{ B: { hide: true } }}
            widgetPropertyNames={['A', 'C']}
            onExport={actions.onExport} />, document.getElementById("container"));
        Simulate.click(document.querySelector('.download-button'));
        expect(spy.calls.length).toBe(1);
        expect(spy.calls[0].arguments[2].propertyName).toEqual(['A', 'C']);
    });

    it('exports the attributes of the attribute table without a table widget', () => {
        const actions = { onExport: () => {} };
        const spy = expect.spyOn(actions, 'onExport');
        const mapLayer = { type: 'wms', id: 'layer', search: { url: 'http://u.r.l' } };
        ReactDOM.render(<DownloadDialog
            enabled
            service="wfs"
            mapLayer={mapLayer}
            attributes={[{ attribute: 'A' }, { attribute: 'B' }, { attribute: 'C' }]}
            customAttributeSettings={{ B: { hide: true } }}
            onExport={actions.onExport} />, document.getElementById("container"));
        Simulate.click(document.querySelector('.download-button'));
        expect(spy.calls[0].arguments[2].propertyName).toEqual(['A', 'C']);
    });

    it('render download options', (done) => {
        const selectedLayer =
        {
            type: 'wfs',
            visibility: true,
            id: 'mapstore:states__7',
            search: {
                url: 'http://u.r.l'
            }
        };
        ReactDOM.render(<DownloadDialog enabled service="wps" mapLayer={selectedLayer} />, document.getElementById("container"));
        const dialog = document.getElementById('mapstore-export');
        expect(dialog).toBeTruthy();
        setTimeout(() => {
            try {
                expect(dialog.getElementsByTagName('form')[0]).toBeTruthy();
                done();
            } catch (e) {
                done(e);
            }
        }, 0);
    });

    it('render download options with only "wps" available', (done) => {
        const selectedLayer =
        {
            type: 'wms',
            visibility: true,
            id: 'mapstore:states__7'
        };
        ReactDOM.render(<DownloadDialog enabled service="wps" wpsAvailable mapLayer={selectedLayer} />, document.getElementById("container"));
        const dialog = document.getElementById('mapstore-export');
        expect(dialog).toBeTruthy();
        setTimeout(() => {
            try {
                expect(dialog.getElementsByTagName('form')[0]).toBeTruthy();
                done();
            } catch (e) {
                done(e);
            }
        }, 0);
    });
    it('should not render service selector with true hideServiceSelector prop', (done) => {
        const selectedLayer = {
            type: 'wms',
            visibility: true,
            id: 'mapstore:states__7',
            search: {
                url: '/geoserver/wfs'
            }
        };
        ReactDOM.render(<DownloadDialog enabled service="wps" wpsAvailable mapLayer={selectedLayer} hideServiceSelector />, document.getElementById("container"));
        const dialog = document.getElementById('mapstore-export');
        expect(dialog).toBeTruthy();
        setTimeout(() => {
            try {
                expect(dialog.getElementsByTagName('form')[0]).toBeTruthy();
                const selectors = dialog.querySelectorAll('.Select');
                expect(selectors.length).toBe(1);
                done();
            } catch (e) {
                done(e);
            }
        }, 0);
    });
    it('should render serviceNotAvailable', (done) => {
        const selectedLayer = {
            type: 'wms',
            visibility: true,
            id: 'mapstore:states__7'
        };
        ReactDOM.render(<DownloadDialog enabled service="wps" wpsAvailable={false} mapLayer={selectedLayer} />, document.getElementById("container"));
        setTimeout(() => {
            const dialog = document.querySelector('.empty-state-container');
            expect(dialog).toBeTruthy();
            expect(dialog.textContent).toBe('layerdownload.noSupportedServiceFound');
            const button = document.querySelector('.download-button');
            expect(button).toBeFalsy();
            done();
        }, 0);
    });
    it('render download options for raster layer with time dimension and range mode', (done) => {
        const selectedLayer = {
            type: 'wms',
            visibility: true,
            id: 'mapstore:raster__1',
            dimensions: [{ name: 'time' }]
        };
        const wpsFormats = [
            { name: 'geotiff', label: 'GeoTIFF' },
            { name: 'application/x-netcdf', label: 'NetCDF' }
        ];
        ReactDOM.render(
            <DownloadDialog
                enabled
                service="wps"
                wpsAvailable
                mapLayer={selectedLayer}
                wpsFormats={wpsFormats}
                isRangeEnabled
            />,
            document.getElementById("container")
        );
        const dialog = document.getElementById('mapstore-export');
        expect(dialog).toBeTruthy();
        setTimeout(() => {
            try {
                expect(dialog.getElementsByTagName('form')[0]).toBeTruthy();
                done();
            } catch (e) {
                done(e);
            }
        }, 0);
    });
});
