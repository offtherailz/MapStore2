import {Observable, Subject} from 'rxjs';

export const generateActionTrigger = (startAction) => {
    var eventStream = new Subject();
    let init = false;
    const buffer = [];
    eventStream.publish();
    return {
        trigger: (action) => init ? eventStream.next(action) : buffer.push(action),
        stop: () => eventStream.complete(),
        epic: (action$) =>
            action$.ofType(startAction).take(1).switchMap(() => {
                init = true;
                return Observable.from(buffer).concat(eventStream);
            })
    };
};


export default {
    generateActionTrigger
};
