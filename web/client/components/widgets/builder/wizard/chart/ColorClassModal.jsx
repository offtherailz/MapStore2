/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from "react";
import classnames from "classnames";
import PropTypes from "prop-types";
import {
    Row,
    Col,
    Form,
    FormGroup,
    ControlLabel,
    Button,
    Glyphicon,
} from "react-bootstrap";
import Select from "react-select";

import ColorSelector from "../../../../style/ColorSelector";
import Message from "../../../../../components/I18N/Message";
import Portal from "../../../../../components/misc/Portal";
import ResizableModal from "../../../../../components/misc/ResizableModal";
import TextAttributeClassForm from "./TextAttributeClassForm";
import RangeAttributeClassForm from "./RangeAttributeClassForm";

import uuid from "uuid";
import { onEditorChange } from "../../../../../actions/widgets";
import { generateRandomHexColor } from "../../../../../utils/ColorUtils";
import SwitchButton from "../../../../misc/switch/SwitchButton";
import wpsAutopop from "../../../enhancers/wpsAutopop";

const ColorClassModal = ({
    modalClassName,
    show,
    onClose,
    onSaveClassification,
    onChangeClassAttribute,
    classificationAttribute,
    classificationAttributeType,
    onUpdateClasses,
    options,
    placeHolder,
    classification,
    rangeClassification,
    defaultCustomColor,
    defaultClassLabel,
    onChangeColor,
    onChangeDefaultClassLabel,
    layer,
    chartType,
    values,
    onAutopop,
    checked,
    autopop,
    loading,
    data,
    onLuck,
}) => {
    console.log("MRPOPP: ", autopop);
    console.log("ccmodal :", values);
    console.log("LOADING?: ", loading);
    console.log("FATA: ", data);

    //stateaenderungen
    const [selectMenuOpen, setSelectMenuOpen] = useState(false);
    //aendern von autopopClassification
    const [autopopClassification, setautopopClassification] =
        useState(classification);
    // alreadyLoaded soll mehrmaliges laden verhindern
    const [alreadyLoaded, setalreadyLoaded] = useState(false);

    //function um aus den vom wps kommenden values das autopopObject zu erstellen
    function autopoper(values) {
        let autoClass = [];
        autoClass = values?.map((e) => {
            return {
                id: uuid.v1(),
                color: generateRandomHexColor(),
                title: "",
                value: e,
                unique: e,
            };
        });
        console.log("class: ", autoClass);
        return autoClass;
    }

    console.log(
        "alleda? :",
        values,
        checked,
        classificationAttributeType,
        classification
    );

    //effect um autopop in state zu setzen bei click auf button
    useEffect(() => {
        console.log("wobinich");
        if (
            values &&
            checked &&
            classificationAttributeType &&
            !alreadyLoaded
        ) {
            console.log("XXXXXXXX");
            setautopopClassification((autopopClassification) => {
                return autopoper(values);
            });

            setalreadyLoaded((alreadyLoaded) => true);

            onLuck(autopopClassification, classificationAttributeType);
        } else {
            console.log("huhuhuhu");
        }
    }, [checked, loading]);

    return (
        <Portal>
            <ResizableModal
                modalClassName={classnames(
                    modalClassName,
                    { "menu-open": selectMenuOpen || classificationAttribute },
                    { "text-class": classificationAttributeType === "string" },
                    { "range-class": classificationAttributeType === "number" }
                )}
                title={
                    <Message msgId="widgets.builder.wizard.classAttributes.title" />
                }
                show={show}
                clickOutEnabled={false}
                showClose={false}
                onClose={() => onClose()}
                buttons={[
                    {
                        className: "btn-cancel",
                        text: <Message msgId="close" />,
                        bsSize: "sm",
                        onClick: () => onClose(),
                    },
                    {
                        className: "btn-save",
                        text: <Message msgId="save" />,
                        bsSize: "sm",
                        onClick: () => onSaveClassification(),
                    },
                ]}
            >
                <Row xs={12}>
                    <Col componentClass={ControlLabel} xs={6}>
                        <Message
                            msgId={
                                !classificationAttribute
                                    ? "widgets.builder.wizard.classAttributes.color"
                                    : "widgets.builder.wizard.classAttributes.defaultColor"
                            }
                        />
                    </Col>
                    <Col xs={6}>
                        <ColorSelector
                            key={0}
                            color={defaultCustomColor}
                            disableAlpha
                            format="hex"
                            onChangeColor={(color) => onChangeColor(color)}
                        />
                    </Col>
                </Row>
                <Row xs={12}>
                    <Form id="chart-color-class-form" horizontal>
                        <FormGroup
                            controlId="classificationAttribute"
                            className="chart-color-class-form-group"
                        >
                            <Col componentClass={ControlLabel} xs={6}>
                                <Message msgId="widgets.builder.wizard.classAttributes.classificationAttribute" />
                            </Col>
                            <Col xs={6}>
                                <Select
                                    value={classificationAttribute}
                                    options={options}
                                    placeholder={placeHolder}
                                    onChange={(val) => {
                                        const value =
                                            (val && val.value) || undefined;
                                        const type =
                                            (val && val.type) || undefined;
                                        onChangeClassAttribute(value, type);
                                    }}
                                    onOpen={() =>
                                        setSelectMenuOpen(!selectMenuOpen)
                                    }
                                    onClose={() =>
                                        setSelectMenuOpen(!selectMenuOpen)
                                    }
                                />
                            </Col>
                        </FormGroup>
                    </Form>
                </Row>
                <Row xs={12}>
                    <Form>
                        <FormGroup>
                            <Col xs={6}>alles vollballern?</Col>
                            <Col xs={6}>
                                <SwitchButton
                                    checked={checked}
                                    //onChange={(val) => onAutopop("legend", val)}
                                    onClick={onAutopop}
                                />
                                {/*                                     <Glyphicon glyph="heart" />
                                </Button> */}
                            </Col>
                        </FormGroup>
                    </Form>
                </Row>
                {classificationAttribute &&
                classificationAttributeType === "string" ? (
                    <TextAttributeClassForm
                        onUpdateClasses={onUpdateClasses}
                        classification={autopopClassification}
                        defaultClassLabel={defaultClassLabel}
                        onChangeDefaultClassLabel={onChangeDefaultClassLabel}
                        layer={layer}
                        chartType={chartType}
                        classificationAttribute={classificationAttribute}
                        classificationAttributeType={
                            classificationAttributeType
                        }
                    />
                ) : classificationAttribute &&
                  classificationAttributeType === "number" ? (
                    <RangeAttributeClassForm
                        onUpdateClasses={onUpdateClasses}
                        chartType={chartType}
                        onChangeDefaultClassLabel={onChangeDefaultClassLabel}
                        defaultClassLabel={defaultClassLabel}
                        rangeClassification={rangeClassification}
                        classificationAttributeType={
                            classificationAttributeType
                        }
                    />
                ) : null}
            </ResizableModal>
        </Portal>
    );
};

ColorClassModal.propTypes = {
    modalClassName: PropTypes.string,
    show: PropTypes.boolean,
    onClose: PropTypes.func,
    onSaveClassification: PropTypes.func,
    onChangeClassAttribute: PropTypes.func,
    classificationAttribute: PropTypes.string,
    onUpdateClasses: PropTypes.func,
    options: PropTypes.array,
    placeHolder: PropTypes.string,
    classification: PropTypes.array,
    rangeClassification: PropTypes.array,
    defaultCustomColor: PropTypes.string,
    defaultClassLabel: PropTypes.string,
    onChangeColor: PropTypes.func,
    onChangeDefaultClassLabel: PropTypes.func,
};

ColorClassModal.defaultProps = {
    modalClassName: "chart-color-class-modal",
    onClose: () => {},
    onSaveClassification: () => {},
    onChangeClassAttribute: () => {},
    classificationAttribute: "",
    onUpdateClasses: () => {},
    options: [],
    classification: [
        {
            uuid: uuid.v1(),
            title: "",
            color: generateRandomHexColor(),
            type: "Polygon",
            unique: "",
        },
    ],
    rangeClassification: [
        {
            uuid: uuid.v1(),
            title: "",
            color: generateRandomHexColor(),
            type: "Polygon",
            min: 0,
            max: 0,
        },
    ],
    defaultCustomColor: "#0888A1",
    defaultClassLabel: "",
    onChangeColor: () => {},
    onChangeDefaultClassLabel: () => {},
    onAutopop: () => {},
};

export default ColorClassModal;
