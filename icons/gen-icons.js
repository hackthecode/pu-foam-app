// Генериране на PNG икони програмно (без външни библиотеки).
const zlib = require("zlib");
const fs = require("fs");

function makeIcon(size) {
  const W = size, H = size;
  const buf = Buffer.alloc(W * H * 4);

  function set(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    // alpha blend върху съществуващото
    const ba = buf[i + 3] / 255;
    const na = a / 255;
    const out = na + ba * (1 - na);
    if (out === 0) return;
    buf[i] = Math.round((r * na + buf[i] * ba * (1 - na)) / out);
    buf[i + 1] = Math.round((g * na + buf[i + 1] * ba * (1 - na)) / out);
    buf[i + 2] = Math.round((b * na + buf[i + 2] * ba * (1 - na)) / out);
    buf[i + 3] = Math.round(out * 255);
  }

  const s = size / 512; // мащаб

  // помощна: запълнен заоблен правоъгълник
  function roundRect(x0, y0, w, h, rad, colFn) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        // проверка за ъглите
        let dx = 0, dy = 0;
        if (x < x0 + rad && y < y0 + rad) { dx = x0 + rad - x; dy = y0 + rad - y; }
        else if (x >= x0 + w - rad && y < y0 + rad) { dx = x - (x0 + w - rad - 1); dy = y0 + rad - y; }
        else if (x < x0 + rad && y >= y0 + h - rad) { dx = x0 + rad - x; dy = y - (y0 + h - rad - 1); }
        else if (x >= x0 + w - rad && y >= y0 + h - rad) { dx = x - (x0 + w - rad - 1); dy = y - (y0 + h - rad - 1); }
        if (dx > 0 && dy > 0 && dx * dx + dy * dy > rad * rad) continue;
        const c = colFn(x, y);
        set(x, y, c[0], c[1], c[2], 255);
      }
    }
  }

  // фон (тъмен градиент)
  roundRect(0, 0, W, H, Math.round(110 * s), (x, y) => {
    const t = y / H;
    return [
      Math.round(26 + (14 - 26) * t),
      Math.round(33 + (17 - 33) * t),
      Math.round(43 + (22 - 43) * t),
    ];
  });

  // оранжев заоблен квадрат
  roundRect(Math.round(86 * s), Math.round(86 * s), Math.round(340 * s), Math.round(340 * s), Math.round(80 * s), (x, y) => {
    const t = (x + y) / (W + H);
    return [
      Math.round(255 + (217 - 255) * t),
      Math.round(157 + (115 - 157) * t),
      Math.round(51 + (15 - 51) * t),
    ];
  });

  // тъмна капка (елипса + конус)
  const cx = 256 * s, cy = 318 * s, rx = 94 * s, ry = 94 * s;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ex = (x - cx) / rx, ey = (y - cy) / ry;
      const inBulb = ex * ex + ey * ey <= 1;
      // триъгълен връх над центъра
      const topY = 150 * s;
      let inTip = false;
      if (y >= topY && y <= cy) {
        const prog = (y - topY) / (cy - topY);
        const halfW = rx * prog;
        if (Math.abs(x - cx) <= halfW) inTip = true;
      }
      if (inBulb || inTip) set(x, y, 26, 18, 7, 235);
    }
  }
  // светло петно
  const hx = 224 * s, hy = 318 * s, hr = 26 * s;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = (x - hx) ** 2 + (y - hy) ** 2;
      if (d <= hr * hr) set(x, y, 255, 217, 168, 140);
    }
  }

  return encodePNG(W, H, buf);
}

function encodePNG(W, H, rgba) {
  // raw данни с filter byte 0 за всеки ред
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const comp = zlib.deflateSync(raw, { level: 9 });

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", comp), chunk("IEND", Buffer.alloc(0))]);
}

// CRC32
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

fs.writeFileSync(__dirname + "/icon-192.png", makeIcon(192));
fs.writeFileSync(__dirname + "/icon-512.png", makeIcon(512));
console.log("Иконите са генерирани.");
