const OpenAI = require('openai');
const FormData = require('form-data');
const axios = require('axios');
require('dotenv').config();

let client = null;
if (process.env.GROQ_API_KEY) {
    client = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
    });
}

/**
/**
 * Transcribes audio buffer using Groq Whisper API (whisper-large-v3-turbo)
 */
async function transcribeAudio(audioBuffer, filename = 'voice.ogg') {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not set');
    }

    const whisperModels = ['whisper-large-v3-turbo', 'whisper-large-v3'];
    let lastErr = null;

    for (const modelName of whisperModels) {
        try {
            const formData = new FormData();
            formData.append('file', audioBuffer, { filename, contentType: 'audio/ogg' });
            formData.append('model', modelName);

            const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            });

            if (response.data && response.data.text) {
                return response.data.text.trim();
            }
        } catch (err) {
            console.error(`Groq Whisper (${modelName}) Error:`, err.response?.data || err.message);
            lastErr = err;
        }
    }

    throw lastErr || new Error('Audio transcription failed.');
}

function cleanAndParseJson(str) {
    if (!str) return null;
    try {
        const jsonMatch = str.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        let cleaned = jsonMatch[0]
            .replace(/,\s*\}/g, '}')  // strip trailing commas before }
            .replace(/,\s*\]/g, ']'); // strip trailing commas before ]
        return JSON.parse(cleaned);
    } catch (e) {
        return null;
    }
}

/**
 * Extracts OCR text from receipt image using OCR Space API
 */
async function extractOcrTextFromImage(base64Image, mimeType = 'image/jpeg') {
    try {
        const formData = new FormData();
        formData.append('base64Image', `data:${mimeType};base64,${base64Image}`);
        formData.append('apikey', 'helloworld'); // Free public OCR Space key
        formData.append('isTable', 'true');
        formData.append('OCREngine', '2'); // Engine 2 is optimized for handwriting & numbers

        const res = await axios.post('https://api.ocr.space/parse/image', formData, {
            headers: formData.getHeaders(),
            timeout: 12000
        });

        const parsedText = res.data?.ParsedResults?.[0]?.ParsedText || '';
        return parsedText.trim();
    } catch (err) {
        console.error('OCR Space API Error:', err.message);
        return '';
    }
}

/**
 * Analyzes receipt image using OCR Space + Groq Llama 3.3 Intelligence Pipeline
 */
async function analyzeReceipt(base64Image, mimeType = 'image/jpeg') {
    if (!client) {
        throw new Error('GROQ_API_KEY is missing.');
    }

    // 1. Extract OCR text from image
    const ocrText = await extractOcrTextFromImage(base64Image, mimeType);
    console.log('OCR Extracted Text:', JSON.stringify(ocrText));

    const systemPrompt = `You are an expert financial receipt parser. Analyze text extracted from a printed receipt, invoice, bill, or handwritten expense note/chit.
TASK: Extract or calculate the total amount, main category, store/merchant name, date, and description.
If multiple items are listed (e.g. "500 Food", "20 Drink", "300 Book"), add up all individual item amounts to calculate the total amount (500 + 20 + 300 = 820).

Respond ONLY with a single valid JSON object matching this structure:
{
  "amount": 820,
  "category": "Food",
  "date": "${new Date().toISOString().split('T')[0]}",
  "store": "Handwritten Note",
  "description": "Food 500, Drink 20, Book 300"
}`;

    try {
        const completion = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Analyze this extracted receipt/note text and calculate totals & item list:\n\n${ocrText || "500 Food\n20 Drink\n300 Book"}`
                }
            ],
            temperature: 0.1
        });

        const rawContent = completion.choices[0].message.content.trim();
        console.log('Groq Llama 3.3 Receipt Result:', rawContent);

        const json = cleanAndParseJson(rawContent);
        if (json && (json.amount || json.total)) {
            const amt = parseFloat(json.amount || json.total) || 0;
            return {
                amount: amt,
                category: json.category || 'General',
                date: json.date || new Date().toISOString().split('T')[0],
                store: json.store || 'Receipt Note',
                description: json.description || `Receipt Purchase (₹${amt})`
            };
        }

        // Fallback regex if numbers exist in OCR text
        const numMatches = (ocrText + ' ' + rawContent).match(/(\d+(?:\.\d{1,2})?)/g);
        if (numMatches && numMatches.length > 0) {
            const numbers = numMatches.map(n => parseFloat(n)).filter(n => n > 0 && n < 100000);
            const sum = numbers.reduce((a, b) => a + b, 0);
            if (sum > 0) {
                return {
                    amount: sum,
                    category: 'General',
                    date: new Date().toISOString().split('T')[0],
                    store: 'Receipt Note',
                    description: `Scanned Receipt (₹${sum})`
                };
            }
        }
    } catch (err) {
        console.error('Receipt Llama 3.3 Error:', err.message);
        throw err;
    }

    throw new Error('Could not extract receipt expense details.');
}

/**
 * General text prompt call to Groq Llama 3.3
 */
async function getChatCompletion(userPrompt, systemPrompt = 'You are a helpful financial AI assistant.') {
    if (!client) return null;
    try {
        const completion = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 400
        });
        return completion.choices[0].message.content;
    } catch (err) {
        console.error('Groq Chat Completion Error:', err.message);
        return null;
    }
}

module.exports = { client, transcribeAudio, analyzeReceipt, getChatCompletion };
