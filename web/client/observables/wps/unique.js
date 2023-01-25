import { castArray } from "lodash";
import {
    processParameter,
    processData,
    literalData,
    processReference,
    responseForm,
    rawDataOutput,
} from "./common";
import { executeProcessXML, executeProcess } from "./execute";

//vgl MapStore2/web/client/observables/wps/aggregate.js
export const uniqueXML = ({
    featureType,
    classificationAttribute = [],
    viewParams,
    filter = "",
}) => {
    console.log(classificationAttribute);
    const getFeature =
        `<wfs:GetFeature ${
            viewParams ? `viewParams="${viewParams}"` : ""
        } outputFormat="GML2" service="WFS" version="1.0.0">` +
        `<wfs:Query typeName="${featureType}">${filter}</wfs:Query></wfs:GetFeature>`;

    return executeProcessXML(
        "gs:PagedUnique",
        [
            processParameter(
                "features",
                processReference(
                    "text/xml",
                    "http://geoserver/wfs",
                    "POST",
                    getFeature
                )
            ),
            ...castArray(classificationAttribute).map((attribute) =>
                processParameter(
                    "fieldName",
                    processData(literalData(attribute))
                )
            ),
        ],
        responseForm(rawDataOutput("result", "application/json"))
    );
};

const unique = (url, options, requestOptions = {}) =>
    executeProcess(url, uniqueXML(options), {}, requestOptions);

export default unique;
