/*
 * SPIKE ONLY (React 19 trial, \#12506) — NOT a proposal.
 * Minimal probes for the React 19 removals that stop the app at bootstrap,
 * so the layers of breakage below them become observable.
 */
import React from 'react';

if (!React.createFactory) {
    React.createFactory = (type) => React.createElement.bind(null, type);
}
