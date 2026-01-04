const { addonBuilder } = require('stremio-addon-sdk');
const fs = require('fs');

// Load the same manifest building code
eval(fs.readFileSync('index.js', 'utf8').replace(/module\.exports.*/, '').replace(/if \(require\.main === module\).*/, ''));

// Get the manifest
const manifest = buildManifest();
const manifestJson = JSON.stringify(manifest);
const sizeInBytes = Buffer.byteLength(manifestJson, 'utf8');
const sizeInKB = (sizeInBytes / 1024).toFixed(2);

console.log('📊 Manifest Size Analysis:');
console.log(`   Size: ${sizeInKB} KB (${sizeInBytes} bytes)`);
console.log(`   Limit: 8 KB (8192 bytes)`);
console.log(`   Status: ${sizeInBytes <= 8192 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Margin: ${(8192 - sizeInBytes).toFixed(0)} bytes`);

if (sizeInBytes > 8192) {
  console.log('\n⚠️  Manifest exceeds 8KB limit!');
  process.exit(1);
} else {
  console.log('\n✅ Manifest is within limits!');
  process.exit(0);
}

