/**
 * Copyright 2015-2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';

import ReactDOM from 'react-dom';
import ZoomToMaxExtentButton from '../ZoomToMaxExtentButton';
import expect from 'expect';

// initializes Redux store
import { Provider } from 'react-redux';

import {createStore, combineReducers, applyMiddleware} from 'redux';

import thunkMiddleware from 'redux-thunk';
import mapConfig from '../../../reducers/config';

// reducers
const reducers = combineReducers({
    mapConfig
});

// compose middleware(s) to createStore
let finalCreateStore = applyMiddleware(thunkMiddleware)(createStore);

// export the store with the given reducers (and middleware applied)
const store = finalCreateStore(reducers, {});

describe('This test for ZoomToMaxExtentButton', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });

    // test DEFAULTS
    it('test default properties', (done) => {
        const container = document.getElementById("container");
        ReactDOM.render(
            <Provider store={store}>
                <ZoomToMaxExtentButton/>
            </Provider>,
            container,
            () => {
                expect(container.innerHTML).toExist();
                const zmeBtnNode = document.getElementById("mapstore-zoomtomaxextent");
                expect(zmeBtnNode).toExist();
                expect(zmeBtnNode.className.indexOf('default') >= 0).toBe(true);
                expect(zmeBtnNode.innerHTML).toExist();
                done();
            });
    });

    it('test glyphicon property', (done) => {
        const container = document.getElementById("container");
        ReactDOM.render(
            <Provider store={store}>
                <ZoomToMaxExtentButton/>
            </Provider>,
            container,
            () => {
                expect(container.innerHTML).toExist();
                const zmeBtnNode = document.getElementById("mapstore-zoomtomaxextent");
                expect(zmeBtnNode).toExist();
                const icons = zmeBtnNode.getElementsByTagName('span');
                expect(icons.length).toBe(1);
                done();
            });
    });

    it('test glyphicon property with text', (done) => {
        const container = document.getElementById("container");
        ReactDOM.render(
            <Provider store={store}>
                <ZoomToMaxExtentButton glyphicon="info-sign" text="button"/>
            </Provider>,
            container,
            () => {
                expect(container.innerHTML).toExist();
                const zmeBtnNode = document.getElementById("mapstore-zoomtomaxextent");
                expect(zmeBtnNode).toExist();
                const btnItems = zmeBtnNode.getElementsByTagName('span');
                expect(btnItems.length).toBe(1);

                expect(zmeBtnNode.innerText.indexOf("button") !== -1).toBe(true);
                done();
            });
    });

    it('test if click on button launches the proper action', () => {

        let genericTest = function(btnType) {
            let actions = {
                changeMapView: (c, z, mb, ms) => {
                    return {c, z, mb, ms};
                }
            };
            let spy = expect.spyOn(actions, "changeMapView");
            var cmp = ReactDOM.render(
                <ZoomToMaxExtentButton
                    {...actions} btnType={btnType}
                    mapConfig={{
                        maxExtent: [-110, -110, 90, 90],
                        zoom: 10,
                        bbox: {
                            crs: 'EPSG:4326',
                            bounds: {
                                minx: "-15",
                                miny: "-15",
                                maxx: "5",
                                maxy: "5"
                            }
                        },
                        size: {
                            height: 100,
                            width: 100
                        }
                    }}
                />
                , document.getElementById("container"));
            expect(cmp).toExist();

            let componentSpy = expect.spyOn(cmp, 'zoomToMaxExtent').andCallThrough();

            const cmpDom = document.getElementById("mapstore-zoomtomaxextent");
            expect(cmpDom).toExist();

            cmpDom.click();

            // check that the correct zoom to extent method has been invoked
            expect(componentSpy.calls.length).toBe(1);
            componentSpy.restore();

            expect(spy.calls.length).toBe(1);
            expect(spy.calls[0].arguments.length).toBe(6);
        };

        genericTest("normal");
        genericTest("image");
    });

    it('create glyphicon with custom css class', (done) => {
        const container = document.getElementById("container");
        ReactDOM.render(
            <Provider store={store}>
                <ZoomToMaxExtentButton className="custom" glyphicon="info-sign" text="button"/>
            </Provider>,
            container,
            () => {
                expect(container.innerHTML).toExist();
                const zmeBtnNode = document.getElementById("mapstore-zoomtomaxextent");
                expect(zmeBtnNode).toExist();
                expect(zmeBtnNode.className.indexOf('custom') !== -1).toBe(true);
                done();
            });
    });

    it('test zoom to initial extent', () => {

        let genericTest = function(btnType, projection) {
            let actions = {
                changeMapView: (c, z, mb, ms) => {
                    return {c, z, mb, ms};
                }
            };
            let actionsSpy = expect.spyOn(actions, "changeMapView");
            var cmp = ReactDOM.render(
                <ZoomToMaxExtentButton
                    {...actions} btnType={btnType}
                    useInitialExtent
                    mapConfig={{
                        size: {
                            height: 100,
                            width: 100
                        },
                        projection: projection
                    }}
                    mapInitialConfig={{
                        zoom: 10,
                        center: {
                            x: 1250000.000000,
                            y: 5370000.000000,
                            crs: "EPSG:900913"
                        },
                        projection: "EPSG:900913"
                    }}
                />
                , document.getElementById("container"));
            expect(cmp).toExist();

            let componentSpy = expect.spyOn(cmp, 'zoomToInitialExtent').andCallThrough();

            const cmpDom = document.getElementById("mapstore-zoomtomaxextent");
            expect(cmpDom).toExist();

            cmpDom.click();

            // check that the correct zoom to extent method has been invoked
            expect(componentSpy.calls.length).toBe(1);
            componentSpy.restore();

            expect(actionsSpy.calls.length).toBe(1);
            expect(actionsSpy.calls[0].arguments.length).toBe(7);
            expect(actionsSpy.calls[0].arguments[0]).toExist();
            expect(actionsSpy.calls[0].arguments[1]).toExist();
            // the bbox is null since no hook was registered
            expect(actionsSpy.calls[0].arguments[2]).toNotExist();
            expect(actionsSpy.calls[0].arguments[3]).toExist();
            expect(actionsSpy.calls[0].arguments[4]).toNotExist();
            expect(actionsSpy.calls[0].arguments[5]).toEqual(projection);
        };

        genericTest("normal", "EPSG:900913");
        genericTest("normal", "EPSG:4326");
        genericTest("image", "EPSG:900913");
        genericTest("image", "EPSG:4326");
    });
});
