/*
 * Copyright 2024, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import useResourcePanelWrapper from '../useResourcePanelWrapper';
import expect from 'expect';
import { act } from 'react-dom/test-utils';

const Component = (props) => {
    const {
        stickyTop,
        stickyBottom
    } = useResourcePanelWrapper(props);
    return <div id="component" style={{ top: stickyTop, bottom: stickyBottom }} />;
};

// waits for the next animation frames where the hook updates the values
const waitFrames = () => act(() => new Promise(resolve => setTimeout(resolve, 100)));

describe('useResourcePanelWrapper', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        window.scrollTo(0, 0);
        setTimeout(done);
    });
    it('should apply top and bottom styles to the component based on the existing header, navbar and footer components', () => {
        act(() => {
            ReactDOM.render(
                <div style={{ position: 'relative', height: 500 }}>
                    <div id="header" style={{ position: 'fixed', top: 0, left: 0, height: 30 }}></div>
                    <div id="navbar" style={{ position: 'fixed', top: 30, left: 0, height: 30 }}></div>
                    <Component
                        headerNodeSelector="#header"
                        navbarNodeSelector="#navbar"
                        footerNodeSelector="#footer"
                        active
                    />
                    <div id="footer" style={{ position: 'fixed', bottom: 0, left: 0, height: 30 }}></div>
                </div>, document.getElementById("container"));
        });
        const componentNode = document.querySelector('#component');
        expect(componentNode.style.top).toBe('60px');
        expect(componentNode.style.bottom).toBe('30px');
    });
    it('should not compute top and bottom if not active', () => {
        act(() => {
            ReactDOM.render(
                <div>
                    <div id="header" style={{ position: 'fixed', top: 0, left: 0, height: 30 }}></div>
                    <Component headerNodeSelector="#header" />
                </div>, document.getElementById("container"));
        });
        expect(document.querySelector('#component').style.top).toBe('0px');
    });
    it('should update top when the header changes size', async() => {
        act(() => {
            ReactDOM.render(
                <div>
                    <div id="header" style={{ position: 'fixed', top: 0, left: 0, height: 0 }}></div>
                    <Component headerNodeSelector="#header" active />
                </div>, document.getElementById("container"));
        });
        expect(document.querySelector('#component').style.top).toBe('0px');
        document.querySelector('#header').style.height = '90px';
        await waitFrames();
        expect(document.querySelector('#component').style.top).toBe('90px');
    });
    it('should update top when the header is added to the page after mount', async() => {
        act(() => {
            ReactDOM.render(<Component headerNodeSelector="#header" active />, document.getElementById("container"));
        });
        expect(document.querySelector('#component').style.top).toBe('0px');
        const header = document.createElement('div');
        header.id = 'header';
        header.style.position = 'fixed';
        header.style.top = '0px';
        header.style.height = '40px';
        document.body.appendChild(header);
        await waitFrames();
        expect(document.querySelector('#component').style.top).toBe('40px');
    });
    it('should follow the visible bottom edge of a header scrolled out of the page', async() => {
        act(() => {
            ReactDOM.render(
                <div>
                    <div id="header" style={{ height: 50 }}></div>
                    <div style={{ height: 3000 }}></div>
                    <Component headerNodeSelector="#header" active />
                </div>, document.getElementById("container"));
        });
        const initialTop = parseFloat(document.querySelector('#component').style.top);
        expect(initialTop > 0).toBe(true);
        window.scrollTo(0, 20);
        await waitFrames();
        expect(parseFloat(document.querySelector('#component').style.top)).toBe(initialTop - 20);
        window.scrollTo(0, 1000);
        await waitFrames();
        expect(document.querySelector('#component').style.top).toBe('0px');
    });
    it('should ignore a footer outside of the visible area', () => {
        act(() => {
            ReactDOM.render(
                <div>
                    <div style={{ height: 3000 }}></div>
                    <Component footerNodeSelector="#footer" active />
                    <div id="footer" style={{ height: 30 }}></div>
                </div>, document.getElementById("container"));
        });
        expect(document.querySelector('#component').style.bottom).toBe('0px');
    });
});
