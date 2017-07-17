/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const expect = require('expect');
const featuregrid = require('../featuregrid');
const {setFeatures, dockSizeFeatures, setLayer, toggleTool, customizeAttribute, selectFeatures, deselectFeatures, createNewFeatures,
    featureSaving, toggleSelection, clearSelection, MODES, toggleEditMode, toggleViewMode, saveSuccess, clearChanges, saveError} = require('../../actions/featuregrid');
const museam = require('json-loader!../../test-resources/wfs/museam.json');
describe('Test the featuregrid reducer', () => {

    it('returns original state on unrecognized action', () => {
        let state = featuregrid(1, {type: 'UNKNOWN'});
        expect(state).toBe(1);
    });
    it('default state', () => {
        let state = featuregrid(undefined, {type: 'UNKNOWN'});
        expect(state).toExist();
        expect(state.pagination).toExist();
        expect(state.select).toExist();
        expect(state.features).toExist();
    });
    it('selectFeature', () => {
        let state = featuregrid( {}, selectFeatures([1, 2]));
        expect(state.select).toExist();
        expect(state.select.length).toBe(2);
        expect(state.select[0]).toBe(1);

        // check multiselect
        state = featuregrid( {multiselect: true}, selectFeatures([1, 2]));
        expect(state.select).toExist();
        expect(state.select.length).toBe(2);
        expect(state.select[0]).toBe(1);
        // check append mode with multiselect on
        state = featuregrid( state, selectFeatures([3], true));
        expect(state.select).toExist();
        expect(state.select.length).toBe(3);
        expect(state.select[2]).toBe(3);
    });
    it('clearSelection', () => {
        let state = featuregrid( {select: [1, 2]}, clearSelection());
        expect(state.select).toExist();
        expect(state.select.length).toBe(0);
    });
    it('deselectFeature', () => {
        let state = featuregrid( {select: [1, 2]}, deselectFeatures([1]));
        expect(state.select).toExist();
        expect(state.select[0]).toBe(2);
    });
    it('toggleSelection', () => {
        let state = featuregrid( {select: [1, 2], multiselect: true}, toggleSelection([1, 3, 4]));
        expect(state.select).toExist();
        expect(state.select.length).toBe(3);
        state = featuregrid( state, toggleSelection([2, 3, 4]));
        expect(state.select.length).toBe(0);
        state = featuregrid( state, toggleSelection([1]));
        expect(state.select.length).toBe(1);
        expect(state.select[0]).toBe(1);
        state = featuregrid( state, toggleSelection([1]));
        expect(state.select.length).toBe(0);
        // single select
        state = featuregrid( {select: [2], multiselect: false}, toggleSelection([1, 3, 4]));
        expect(state.select.length).toBe(1);
        state = featuregrid( {select: [], multiselect: false}, toggleSelection([1]));
        expect(state.select.length).toBe(1);
        state = featuregrid( state, toggleSelection([1]));
        expect(state.select.length).toBe(0);
    });
    it('setFeatures', () => {
        let state = featuregrid( {}, setFeatures(museam.features));
        expect(state.features).toExist();
        expect(state.features.length).toBe(1);
    });
    it('dockSizeFeatures', () => {
        let state = featuregrid( {}, dockSizeFeatures(200));
        expect(state.dockSize).toBe(200);
    });
    it('toggleEditMode', () => {
        let state = featuregrid( {}, toggleEditMode());
        expect(state.multiselect).toBeTruthy();
        expect(state.mode).toBe(MODES.EDIT);
    });
    it('toggleViewMode', () => {
        let state = featuregrid( {}, toggleViewMode());
        expect(state.multiselect).toBeFalsy();
        expect(state.mode).toBe(MODES.VIEW);
    });
    it('featureSaving', () => {
        let state = featuregrid( {}, featureSaving());
        expect(state.saving).toBeTruthy();
        expect(state.loading).toBeTruthy();
    });
    it('saveSuccess', () => {
        let state = featuregrid( {}, saveSuccess());
        expect(state.deleteConfirm).toBeFalsy();
        expect(state.saved).toBeTruthy();
        expect(state.saving).toBeFalsy();
        expect(state.loading).toBeFalsy();
    });
    it('clearChanges', () => {
        let state = featuregrid( {}, clearChanges());
        expect(state.deleteConfirm).toBeFalsy();
        expect(state.saved).toBeFalsy();
        expect(state.newFeatures.length).toBe(0);
        expect(state.changes.length).toBe(0);
    });
    it('createNewFeatures', () => {
        let state = featuregrid( {}, createNewFeatures([1]));
        expect(state.deleteConfirm).toBeFalsy();
        expect(state.saved).toBeFalsy();
        expect(state.newFeatures.length).toBe(1);
    });
    it('saveError', () => {
        let state = featuregrid( {}, saveError());
        expect(state.deleteConfirm).toBeFalsy();
        expect(state.saving).toBeFalsy();
        expect(state.loading).toBeFalsy();
    });
    it('setLayer', () => {
        let state = featuregrid( {}, setLayer("TEST_ID"));
        expect(state.selectedLayer).toBe("TEST_ID");
    });
    it('toggleTool', () => {
        let state = featuregrid( {}, toggleTool("toolA"));
        expect(state.tools).toExist();
        expect(state.tools.toolA).toBe(true);
        state = featuregrid( state, toggleTool("toolA"));
        expect(state.tools.toolA).toBe(false);
        state = featuregrid( state, toggleTool("toolA", "value"));
        expect(state.tools.toolA).toBe("value");
    });
    it('customizeAttribute', () => {
        let state = featuregrid( {}, customizeAttribute("attrA", "test", true));
        expect(state.attributes).toExist();
        expect(state.attributes.attrA).toExist();
        expect(state.attributes.attrA.test).toBe(true);
        // auto toggle
        state = featuregrid( state, customizeAttribute("attrA", "test"));
        expect(state.attributes.attrA.test).toBe(false);
        state = featuregrid( state, customizeAttribute("attrA", "test", "value"));
        expect(state.attributes.attrA.test).toBe("value");
    });

});
