import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';

import { loginSuccess } from '../../../../actions/security';
import { getSavedAudits } from '../../api/auditApi';
import { getPendingEvents, getAuditConfig } from '../../selectors';
import tooltip from '../../../../components/misc/enhancers/tooltip';
import './auditDevtool.less';

const TooltipDiv = tooltip('div');

const AuditDevtool = ({ pendingEvents, config, loginSuccess: loggedInSuccessfully }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [savedAudits, setSavedAudits] = useState([]);

    if (!config.auditDevToolEnabled) return null;

    useEffect(() => {
        const refreshSavedAudits = () => {
            const audits = getSavedAudits();
            setSavedAudits(audits);
        };

        refreshSavedAudits();
        const interval = setInterval(refreshSavedAudits, 2000);

        return () => clearInterval(interval);
    }, []);

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    const formatJsonData = (data) => {
        const formatValue = (value) => {
            if (typeof value === 'object' && value !== null) {
                return JSON.stringify(value, null, 2);
            }
            return String(value);
        };

        return (
            <div className="audit-devtool-tooltip-content">
                <table>
                    <tbody>
                        {Object.entries(data).map(([key, value]) => (
                            <tr key={key}>
                                <td className="tooltip-key">
                                    {key}:
                                </td>
                                <td className="tooltip-value">
                                    <pre>
                                        {formatValue(value)}
                                    </pre>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const handleMockLogin = () => {
        loggedInSuccessfully({
            name: 'test-user',
            id: 'test-user-123',
            role: 'USER'
        });
    };

    return (
        <div className="audit-devtool">
            <button
                className="audit-devtool-toggle"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                Audit Devtool
                <span>{isExpanded ? '▼' : '▶'}</span>
            </button>

            {isExpanded && (
                <div className="audit-devtool-panel">
                    <div className="audit-devtool-header">
                        <div className="audit-devtool-status">
                            <div><span>Status: </span><span className={config.enabled ? "status-ok" : "status-error"}>{config.enabled ? 'Enabled' : 'Disabled'}</span></div>
                            <div>&nbsp;&nbsp;&gt;&nbsp;<span>API:</span><span className={config.auditAPIActive ? "status-ok" : "status-error"}> {config.auditAPIActive ? 'Active' : `Inactive (${config.reason ?? "Disabled"})`}</span></div>
                            <div>&nbsp;&nbsp;&gt;&nbsp;<span>localConfig:</span><span className={config.localConfigEnabled === false ? "status-error" : "status-ok" }> {
                                config.localConfigEnabled
                                    ? 'Enabled'
                                    : config.localConfigEnabled === false ? 'Disabled' : "(not indicated)"
                            }</span></div>
                        </div>

                    </div>
                    { config.enabled && (
                        <>
                            <div
                                onClick={handleMockLogin}
                                className="audit-devtool-mock-login-btn"
                            >
                        Test Action:
                        Mock Login
                            </div>

                            <div className="audit-devtool-stats">
                                <div className="stat-item pending">
                                    <div className="value">{pendingEvents.length}</div>
                                    <div className="label">Pending</div>
                                </div>
                                <div className="stat-item sent">
                                    <div className="value">{savedAudits.length}</div>
                                    <div className="label">Sent</div>
                                </div>
                            </div>

                            <div className="audit-devtool-section">
                                <h4>Pending Events ({pendingEvents.length})</h4>
                                {pendingEvents.length > 0 ? (
                                    <div className="events-list">
                                        {pendingEvents.map((event, index) => (
                                            <TooltipDiv
                                                key={index}
                                                className="event-item"
                                                tooltip={formatJsonData(event)}
                                                tooltipPosition="left"
                                                tooltipTrigger={["hover", "focus"]}
                                                tooltipShowDelay={0}
                                            >
                                                <div className="event-type">{event.eventType}</div>
                                                <div className="timestamp">{formatTimestamp(event.timestamp)}</div>
                                                {event.data?.resourceType && (
                                                    <div className="resource-type">{event.data.resourceType}</div>
                                                )}
                                            </TooltipDiv>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state">No pending events</div>
                                )}
                            </div>

                            <div className="audit-devtool-section">
                                <h4>Sent Audits ({savedAudits.length})</h4>
                                {savedAudits.length > 0 ? (
                                    <div className="events-list">
                                        {savedAudits.slice(-5).reverse().map((audit, index) => (
                                            <TooltipDiv
                                                key={index}
                                                className="event-item"
                                                tooltip={formatJsonData(audit)}
                                                tooltipPosition="left"
                                                tooltipTrigger={["hover", "focus"]}
                                            >
                                                <div className="event-type">{audit.eventType}</div>
                                                <div className="timestamp">{formatTimestamp(audit.timestamp)}</div>
                                                {audit.data?.resourceType && (
                                                    <div className="resource-type">{audit.data.resourceType}</div>
                                                )}
                                            </TooltipDiv>
                                        ))}
                                        {savedAudits.length > 5 && (
                                            <div className="audit-devtool-more-indicator">
                                        ... and {savedAudits.length - 5} more
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="empty-state">No sent audits yet</div>
                                )}
                            </div>
                        </>
                    )
                    }
                    <div className="audit-devtool-config">
                        Config: Max: {config.maxAuditSizeToSave} | Flush: {config.flushInterval}ms
                    </div>

                </div>
            )}
        </div>
    );
};
const mapStateToProps = createStructuredSelector({
    pendingEvents: getPendingEvents,
    config: getAuditConfig
});

const mapDispatchToProps = {
    loginSuccess
};

export default connect(mapStateToProps, mapDispatchToProps)(AuditDevtool);
