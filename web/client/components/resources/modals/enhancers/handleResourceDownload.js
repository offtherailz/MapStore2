/*
 * Copyright 2018, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mapPropsStream } from 'recompose';
import {Observable} from 'rxjs';

import { getResource } from '../../../../api/persistence';

export default mapPropsStream(props$ => {
    return Observable.from(props$).combineLatest(
        Observable.from(props$)
            .pluck('resource')
            .filter(res => res && res.id)
            .distinctUntilChanged()
            .switchMap(res =>
                getResource(res.id, { withData: false, includeAttributes: true })
                    .map(resource => ({
                        loading: false,
                        resource
                    }))
                    .startWith({ loading: true, resource: false })
                    .catch(e => Observable.of({ loading: false, errors: [e] }))
            )
            .startWith({}),
        (p1, p2) => ({
            ...p1,
            ...p2
        })
    );
});
