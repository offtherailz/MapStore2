import {Observable} from 'rxjs';
import { SAVE_RULE, setLoading, RULE_SAVED, DELETE_RULES, CACHE_CLEAN } from '../actions/rulesmanager';
import { error, success } from '../actions/notifications';
import { drawSupportReset } from '../actions/draw';
import { updateRule, createRule, deleteRule, cleanCache } from '../observables/rulesmanager';

// To do add Error management
import { get } from 'lodash';

const saveRule = stream$ => stream$
    .mapTo({type: RULE_SAVED})
    .concat(Observable.of(drawSupportReset()))
    .catch(e => {
        let isDuplicate = false;
        if (e.data) {
            isDuplicate = e.data.indexOf("Duplicat") === 0;
        }
        return Observable.of(error({title: "rulesmanager.errorTitle", message: isDuplicate ? "rulesmanager.errorDuplicateRule" : "rulesmanager.errorUpdatingRule"}));
    })
    .startWith(setLoading(true))
    .concat(Observable.of(setLoading(false)));

export default {
    onSave: (action$, store) => action$.ofType(SAVE_RULE)
        .exhaustMap(({rule}) =>
            rule.id ? updateRule(rule, get(store.value, "rulesmanager.activeRule", {})).let(saveRule) : createRule(rule).let(saveRule)
        ),
    onDelete: (action$, store) => action$.ofType(DELETE_RULES)
        .switchMap(({ids = get(store.value, "rulesmanager.selectedRules", []).map(row => row.id)}) => {
            return Observable.combineLatest(ids.map(id => deleteRule(id))).let(saveRule);
        }),
    onCacheClean: action$ => action$.ofType(CACHE_CLEAN)
        .exhaustMap( () =>
            cleanCache()
                .mapTo(success({title: "rulesmanager.errorTitle", message: "rulesmanager.cacheCleaned"}))
                .startWith(setLoading(true))
                .catch(() => {
                    return Observable.of(error({title: "rulesmanager.errorTitle", message: "rulesmanager.errorCleaningCache"}));
                })
                .concat(Observable.of(setLoading(false))))
};

