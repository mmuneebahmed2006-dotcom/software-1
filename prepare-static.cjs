const fs = require('fs');
fs.cpSync('.output', 'app-output', { recursive: true });
console.log('Copied .output to app-output');
