/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Observable} from 'rxjs';

export const onEpic = (action$, store) =>
    action$.filter((action) => action.type.indexOf('IF:') === 0)
        .switchMap((action) => {
            if (action.condition(store.value)) {
                return Observable.of(action.action);
            }
            return Observable.of(action.elseAction.call());
        });

export default {
    onEpic
};
