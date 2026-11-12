/*
 * Minimal ZIP writer (store method, no compression) — no dependencies.
 * Dostatečné pro balení PNG (které už jsou komprimované) do jednoho .zip.
 *
 * Použití:
 *   const zip = new ZipWriter();
 *   zip.addFile('cesta/soubor.png', uint8Array);
 *   const blob = zip.toBlob();
 */
(function (global) {
  'use strict';

  // --- CRC32 tabulka ---
  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function stringToBytes(str) {
    return new TextEncoder().encode(str);
  }

  class ByteBuilder {
    constructor() {
      this.chunks = [];
      this.length = 0;
    }
    push(bytes) {
      this.chunks.push(bytes);
      this.length += bytes.length;
    }
    pushU16(value) {
      const b = new Uint8Array(2);
      b[0] = value & 0xff;
      b[1] = (value >>> 8) & 0xff;
      this.push(b);
    }
    pushU32(value) {
      const b = new Uint8Array(4);
      b[0] = value & 0xff;
      b[1] = (value >>> 8) & 0xff;
      b[2] = (value >>> 16) & 0xff;
      b[3] = (value >>> 24) & 0xff;
      this.push(b);
    }
    toUint8Array() {
      const out = new Uint8Array(this.length);
      let offset = 0;
      for (const chunk of this.chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
      }
      return out;
    }
  }

  class ZipWriter {
    constructor() {
      this.files = [];
    }

    /**
     * @param {string} name  cesta v archivu (lomítka pro složky)
     * @param {Uint8Array} data  binární obsah
     */
    addFile(name, data) {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      this.files.push({
        name: name,
        nameBytes: stringToBytes(name),
        data: bytes,
        crc: crc32(bytes),
      });
    }

    toBlob() {
      const local = new ByteBuilder();
      const central = new ByteBuilder();
      const offsets = [];

      for (const file of this.files) {
        offsets.push(local.length);

        // Local file header
        local.pushU32(0x04034b50);
        local.pushU16(20); // version needed
        local.pushU16(0x0800); // flags: UTF-8 filename
        local.pushU16(0); // method: store
        local.pushU16(0); // mod time
        local.pushU16(0); // mod date
        local.pushU32(file.crc);
        local.pushU32(file.data.length); // compressed size
        local.pushU32(file.data.length); // uncompressed size
        local.pushU16(file.nameBytes.length);
        local.pushU16(0); // extra length
        local.push(file.nameBytes);
        local.push(file.data);
      }

      for (let i = 0; i < this.files.length; i++) {
        const file = this.files[i];
        central.pushU32(0x02014b50);
        central.pushU16(20); // version made by
        central.pushU16(20); // version needed
        central.pushU16(0x0800); // flags: UTF-8
        central.pushU16(0); // method
        central.pushU16(0); // time
        central.pushU16(0); // date
        central.pushU32(file.crc);
        central.pushU32(file.data.length);
        central.pushU32(file.data.length);
        central.pushU16(file.nameBytes.length);
        central.pushU16(0); // extra
        central.pushU16(0); // comment
        central.pushU16(0); // disk number
        central.pushU16(0); // internal attrs
        central.pushU32(0); // external attrs
        central.pushU32(offsets[i]);
        central.push(file.nameBytes);
      }

      const localBytes = local.toUint8Array();
      const centralBytes = central.toUint8Array();

      const end = new ByteBuilder();
      end.pushU32(0x06054b50);
      end.pushU16(0); // disk number
      end.pushU16(0); // disk with central dir
      end.pushU16(this.files.length);
      end.pushU16(this.files.length);
      end.pushU32(centralBytes.length);
      end.pushU32(localBytes.length);
      end.pushU16(0); // comment length

      return new Blob([localBytes, centralBytes, end.toUint8Array()], {
        type: 'application/zip',
      });
    }
  }

  global.ZipWriter = ZipWriter;
})(window);
