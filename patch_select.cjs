const fs = require('fs');
const file = 'frontend/src/pages/Home.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldOptions = `<option value={30}>30 seconds</option>
                              <option value={60}>1 minute</option>
                              <option value={300}>5 minutes</option>
                              <option value={600}>10 minutes</option>
                              <option value={3600}>1 hour</option>`;

const newOptions = `<option value={10}>10 seconds</option>
                              <option value={30}>30 seconds</option>
                              <option value={60}>1 minute</option>
                              <option value={300}>5 minutes</option>`;

if (content.includes(oldOptions)) {
    content = content.replace(oldOptions, newOptions);
    fs.writeFileSync(file, content);
    console.log("Replaced successfully.");
} else {
    console.log("Could not find the exact options string.");
}
