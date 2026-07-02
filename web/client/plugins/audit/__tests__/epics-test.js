import expect from 'expect';
import { testEpic } from '@mapstore/epics/__tests__/epicTestUtils';
import { LOGIN_SUCCESS } from '@mapstore/actions/security';
import { TEXT_SEARCH_STARTED, TEXT_SEARCH_ITEM_SELECTED } from '@mapstore/actions/search';
import { LOAD_FEATURE_INFO } from '@mapstore/actions/mapInfo';
import { CLICK_ON_MAP } from '@mapstore/actions/map';
import { SAVE_SUCCESS, DELETE_SELECTED_FEATURES, SET_LAYER, UPDATE_FILTER  } from '@mapstore/actions/featuregrid';
import { MAP_CONFIG_LOADED } from '@mapstore/actions/config';
import { DASHBOARD_LOADED } from '@mapstore/actions/dashboard';
import { GEOSTORY_LOADED } from '@mapstore/actions/geostory';

import {
    genericAuditEpic
} from '../epics';

import {
    RECORD_AUDIT
} from '../actions';

describe('Audit Epics', () => {

    describe('genericAuditEpic', () => {
        describe('LOGIN_SUCCESS handling', () => {
            it('should not record audit data when audit is disabled', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: false
                        }
                    },
                    router: {
                        location: {
                            pathname: '/context/test-context'
                        }
                    }
                };

                testEpic(genericAuditEpic, 0, {
                    type: LOGIN_SUCCESS,
                    userDetails: {
                        user: {
                            name: 'testUser'
                        }
                    }
                }, actions => {
                    expect(actions.length).toBe(0);
                }, mockState, done);
            });

            it('should record audit data when LOGIN_SUCCESS occurs and audit is enabled', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/context/test-context'
                        }
                    }
                };

                testEpic(genericAuditEpic, 1, {
                    type: LOGIN_SUCCESS,
                    userDetails: {
                        user: {
                            name: 'testUser'
                        }
                    }
                }, actions => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(RECORD_AUDIT);
                    expect(actions[0].eventType).toBe('LOGIN');
                    expect(actions[0].data).toExist();
                    expect(actions[0].data.eventType).toBe('LOGIN');
                    expect(actions[0].data.resourceType).toBe("CONTEXT");
                    expect(actions[0].data.appContext).toBe('test-context');
                    expect(actions[0].timestamp).toExist();
                }, mockState, done);
            });
        });

        describe('SEARCH handling', () => {

            it('should record SEARCH audit event when searches something on input', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/viewer/456'
                        }
                    },
                    search: {
                        searchText: 'New York'
                    }
                };

                testEpic(genericAuditEpic, 1, {
                    type: TEXT_SEARCH_STARTED,
                    searchText: 'New York'
                }, actions => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(RECORD_AUDIT);
                    expect(actions[0].eventType).toBe('SEARCH');
                    expect(actions[0].data).toExist();
                    expect(actions[0].data.eventType).toBe('SEARCH');
                    expect(actions[0].data.resourceType).toBe('MAP');
                    expect(actions[0].data.resourceId).toBe('456');
                    expect(actions[0].data.searchText).toBe('New York');
                    expect(actions[0].timestamp).toExist();
                }, mockState, done);
            });
        });

        describe('SEARCH_CLICK handling', () => {

            it('should record SEARCH_CLICK audit event when search item is selected', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/viewer/123'
                        }
                    }
                };

                testEpic(genericAuditEpic, 1, {
                    type: TEXT_SEARCH_ITEM_SELECTED,
                    item: {
                        type: 'Feature',
                        geometry: {
                            type: "Point",
                            coordinates: [
                                4.4,
                                50.7
                            ]
                        },
                        properties: {
                            display_name: 'Main Street, New York, NY'
                        },
                        __SERVICE__: {
                            type: 'nominatim'
                        }
                    },
                    service: {
                        type: 'nominatim'
                    }
                }, actions => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(RECORD_AUDIT);
                    expect(actions[0].eventType).toBe('SEARCH_CLICK');
                    expect(actions[0].data).toExist();
                    expect(actions[0].data.eventType).toBe('SEARCH_CLICK');
                    expect(actions[0].data.resourceType).toBe('MAP');
                    expect(actions[0].data.resourceId).toBe('123');
                    expect(actions[0].data.service).toBe('nominatim');
                    expect(actions[0].data.lat).toBe(50.7);
                    expect(actions[0].data.lon).toBe(4.4);
                    expect(actions[0].data.title).toBe('Main Street, New York, NY');
                    expect(actions[0].timestamp).toExist();
                }, mockState, done);
            });
        });

        describe('MAP_CLICK handling', () => {

            it('should record MAP_CLICK audit event when user clicks on map', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/viewer/789'
                        }
                    }
                };

                testEpic(genericAuditEpic, 1, {
                    type: CLICK_ON_MAP,
                    point: {
                        latlng: {
                            lat: 40.7128,
                            lng: -74.0060
                        }
                    }
                }, actions => {
                    expect(actions.length).toBe(1);

                    // MAP_CLICK event with coordinates only
                    expect(actions[0].type).toBe(RECORD_AUDIT);
                    expect(actions[0].data.eventType).toBe('MAP_CLICK');
                    expect(actions[0].data.resourceType).toBe('MAP');
                    expect(actions[0].data.resourceId).toBe('789');
                    expect(actions[0].data.lat).toBe(40.7128);
                    expect(actions[0].data.lon).toBe(-74.0060);
                    expect(actions[0].data.layerUrl).toNotExist();
                    expect(actions[0].data.layerName).toNotExist();
                    expect(actions[0].timestamp).toExist();
                }, mockState, done);
            });
        });

        describe('MAP_CLICK_RESULT handling', () => {

            it('should record MAP_CLICK_RESULT audit events when all queries complete with features', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/viewer/789'
                        }
                    },
                    mapInfo: {
                        clickPoint: {
                            latlng: {
                                lat: 40.7128,
                                lng: -74.0060
                            }
                        },
                        requests: [
                            { reqId: 'req1' },
                            { reqId: 'req2' }
                        ],
                        responses: [
                            {
                                layerMetadata: {
                                    features: [{ type: 'Feature', properties: {} }]
                                },
                                layer: {
                                    name: 'roads',
                                    url: 'https://geoserver.example.com/wms'
                                }
                            },
                            {
                                layerMetadata: {
                                    features: [{ type: 'Feature', properties: {} }]
                                },
                                layer: {
                                    name: 'buildings',
                                    url: 'https://geoserver.example.com/wms2'
                                }
                            }
                        ]
                    }
                };

                // Expected events: 2 MAP_CLICK_RESULT (one per layer with features)
                testEpic(genericAuditEpic, 2, {
                    type: LOAD_FEATURE_INFO,
                    reqId: 'req2'
                }, actions => {
                    expect(actions.length).toBe(2);

                    // First event - MAP_CLICK_RESULT for roads layer
                    expect(actions[0].type).toBe(RECORD_AUDIT);
                    expect(actions[0].data.eventType).toBe('MAP_CLICK_RESULT');
                    expect(actions[0].data.resourceType).toBe('MAP');
                    expect(actions[0].data.resourceId).toBe('789');
                    expect(actions[0].data.layerUrl).toBe('https://geoserver.example.com/wms');
                    expect(actions[0].data.layerName).toBe('roads');
                    expect(actions[0].data.lat).toBe(40.7128);
                    expect(actions[0].data.lon).toBe(-74.0060);
                    expect(actions[0].timestamp).toExist();

                    // Second event - MAP_CLICK_RESULT for buildings layer
                    expect(actions[1].type).toBe(RECORD_AUDIT);
                    expect(actions[1].data.eventType).toBe('MAP_CLICK_RESULT');
                    expect(actions[1].data.layerUrl).toBe('https://geoserver.example.com/wms2');
                    expect(actions[1].data.layerName).toBe('buildings');
                    expect(actions[1].data.lat).toBe(40.7128);
                    expect(actions[1].data.lon).toBe(-74.0060);
                }, mockState, done);
            });

            it('should not record MAP_CLICK_RESULT when no features are returned', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/viewer/789'
                        }
                    },
                    mapInfo: {
                        clickPoint: {
                            latlng: {
                                lat: 40.7128,
                                lng: -74.0060
                            }
                        },
                        requests: [
                            { reqId: 'req1' }
                        ],
                        responses: [
                            {
                                layerMetadata: {
                                    features: [] // No features
                                },
                                layer: {
                                    name: 'empty-layer',
                                    url: 'https://geoserver.example.com/wms'
                                }
                            }
                        ]
                    }
                };

                // Expected events: None (no MAP_CLICK_RESULT since no features)
                testEpic(genericAuditEpic, 0, {
                    type: LOAD_FEATURE_INFO,
                    reqId: 'req1'
                }, actions => {
                    expect(actions.length).toBe(0);
                }, mockState, done);
            });
        });
        describe('ATTRIBUTE_TABLE_OPEN handling', () => {

            it('should record ATTRIBUTE_TABLE_OPEN audit event when attribute table is opened', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/viewer/789'
                        }
                    },
                    layers: {
                        flat: [
                            {
                                id: 'test-layer-1',
                                name: 'TestLayer',
                                url: 'https://example.com/wfs'
                            },
                            {
                                id: 'test-layer-2',
                                name: 'AnotherLayer',
                                url: 'https://example.com/wfs2'
                            }
                        ]
                    }
                };

                testEpic(genericAuditEpic, 1, {
                    type: SET_LAYER,
                    id: 'test-layer-1'
                }, actions => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(RECORD_AUDIT);
                    expect(actions[0].eventType).toBe('ATTRIBUTE_TABLE_OPEN');
                    expect(actions[0].data).toExist();
                    expect(actions[0].data.eventType).toBe('ATTRIBUTE_TABLE_OPEN');
                    expect(actions[0].data.resourceType).toBe('MAP');
                    expect(actions[0].data.resourceId).toBe('789');
                    expect(actions[0].data.layerUrl).toBe('https://example.com/wfs');
                    expect(actions[0].data.layerName).toBe('TestLayer');
                    expect(actions[0].timestamp).toExist();
                }, mockState, done);
            });

            it('should not record audit when layer is not found', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/viewer/789'
                        }
                    },
                    layers: {
                        flat: [
                            {
                                id: 'test-layer-1',
                                name: 'TestLayer',
                                url: 'https://example.com/wfs'
                            }
                        ]
                    }
                };

                testEpic(genericAuditEpic, 0, {
                    type: SET_LAYER,
                    id: 'non-existent-layer'
                }, actions => {
                    expect(actions.length).toBe(0);
                }, mockState, done);
            });
        });

        describe('ATTRIBUTE_TABLE_SEARCH handling', () => {

            it('should record ATTRIBUTE_TABLE_SEARCH audit event when user searches in column filter', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/viewer/456'
                        }
                    },
                    featuregrid: {
                        selectedLayer: 'cities-layer'
                    },
                    layers: {
                        flat: [
                            {
                                id: 'cities-layer',
                                name: 'Cities',
                                url: 'https://example.com/geoserver/wfs'
                            }
                        ]
                    }
                };

                testEpic(genericAuditEpic, 1, {
                    type: UPDATE_FILTER,
                    update: {
                        attribute: 'city_name',
                        value: 'Paris',
                        operator: 'ilike',
                        type: 'string'
                    }
                }, actions => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(RECORD_AUDIT);
                    expect(actions[0].eventType).toBe('ATTRIBUTE_TABLE_SEARCH');
                    expect(actions[0].data).toExist();
                    expect(actions[0].data.eventType).toBe('ATTRIBUTE_TABLE_SEARCH');
                    expect(actions[0].data.resourceType).toBe('MAP');
                    expect(actions[0].data.resourceId).toBe('456');
                    expect(actions[0].data.layerUrl).toBe('https://example.com/geoserver/wfs');
                    expect(actions[0].data.layerName).toBe('Cities');
                    expect(actions[0].data.attributeName).toBe('city_name');
                    expect(actions[0].data.attributeValue).toBe('Paris');
                    expect(actions[0].data.operator).toBe('ilike');
                    expect(actions[0].timestamp).toExist();
                }, mockState, done);
            });
        });

        describe('WFS Edit Events', () => {

            describe('RECORD_CREATION handling', () => {

                it('should record RECORD_CREATION audit events when new features are saved', (done) => {
                    const mockState = {
                        audit: {
                            config: {
                                enabled: true
                            }
                        },
                        router: {
                            location: {
                                pathname: '/context/map-context'
                            }
                        },
                        featuregrid: {
                            selectedLayer: 'test-layer-id',
                            newFeatures: [
                                { id: 'temp-id-1', properties: { name: 'Feature 1' } },
                                { id: 'temp-id-2', properties: { name: 'Feature 2' } }
                            ]
                        },
                        layers: {
                            flat: [
                                {
                                    id: 'test-layer-id',
                                    name: 'states_test',
                                    title: 'Test States',
                                    url: 'https://geoserver.example.com/geoserver/wfs'
                                }
                            ]
                        }
                    };

                    // Expected: 2 RECORD_CREATION events (one per new feature)
                    testEpic(genericAuditEpic, 2, {
                        type: SAVE_SUCCESS
                    }, actions => {
                        expect(actions.length).toBe(2);

                        // First RECORD_CREATION event
                        expect(actions[0].type).toBe(RECORD_AUDIT);
                        expect(actions[0].eventType).toBe('RECORD_CREATION');
                        expect(actions[0].data.resourceType).toBe('CONTEXT');
                        expect(actions[0].data.appContext).toBe('map-context');
                        expect(actions[0].data.layerUrl).toBe('https://geoserver.example.com/geoserver/wfs');
                        expect(actions[0].data.layerName).toBe('states_test');
                        expect(actions[0].timestamp).toExist();

                        // Second RECORD_CREATION event
                        expect(actions[1].type).toBe(RECORD_AUDIT);
                        expect(actions[1].eventType).toBe('RECORD_CREATION');
                    }, mockState, done);
                });

            });

            describe('RECORD_UPDATE handling', () => {

                it('should record RECORD_UPDATE audit events when features are modified', (done) => {
                    const mockState = {
                        audit: {
                            config: {
                                enabled: true
                            }
                        },
                        router: {
                            location: {
                                pathname: '/context/map-context'
                            }
                        },
                        featuregrid: {
                            selectedLayer: 'test-layer-id',
                            newFeatures: [],
                            changes: [ {
                                id: 'states_test.64',
                                updated: {
                                    STATE_NAME: 'Alabama Updated'
                                }
                            },
                            {
                                id: 'states_test.65',
                                updated: {
                                    STATE_NAME: 'Alaska Updated'
                                }
                            }
                            ]
                        },
                        layers: {
                            flat: [
                                {
                                    id: 'test-layer-id',
                                    name: 'states_test',
                                    title: 'Test States',
                                    url: 'https://geoserver.example.com/geoserver/wfs'
                                }
                            ]
                        }
                    };

                    // Expected: 2 RECORD_UPDATE events (one per modified feature)
                    testEpic(genericAuditEpic, 2, {
                        type: SAVE_SUCCESS
                    }, actions => {
                        expect(actions.length).toBe(2);

                        // First RECORD_UPDATE event
                        expect(actions[0].type).toBe(RECORD_AUDIT);
                        expect(actions[0].eventType).toBe('RECORD_UPDATE');
                        expect(actions[0].data.resourceType).toBe('CONTEXT');
                        expect(actions[0].data.appContext).toBe('map-context');
                        expect(actions[0].data.layerUrl).toBe('https://geoserver.example.com/geoserver/wfs');
                        expect(actions[0].data.layerName).toBe('states_test');
                        expect(actions[0].data.recordId).toBe('states_test.64');
                        expect(actions[0].timestamp).toExist();

                        // Second RECORD_UPDATE event
                        expect(actions[1].type).toBe(RECORD_AUDIT);
                        expect(actions[1].eventType).toBe('RECORD_UPDATE');
                        expect(actions[1].data.recordId).toBe('states_test.65');
                    }, mockState, done);
                });

            });

            describe('RECORD_DELETE handling', () => {

                it('should record RECORD_DELETE audit events when features are deleted', (done) => {
                    const mockState = {
                        audit: {
                            config: {
                                enabled: true
                            }
                        },
                        router: {
                            location: {
                                pathname: '/context/map-context'
                            }
                        },
                        featuregrid: {
                            selectedLayer: 'test-layer-id',
                            select: [
                                { id: 'states_test.64', properties: { STATE_NAME: 'State 1' } },
                                { id: 'states_test.65', properties: { STATE_NAME: 'State 2' } }
                            ]
                        },
                        layers: {
                            flat: [
                                {
                                    id: 'test-layer-id',
                                    name: 'states_test',
                                    title: 'Test States',
                                    url: 'https://geoserver.example.com/geoserver/wfs'
                                }
                            ]
                        }
                    };

                    // Expected: 2 RECORD_DELETE events (one per selected feature)
                    testEpic(genericAuditEpic, 2, {
                        type: DELETE_SELECTED_FEATURES
                    }, actions => {
                        expect(actions.length).toBe(2);

                        // First RECORD_DELETE event
                        expect(actions[0].type).toBe(RECORD_AUDIT);
                        expect(actions[0].eventType).toBe('RECORD_DELETE');
                        expect(actions[0].data.resourceType).toBe('CONTEXT');
                        expect(actions[0].data.appContext).toBe('map-context');
                        expect(actions[0].data.layerUrl).toBe('https://geoserver.example.com/geoserver/wfs');
                        expect(actions[0].data.layerName).toBe('states_test');
                        expect(actions[0].data.recordId).toBe('states_test.64');
                        expect(actions[0].timestamp).toExist();

                        // Second RECORD_DELETE event
                        expect(actions[1].type).toBe(RECORD_AUDIT);
                        expect(actions[1].eventType).toBe('RECORD_DELETE');
                        expect(actions[1].data.recordId).toBe('states_test.65');
                    }, mockState, done);
                });

            });

        });

        describe('RESOURCE_ACCESS handling', () => {

            it('should record RESOURCE_ACCESS audit event when accessing a map', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/viewer/456'
                        }
                    }
                };

                testEpic(genericAuditEpic, 1, {
                    type: MAP_CONFIG_LOADED
                }, actions => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(RECORD_AUDIT);
                    expect(actions[0].eventType).toBe('RESOURCE_ACCESS');
                    expect(actions[0].data).toExist();
                    expect(actions[0].data.eventType).toBe('RESOURCE_ACCESS');
                    expect(actions[0].data.resourceType).toBe('MAP');
                    expect(actions[0].data.resourceId).toBe('456');
                    expect(actions[0].timestamp).toExist();
                }, mockState, done);
            });

            it('should record RESOURCE_ACCESS audit event when accessing a context', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/context/test-context'
                        }
                    },
                    context: {
                        resource: {
                            id: 20,
                            name: 'Test Context'
                        }
                    }
                };

                testEpic(genericAuditEpic, 1, {
                    type: MAP_CONFIG_LOADED
                }, actions => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(RECORD_AUDIT);
                    expect(actions[0].eventType).toBe('RESOURCE_ACCESS');
                    expect(actions[0].data).toExist();
                    expect(actions[0].data.eventType).toBe('RESOURCE_ACCESS');
                    expect(actions[0].data.resourceType).toBe('CONTEXT');
                    expect(actions[0].data.resourceId).toNotExist(); // Context has no resourceId, only appContext
                    expect(actions[0].data.appContext).toBe('test-context');
                    expect(actions[0].timestamp).toExist();
                }, mockState, done);
            });

            it('should record RESOURCE_ACCESS audit event when accessing a map within a context', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/context/test-context/789'
                        }
                    },
                    context: {
                        resource: {
                            id: 25,
                            name: 'Test Context'
                        }
                    }
                };

                testEpic(genericAuditEpic, 1, {
                    type: MAP_CONFIG_LOADED
                }, actions => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(RECORD_AUDIT);
                    expect(actions[0].eventType).toBe('RESOURCE_ACCESS');
                    expect(actions[0].data).toExist();
                    expect(actions[0].data.eventType).toBe('RESOURCE_ACCESS');
                    expect(actions[0].data.resourceType).toBe('CONTEXT_MAP');
                    expect(actions[0].data.resourceId).toBe('789'); // Map ID from URL
                    expect(actions[0].data.appContext).toBe('test-context'); // Context name from URL
                    expect(actions[0].timestamp).toExist();
                }, mockState, done);
            });

            it('should record RESOURCE_ACCESS audit event when accessing a dashboard', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/dashboard/123'
                        }
                    }
                };

                testEpic(genericAuditEpic, 1, {
                    type: DASHBOARD_LOADED
                }, actions => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(RECORD_AUDIT);
                    expect(actions[0].eventType).toBe('RESOURCE_ACCESS');
                    expect(actions[0].data).toExist();
                    expect(actions[0].data.eventType).toBe('RESOURCE_ACCESS');
                    expect(actions[0].data.resourceType).toBe('DASHBOARD');
                    expect(actions[0].data.resourceId).toBe('123');
                    expect(actions[0].timestamp).toExist();
                }, mockState, done);
            });

            it('should record RESOURCE_ACCESS audit event when accessing a geostory', (done) => {
                const mockState = {
                    audit: {
                        config: {
                            enabled: true
                        }
                    },
                    router: {
                        location: {
                            pathname: '/geostory/456'
                        }
                    }
                };

                testEpic(genericAuditEpic, 1, {
                    type: GEOSTORY_LOADED
                }, actions => {
                    expect(actions.length).toBe(1);
                    expect(actions[0].type).toBe(RECORD_AUDIT);
                    expect(actions[0].eventType).toBe('RESOURCE_ACCESS');
                    expect(actions[0].data).toExist();
                    expect(actions[0].data.eventType).toBe('RESOURCE_ACCESS');
                    expect(actions[0].data.resourceType).toBe('GEOSTORY');
                    expect(actions[0].data.resourceId).toBe('456');
                    expect(actions[0].timestamp).toExist();
                }, mockState, done);
            });

        });
    });

});
