/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import PropTypes from 'prop-types';
import {isEqual} from "lodash";
import {parseTemplate} from '../../../../utils/TemplateUtils';

class Template extends React.Component {
    static propTypes = {
        template: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
        model: PropTypes.object,
        renderContent: PropTypes.func,
        onError: PropTypes.func
    };

    static defaultProps = {
        template: "",
        model: {},
        onError: () => {}
    };

    UNSAFE_componentWillMount() {
        this.parseTemplate(this.props.template);
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        if (nextProps.template !== this.props.template) {
            // Reset to avoid rendering with old comp value during template update
            this.comp = null;
            this.parseTemplate(nextProps.template);
        }
    }

    shouldComponentUpdate(nextProps) {
        return !isEqual(nextProps, this.props);
    }

    /* eslint-disable */
    renderContent = () => {
        let model = this.props.model;
        let props = this.props;
        return eval(this.comp);
    };
    /* eslint-enable */

    render() {
        if (this.comp) {
            let content = this.props.renderContent ? this.props.renderContent(this.comp, this.props) : this.renderContent();
            return React.isValidElement(content) ? content : null;
        }
        return null;
    }

    parseTemplate = (temp) => {
        parseTemplate(temp, (comp, error) => {
            if (error) {
                this.props.onError(error.message);
            } else {
                this.comp = comp;
                this.forceUpdate();
            }
        });
    };
}

export default Template;
