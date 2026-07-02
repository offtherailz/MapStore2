import expect from 'expect';
import { matches, shouldSend } from '../auditFilter';

describe('auditFilter', () => {
    describe('matches', () => {
        it('should match event by eventType', () => {
            const event = { eventType: 'LOGIN' };
            const rule = { eventType: 'LOGIN', decision: 'accept' };
            expect(matches(event, rule)).toBe(true);

            const event2 = { eventType: 'SEARCH' };
            expect(matches(event2, rule)).toBe(false);
        });

        it('should match by attributes', () => {
            const event = { eventType: 'MAP_CLICK', layerName: 'test_layer' };
            const rule = { attributes: { layerName: ['test_layer'] }, decision: 'drop' };
            expect(matches(event, rule)).toBe(true);

            const event2 = { eventType: 'MAP_CLICK', layerName: 'other_layer' };
            expect(matches(event2, rule)).toBe(false);
        });

        it('should match catch-all rule', () => {
            const event = { eventType: 'ANYTHING' };
            const dropRule = { decision: 'drop' };
            const acceptRule = { decision: 'accept' };
            expect(matches(event, dropRule)).toBe(true);
            expect(matches(event, acceptRule)).toBe(true);
        });
    });

    describe('shouldSend', () => {
        it('should handle whitelist mode', () => {
            const rules = [
                { eventType: 'LOGIN', decision: 'accept' },
                { decision: 'drop' }
            ];
            expect(shouldSend({ eventType: 'LOGIN' }, rules)).toBe(true);
            expect(shouldSend({ eventType: 'SEARCH' }, rules)).toBe(false);
        });

        it('should handle blacklist mode', () => {
            const rules = [
                { eventType: 'SEARCH_CLICK', decision: 'drop' }
            ];
            expect(shouldSend({ eventType: 'SEARCH_CLICK' }, rules)).toBe(false);
            expect(shouldSend({ eventType: 'LOGIN' }, rules)).toBe(true);
        });

        it('should accept by default with no rules', () => {
            expect(shouldSend({ eventType: 'ANYTHING' }, [])).toBe(true);
        });

        it('should respect first matching rule', () => {
            const rules = [
                { eventType: 'LOGIN', decision: 'drop' },
                { eventType: 'LOGIN', decision: 'accept' }
            ];
            expect(shouldSend({ eventType: 'LOGIN' }, rules)).toBe(false);
        });
    });
});
