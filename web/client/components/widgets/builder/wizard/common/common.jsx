import localizedProps from '../../../../misc/enhancers/localizedProps';
import Select from 'react-select';

export const AXIS_TYPES = [{
    value: '-',
    label: 'widgets.advanced.axisTypes.auto'
}, {
    value: 'linear',
    label: 'widgets.advanced.axisTypes.linear'
}, {
    value: 'category',
    label: 'widgets.advanced.axisTypes.category'
}, {
    value: 'log',
    label: 'widgets.advanced.axisTypes.log'
}, {
    value: 'date',
    label: 'widgets.advanced.axisTypes.date'
}];
export const AxisTypeSelect = localizedProps('options')(Select);
