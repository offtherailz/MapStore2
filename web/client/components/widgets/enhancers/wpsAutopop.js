import { isNil, isObject } from "lodash";
import { compose, withProps } from "recompose";
import Rx from "rxjs";

import wpsUnique from "../../../observables/wps/unique";
import { getWpsUrl } from "../../../utils/LayersUtils";
import propsStreamFactory from "../../misc/enhancers/propsStreamFactory";

//vgl MapStore2/web/client/components/widgets/enhancers/wpsChart.js
const dataStreamFactory = ($props) =>
    $props
        .filter(
            ({ layer = {} }) =>
                (layer.name && getWpsUrl(layer)) || classificationAttribute
        )
        .distinctUntilChanged(
            ({ layer = {}, classificationAttribute = {}, filter }, newProps) =>
                newProps.layer &&
                layer.name === newProps.layer.name &&
                classificationAttribute &&
                filter
        )
        .switchMap(
            ({
                layer = {},
                classificationAttribute,
                filter,
                onLoad = () => {},
                onLoadError = () => {},
            }) =>
                wpsUnique(
                    getWpsUrl(layer),
                    {
                        featureType: layer.name,
                        classificationAttribute,
                        filter,
                    },
                    {
                        timeout: 15000,
                    }
                )
                    .map((data) => ({
                        loading: false,
                        isAnimationActive: false,
                        error: undefined,
                        //autopop: "ugu",
                        values: data.values,
                    }))
                    .do(onLoad)
                    .catch((e) =>
                        Rx.Observable.of({
                            loading: false,
                            error: e,
                            data: [],
                        }).do(onLoadError)
                    )
                    .startWith({ loading: true })
        );
export default compose(
    withProps(() => ({
        dataStreamFactory,
    })),
    propsStreamFactory
);
