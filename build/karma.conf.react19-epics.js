const path = require("path");

module.exports = function karmaConfig(config) {

    process.env.BABEL_ENV = 'test';
    const testConfig = require('./testConfig')({
        files: [
            'build/tests-react19-epics.webpack.js',
            { pattern: './web/client/test-resources/**/*', included: false },
            { pattern: './web/client/translations/**/*', included: false }
        ],
        path: path.join(__dirname, "..", "web", "client"),
        basePath: path.join(__dirname, ".."),
        testFile: 'build/tests-react19-epics.webpack.js',
        singleRun: true
    });
    testConfig.client = { ...testConfig.client, captureConsole: true };
    testConfig.browserConsoleLogOptions = { level: 'warn', format: '%b %T: %m', terminal: true };
    config.set(testConfig);
};
