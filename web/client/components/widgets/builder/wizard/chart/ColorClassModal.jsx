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

import { generateRandomHexColor } from "../../../../../utils/ColorUtils";
import axios from "axios";
import Loader from "@mapstore/framework/components/misc/Loader";

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

    onAutopop,

    autopop,

    rangeIntervals,
    rangeMethods,
    onChange,
}) => {
    //stateaenderungen
    const [selectMenuOpen, setSelectMenuOpen] = useState(false);
    //aendern von autopopClassification
    const [autopopClassification, setautopopClassification] =
        useState(classification);
    // get rangeclassies

    const [rangeInterval, setrangeInterval] = useState(null);
    const [rangeMethod, setrangeMethod] = useState(null);

    //
    const [loadingSLD, setloadingSLD] = useState(false);
    const [errorOnLoading, seterrorOnLoading] = useState(null);

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
        return autoClass;
    }

    useEffect(() => {
        const getrangeClassIntervals = async () => {
            if (classificationAttributeType === "string") {
                const url =
                    "http://localhost/geoserver/rest/sldservice/" +
                    layer.title +
                    "/classify.json?attribute=" +
                    classificationAttribute +
                    "&method=uniqueInterval";

                setloadingSLD(true);
                const uCL = axios
                    .get(url)
                    .then((res) => res.data)
                    .then((data) => {
                        if (Array.isArray(data.Rules.Rule)) {
                            const labels = data.Rules.Rule.map((e) => e.Title);
                            setautopopClassification(autopoper(labels));
                            setloadingSLD(false);
                        } else {
                            const label = [data.Rules.Rule.Title];
                            setautopopClassification(autopoper(label));
                            setloadingSLD(false);
                        }
                    })
                    .catch(function (error) {
                        seterrorOnLoading(error.data);
                        setloadingSLD(false);
                    });
            }
            if (classificationAttributeType === "number") {
                const url =
                    "http://localhost/geoserver/rest/sldservice/" +
                    layer.title +
                    "/classify.json?attribute=" +
                    classificationAttribute +
                    "&intervals=" +
                    rangeInterval +
                    "&method=" +
                    rangeMethod;

                if (rangeInterval != null && rangeMethod != null) {
                    setloadingSLD(true);
                    const rCI = axios
                        .get(url)
                        .then((res) => res.data)
                        .then((raw) => {
                            const data = raw.Rules.Rule.filter((e) => {
                                if (typeof e.Title === "string") {
                                    return e;
                                }
                            });
                            const keys = data
                                .map((e) => e.Filter.And)
                                .map((f) => Object.keys(f));
                            const split = data.map((e) => e.Filter.And);
                            const min_max = split.map((e, i) => {
                                return {
                                    min: e[keys[i][0]].Literal,
                                    max: e[keys[i][1]].Literal,
                                };
                            });
                            const newClasses = min_max.map((e) => {
                                return {
                                    color: generateRandomHexColor(),
                                    id: uuid.v1(),
                                    min: e.min,
                                    max: e.max,
                                };
                            });
                            newClasses.slice(-1)[0].max += 0.01;

                            setautopopClassification(newClasses);
                            setloadingSLD(false);
                        })
                        .catch(function (error) {
                            seterrorOnLoading(error.data);
                            setloadingSLD(false);
                        });
                }
            }
        };

        getrangeClassIntervals();
    }, [
        autopop,
        classificationAttribute,
        classificationAttributeType,
        rangeInterval,
        rangeMethod,
    ]);

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
                        onClick: () =>
                            onSaveClassification(rangeMethod, rangeInterval),
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
                {classificationAttribute &&
                classificationAttributeType === "number" ? (
                    <Row xs={12}>
                        <Form>
                            <FormGroup>
                                <Col xs={3}>
                                    <b>Intervalle</b>
                                </Col>
                                <Col xs={3}>
                                    <Select
                                        value={rangeInterval}
                                        options={rangeIntervals}
                                        onChange={(val) => {
                                            setrangeInterval(val.value);
                                            onChange(
                                                "rangeInterval",
                                                val.value
                                            );
                                        }}
                                        onClose={() =>
                                            setSelectMenuOpen(!selectMenuOpen)
                                        }
                                    />
                                </Col>
                                <Col xs={3}>
                                    <b>Methode</b>
                                </Col>
                                <Col xs={3}>
                                    <Select
                                        value={rangeMethod}
                                        options={rangeMethods}
                                        onChange={(val) => {
                                            setrangeMethod(val.value);
                                            onChange("rangeMethod", val.value);
                                        }}
                                        onClose={() =>
                                            setSelectMenuOpen(!selectMenuOpen)
                                        }
                                    />
                                </Col>
                            </FormGroup>
                        </Form>
                    </Row>
                ) : null}
                <Row xs={12}>
                    {!loadingSLD && errorOnLoading === null ? (
                        <Form>
                            <FormGroup>
                                <Col xs={6}>
                                    <b>automatisch Ausfüllen</b>
                                </Col>
                                <Col xs={6}>
                                    <Button
                                        onClick={() =>
                                            onAutopop(
                                                autopopClassification,
                                                classificationAttributeType,
                                                autopop
                                            )
                                        }
                                    >
                                        <Glyphicon glyph="ok" />
                                    </Button>
                                    <Button
                                        onClick={() =>
                                            onAutopop(
                                                classificationAttributeType ===
                                                    "number"
                                                    ? ColorClassModal
                                                          .defaultProps
                                                          .rangeClassification
                                                    : ColorClassModal
                                                          .defaultProps
                                                          .classification,

                                                classificationAttributeType,
                                                autopop
                                            )
                                        }
                                    >
                                        <Glyphicon glyph="remove" />
                                    </Button>
                                </Col>
                            </FormGroup>
                        </Form>
                    ) : errorOnLoading != null ? (
                        <div>
                            {!loadingSLD ? (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Button
                                        onClick={() => {
                                            seterrorOnLoading(null);
                                        }}
                                    >
                                        <p>ERROR!</p>
                                        <Glyphicon glyph="edit" />
                                        <p>
                                            Klassifizierungsattribut löschen und
                                            anderes auswählen!
                                        </p>
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    ) : loadingSLD ? (
                        <div>
                            <Col xs={6}></Col>
                            <Col xs={6}>
                                <Loader size={50} />
                            </Col>
                        </div>
                    ) : null}
                </Row>
                {classificationAttribute &&
                classificationAttributeType === "string" ? (
                    <TextAttributeClassForm
                        onUpdateClasses={onUpdateClasses}
                        classification={classification}
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
