const React = require('react');
const Confirm = require('../../../misc/ConfirmDialog');
const Message = require('../../../I18N/Message');
module.exports = ({
    onClose = () => {},
    saving = false,
    count,
    onConfirm = () => {}
} = {}) => (<Confirm
    show
    onClose={onClose}
    onConfirm={onConfirm}
    confirmButtonContent={<Message msgId="delete" />}
    confirmButtonDisabled={saving}>
    Do you confirm you want to delete {count} features?
    </Confirm>);
