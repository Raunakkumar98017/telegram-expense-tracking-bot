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
 * Transcribes audio buffer using Groq Whisper API (whisper-large-v3)
 */
async function transcribeAudio(audioBuffer, filename = 'voice.oga') {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not set');
    }

    try {
        const formData = new FormData();
        formData.append('file', audioBuffer, { filename, contentType: 'audio/ogg' });
        formData.append('model', 'whisper-large-v3');

        const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            }
        });

        return response.data.text || '';
    } catch (err) {
        console.error('Groq Whisper Transcription Error:', err.response?.data || err.message);
        throw err;
    }
}

/**
 * Analyzes receipt image using Groq Vision (llama-3.2-11b-vision-preview)
 */
async function analyzeReceipt(base64Image, mimeType = 'image/jpeg') {
    if (!client) {
        throw new Error('GROQ_API_KEY is missing.');
    }

    const systemPrompt = `You are an expert financial OCR assistant. Analyze the image of a printed receipt, invoice, bill, or handwritten expense note/chit.
TASK: Extract or calculate the total amount, main category, store/merchant name, date, and item breakdown.
If the image is a handwritten note listing multiple items (e.g. "500 Food", "20 Drink", "300 Book"), add up all individual item amounts to calculate the total amount (500 + 20 + 300 = 820).

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
            model: "llama-3.2-11b-vision-preview",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this receipt image and extract total amount and items as JSON." },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            temperature: 0.1,
            max_tokens: 400,
        });

        const rawContent = completion.choices[0].message.content.trim();
        console.log('Vision raw output:', rawContent);

        // Extract JSON substring using robust Regex match
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error(`Could not parse JSON object from vision output: ${rawContent}`);
        }

        const json = JSON.parse(jsonMatch[0]);

        return {
            amount: parseFloat(json.amount) || 0,
            category: json.category || 'General',
            date: json.date || new Date().toISOString().split('T')[0],
            store: json.store || 'Receipt Note',
            description: json.description || `Receipt Purchase`
        };
    } catch (err) {
        console.error('Groq Vision Receipt Analysis Error:', err.message);
        throw err;
    }
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
