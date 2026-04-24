function parseMultipartSingleFile(fieldName = 'file') {
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

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('error', () => res.status(400).json({ ok: false, message: 'Upload stream error' }));
    req.on('end', () => {
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
