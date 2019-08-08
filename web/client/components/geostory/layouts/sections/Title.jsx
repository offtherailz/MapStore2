/*
 * Copyright 2019, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from "react";
import Content from '../../contents/Content';
import Background from './Background';
import { backgroundProp } from './enhancers/immersiveBackgroundManager';
import ContainerDimensions from 'react-container-dimensions';
import AddBar from '../../common/AddBar';
import { SectionTypes } from '../../../../utils/GeoStoryUtils';

/**
 * Paragraph Section Type.
 * Paragraph is a page block that expands for all it's height
 */
export default backgroundProp(({ id, background = {}, contents = [], add = () => {}, update = () => {}, mode, cover, viewWidth, viewHeight }) => (
    <section
        className="ms-section ms-section-title">
        <ContainerDimensions>
            {({ height }) =>
            // when section height is less then the view height
            // background height need to be equal to section size
            // this is important when working with z-index of section
            // in case we increase the z-index of title the whole background is visible and overlap next section
            <Background
                { ...background }
                // selector used by sticky polyfill to detect scroll events
                scrollContainerSelector="#ms-sections-container"
                key={background.id}
                width={viewWidth}
                height={height >= viewHeight
                    ? viewHeight
                    : height}/>}
        </ContainerDimensions>
        <div className="ms-section-contents">
            {contents.map((props) => (<Content mode={mode} {...props} add={add} update={update} sectionId={id} contentWrapperStyle={cover ? { minHeight: viewHeight } : {}}/>))}
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
));
