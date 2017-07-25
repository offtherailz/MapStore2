/*
* Copyright 2017, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const expect = require('expect');
const assign = require('object-assign');
const {
    hasGeometrySelector,
    selectedFeatureSelector,
    selectedFeaturesSelector,
    modeSelector,
    selectedFeaturesCount,
    changesSelector,
    isDrawingSelector,
    isSimpleGeomSelector
} = require('../featuregrid');

const idFt1 = "idFt1";
const idFt2 = "idFt2";
const modeEdit = "edit";
let feature1 = {
    type: "Feature",
    geometry: {
        type: "Point",
        coordinates: [1, 2]
    },
    id: idFt1,
    properties: {
        someProp: "someValue"
    }
};
let feature2 = {
    type: "Feature",
    geometry: {
        type: "Point",
        coordinates: [1, 2]
    },
    id: idFt2,
    properties: {
        someProp: "someValue"
    }
};

let initialState = {
        query: {
        featureTypes: {
          'editing:poligoni': {
            geometry: [
              {
                label: 'geometry',
                attribute: 'geometry',
                type: 'geometry',
                valueId: 'id',
                valueLabel: 'name',
                values: []
              }
            ],
            original: {
              elementFormDefault: 'qualified',
              targetNamespace: 'http://geoserver.org/editing',
              targetPrefix: 'editing',
              featureTypes: [
                {
                  typeName: 'poligoni',
                  properties: [
                    {
                      name: 'name',
                      maxOccurs: 1,
                      minOccurs: 0,
                      nillable: true,
                      type: 'xsd:string',
                      localType: 'string'
                    },
                    {
                      name: 'geometry',
                      maxOccurs: 1,
                      minOccurs: 0,
                      nillable: true,
                      type: 'gml:Polygon',
                      localType: 'Polygon'
                    }
                  ]
                }
              ]
            },
            attributes: [
              {
                label: 'name',
                attribute: 'name',
                type: 'string',
                valueId: 'id',
                valueLabel: 'name',
                values: []
              }
            ]
          }
        },
        data: {},
        result: {
          type: 'FeatureCollection',
          totalFeatures: 4,
          features: [
            {
              type: 'Feature',
              id: 'poligoni.1',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [
                      -39,
                      39
                    ],
                    [
                      -39,
                      38
                    ],
                    [
                      -40,
                      38
                    ],
                    [
                      -39,
                      39
                    ]
                  ]
                ]
              },
              geometry_name: 'geometry',
              properties: {
                name: 'test'
              }
            },
            {
              type: 'Feature',
              id: 'poligoni.2',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [
                      -48.77929687,
                      37.54457732
                    ],
                    [
                      -49.43847656,
                      36.06686213
                    ],
                    [
                      -46.31835937,
                      35.53222623
                    ],
                    [
                      -44.47265625,
                      37.40507375
                    ],
                    [
                      -48.77929687,
                      37.54457732
                    ]
                  ]
                ]
              },
              geometry_name: 'geometry',
              properties: {
                name: 'poly2'
              }
            },
            {
              type: 'Feature',
              id: 'poligoni.6',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [
                      -50.16357422,
                      28.90239723
                    ],
                    [
                      -49.69116211,
                      28.24632797
                    ],
                    [
                      -48.2409668,
                      28.56522549
                    ],
                    [
                      -50.16357422,
                      28.90239723
                    ]
                  ]
                ]
              },
              geometry_name: 'geometry',
              properties: {
                name: 'ads'
              }
            },
            {
              type: 'Feature',
              id: 'poligoni.7',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [
                      -64.46777344,
                      33.90689555
                    ],
                    [
                      -66.22558594,
                      31.95216224
                    ],
                    [
                      -63.32519531,
                      30.97760909
                    ],
                    [
                      -64.46777344,
                      33.90689555
                    ]
                  ]
                ]
              },
              geometry_name: 'geometry',
              properties: {
                name: 'vvvv'
              }
            }
          ],
          crs: {
            type: 'name',
            properties: {
              name: 'urn:ogc:def:crs:EPSG::4326'
            }
          }
        },
        resultError: null,
        open: true,
        isNew: false,
        filterObj: {
          featureTypeName: 'editing:poligoni',
          groupFields: [
            {
              id: 1,
              logic: 'OR',
              index: 0
            }
          ],
          filterFields: [],
          spatialField: {
            method: null,
            attribute: 'geometry',
            operation: 'INTERSECTS',
            geometry: null
          },
          pagination: {
            startIndex: 0,
            maxFeatures: 20
          },
          filterType: 'OGC',
          ogcVersion: '1.1.0',
          sortOptions: null,
          hits: false
        },
        searchUrl: 'http://localhost:8081/geoserver/wfs?',
        typeName: 'editing:poligoni',
        url: 'http://localhost:8081/geoserver/wfs?',
        featureLoading: false
      },
      featuregrid: {
          mode: modeEdit,
          select: [feature1, feature2],
          changes: [{id: feature2.id, updated: {geometry: null}}]
      },
        highlight: {
            featuresPath: "featuregrid.select"
        }
    };


describe('Test featuregrid selectors', () => {
    afterEach(() => {
        initialState = assign({}, initialState, {
            featuregrid: {
                drawing: true,
                mode: modeEdit,
                select: [feature1, feature2],
                changes: [{id: feature2.id, updated: {geometry: null}}]
            }
        });
    });

    it('test if the feature has some geometry (true)', () => {
        const bool = hasGeometrySelector(initialState);
        expect(bool).toExist();
        expect(bool).toBe(true);
    });
    it('test if the feature has not geometry (false)', () => {
        initialState.featuregrid.select = [feature2];
        const bool = hasGeometrySelector(initialState);
        expect(bool).toBe(false);
    });
    it('test selectedFeatureSelector ', () => {
        const feature = selectedFeatureSelector(initialState);
        expect(feature).toExist();
        expect(feature.id).toBe(idFt1);
    });
    it('test selectedFeaturesSelector ', () => {
        const features = selectedFeaturesSelector(initialState);
        expect(features).toExist();
        expect(features.length).toBe(2);
    });
    it('test modeSelector ', () => {
        const mode = modeSelector(initialState);
        expect(mode).toExist();
        expect(mode).toBe(modeEdit);
    });
    it('test selectedFeaturesCount ', () => {
        const count = selectedFeaturesCount(initialState);
        expect(count).toExist();
        expect(count).toBe(2);
    });
    it('test changesSelector ', () => {
        const ftChanged = changesSelector(initialState);
        expect(ftChanged).toExist();
        expect(ftChanged.length).toBe(1);
    });
    it('test isDrawingSelector ', () => {
        const isdrawing = isDrawingSelector(initialState);
        expect(isdrawing).toExist();
        expect(isdrawing).toBe(true);
    });
    it('test isSimpleGeomSelector ', () => {
        const geomType = isSimpleGeomSelector(initialState);
        expect(geomType).toExist();
    });

});
