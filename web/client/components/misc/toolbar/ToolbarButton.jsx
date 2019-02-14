 /*
  * Copyright 2017, GeoSolutions Sas.
  * All rights reserved.
  *
  * This source code is licensed under the BSD-style license found in the
  * LICENSE file in the root directory of this source tree.
  */
const React = require('react');
const {compose} = require('recompose');
const Message = require('../../I18N/Message');

const {Button, Glyphicon} = require('react-bootstrap');
const Loader = require('../Loader');
const tooltip = require('../enhancers/tooltip');
const popover = require('../enhancers/popover');
/**
 * Button for @see components.misc.toolbar.Toolbar. Exposes all the props of a react-bootstrap button, plus glyph and text
 * Has tooltip and popover enhancers, so you can add properties like `popover`, `tooltip`, `tooltipId` and so on.
 * @see components.misc.enhancers.tooltip and @see components.misc.enhancers.popover
 * @class TooltipButton
 * @memberof components.misc.toolbar
 * @implements ma
 * @prop {string} [glyph] the icon to use
 * @prop {element} [text] the text to display
 */

module.exports = compose(tooltip, popover)(({ glyph, loading, text = "", textId, glyphClassName="", loaderProps = {}, ...props} = {}) =>
    <Button {...props}>
        {glyph && !loading ? <Glyphicon glyph={glyph} className={glyphClassName}/> : null}
        {textId ? <Message msgId={textId} /> : text}
        {loading ? <Loader className={`ms-loader${props.bsStyle && ' ms-loader-' + props.bsStyle || ''}${props.bsSize && ' ms-loader-' + props.bsSize || ''}`} {...loaderProps}/> : null}
    </Button>);
