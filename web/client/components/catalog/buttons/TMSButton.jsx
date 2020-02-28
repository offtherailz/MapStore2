
/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { Button as ButtonRB } from 'react-bootstrap';


import tooltip from '../../misc/enhancers/tooltip';
const Button = tooltip(ButtonRB);

import { getTileMap } from '../../../api/TMS';
import { tmsToLayer } from '../../../utils/CatalogUtils';


export default ({ record, children, addLayer = () => { }, ...props }) => {
    const [loading, setLoading] = useState(false);
    return (<Button
        disabled={loading}
        {...props}
        onClick={() => {
            setLoading(true);
            getTileMap(record.tileMapUrl).then( tileMap => {
                addLayer(tmsToLayer(record, tileMap));
                setLoading(false);
            });
        }}>
        {children}
    </Button>);
};
