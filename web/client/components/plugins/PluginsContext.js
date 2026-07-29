/*
 * SPIKE ONLY (React 19 trial, \#12506) — NOT a proposal.
 * Replacement for the legacy child context of PluginsContainer, used to probe
 * what breaks below the legacy context layer once the plugin system boots.
 */
import { createContext, useContext } from 'react';

export const PluginsContext = createContext({});

export const usePluginsContext = () => useContext(PluginsContext);

export default PluginsContext;
