const fs = require('fs');

function getDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  // PNG signature is 8 bytes
  // IHDR chunk starts at byte 8, Length (4), Type (4), Width (4), Height (4)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  console.log(`${filePath}: ${width}x${height}`);
}

getDimensions('public/icon-192.png');
