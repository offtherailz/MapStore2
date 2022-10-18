/*
 * Copyright 2018, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { branch, compose, mapPropsStream, withStateHandlers } from 'recompose';
import {Observable} from 'rxjs';

import GeoStoreDAO from '../../../../api/GeoStoreDAO';

/**
 * retrieves groups for permission handling and returns as props
 * @param {Object} API the API to use
 */
const retrieveGroups = (API) =>
    mapPropsStream(props$ =>
        props$.combineLatest(
            props$
                .take(1)
                .switchMap(({ user }) =>
                    Observable.defer(() => API.getAvailableGroups(user))
                        .map(availableGroups => ({ availableGroups }))
                        .startWith({ loading: true })
                )
                .startWith({})
                .catch( () => Observable.of({})),
            (props, overrides) => ({
                ...props,
                ...overrides
            })
        )
    );

/**
 * retrieves permission for the resource
 * @param {object} API the API to use
 */
const retrievePermission = (API) =>
    mapPropsStream(props$ =>
        props$.combineLatest(
            props$
            // trigger when resource changes
                .distinctUntilKeyChanged('resource')
                .pluck('resource')
                .filter(resource => resource.id)
                .pluck('id')
                .distinctUntilChanged()
                .switchMap(id =>
                    Observable.defer(() => API.getResourcePermissions(id))
                        .map(rules => ({ rules }))
                        .startWith({ loading: true })
                )
                .startWith({})
                .catch(() => Observable.of({})),
            (props, overrides) => ({
                ...props,
                ...overrides
            })
        )
    );
const manageLocalPermissionChanges = withStateHandlers(
    () => ({}),
    {
        onUpdateRules: () => (rules) => ({
            rules: rules
        })
    }
);

export default ( API = GeoStoreDAO ) => branch(
    ({ disablePermission }) => !disablePermission,
    compose(
        retrieveGroups(API),
        retrievePermission(API),
        manageLocalPermissionChanges
    )
);

