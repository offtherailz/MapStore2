/*
 * SPIKE ONLY (React 19 trial, \#12506) — NOT a proposal.
 * Replacement for the legacy child context of Localized, which hands `locale` and
 * `messages` to roughly 90 components. Consumers that read nothing else can switch
 * to `static contextType = LocaleContext` and keep `this.context.messages` as is.
 * Consumers that also read `router`, `intl`, `plugins` or `store` cannot: a class
 * takes a single contextType, so those need a merged context, a wrapper, or a move
 * to function components with one useContext per source.
 */
import { createContext, useContext } from 'react';

export const LocaleContext = createContext({});

export const useLocaleContext = () => useContext(LocaleContext);

export default LocaleContext;
