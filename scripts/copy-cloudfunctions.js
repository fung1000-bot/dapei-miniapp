const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'cloudfunctions')
const dst = path.join(__dirname, '..', 'dist', 'cloudfunctions')

fs.cpSync(src, dst, { recursive: true })
console.log('[build] cloudfunctions -> dist/cloudfunctions')
