/*
 * SPIKE ONLY (React 19 trial, \#12506) — NOT a proposal.
 * Replacement for the legacy child context of FeatureGrid, which hands
 * isModified/isValid/isProperty down to the cell renderers and editors.
 */
import { createContext, useContext } from 'react';

export const FeatureGridContext = createContext({});

export const useFeatureGridContext = () => useContext(FeatureGridContext);

export default FeatureGridContext;
