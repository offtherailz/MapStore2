/*
 * Copyright 2019, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from "react";
import Content from '../../contents/Content';

import AddBar from '../../common/AddBar';
import { SectionTypes } from '../../../../utils/GeoStoryUtils';
/**
 * Paragraph Section Type.
 * Paragraph is a page block that expands for all it's height
 */
export default ({ id, className = '', contents, mode, addSection = () => {}, viewWidth, viewHeight }) => (
    <section
        className="ms-section ms-section-paragraph">
        <div className="ms-section-contents">
            {contents.map((props) => (<Content mode={mode} {...props}/>))}
        </div>
        <AddBar
            containerWidth={viewWidth}
            containerHeight={viewHeight}
            buttons={[{
                glyph: 'font',
                tooltip: 'Add title section',
                onClick: () => {
                    addSection(SectionTypes.TITLE, id);
                }
            },
            {
                glyph: 'sheet',
                tooltip: 'Add paragraph section',
                onClick: () => {
                    addSection(SectionTypes.PARAGRAPH, id);
                }
            },
            {
                glyph: 'book',
                tooltip: 'Add immersive section',
                onClick: () => {
                    // TODO: add
                    addSection(SectionTypes.IMMERSIVE, id);
                }
            }]}/>
    </section>
);
