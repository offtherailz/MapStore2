/**
 * Builds the smallest MapStore extension the upload service accepts, so the context
 * suites can exercise upload, use and removal without a webpack build.
 *
 * MapStore loads an extension bundle as a script and then asks the global container
 * named after the plugin for its `./plugin` module (PluginsUtils.loadPlugin). The bundle
 * below defines that container by hand; its plugin renders a fixed text.
 */

/** Text rendered by the extension, the observable proof that it was loaded. */
const EXTENSION_TEXT = 'E2E extension is running';

/**
 * The component carries a displayName: PluginsUtils treats a bare function as a factory
 * to call, while a named component is rendered as is.
 */
function extensionBundle(name) {
    return `(function() {
    var Component = function() { return ${JSON.stringify(EXTENSION_TEXT)}; };
    Component.displayName = ${JSON.stringify(name)};
    window[${JSON.stringify(name)}] = {
        init: function() { return Promise.resolve(); },
        get: function() {
            return Promise.resolve(function() {
                return { default: { name: ${JSON.stringify(name)}, component: Component, containers: {} } };
            });
        }
    };
})();
`;
}

function extensionDescriptor(name) {
    return JSON.stringify({
        id: name,
        version: '1.0.0',
        title: name,
        description: 'Created by the E2E suite',
        plugins: [{ name, title: name, description: 'Created by the E2E suite', defaultConfig: {} }]
    }, null, 2);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;

    for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    return c >>> 0;
});

function crc32(buffer) {
    let crc = 0xffffffff;

    for (const byte of buffer) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Minimal zip writer: entries are stored without compression, which every unzip accepts.
 *
 * @param {Record<string, string>} files path → text content
 * @returns {Buffer}
 */
function zip(files) {
    const locals = [];
    const centrals = [];
    let offset = 0;

    for (const [path, content] of Object.entries(files)) {
        const name = Buffer.from(path);
        const data = Buffer.from(content);
        const crc = crc32(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        locals.push(local, name, data);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(offset, 42);
        centrals.push(central, name);

        offset += local.length + name.length + data.length;
    }

    const directory = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(Object.keys(files).length, 8);
    end.writeUInt16LE(Object.keys(files).length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...locals, directory, end]);
}

/**
 * @param {string} name plugin name, also the name of the extension
 * @returns {{name: string, mimeType: string, buffer: Buffer}} a file for setInputFiles
 */
function extensionZip(name) {
    return {
        name: `${name}.zip`,
        mimeType: 'application/zip',
        buffer: zip({ 'index.js': extensionBundle(name), 'index.json': extensionDescriptor(name) })
    };
}

export { EXTENSION_TEXT, extensionZip };
