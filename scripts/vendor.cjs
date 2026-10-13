const fs = require('node:fs');
fs.mkdirSync('assets/vendor', { recursive: true });
fs.copyFileSync('node_modules/gsap/dist/gsap.min.js', 'assets/vendor/gsap.min.js');
