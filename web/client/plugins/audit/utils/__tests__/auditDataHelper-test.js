

import expect from 'expect';
import {
    getResourceRelatedMetadata,
    enrichAuditData,
    generateStandardAuditFields,
    detectResourceType,
    extractResourceId,
    extractAppContext,
    auditKeysParser,
    isPathForExistingResource
} from '../auditDataHelper';

describe('auditDataHelper', () => {

    describe('getResourceRelatedMetadata', () => {
        it('should return dashboard metadata for dashboard route', () => {
            const pathname = '/dashboard/12345';
            const result = getResourceRelatedMetadata(pathname);

            expect(result).toEqual({
                resourceType: 'DASHBOARD',
                resourceId: '12345',
                appContext: null
            });
        });

        it('should return geoStory metadata for GeoStory route', () => {
            const pathname = '/geostory/456';

            const result = getResourceRelatedMetadata(pathname);

            expect(result).toEqual({
                resourceType: 'GEOSTORY',
                resourceId: '456',
                appContext: null
            });
        });

        it('should return map metadata for viewer route', () => {
            const pathname = '/viewer/789';
            const result = getResourceRelatedMetadata(pathname);

            expect(result).toEqual({
                resourceType: 'MAP',
                resourceId: '789',
                appContext: null
            });
        });

        it('should return context metadata for context route without map', () => {
            const pathname = '/context/my-context';
            const result = getResourceRelatedMetadata(pathname);

            expect(result).toEqual({
                resourceType: 'CONTEXT',
                resourceId: null,
                appContext: 'my-context'
            });
        });

        it('should return context map metadata for context route with map', () => {
            const pathname = '/context/my-context/123';
            const result = getResourceRelatedMetadata(pathname);

            expect(result).toEqual({
                resourceType: 'CONTEXT_MAP',
                resourceId: '123',
                appContext: 'my-context'
            });
        });

        it('should return home page metadata for root route', () => {
            const pathname = '/';
            const result = getResourceRelatedMetadata(pathname);

            expect(result).toEqual({
                resourceType: 'HOME_PAGE',
                resourceId: null,
                appContext: null
            });
        });

        it('should handle empty pathname', () => {
            const pathname = '';
            const result = getResourceRelatedMetadata(pathname);

            expect(result).toEqual({
                resourceType: null,
                resourceId: null,
                appContext: null
            });
        });
    });

    describe('enrichAuditData', () => {
        it('should merge standard data with additional data', () => {
            const standardData = {
                eventType: 'SEARCH',
                resourceType: 'MAP',
                resourceId: '123',
                appContext: 29
            };
            const additionalData = {
                searchText: 'Paris'
            };

            const result = enrichAuditData(standardData, additionalData);

            expect(result).toEqual({
                eventType: 'SEARCH',
                resourceType: 'MAP',
                resourceId: '123',
                appContext: 29,
                searchText: 'Paris'
            });
        });
    });

    describe('generateStandardAuditFields', () => {
        it('should generate standard fields for map viewer route', () => {
            const state = {
                router: {
                    location: {
                        pathname: '/viewer/123'
                    }
                }
            };

            const result = generateStandardAuditFields(state, 'SEARCH');

            expect(result).toEqual({
                eventType: 'SEARCH',
                resourceType: 'MAP',
                resourceId: '123',
                appContext: null
            });
        });

        it('should generate standard fields for context route with appContext from URL', () => {
            const state = {
                router: {
                    location: {
                        pathname: '/context/my-context'
                    }
                }
            };

            const result = generateStandardAuditFields(state, 'LOGIN');

            expect(result).toEqual({
                eventType: 'LOGIN',
                resourceType: 'CONTEXT',
                resourceId: null,
                appContext: 'my-context'
            });
        });
    });

    describe('detectResourceType', () => {
        it('should detect CONTEXT_MAP for context route with map ID', () => {
            const pathname = '/context/my-context/789';
            const result = detectResourceType(pathname);

            expect(result.type).toBe('CONTEXT_MAP');
            expect(result.match).toEqual(['/context/my-context/789', 'my-context', '789']);
        });

        it('should detect CONTEXT for context route without map ID', () => {
            const pathname = '/context/my-context';
            const result = detectResourceType(pathname);

            expect(result.type).toBe('CONTEXT');
            expect(result.match).toEqual(['/context/my-context', 'my-context']);
        });

        it('should detect DASHBOARD for dashboard route', () => {
            const pathname = '/dashboard/123';
            const result = detectResourceType(pathname);

            expect(result.type).toBe('DASHBOARD');
            expect(result.match).toEqual(['/dashboard/123', '123']);
        });

        it('should return null type for empty pathname', () => {
            const pathname = '';
            const result = detectResourceType(pathname);

            expect(result).toEqual({ type: null, match: null });
        });
    });

    describe('extractResourceId', () => {
        it('should extract map ID from CONTEXT_MAP match', () => {
            const resourceType = 'CONTEXT_MAP';
            const match = ['/context/my-context/456', 'my-context', '456'];
            const result = extractResourceId(resourceType, match);

            expect(result).toBe('456');
        });

        it('should return null for CONTEXT type', () => {
            const resourceType = 'CONTEXT';
            const match = ['/context/my-context', 'my-context'];
            const result = extractResourceId(resourceType, match);

            expect(result).toBe(null);
        });

        it('should extract resource ID for DASHBOARD type', () => {
            const resourceType = 'DASHBOARD';
            const match = ['/dashboard/789', '789'];
            const result = extractResourceId(resourceType, match);

            expect(result).toBe('789');
        });

        it('should return null when match is null', () => {
            const resourceType = 'DASHBOARD';
            const match = null;
            const result = extractResourceId(resourceType, match);

            expect(result).toBe(null);
        });
    });

    describe('extractAppContext', () => {
        it('should extract context name from CONTEXT match', () => {
            const resourceType = 'CONTEXT';
            const match = ['/context/my-context', 'my-context'];
            const result = extractAppContext(resourceType, match);

            expect(result).toBe('my-context');
        });

        it('should extract context name from CONTEXT_MAP match', () => {
            const resourceType = 'CONTEXT_MAP';
            const match = ['/context/my-context/456', 'my-context', '456'];
            const result = extractAppContext(resourceType, match);

            expect(result).toBe('my-context');
        });

        it('should return null for non-context resource types', () => {
            expect(extractAppContext('DASHBOARD', ['/dashboard/789', '789'])).toBe(null);
            expect(extractAppContext('MAP', ['/viewer/123', '123'])).toBe(null);
            expect(extractAppContext('GEOSTORY', ['/geostory/456', '456'])).toBe(null);
        });

        it('should return null when match is null', () => {
            const result = extractAppContext('CONTEXT', null);

            expect(result).toBe(null);
        });
    });

    describe('auditKeysParser', () => {
        it('should convert client fields to database keys (reverse=false)', () => {
            const clientData = {
                eventType: 'SEARCH_CLICK',
                resourceType: 'MAP',
                resourceId: '123',
                appContext: 40,
                service: 'nominatim',
                lat: 48.8566,
                lon: 2.3522,
                title: 'Paris, France'
            };
            const keysMap = { key1: 'service', key2: 'lat', key3: 'lon', key4: 'title' };

            const result = auditKeysParser(clientData, keysMap, false);

            expect(result).toEqual({
                eventType: 'SEARCH_CLICK',
                resourceType: 'MAP',
                resourceId: '123',
                appContext: 40,
                key1: 'nominatim',
                key2: 48.8566,
                key3: 2.3522,
                key4: 'Paris, France'
            });
        });

        it('should convert database keys to client fields (reverse=true)', () => {
            const dbData = {
                eventType: 'SEARCH_CLICK',
                resourceType: 'MAP',
                resourceId: '456',
                appContext: null,
                key1: 'nominatim',
                key2: 48.8566,
                key3: 2.3522,
                key4: 'Paris, France'
            };
            const keysMap = { key1: 'service', key2: 'lat', key3: 'lon', key4: 'title' };

            const result = auditKeysParser(dbData, keysMap, true);

            expect(result).toEqual({
                eventType: 'SEARCH_CLICK',
                resourceType: 'MAP',
                resourceId: '456',
                appContext: null,
                service: 'nominatim',
                lat: 48.8566,
                lon: 2.3522,
                title: 'Paris, France'
            });
        });

        it('should handle null and undefined data', () => {
            expect(auditKeysParser(null, {}, false)).toBe(null);
            expect(auditKeysParser(undefined, {}, true)).toBe(undefined);
        });
    });

    describe('isPathForExistingResource', () => {
        it('should return true for existing resource pathnames', () => {
            expect(isPathForExistingResource('/dashboard/123')).toBe(true);
            expect(isPathForExistingResource('/viewer/456')).toBe(true);
            expect(isPathForExistingResource('/geostory/789')).toBe(true);
            expect(isPathForExistingResource('/context/test-context')).toBe(true);
            expect(isPathForExistingResource('/context/test-context/123')).toBe(true);
        });

        it('should return false when pathname contains /new (creating new map)', () => {
            const result = isPathForExistingResource('/viewer/new');

            expect(result).toBe(false);
        });

        it('should return false when pathname contains /newgeostory', () => {
            const result = isPathForExistingResource('/geostory/newgeostory');

            expect(result).toBe(false);
        });

        it('should return false when pathname ends with /dashboard (creating new dashboard)', () => {
            expect(isPathForExistingResource('/dashboard')).toBe(false);
            expect(isPathForExistingResource('/dashboard/')).toBe(false);
        });

        it('should return false when pathname is null or undefined', () => {
            expect(isPathForExistingResource(null)).toBe(false);
            expect(isPathForExistingResource(undefined)).toBe(false);
            expect(isPathForExistingResource('')).toBe(false);
        });
    });

});
