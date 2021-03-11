const path = require("path");

module.exports = function karmaConfig(config) {

    // set BABEL_ENV to load proper preset config (e.g. istanbul plugin)
    process.env.BABEL_ENV = 'test';
    const testConfig = require('./testConfig')({
        files: [
            'build/tests-travis.webpack.js',
            { pattern: './web/client/test-resources/**/*', included: false },
            { pattern: './web/client/translations/**/*', included: false }
        ],
        path: path.join(__dirname, "..", "web", "client"),
        basePath: "..",
        testFile: 'build/tests-travis.webpack.js',
        singleRun: true
    });
    testConfig.logLevel = config.LOG_ERROR; // in single run typically warn errors (e.g. of 404 not found) should not be reported. Some errors of this kind are desired to test not found.
    config.set(testConfig);
};
