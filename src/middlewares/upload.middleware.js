function parseMultipartSingleFile(fieldName = 'file', { maxBytes = 0 } = {}) {
  return (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.startsWith('multipart/form-data')) {
      req.file = null;
      return next();
    }

    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      return res.status(400).json({ ok: false, message: 'Multipart boundary not found' });
    }

    const boundary = `--${boundaryMatch[1]}`;
    const chunks = [];

    let totalBytes = 0;
    let limitHit = false;
    req.on('data', (chunk) => {
      if (limitHit) return;
      totalBytes += chunk.length;
      if (maxBytes > 0 && totalBytes > maxBytes) {
        limitHit = true;
        chunks.length = 0;
        req.removeAllListeners('end');
        return res.status(413).json({ ok: false, message: `Uploaded file is too large. Max allowed: ${maxBytes} bytes` });
      }
      chunks.push(chunk);
    });
    req.on('error', () => res.status(400).json({ ok: false, message: 'Upload stream error' }));
    req.on('end', () => {
      if (limitHit) return;
      try {
        const buffer = Buffer.concat(chunks);
        const body = buffer.toString('latin1');

        const parts = body.split(boundary).filter((part) => part.trim() && part.trim() !== '--');
        for (const part of parts) {
          const nameMatch = part.match(/name="([^"]+)"/i);
          if (!nameMatch || nameMatch[1] !== fieldName) continue;

          const filenameMatch = part.match(/filename="([^"]*)"/i);
          const typeMatch = part.match(/Content-Type:\s*([^\r\n]+)/i);

          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;

          const fileContentStart = headerEnd + 4;
          const fileContentEnd = part.lastIndexOf('\r\n');
          if (fileContentEnd <= fileContentStart) continue;

          const binaryChunk = part.slice(fileContentStart, fileContentEnd);
          req.file = {
            fieldname: fieldName,
            originalname: filenameMatch ? filenameMatch[1] : 'upload.bin',
            mimetype: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
            buffer: Buffer.from(binaryChunk, 'latin1')
          };

          return next();
        }

        req.file = null;
        return next();
      } catch (error) {
        return res.status(400).json({ ok: false, message: 'Invalid multipart payload' });
      }
    });
  };
}

module.exports = {
  parseMultipartSingleFile
};
