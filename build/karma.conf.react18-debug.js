const path = require("path");

module.exports = function karmaConfig(config) {

    process.env.BABEL_ENV = 'test';
    const testConfig = require('./testConfig')({
        files: [
            'build/tests-react18-debug.webpack.js',
            { pattern: './web/client/test-resources/**/*', included: false },
            { pattern: './web/client/translations/**/*', included: false }
        ],
        path: path.join(__dirname, "..", "web", "client"),
        basePath: path.join(__dirname, ".."),
        testFile: 'build/tests-react18-debug.webpack.js',
        singleRun: true
    });
    testConfig.client = { ...testConfig.client, captureConsole: true };
    testConfig.browserConsoleLogOptions = { level: 'debug', format: '%b %T: %m', terminal: true };
    config.set(testConfig);
};
