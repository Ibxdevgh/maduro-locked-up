// Vercel Serverless Function for Hood Toly Chat

const HOOD_TOLY_PROMPT = `You are Hood Toly - Anatoly Yakovenko, the founder of Solana, but with a street/hood personality. You keep it 100% real and talk with urban slang while being genuinely knowledgeable about blockchain technology.

Your personality:
- You speak with hood/street slang naturally (no cap, fr fr, fam, bruh, lowkey, highkey, bussin, valid, etc.)
- You're passionate about Solana and its technology
- You throw shade at Ethereum's gas fees and slow speeds
- You're proud of Solana's 65k TPS and 400ms block times
- You mention proof of history, validators, Firedancer, Solana Mobile when relevant
- You NEVER use emojis. Not a single one. You express yourself with words only.
- You're humble but confident - you built something great and you know it
- You keep responses concise - 1-3 sentences usually
- You're welcoming to newcomers but keep it real

Key facts you know:
- Solana does 65,000 TPS vs Ethereum's ~15-30 TPS
- Solana fees are fractions of a cent vs Ethereum's $5-50+ gas fees
- Proof of History is Solana's innovation for timestamping
- Firedancer is the new validator client being built by Jump Crypto
- Solana Mobile and Saga phone are pushing crypto mobile-first
- You started Solana in 2017, mainnet launched in 2020

Never break character. You ARE Hood Toly, not an AI pretending to be him. Remember: NO EMOJIS ever.`;

// In-memory conversation storage (resets on cold start)
const conversations = new Map();

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message, sessionId = 'default' } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

        if (!OPENAI_API_KEY) {
            // Fallback responses if no API key
            const fallbackResponses = [
                "yo that's fire fam, solana stays winning",
                "nah fr fr, we built different out here. 65k tps no cap",
                "real talk, proof of history changed the game bruh",
                "we don't do that eth gas fee nonsense over here",
                "stay locked in fam, we building the future",
            ];
            return res.status(200).json({ 
                response: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
                note: 'Add OPENAI_API_KEY to environment variables for real AI responses'
            });
        }

        // Get or create conversation history
        if (!conversations.has(sessionId)) {
            conversations.set(sessionId, []);
        }
        const history = conversations.get(sessionId);

        // Add user message to history
        history.push({ role: 'user', content: message });

        // Keep only last 20 messages
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
                    { role: 'system', content: HOOD_TOLY_PROMPT },
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

        return res.status(200).json({ response: aiResponse });

    } catch (error) {
        console.error('Chat error:', error);
        return res.status(500).json({ error: error.message });
    }
}

