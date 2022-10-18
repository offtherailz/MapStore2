/*
 * Copyright 2018, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { castArray } from 'lodash';
import {Observable} from 'rxjs';
import { startWith, catchError } from 'rxjs/operators';

export const start = (stream$, actions = []) => stream$
    .startWith(...actions);
/**
 * wraps an epic with start/stop action. Useful shortcut for loading actions.
 * Accepts also an exception stream, that gets error before to emit loading stop.
 * @memberof observables.epics
 * @param {object|object[]} startAction start action(s)
 * @param {object|object[]} endAction end action(s)
 * @param {function} exception an optional function that returns the stream for exceptions
 */
export const wrapStartStop = (startAction, endAction, createExceptionStream) => stream$ =>
    Observable.concat(
        createExceptionStream ?
            stream$.pipe(startWith(...castArray(startAction)), catchError(createExceptionStream))
            : stream$.pipe(startWith(...castArray(startAction))),
        Observable.from(castArray(endAction))
    );


/**
 * Utility stream manipulation for epics
 * @module observables.epics
 */

export default {
    wrapStartStop
};
