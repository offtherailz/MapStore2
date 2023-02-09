///hier steht nur gedoens
/* import uuid from "uuid";
import { generateRandomHexColor } from "../../../../../utils/ColorUtils";

//to get unique values of visByFieldID
const uniqueVals = props?.data
    .map((e) => e[props?.classifications?.dataKey])
    .filter((value, index, self) => {
        return self.indexOf(value) === index;
    });

const autopopClassification = uniqueVals.map((e) => {
    return({
        id: uuid.v1(),
        color: generateRandomHexColor(),
        title: "",
        value: e,
        unique: e
    })
});

function autoClassifier(props, autopopClassification) {
    props?.autoColorOptions?.classification &&
    props?.autoColorOptions?.classification?.length() > 1
        ? (props.autoColorOptions = [])
        : (props.autoColorOptions.classification = autopopClassification);
}


//action
export const autopopClasses = (newClasses) => ({
    type: AUTOPOP,
    newClasses
}) 


//reducer
case AUTOPOP: {
    return set("autoColorOptions.classification", action.newClasses)
}
 */
