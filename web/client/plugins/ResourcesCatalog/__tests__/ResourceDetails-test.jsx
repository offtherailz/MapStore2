/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { Simulate } from 'react-dom/test-utils';

import ResourceDetailsPlugin from '../ResourceDetails';
import { getPluginForTest } from '../../__tests__/pluginsTestUtils';

function MockMenuItem({ active, onClick, glyph, labelId }) {
    return (
        <button className={`mock-item${active ? ' active' : ''}`} data-glyph={glyph} data-label={labelId} onClick={onClick} />
    );
}

describe('ResourceDetails Plugin', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });

    it('should support the SidebarMenu container with lower priority than BrandNavbar', () => {
        const { containers } = getPluginForTest(ResourceDetailsPlugin, {});
        expect(containers.BrandNavbar).toBeTruthy();
        expect(containers.SidebarMenu).toContain({ position: 25, priority: 0, doNotHide: true });
        expect(containers.SidebarMenu.priority).toBeLessThan(containers.BrandNavbar.priority);
        expect(containers.SidebarMenu.tool).toBeTruthy();
    });

    it('should not render the sidebar item without resourceType', () => {
        const { containers, store } = getPluginForTest(ResourceDetailsPlugin, {});
        const Tool = containers.SidebarMenu.tool;
        ReactDOM.render(
            <Provider store={store}><Tool component={MockMenuItem} /></Provider>,
            document.getElementById("container")
        );
        expect(document.querySelector('.mock-item')).toBeFalsy();
    });

    it('should toggle the details panel from the sidebar item', () => {
        const { containers, store } = getPluginForTest(ResourceDetailsPlugin, {
            map: { present: { info: { id: 10, name: 'Map' } } }
        });
        const Tool = containers.SidebarMenu.tool;
        ReactDOM.render(
            <Provider store={store}><Tool resourceType="MAP" component={MockMenuItem} /></Provider>,
            document.getElementById("container")
        );
        const item = document.querySelector('.mock-item');
        expect(item).toBeTruthy();
        expect(item.getAttribute('data-glyph')).toBe('details');
        expect(item.getAttribute('data-label')).toBe('resourcesCatalog.viewResourceProperties');
        expect(item.className).toNotContain('active');

        Simulate.click(item);
        expect(store.getState().resources.showDetails).toBe(true);
        expect(store.getState().resources.selectedResource).toBeTruthy();
        expect(document.querySelector('.mock-item').className).toContain('active');

        Simulate.click(document.querySelector('.mock-item'));
        expect(store.getState().resources.showDetails).toBe(false);
    });
});
