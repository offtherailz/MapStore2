#!/usr/bin/env python3
"""
SPIKE ONLY (React 19 trial, #12506) -- NOT a proposal.

Re-applies the third-party patches the React 19 spike needs, because they live in
node_modules and are lost on every `npm install`. Every patch is guarded by a
__SPIKE_* marker and is idempotent, so running this twice is harmless.

    python3 build/spike-react19-node-modules-patches.py

Each patch exists because a library uses an API React 19 removed. They are probes
to reach the next layer of breakage, not proposed fixes: the real work is decided
in the MIP.
"""
import io
import os
import re
import sys

NM = 'node_modules'
applied, skipped, missing = [], [], []


def read(path):
    return io.open(path, encoding='utf-8').read()


def write(path, content):
    io.open(path, 'w', encoding='utf-8').write(content)


def patch(name, rel, fn, marker):
    path = os.path.join(NM, rel)
    if not os.path.exists(path):
        missing.append('%s (%s not found)' % (name, rel))
        return
    src = read(path)
    if marker in src:
        skipped.append(name)
        return
    out = fn(src)
    if out is None or out == src:
        missing.append('%s (pattern not found in %s)' % (name, rel))
        return
    write(path, out)
    applied.append(name)


# 1. react-dom: findDOMNode was removed in React 19. Walk the fiber of a class
#    instance down to its first host node, which covers every call shape the
#    running app hit (react-overlays, react-data-grid, our own code).
def p_find_dom_node(s):
    if 'module.exports.findDOMNode' in s:
        return None
    return s + '''
/* __SPIKE_FINDDOMNODE (React 19 trial, #12506) */
if (!module.exports.findDOMNode) {
  var HOST_COMPONENT = 5;
  var HOST_TEXT = 6;
  module.exports.findDOMNode = function findDOMNode(componentOrElement) {
    if (componentOrElement == null) { return null; }
    if (componentOrElement.nodeType) { return componentOrElement; }
    var root = componentOrElement._reactInternals;
    if (!root) { return null; }
    var node = root;
    while (node) {
      if (node.tag === HOST_COMPONENT || node.tag === HOST_TEXT) { return node.stateNode; }
      if (node.child) { node = node.child; continue; }
      while (node && node !== root && !node.sibling) { node = node.return; }
      if (!node || node === root) { return null; }
      node = node.sibling;
    }
    return null;
  };
}
'''


patch('react-dom findDOMNode polyfill', 'react-dom/index.js',
      p_find_dom_node, 'module.exports.findDOMNode')


# 2. uncontrollable 4.1.0 passes a hardcoded string ref ('inner') to every
#    composite component it wraps. String refs are removed in React 19, so this
#    crashes 7 react-bootstrap components (Dropdown, Tabs, Panel, Navbar, ...).
def p_uncontrollable(s):
    s = s.replace(
        "          ref: isCompositeComponent ? 'inner' : null",
        "          ref: isCompositeComponent ? function (c) { /* __SPIKE_UNCONTROLLABLE */ _this4.__innerRef = c; } : null", 1)
    s = s.replace("return (_refs$inner = this.refs.inner)[method].apply(_refs$inner, arguments);",
                  "return (_refs$inner = this.__innerRef)[method].apply(_refs$inner, arguments);", 1)
    s = s.replace("        return this.refs.inner;\n", "        return this.__innerRef;\n", 1)
    return s if '__SPIKE_UNCONTROLLABLE' in s else None


patch('uncontrollable string ref', 'uncontrollable/createUncontrollable.js',
      p_uncontrollable, '__innerRef')


# 3. react-intl 2.3.0 delivers `intl` through legacy context. Give it a real
#    context and turn its consumers into contextType users, so `this.context.intl`
#    keeps working unchanged.
def p_react_intl(s):
    m = re.search(r"^import .*from 'react';\s*$", s, re.M)
    if not m:
        return None
    s = s[:m.end()] + "\n\n/* __SPIKE_REACTINTL (React 19 trial, #12506) */\nvar __MS_INTL_CTX = React.createContext({});\n" + s[m.end():]
    old = """        key: 'render',
        value: function render() {
            return Children.only(this.props.children);
        }
    }]);
    return IntlProvider;"""
    new = """        key: 'render',
        value: function render() {
            return React.createElement(__MS_INTL_CTX.Provider, { value: this.getChildContext() }, Children.only(this.props.children));
        }
    }]);
    return IntlProvider;"""
    if old not in s:
        return None
    s = s.replace(old, new, 1)
    s = re.sub(r"\.contextTypes = \{\s*intl: intlShape\s*\};", ".contextType = __MS_INTL_CTX;", s)
    return s.rstrip() + "\n\nexport { __MS_INTL_CTX };\n"


patch('react-intl real context', 'react-intl/lib/index.es.js',
      p_react_intl, '__MS_INTL_CTX')


# 4. react-overlays RootCloseWrapper attaches its close listener on `document`
#    during componentDidMount. Since React 17 React delegates on the root
#    container, so the click that opened the overlay reaches the listener right
#    after it is attached and closes it in the same click: every menu is dead.
#    Two copies live in the tree, broken the same way.
def make_root_close(indent_style):
    def fn(s):
        m = re.search(r"(\s*)_this\.addEventListeners = function \(\) \{", s)
        if not m:
            return None
        ind = m.group(1)
        s = (s[:m.start()] + m.group(0) +
             ind + "  /* __SPIKE_ROOTCLOSE (React 19 trial, #12506) */" +
             ind + "  _this.__spikeAttachedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;" +
             s[m.end():])
        for h in ['handleMouseCapture', 'handleMouse']:
            mm = re.search(r"(\s*)_this\.%s = function \(e\) \{" % h, s)
            if not mm:
                return None
            i2 = mm.group(1)
            s = (s[:mm.start()] + mm.group(0) +
                 i2 + "  if (e && typeof e.timeStamp === 'number' && _this.__spikeAttachedAt != null && e.timeStamp < _this.__spikeAttachedAt) { return; }" +
                 s[mm.end():])
        return s
    return fn


patch('react-overlays 1.x RootCloseWrapper', 'react-overlays/es/RootCloseWrapper.js',
      make_root_close('es'), '__SPIKE_ROOTCLOSE')
patch('react-overlays 0.7.4 RootCloseWrapper (the one react-bootstrap uses)',
      'react-bootstrap/node_modules/react-overlays/lib/RootCloseWrapper.js',
      make_root_close('lib'), '__SPIKE_ROOTCLOSE')


# 5. react-bootstrap OverlayTrigger mounts its overlay imperatively with
#    unstable_renderSubtreeIntoContainer and tears it down with
#    unmountComponentAtNode, both removed in React 19. Rendering the overlay in
#    the tree instead lets react-overlays' own Portal place it, and the context
#    is inherited naturally.
def p_overlay_trigger(s):
    old_mount = """  OverlayTrigger.prototype.componentDidMount = function componentDidMount() {
    this._mountNode = document.createElement('div');
    this.renderOverlay();
  };

  OverlayTrigger.prototype.componentDidUpdate = function componentDidUpdate() {
    this.renderOverlay();
  };"""
    new_mount = """  OverlayTrigger.prototype.componentDidMount = function componentDidMount() {
    /* __SPIKE_OVERLAY (React 19 trial, #12506) */
  };

  OverlayTrigger.prototype.componentDidUpdate = function componentDidUpdate() {};"""
    old_unmount = """    ReactDOM.unmountComponentAtNode(this._mountNode);
    this._mountNode = null;"""
    new_unmount = """    this._mountNode = null;"""
    old_render = """  OverlayTrigger.prototype.renderOverlay = function renderOverlay() {
    ReactDOM.unstable_renderSubtreeIntoContainer(this, this._overlay, this._mountNode);
  };"""
    new_render = """  OverlayTrigger.prototype.renderOverlay = function renderOverlay() {};"""
    old_tree = """    this._overlay = this.makeOverlay(overlay, props);

    return cloneElement(child, triggerProps);"""
    new_tree = """    this._overlay = this.makeOverlay(overlay, props);

    return React.createElement(React.Fragment, null, cloneElement(child, triggerProps), this._overlay);"""
    for old, new in [(old_mount, new_mount), (old_unmount, new_unmount),
                     (old_render, new_render), (old_tree, new_tree)]:
        if old not in s:
            return None
        s = s.replace(old, new, 1)
    return s


patch('react-bootstrap OverlayTrigger', 'react-bootstrap/es/OverlayTrigger.js',
      p_overlay_trigger, '__SPIKE_OVERLAY')


# 6. react-widgets 3.5 uses string refs in 10 modules, so every date picker,
#    combobox and dropdown crashes the moment it mounts on React 19.
def p_react_widgets():
    import glob
    count = 0
    for path in sorted(glob.glob(os.path.join(NM, 'react-widgets/lib/*.js'))):
        s = read(path)
        if '__SPIKE_RW' in s or not re.search(r"ref: '[A-Za-z_$][\w$]*'", s):
            continue

        def repl(m):
            return ("ref: function (c) { /* __SPIKE_RW */ if (!this.refs) { this.refs = {}; } "
                    "this.refs['%s'] = c; }.bind(this)" % m.group(1))
        s2, n = re.subn(r"ref: '([A-Za-z_$][\w$]*)'", repl, s)
        write(path, s2)
        count += n
    return count


if os.path.isdir(os.path.join(NM, 'react-widgets/lib')):
    n = p_react_widgets()
    (applied if n else skipped).append('react-widgets string refs (%d)' % n)
else:
    missing.append('react-widgets (not installed)')



# 7. react-dnd 2.6.0 hands the drag and drop manager down through legacy context.
#    The layer tree entries are drag sources, so on React 19 the viewer breaks as
#    soon as the map has a single layer. Same treatment as react-intl: a real
#    context, so `this.context.dragDropManager` keeps working unchanged.
DND_CTX = """/*
 * SPIKE ONLY (React 19 trial, #12506) -- NOT a proposal.
 */
'use strict';
var React = require('react');
module.exports = React.createContext(null);
"""


def p_dnd_provider(s):
    s = s.replace("var CHILD_CONTEXT_TYPES = exports.CHILD_CONTEXT_TYPES = {",
                  "var __SPIKE_DND_CTX = require('./__spikeContext');\n\nvar CHILD_CONTEXT_TYPES = exports.CHILD_CONTEXT_TYPES = {", 1)
    old = """					return _react2.default.createElement(DecoratedComponent, _extends({}, this.props, {
						ref: function ref(child) {
							_this2.child = child;
						}
					}));"""
    new = """					return _react2.default.createElement(__SPIKE_DND_CTX.Provider, { value: childContext }, _react2.default.createElement(DecoratedComponent, _extends({}, this.props, {
						ref: function ref(child) {
							_this2.child = child;
						}
					})));"""
    if old not in s:
        return None
    return s.replace(old, new, 1)


def p_dnd_consumer(s):
    old = """_class.contextTypes = {
		dragDropManager: _propTypes2.default.object.isRequired
	}, _temp);"""
    if old not in s:
        return None
    s = s.replace("'use strict';", "'use strict';\n\nvar __SPIKE_DND_CTX = require('./__spikeContext');", 1)
    return s.replace(old, "_class.contextType = __SPIKE_DND_CTX, _temp);", 1)


if os.path.isdir(os.path.join(NM, 'react-dnd/lib')):
    ctx_path = os.path.join(NM, 'react-dnd/lib/__spikeContext.js')
    if not os.path.exists(ctx_path):
        write(ctx_path, DND_CTX)
    patch('react-dnd provider', 'react-dnd/lib/DragDropContext.js', p_dnd_provider, '__spikeContext')
    patch('react-dnd consumer', 'react-dnd/lib/decorateHandler.js', p_dnd_consumer, '__spikeContext')
else:
    missing.append('react-dnd (not installed)')

print('applied : %s' % (', '.join(applied) if applied else '-'))
print('already : %s' % (', '.join(skipped) if skipped else '-'))
if missing:
    print('MISSING : %s' % ', '.join(missing))
    sys.exit(1)
