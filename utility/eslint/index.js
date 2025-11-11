import {
    defineConfig,
} from "eslint/config";

import * as espree from "espree";
import noOnlyTests from "eslint-plugin-no-only-tests";
import react from "eslint-plugin-react";
import _import from "eslint-plugin-import";

import {
    fixupPluginRules,
} from "@eslint/compat";

import globals from "globals";

export default defineConfig([{
    languageOptions: {
        parser: espree,
        "ecmaVersion": "latest",
        "sourceType": "module",

        parserOptions: {
            "ecmaFeatures": {
                "jsx": true,
            },
        },

        globals: {
            ...globals.browser,
            ...globals.node,
            "describe": false,
            "it": false,
            "before": false,
            "beforeEach": false,
            "after": false,
            "afterEach": false,
            "__DEVTOOLS__": false,
            "__MAPSTORE_PROJECT_CONFIG__": false,
            "__COMMITHASH__": false,
            "__COMMIT_DATA__": false,
        },
    },

    plugins: {
        "no-only-tests": noOnlyTests,
        react,
        import: fixupPluginRules(_import),
    },

    "rules": {
        "strict": [2, "never"],
        "no-var": 0,
        "prefer-const": 0,
        "no-shadow": 2,
        "no-shadow-restricted-names": 2,

        "no-unused-vars": [2, {
            "vars": "local",
            "args": "after-used",
            "ignoreRestSiblings": true,
        }],

        "no-use-before-define": 2,

        "no-only-tests/no-only-tests": ["error", {
            "block": ["it", "describe"],
            "focus": ["only"],
        }],

        "comma-dangle": [2, "never"],
        "no-cond-assign": [2, "always"],

        "no-console": ["error", {
            allow: ["error", "warn"],
        }],

        "no-debugger": 1,
        "no-undef": 2,
        "no-const-assign": 2,
        "no-duplicate-imports": 2,
        "no-alert": 1,
        "no-constant-condition": 1,
        "no-dupe-keys": 2,
        "no-duplicate-case": 2,
        "no-empty": 2,
        "no-ex-assign": 2,
        "no-extra-boolean-cast": 0,
        "no-extra-semi": 2,
        "no-func-assign": 2,
        "no-inner-declarations": 2,
        "no-invalid-regexp": 2,
        "no-irregular-whitespace": 2,
        "no-obj-calls": 2,

        "quote-props": [2, "as-needed", {
            "keywords": true,
            "unnecessary": false,
        }],

        "no-sparse-arrays": 2,
        "no-unreachable": 2,
        "use-isnan": 2,
        "block-scoped-var": 2,

        "consistent-return": [2, {
            "treatUndefinedAsUnspecified": true,
        }],

        "curly": [2, "multi-line"],
        "default-case": 2,

        "dot-notation": [2, {
            "allowKeywords": true,
        }],

        "eqeqeq": 2,
        "guard-for-in": 2,
        "no-caller": 2,
        "import/named": 2,
        "no-else-return": 2,
        "no-eq-null": 2,
        "no-eval": 2,
        "no-extend-native": 2,
        "no-extra-bind": 2,
        "no-fallthrough": 2,
        "no-floating-decimal": 2,
        "no-implied-eval": 2,
        "no-lone-blocks": 2,
        "no-loop-func": 2,
        "no-multi-str": 2,
        "no-native-reassign": 2,
        "no-new": 2,
        "no-new-func": 2,
        "no-new-wrappers": 2,
        "no-octal": 2,
        "no-octal-escape": 2,
        "no-param-reassign": 2,
        "no-proto": 2,
        "no-redeclare": 2,
        "no-return-assign": 2,
        "no-script-url": 2,
        "no-self-compare": 2,
        "no-sequences": 2,
        "no-throw-literal": 2,
        "no-with": 2,
        "radix": 2,
        "vars-on-top": 2,
        "wrap-iife": [2, "any"],
        "yoda": 2,
        "indent": [2, 4],

        "brace-style": [2, "1tbs", {
            "allowSingleLine": true,
        }],

        "quotes": [0, "single", "avoid-escape"],

        "camelcase": [1, {
            "properties": "never",
            "allow": ["^UNSAFE_"],
        }],

        "comma-spacing": [2, {
            "before": false,
            "after": true,
        }],

        "comma-style": [2, "last"],
        "eol-last": 2,
        "func-names": 0,

        "key-spacing": [2, {
            "beforeColon": false,
            "afterColon": true,
        }],

        "new-cap": [2, {
            "newIsCap": true,
        }],

        "no-multiple-empty-lines": [2, {
            "max": 2,
        }],

        "no-nested-ternary": 0,
        "no-new-object": 2,
        "no-spaced-func": 2,
        "no-trailing-spaces": 2,
        "no-extra-parens": [2, "functions"],
        "no-underscore-dangle": 0,
        "one-var": [2, "never"],
        "padded-blocks": [0, "never"],
        "semi": [2, "always"],

        "semi-spacing": [2, {
            "before": false,
            "after": true,
        }],

        "keyword-spacing": [2, {
            "after": true,
        }],

        "space-before-blocks": 2,
        "space-before-function-paren": [2, "never"],
        "space-infix-ops": 2,
        "spaced-comment": 2,
        "react/jsx-no-duplicate-props": 2,
        "react/display-name": 0,
        "react/jsx-boolean-value": 2,
        "jsx-quotes": [2, "prefer-double"],
        "react/jsx-no-undef": 2,
        "react/jsx-sort-props": 0,
        "react/jsx-sort-prop-types": 0,
        "react/jsx-uses-react": 2,
        "react/jsx-uses-vars": 2,
        "react/no-did-mount-set-state": [2],
        "react/no-did-update-set-state": 2,
        "react/no-multi-comp": 0,
        "react/no-unknown-property": 2,

        "react/prop-types": [0, {
            "ignore": ["children"],
        }],

        "react/react-in-jsx-scope": 2,
        "react/self-closing-comp": 2,
        //"react/wrap-multilines": 2,

        "no-restricted-imports": [2, {
            "name": "lodash",
            "importNames": ["default"],
            "message": "Please use the default import from 'lodash/functionName' instead.",
        }],

        "no-restricted-modules": [2, {
            "paths": ["lodash", "!lodash/*"],
        }],
    },
}]);

