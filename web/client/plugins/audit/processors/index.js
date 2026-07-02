/**
 * Audit Processors
 *
 * Each processor extracts additional audit data from a specific action type.
 * Processors receive (action, state) and return an array of additional data objects.
 * Standard fields (eventType, resourceType, resourceId, appContext) are added by the epic.
 */

export { processSearchAdditionalData, processSearchClickAdditionalData } from './searchProcessors';
export { processMapClickAdditionalData, processMapClickResultAdditionalData } from './mapProcessors';
export {
    processRecordDeleteAdditionalData,
    processRecordCreationFromSaveSuccess,
    processRecordUpdateFromSaveSuccess
} from './wfsRecordProcessors';
export { processAttributeTableOpenAdditionalData, processAttributeTableSearchAdditionalData } from './featureGridProcessors';


