const zlib = require('zlib');

function findEOCD(buffer) {
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 0xffff - 22); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

function unzipBuffer(buffer) {
  const eocd = findEOCD(buffer);
  if (eocd === -1) throw new Error('Invalid XLSX zip: EOCD not found');

  const centralDirSize = buffer.readUInt32LE(eocd + 12);
  const centralDirOffset = buffer.readUInt32LE(eocd + 16);

  let ptr = centralDirOffset;
  const end = centralDirOffset + centralDirSize;
  const files = {};

  while (ptr < end) {
    if (buffer.readUInt32LE(ptr) !== 0x02014b50) break;

    const compressedSize = buffer.readUInt32LE(ptr + 20);
    const fileNameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localHeaderOffset = buffer.readUInt32LE(ptr + 42);
    const fileName = buffer.slice(ptr + 46, ptr + 46 + fileNameLen).toString('utf8');

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) throw new Error(`Invalid local header for ${fileName}`);

    const method = buffer.readUInt16LE(localHeaderOffset + 8);
    const localFileNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLen + localExtraLen;
    const raw = buffer.slice(dataStart, dataStart + compressedSize);

    let out;
    if (method === 0) out = raw;
    else if (method === 8) out = zlib.inflateRawSync(raw);
    else throw new Error(`Unsupported ZIP compression method ${method}`);

    files[fileName] = out;
    ptr += 46 + fileNameLen + extraLen + commentLen;
  }

  return files;
}

module.exports = { unzipBuffer };
