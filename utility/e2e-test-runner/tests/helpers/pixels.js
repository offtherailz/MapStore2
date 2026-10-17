/**
 * Colour checks on screenshots, to verify what a style draws on the map.
 *
 * Playwright screenshots are 8 bit, non interlaced RGB(A) PNGs: this decoder handles
 * only that kind of image.
 */

import { inflateSync } from 'node:zlib';

function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) {
        return a;
    }

    return pb <= pc ? b : c;
}

/** @returns {{ width: number, height: number, channels: number, pixels: Uint8Array }} */
function decodePng(buffer) {
    let offset = 8;
    let width;
    let height;
    let channels;
    const data = [];
    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        const chunk = buffer.subarray(offset + 8, offset + 8 + length);
        if (type === 'IHDR') {
            width = chunk.readUInt32BE(0);
            height = chunk.readUInt32BE(4);
            channels = chunk[9] === 6 ? 4 : 3;
        } else if (type === 'IDAT') {
            data.push(chunk);
        }
        offset += length + 12;
    }
    const raw = inflateSync(Buffer.concat(data));
    const stride = width * channels;
    const pixels = new Uint8Array(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        for (let x = 0; x < stride; x++) {
            const value = raw[y * (stride + 1) + 1 + x];
            const left = x >= channels ? pixels[y * stride + x - channels] : 0;
            const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
            const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
            const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
            pixels[y * stride + x] = (value + predictor) & 0xff;
        }
    }

    return { width, height, channels, pixels };
}

/**
 * Counts the pixels of a screenshot close to a colour.
 *
 * @param {Buffer} png screenshot
 * @param {string} color hex colour, e.g. '#0000ff'
 * @param {number} [tolerance] maximum difference per channel
 */
function countColor(png, color, tolerance = 40) {
    const { width, height, channels, pixels } = decodePng(png);
    const target = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
    let count = 0;
    for (let i = 0; i < width * height * channels; i += channels) {
        if (target.every((value, channel) => Math.abs(pixels[i + channel] - value) <= tolerance)) {
            count++;
        }
    }

    return count;
}

/**
 * Number of pixels of the map viewport drawn in a colour. The side panels open over the
 * map are masked, so their swatches and previews are not counted.
 */
async function mapPixels(page, color, tolerance) {
    const screenshot = await page.locator('.ol-viewport, .cesium-widget').first().screenshot({
        mask: [page.locator('.ms-side-panel')],
        maskColor: '#ff00ff'
    });

    return countColor(screenshot, color, tolerance);
}

export { decodePng, countColor, mapPixels };
