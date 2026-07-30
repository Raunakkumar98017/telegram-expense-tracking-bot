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

    const systemPrompt = `You are an expert financial OCR assistant. Analyze the image of a receipt, bill, or invoice.
Extract the following information as STRICT valid JSON with NO markdown code blocks or extra text:
{
  "amount": number (total amount paid or due, e.g. 250.50),
  "category": string (e.g. "Groceries", "Food", "Transport", "Shopping", "Bills", "Health", "General"),
  "date": string (ISO YYYY-MM-DD or today's date if not visible),
  "store": string (name of merchant or restaurant),
  "description": string (short summary, e.g. "Lunch at Dominos" or "Groceries at D-Mart")
}`;

    try {
        const completion = await client.chat.completions.create({
            model: "llama-3.2-11b-vision-preview",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Extract receipt details into structured JSON." },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            temperature: 0.2,
            max_tokens: 300,
        });

        const rawContent = completion.choices[0].message.content.trim();
        // Remove potential markdown block wrappers
        const cleaned = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
        const json = JSON.parse(cleaned);
        return {
            amount: parseFloat(json.amount) || 0,
            category: json.category || 'General',
            date: json.date || new Date().toISOString().split('T')[0],
            store: json.store || 'Merchant',
            description: json.description || `Purchase at ${json.store || 'Merchant'}`
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
