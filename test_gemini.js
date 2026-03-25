const https = require('https');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

https.get(listUrl, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.models) {
            console.log('Available models:');
            parsed.models
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                .forEach(m => console.log(' -', m.name));
        } else {
            console.log('ERROR:', JSON.stringify(parsed, null, 2));
        }
    });
}).on('error', e => console.error('Error:', e.message));
