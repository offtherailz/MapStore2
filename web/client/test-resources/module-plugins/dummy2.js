import {createPlugin} from "../../utils/PluginsUtils";
import {Observable} from 'rxjs';

const Dummy2 = createPlugin('Example2',
    {
        component: () => {
            return null;
        },
        reducers: {
            example2: (state) => { return state;}
        },
        epics: {
            anotherTestEpic: (action$) => action$.ofType('FAKE_TYPE')
                .switchMap(() => {
                    return Observable.empty();
                })
        }
    }
);

export default Dummy2;
