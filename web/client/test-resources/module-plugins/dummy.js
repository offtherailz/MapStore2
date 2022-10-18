import {createPlugin} from "../../utils/PluginsUtils";
import {Observable} from 'rxjs';

const Dummy = createPlugin('Example',
    {
        component: () => {
            return null;
        },
        reducers: {
            example: (state) => { return state;}
        },
        epics: {
            testEpic: (action$) => action$.ofType('FAKE_TYPE')
                .switchMap(() => {
                    return Observable.empty();
                })
        }
    }
);

export default Dummy;
