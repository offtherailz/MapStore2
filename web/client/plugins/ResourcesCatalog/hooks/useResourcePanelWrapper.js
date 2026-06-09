/*
 * Copyright 2024, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect, useRef, useState } from 'react';

const querySelector = (selector) => selector ? document.querySelector(selector) : null;

/**
 * compute the position of top and bottom value for the panel wrappers.
 * The top value is the visible bottom edge of the header and navbar nodes, the bottom value is the visible part of the footer node.
 * Values are updated when the nodes change size, are added to the page (eg. headers loaded asynchronously) or move because of scroll.
 * @param {string} props.headerNodeSelector optional valid query selector for the header in the page, used to set the position of the panel
 * @param {string} props.navbarNodeSelector optional valid query selector for the navbar under the header, used to set the position of the panel
 * @param {string} props.footerNodeSelector optional valid query selector for the footer in the page, used to set the position of the panel
 * @param {number} props.width container width in pixel
 * @param {number} props.height container height in pixel
 * @param {bool} props.active if true it computes the sticky top and bottom
 * @return {object} { stickyTop, stickyBottom }
 */
const useResourcePanelWrapper = ({
    headerNodeSelector,
    navbarNodeSelector,
    footerNodeSelector,
    width,
    height,
    active
}) => {

    const [stickyTop, setStickyTop] = useState(0);
    const [stickyBottom, setStickyBottom] = useState(0);
    const scheduleUpdate = useRef(() => {});

    useEffect(() => {
        if (!active) {
            return () => {};
        }
        const selectors = [headerNodeSelector, navbarNodeSelector, footerNodeSelector];
        let observedNodes = [];
        let observingMutations = false;
        let frame = null;
        let compute;
        const schedule = () => {
            if (frame === null) {
                frame = window.requestAnimationFrame(compute);
            }
        };
        const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
        // nodes can be added to the page after the panel mounts, so the document is observed until all of them are found
        const mutationObserver = typeof MutationObserver !== 'undefined' ? new MutationObserver(schedule) : null;

        compute = () => {
            frame = null;
            const nodes = selectors.map(querySelector);
            if (resizeObserver && nodes.some((node, idx) => node !== observedNodes[idx])) {
                resizeObserver.disconnect();
                nodes.forEach(node => node && resizeObserver.observe(node));
            }
            observedNodes = nodes;
            const missingNodes = selectors.some((selector, idx) => selector && !nodes[idx]);
            if (mutationObserver && missingNodes !== observingMutations) {
                if (missingNodes) {
                    mutationObserver.observe(document.body, { childList: true, subtree: true });
                } else {
                    mutationObserver.disconnect();
                }
                observingMutations = missingNodes;
            }
            const [header, navbar, footer] = nodes;
            const top = Math.max(0, ...[header, navbar].map(node => node ? node.getBoundingClientRect().bottom : 0));
            const bottom = footer ? Math.max(0, window.innerHeight - footer.getBoundingClientRect().top) : 0;
            setStickyTop(Math.round(top));
            setStickyBottom(Math.round(bottom));
        };

        scheduleUpdate.current = schedule;
        compute();
        window.addEventListener('scroll', schedule, { capture: true, passive: true });
        window.addEventListener('resize', schedule);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('scroll', schedule, { capture: true });
            window.removeEventListener('resize', schedule);
            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
            scheduleUpdate.current = () => {};
        };
    }, [active, headerNodeSelector, navbarNodeSelector, footerNodeSelector]);

    useEffect(() => {
        scheduleUpdate.current();
    }, [width, height]);

    return {
        stickyTop,
        stickyBottom
    };
};

export default useResourcePanelWrapper;
