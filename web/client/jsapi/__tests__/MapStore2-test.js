/*
 * Copyright 2019, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ReactDOM = require('react-dom');
const {findIndex} = require('lodash');
const ConfigUtils = require('../../utils/ConfigUtils');
const { INIT_MAP } = require('../../actions/map');
const { MAP_CONFIG_LOADED } = require('../../actions/config');
const { CHANGE_BROWSER_PROPERTIES } = require('../../actions/browser');

const { LOCAL_CONFIG_LOADED } = require('../../actions/localConfig');

const axios = require("../../libs/ajax");
const MockAdapter = require("axios-mock-adapter");

const expect = require('expect');
const MapStore2 = require('../MapStore2');

const testConfig = {
    enUs: 'base/web/client/translations/data.en-US',
    localConfig: 'base/web/client/test-resources/localConfig.json',
    versionURL: 'base/web/client/test-resources/version.txt',
    configUrl: 'base/web/client/test-resources/geostore/data/1#',
    originalUrl: 'base/web/client/test-resources/geostore/extjs/search/category/MAP/1.json#'
};
const testData = {
    enUs: require('json-loader!../../translations/data.en-US'),
    localConfig: require('../../test-resources/localConfig.json'),
    versionURL: "TEST",
    configUrl: require('json-loader!../../test-resources/geostore/data/1'),
    originalUrl: require('../../test-resources/geostore/extjs/search/category/MAP/1.json')
};


describe('MapStore2 API', () => {
    let mockAxios;
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        ConfigUtils.setLocalConfigurationFile('base/web/client/test-resources/localConfig.json');
        ConfigUtils.setConfigProp('translationsPath', "base/web/client/translations");
        mockAxios = new MockAdapter(axios);
        mockAxios.onGet(testConfig.versionURL).reply([200, testData.versionURL]);
        mockAxios.onGet(testConfig.configUrl).reply([200, testData.configUrl]);
        mockAxios.onGet(testConfig.originalUrl).reply([200, testData.originalUrl]);
        mockAxios.onGet(testConfig.localConfig).reply([200], testData.localConfig);
        mockAxios.onGet().reply((a) => {
            debugger;
            console.log(a);
            return [200];
        });
        setTimeout(done);
    });
    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        ConfigUtils.setLocalConfigurationFile('localConfig.json');
        ConfigUtils.setConfigProp('translationsPath', "translations");
        document.body.innerHTML = '';
        mockAxios.restore();
        setTimeout(done);
    });
    it('MapStore2 rendering with defaults', (done) => {

        MapStore2.create('container', {
            epics: {
                testEpic1: action$ => action$
                    .filter(a => a.type === CHANGE_BROWSER_PROPERTIES).do( () => {
                        //  CHANGE BROWSER PROPERTIES IS THE FIRST ACTION
                        done();
                    }).ignoreElements()
            },
            ...testConfig
        });
    });
    it('initMap action called before map load action', (done) => {

        MapStore2.create('container', {
            epics: {
                testEpic1: action$ => action$
                    .bufferCount(6).do((actions) => {
                        expect(findIndex(actions, a => a.type === INIT_MAP)).toBeLessThan(findIndex(actions, a => a.type === MAP_CONFIG_LOADED));
                        done();
                    }).ignoreElements()
            },
            ...testConfig
        });
    });
    it('onAction', (done) => {

        MapStore2.create('container', {
            ...testConfig
        });
        MapStore2.onAction(MAP_CONFIG_LOADED, () => done());
    });
    it('offAction', (done) => {
        MapStore2.create('container', {
            epics: {
                testEpic1: action$ => action$
                    .bufferCount(5).do((actions) => {
                        // the action has been emitted but the listener has not been called
                        expect(findIndex(actions, a => a.type === LOCAL_CONFIG_LOADED)).toBeLessThan(5);
                        done();
                    }).ignoreElements()
            },
            ...testConfig
        });
        const listenerToDeactivate = () => expect(true).toBe(false);
        MapStore2.onAction(LOCAL_CONFIG_LOADED, listenerToDeactivate);
        MapStore2.offAction(LOCAL_CONFIG_LOADED, listenerToDeactivate);
    });
    it('onStateChange', (done) => {

        MapStore2.create('container', {
            ...testConfig
        });
        let counter = 0;
        MapStore2.onStateChange( state => {
            if (state.map) {
                // this has been triggered more than once before the map to be loaded
                expect(counter).toBeGreaterThan(0);
                done();
            } else {
                counter++;
            }
        });
    });
});
