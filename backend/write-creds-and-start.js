const fs = require('fs');
const path = require('path');

// Write Google credentials if provided as environment variables
try {
  if (process.env.GOOGLE_CREDENTIALS_WEB) {
    fs.writeFileSync(path.join(__dirname, 'credentials.json'), process.env.GOOGLE_CREDENTIALS_WEB);
    console.log('Wrote credentials.json from env');
  }
  if (process.env.GOOGLE_CREDENTIALS_ANDROID) {
    fs.writeFileSync(path.join(__dirname, 'credentials_android.json'), process.env.GOOGLE_CREDENTIALS_ANDROID);
    console.log('Wrote credentials_android.json from env');
  }
} catch (e) {
  console.error('Error writing credentials files from env:', e);
}

// Start the server
require('./server');
