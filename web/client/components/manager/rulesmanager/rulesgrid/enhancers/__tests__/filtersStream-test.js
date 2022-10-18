/*
 * Copyright 2018, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';

import filtersStream from '../filtersStream';
import {Observable} from 'rxjs';
describe('rulegrid filterStream', () => {
    it('debounce addFilter$', (done) => {
        const setFilters = (filter) => {
            expect(filter).toExist();
            expect(filter).toBe("WFS");
            done();
        };
        const addFilter$ = Observable.from(["WF", "WFS"]);
        const prop$ = Observable.of({setFilters, addFilter$});
        filtersStream(prop$).subscribe(() => {});
    });
});
