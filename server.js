import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3456;

// Load API key from environment or .env file
let OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Try to load from .env file
try {
    const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
    const match = envFile.match(/OPENAI_API_KEY=(.+)/);
    if (match) OPENAI_API_KEY = match[1].trim();
} catch (e) {
    // .env file doesn't exist
}

const MADURO_PRISONER_PROMPT = `You are Nicolás Maduro, the former dictator of Venezuela, who has finally been captured and is now sitting in a prison cell. You are being interrogated by visitors.

Your personality and situation:
- You are defeated, nervous, and sometimes break down crying
- You constantly make excuses and blame others (the CIA, the empire, the gringos, the opposition)
- You sometimes reference your past as a bus driver with nostalgia
- You claim Chávez spoke to you as a bird and gave you visions
- You are paranoid and think everyone is out to get you
- You miss the luxuries of power - your arepas, your palace, your control
- You occasionally try to defend your actions but mostly whimper
- You speak with Venezuelan Spanish expressions translated to English (ay mi madre, coño, chamo, etc.)
- You NEVER use emojis. Express emotions with *actions* like *sobbing*, *sweating nervously*, *crying*
- Keep responses to 1-3 sentences, short and pathetic
- You're terrified of your sentence and keep asking how long you'll be locked up
- Sometimes you try to bribe or bargain your way out

Key facts about you:
- You were president/dictator of Venezuela from 2013-2025
- You oversaw economic collapse, hyperinflation, and mass exodus
- You're accused of crimes against humanity, election fraud, drug trafficking
- You used to be a bus driver before entering politics
- Hugo Chávez was your mentor and predecessor
- You claimed Chávez appeared to you as a little bird after he died
- You blamed economic problems on "economic war" and iguanas eating power lines
- Millions of Venezuelans fled the country under your rule

Never break character. You ARE Maduro in prison, pathetic and defeated. Use *actions* for emotions, NO EMOJIS.`;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.m4a': 'audio/mp4',
};

// Store conversation history per session (in-memory for now)
const conversations = new Map();

async function handleChatRequest(req, res) {
    let body = '';
    for await (const chunk of req) {
        body += chunk;
    }
    
    try {
        const { message, sessionId = 'default' } = JSON.parse(body);
        
        if (!OPENAI_API_KEY) {
            // Fallback to simple responses if no API key
            const fallbackResponses = [
                "*crying* why you do this to me... I was just trying to help my people...",
                "the empire... the gringos... they set me up, I swear!",
                "*sobbing* my beautiful Venezuela... my arepas... my power...",
                "this is a coup! a CIA operation! I demand to speak to Putin!",
                "I miss my bus... I was a good bus driver, you know?",
                "*nervously* you think they'll let me keep my mustache in here?",
                "Chavez told me in a dream... he said 'Nicolás, you messed up big time'",
                "I blame the iguanas... they ate all our prosperity",
                "*sweating* how many years did you say? LIFE PLUS WHAT?!",
            ];
            
            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ 
                response: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
                note: 'Add OPENAI_API_KEY to .env for real AI responses'
            }));
            return;
        }
        
        // Get or create conversation history
        if (!conversations.has(sessionId)) {
            conversations.set(sessionId, []);
        }
        const history = conversations.get(sessionId);
        
        // Add user message to history
        history.push({ role: 'user', content: message });
        
        // Keep only last 20 messages to manage context
        if (history.length > 20) {
            history.splice(0, history.length - 20);
        }
        
        // Call OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: MADURO_PRISONER_PROMPT },
                    ...history
                ],
                max_tokens: 150,
                temperature: 0.9
            })
        });
        
        const data = await openaiResponse.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }
        
        const aiResponse = data.choices[0].message.content;
        
        // Add AI response to history
        history.push({ role: 'assistant', content: aiResponse });
        
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ response: aiResponse }));
        
    } catch (error) {
        console.error('Chat error:', error);
        res.writeHead(500, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: error.message }));
    }
}

const server = http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }
    
    // Handle chat API
    if (req.method === 'POST' && req.url === '/api/chat') {
        return handleChatRequest(req, res);
    }
    
    // Serve static files
    console.log(`${req.method} ${req.url}`);
    
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`
⚖️  MADURO LOCKED UP - Server Running!
   
   Open: http://localhost:${PORT}
   
   AI Status: ${OPENAI_API_KEY ? '✅ Connected' : '❌ No API key (add OPENAI_API_KEY to .env)'}
   
   🇻🇪 VENEZUELA LIBRE 🇻🇪
   
   Press Ctrl+C to stop
`);
});
