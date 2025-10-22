const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// Content safety keywords to filter inappropriate content
const CONTENT_FILTERS = [
    'violence', 'explicit', 'inappropriate', 'offensive', 'hate', 'discrimination'
];

function isContentSafe(content) {
    const lowerContent = content.toLowerCase();
    return !CONTENT_FILTERS.some(filter => lowerContent.includes(filter));
}

function sanitizeContent(content) {
    if (!isContentSafe(content)) {
        return "The story continues with an unexpected but appropriate turn of events.";
    }
    return content;
}

async function callGemini(prompt, maxTokens = 150) {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
    }

    try {
        const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                maxOutputTokens: maxTokens,
                temperature: 0.8,
                topP: 0.9,
                topK: 40
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        });

        if (response.data && response.data.candidates && response.data.candidates[0]) {
            return response.data.candidates[0].content.parts[0].text;
        }

        throw new Error('Invalid response from Gemini API');
    } catch (error) {
        console.error('Gemini API Error:', error.response?.data || error.message);
        throw new Error('Failed to generate AI content');
    }
}

async function addTwist(roomId, story) {
    try {
        const storyText = story.join(' ');
        const prompt = `Based on this collaborative story, add an unexpected but creative twist that keeps the narrative engaging and appropriate for all ages. The twist should be surprising but logical given the story so far. Keep it to 1-2 sentences.

Story so far: "${storyText}"

Add a creative twist:`;

        const twist = await callGemini(prompt, 100);
        const sanitizedTwist = sanitizeContent(twist.trim());

        return {
            type: 'ai_twist',
            content: sanitizedTwist,
            timestamp: new Date().toISOString(),
            author: 'AI'
        };
    } catch (error) {
        console.error('Error generating twist:', error);
        return {
            type: 'ai_twist',
            content: "Suddenly, the story takes an unexpected turn that no one saw coming!",
            timestamp: new Date().toISOString(),
            author: 'AI'
        };
    }
}

async function suggestNextPlayer(players, currentTurn) {
    try {
        const playerNames = players.map(p => p.name).join(', ');
        const prompt = `Given these players in a collaborative story game: ${playerNames}. Suggest which player should go next and why. Keep it fun and creative. Respond in 1-2 sentences.`;

        const suggestion = await callGemini(prompt, 80);
        return sanitizeContent(suggestion.trim());
    } catch (error) {
        console.error('Error generating player suggestion:', error);
        return "The story continues with the next player's turn!";
    }
}

async function generateStoryPrompt(story, players) {
    try {
        const storyText = story.join(' ');
        const playerNames = players.map(p => p.name).join(', ');

        const prompt = `Create a creative story prompt for a collaborative storytelling game. Players: ${playerNames}. Current story: "${storyText}". Generate an engaging prompt that encourages creative storytelling. Keep it appropriate and inspiring.`;

        const promptText = await callGemini(prompt, 120);
        return sanitizeContent(promptText.trim());
    } catch (error) {
        console.error('Error generating story prompt:', error);
        return "Continue the story with your own creative addition!";
    }
}

module.exports = {
    addTwist,
    callGemini,
    suggestNextPlayer,
    generateStoryPrompt,
    isContentSafe,
    sanitizeContent
};
