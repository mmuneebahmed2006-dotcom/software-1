const fs = require('fs');
fs.cpSync('.output/public', 'app-public', { recursive: true });
console.log('Copied .output/public to app-public');
