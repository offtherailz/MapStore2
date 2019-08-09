/*
 * Copyright 2019, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from "react";
import Content from '../../contents/SectionContent';
import immersiveBackgroundManager from "./enhancers/immersiveBackgroundManager";
import Background from './Background';

import AddBar from '../../common/AddBar';
import { SectionTypes } from '../../../../utils/GeoStoryUtils';
/**
 * Paragraph Section Type.
 * Paragraph is a page block that expands for all it's height
 */
const Immersive = ({ id, contents = [], mode, background = {}, onVisibilityChange = () => { }, updateBackground = () => {}, viewWidth, viewHeight, add = () => {}, update = () => {} }) => (
    <section
        className="ms-section ms-section-immersive">
        <Background
            { ...background }
            // selector used by sticky polyfill to detect scroll events
            scrollContainerSelector="#ms-sections-container"
            update={updateBackground}
            sectionId={id}
            backgroundId={background.id}
            key={background.id}
            width={viewWidth}
            height={viewHeight}/>
        <div className="ms-section-contents">
            {contents.map((props) => (<Content mode={mode} onVisibilityChange={onVisibilityChange} add={add} update={update} sectionId={id} {...props} contentWrapperStyle={{ minHeight: viewHeight }}/>))}
        </div>
        <AddBar
            containerWidth={viewWidth}
            containerHeight={viewHeight}
            buttons={[{
                glyph: 'font',
                tooltip: 'Add title section',
                onClick: () => {
                    add('sections', id, SectionTypes.TITLE);
                }
            },
            {
                glyph: 'sheet',
                tooltip: 'Add paragraph section',
                onClick: () => {
                    add('sections', id, SectionTypes.PARAGRAPH);
                }
            },
            {
                glyph: 'book',
                tooltip: 'Add immersive section',
                onClick: () => {
                    // TODO: add
                    add('sections', id, SectionTypes.IMMERSIVE);
                }
            }]}/>
    </section>
);

export default immersiveBackgroundManager(Immersive);
