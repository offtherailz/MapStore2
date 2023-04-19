import React, {useState} from 'react';
import Modal from './Modal';

import { FormControl, Glyphicon, InputGroup, Button, Image } from 'react-bootstrap';
import { getSupportedLocales, getLocale } from '../../utils/LocaleUtils';
import withTooltip from '../data/featuregrid/enhancers/withTooltip';
import localizedProps from './enhancers/localizedProps';
import Message from '../I18N/Message';


const getLocaleFlag = (code) => {
    try {
        return require('../I18N/images/flags/' + code + '.png');
    } catch (e) {
        return false;
    }
};

/**
 * Component that shows a flag for the given locale.
 * If the flag is not found, the locale description is shown.
 * @prop {object} locale the locale object with the following structure:
 * ```json
 * {
 *   "code": "en-US",
 *  "description": "English"
 * }
 * ```
 */
const FlagAddon = (withTooltip(({locale = {}, ref, tooltip}) => {
    const flagImgSrc = getLocaleFlag(locale.code);
    return <InputGroup.Addon>
        {flagImgSrc ? <Image ref={ref} src={flagImgSrc} alt={locale.description} tooltip={tooltip}/> : <span>{locale.description ?? locale.code }</span>}
    </InputGroup.Addon>;
}));

const DefaultFormControl = localizedProps('placeholder')(FormControl);

const AddonIcon = localizedProps('tooltip')(withTooltip(Glyphicon));

/**
 * Component that allows to edit a localized string.
 * The component is an input with a flag button. When the button is clicked, a modal opens and allows to edit the localized string.
 * This component automatically turns the localized string into an object with the "default" key, when the localized string is changed.
 * The localized string is an object with the following structure:
 * ```json
 * {
 *    "default": "the default string",
 *    "it-IT": "the italian string",
 *    "en-US": "the english string"
 *  }
 * ```
 *
 * @prop {string|object} value the localized string. It can be a string or an object with the localized strings. If it is a string, it will be converted to an object with the "default" key.
 * @prop {function} onChange callback to be called when the localized string is changed. It will be called with the new localized string as argument, in the same format of the value prop.
 *
 */
const LocalizedInput = ({
    locales = getSupportedLocales(),
    currentLocale = getLocale(),
    value,
    onChange = () => {}
}) => {
    const [showModal, setShowModal] = useState(false);
    const translations = value && typeof value === 'object' ? value ?? {} : {};
    const defaultTranslation = value && typeof value === 'object' ? value.default : value;
    const updateTranslation = (newValue, locale = "default") => {

        if (locale !== "default" || value && (typeof value === 'object')) {
            const newTranslations = {"default": defaultTranslation, ...translations, [locale]: newValue};
            console.log(newTranslations);
            onChange(newTranslations);
        } else if (locale === "default" && (value && (typeof value === 'string') || !value && locale === "default")) {
            console.log(`newValue: ${newValue}. locale: ${locale}, value: ${value}`);
            onChange(newValue);
        }
    };
    // if the current translation is present, use it, otherwise use the default translation

    return (<InputGroup>
        <FormControl
            value={defaultTranslation}
            onChange={({target}) => {
                updateTranslation(target.value);

            }}/>
        <InputGroup.Addon>
            <a style={{cursor: 'pointer'}}
                onClick={(e) => {e.preventDefault(); setShowModal(true); }}>
                <AddonIcon glyph="flag" tooltip="localizedInput.localize"/>
            </a>
        </InputGroup.Addon>
        <Modal show={showModal} bsSize="large">
            <Modal.Header>
                <Modal.Title><Message msgId="localizedInput.title" /></Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <InputGroup key="default">
                    <InputGroup.Addon>
                        <AddonIcon glyph="flag" tooltip="localizedInput.default"/>
                    </InputGroup.Addon>
                    <DefaultFormControl
                        placeholder={"localizedInput.default"}
                        defaultValue={defaultTranslation}
                        type="text"
                        onChange={({target}) => updateTranslation(target.value)} />
                </InputGroup>
                <hr />
                {Object.keys(locales).map((a) => {

                    return (<InputGroup key={a}>
                        <FlagAddon tooltip={locales[a].description} locale={locales[a]} />
                        <FormControl
                            placeholder={locales[a].description}
                            defaultValue={translations[locales[a].code] || ''}
                            type="text"
                            onChange={({target}) => updateTranslation(target.value, locales[a].code)} />
                    </InputGroup>);
                }
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button style={{"float": "right"}} onClick={() => setShowModal(false)}>Close</Button>
            </Modal.Footer>
        </Modal>
    </InputGroup>);
};

export default LocalizedInput;

