import ConfigUtils from '../utils/ConfigUtils';
import { setControlProperty } from './controls';
import { logoutWithReload, resetError } from './security';
import { setCookie } from '../utils/CookieUtils';
import AuthorizationAPI from '../api/GeoStoreDAO';

/**
 * Thunk with side effects to trigger set the proper temp cookie and redirect to openID login provider URL.
 * @param {string} provider the provider to use for login
 * @returns {function} the think to execute. It doesn't dispatch any action, but sets a cookie to remember the authProvider used.
 * @memberof actions.login
 */
export function openIDLogin(provider) {
    return () => {
        setCookie("authProvider", provider?.provider, 1000 * 60 * 5); // expires in 5 minutes
        location.href = provider?.url ?? `${ ConfigUtils.getConfigProp("geoStoreUrl")}openid/${provider.provider}/login`;
    };
}
/**
 * Show login window
 * @returns {object} action of type 'SET_CONTROL_PROPERTY' for login
 * @memberof actions.login
 */
export function showLoginWindow() {
    return setControlProperty( "LoginForm", "enabled", true);
}

/**
 * Hide login window
 * @returns {object} action of type 'SET_CONTROL_PROPERTY' for login
 * @memberof actions.login
 */
export function hideLoginWindow() {
    return setControlProperty( "LoginForm", "enabled", false);
}

/**
 * Execute the operation and side effects for close login (resetting login errors)
 * @returns {function}
 * @memberof actions.login
 */
export const closeLogin = () => {
    return (dispatch) => {
        dispatch(hideLoginWindow());
        dispatch(resetError());
    };
};

/**
 * Action triggered by the login tool to start login procedure.
 * @param {object[]} providers the list of providers available.
 * @returns {function|object} the action to trigger or the thunk to execute, to show the Window or redirect to the proper login service.
 * @memberof actions.login
 */
export function onShowLogin(providers = [{type: "basic", provider: "geostore"}]) {
    if (providers?.length > 1) {
        return showLoginWindow(); // SHOW Login form
    }
    // only one provider does automatically redirect or show login form
    const provider = providers?.[0];
    switch (provider?.type) {
    case "openID":
        return openIDLogin(provider);
    case "basic":
        return showLoginWindow();
    default:
        console.warn(`login provider not configured correctly, authentication provider of type ${provider?.type} has not been recognized`);
        return showLoginWindow();
    }
}

/**
 * Execute the logout operations
 * @returns {function} calls authorizationAPI logout and then dispatch the logout actions.
 * @memberof actions.login
 */
export function onLogout() {
    return (dispatch) => {

        AuthorizationAPI.logout()
            .then(() => dispatch(logoutWithReload()))
            .catch(() => dispatch(logoutWithReload()));

    };
}