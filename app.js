/**
 * Thought Clusters - AI Conversation Behavioral Analysis
 *
 * This tool analyzes HOW you interact with AI:
 * - Your questioning patterns and style
 * - Curiosity indicators
 * - Topic diversity and depth
 * - Personality traits revealed through prompts
 *
 * All processing happens in your browser.
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    webllmModel: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
    minClusters: 4,
    maxClusters: 12,
    messagesPerCluster: 15,
    umapNeighbors: 15,
    umapMinDist: 0.1,
    minMessageLength: 15,
    maxMessages: 500,

    // Analysis modes
    analysisMode: 'basic', // 'basic', 'webllm', 'api'
    apiProvider: 'openai', // 'openai', 'anthropic'
    apiKey: null,

    colors: [
        '#f472b6', '#818cf8', '#34d399', '#fbbf24', '#f87171',
        '#38bdf8', '#a78bfa', '#4ade80', '#fb923c', '#e879f9',
        '#22d3ee', '#facc15', '#c084fc', '#fb7185', '#2dd4bf'
    ],

    // Question type patterns - very flexible matching to catch common prompt styles
    questionPatterns: {
        'How-to': /(how (do|can|should|would|to|did|does|could|might)|show me|help me|walk me through|steps to|guide|tutorial|way to|setup|install|configure|build|make|get started)/i,
        'Explanation': /(what (is|are|does|was|were|do|happens|would)|explain|describe|tell me|define|meaning|understand|clarify|elaborate|overview|summary|break down|eli5|mean by)/i,
        'Why': /(why (is|are|do|does|did|would|should|can|won't|doesn't|isn't|am|was|were|not)|reason|cause|purpose|motivation|because)/i,
        'Debugging': /(error|bug|fix|issue|problem|doesn't work|not working|broken|fails|crash|wrong|unexpected|strange|weird|failing|throwing|exception|undefined|null|NaN|invalid|incorrect)/i,
        'Creative': /(write|create|generate|come up with|brainstorm|ideas|story|poem|draft|compose|design|make me|give me|produce|invent|imagine|creative|content)/i,
        'Opinion': /(should i|what do you think|is it (good|bad|worth)|recommend|best|advice|suggest|opinion|thoughts|pros and cons|better|prefer|choice|pick|choose)/i,
        'Comparison': /(vs\.?|versus|difference|compare|than|which (one|is|should|would)|or should|advantages|disadvantages|alternative|instead|over)/i,
        'Code Request': /(code|function|script|program|implement|algorithm|snippet|example|syntax|class|method|api|endpoint|query|regex|sql|html|css|javascript|python|java|react|typescript)/i,
    },

    // Complexity indicators
    complexityIndicators: {
        technical: /(api|algorithm|database|framework|architecture|deploy|config|async|recursive|optimization|server|cloud|docker|kubernetes|aws|gcp|azure|microservice|authentication|authorization|encryption|cache|queue|websocket|graphql|rest|oauth|jwt|sql|nosql)/i,
        conceptual: /(concept|theory|principle|paradigm|methodology|approach|strategy|philosophy|pattern|design|abstraction|inheritance|polymorphism|encapsulation|dependency|injection|middleware)/i,
        specific: /(\d+|specific|exactly|precisely|particular|this exact|in my case|for my|my project|my code|my app)/i,
    }
};

// ============================================
// STATE
// ============================================

let state = {
    messages: [],
    embeddings: [],
    coords2d: [],
    clusters: [],
    points: [],
    insights: {},
    selectedCluster: null,
    zoom: null,
    pipeline: null,
    webllmEngine: null,
    webllmReady: false
};

// ============================================
// BEHAVIORAL ANALYSIS
// ============================================

function analyzeQuestionType(text) {
    for (const [type, pattern] of Object.entries(CONFIG.questionPatterns)) {
        if (pattern.test(text)) return type;
    }
    return 'General';
}

function analyzeComplexity(text) {
    let score = 0;
    const words = text.split(/\s+/);

    // Length factor
    if (words.length > 50) score += 2;
    else if (words.length > 20) score += 1;

    // Technical vocabulary
    if (CONFIG.complexityIndicators.technical.test(text)) score += 2;
    if (CONFIG.complexityIndicators.conceptual.test(text)) score += 1;
    if (CONFIG.complexityIndicators.specific.test(text)) score += 1;

    // Question depth (multiple questions)
    const questionMarks = (text.match(/\?/g) || []).length;
    if (questionMarks > 1) score += 1;

    return Math.min(score, 5); // 0-5 scale
}

function detectIntent(text) {
    const lower = text.toLowerCase();

    // Order matters - more specific patterns first
    if (/fix|error|bug|debug|issue|problem|crash|broken|wrong|fails|exception/i.test(lower)) return 'Problem-Solving';
    if (/write|create|generate|make|build|compose|draft|design|implement|develop/i.test(lower)) return 'Creating';
    if (/review|check|improve|better|optimize|refactor|enhance|upgrade|clean/i.test(lower)) return 'Improving';
    if (/should|recommend|best|opinion|advice|choose|pick|decide|which|versus|vs/i.test(lower)) return 'Deciding';
    if (/brainstorm|ideas|suggest|possibilities|alternatives|options|ways|approaches/i.test(lower)) return 'Exploring';
    if (/learn|understand|explain|what|how|why|meaning|concept|theory|define|describe/i.test(lower)) return 'Learning';

    return 'General';
}

function generateInsights(messages, clusters, labels) {
    const insights = {
        totalPrompts: messages.length,
        questionTypes: {},
        intents: {},
        avgComplexity: 0,
        topicDiversity: clusters.length,
        clusterInsights: {},
        personalityTraits: [],
        funFacts: [],
        timePatterns: {},
    };

    let totalComplexity = 0;
    const hourCounts = {};

    // Analyze each message
    messages.forEach((msg, i) => {
        const qType = analyzeQuestionType(msg.text);
        const intent = detectIntent(msg.text);
        const complexity = analyzeComplexity(msg.text);

        insights.questionTypes[qType] = (insights.questionTypes[qType] || 0) + 1;
        insights.intents[intent] = (insights.intents[intent] || 0) + 1;
        totalComplexity += complexity;

        // Time patterns
        if (msg.timestamp) {
            const hour = new Date(msg.timestamp * 1000).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
    });

    insights.avgComplexity = (totalComplexity / messages.length).toFixed(1);
    insights.timePatterns = hourCounts;

    // Generate cluster-specific insights
    const clusterMessages = {};
    messages.forEach((msg, i) => {
        const cluster = state.points[i]?.cluster;
        if (cluster !== undefined) {
            if (!clusterMessages[cluster]) clusterMessages[cluster] = [];
            clusterMessages[cluster].push(msg);
        }
    });

    for (const [clusterId, msgs] of Object.entries(clusterMessages)) {
        const clusterQTypes = {};
        const clusterIntents = {};
        let clusterComplexity = 0;

        msgs.forEach(msg => {
            const qType = analyzeQuestionType(msg.text);
            const intent = detectIntent(msg.text);
            clusterQTypes[qType] = (clusterQTypes[qType] || 0) + 1;
            clusterIntents[intent] = (clusterIntents[intent] || 0) + 1;
            clusterComplexity += analyzeComplexity(msg.text);
        });

        const dominantQType = Object.entries(clusterQTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';
        const dominantIntent = Object.entries(clusterIntents).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';

        insights.clusterInsights[clusterId] = {
            count: msgs.length,
            dominantQType,
            dominantIntent,
            avgComplexity: (clusterComplexity / msgs.length).toFixed(1),
            insight: generateClusterNarrative(dominantQType, dominantIntent, msgs.length, labels[clusterId])
        };
    }

    // Generate personality traits
    insights.personalityTraits = derivePersonalityTraits(insights);

    // Generate fun facts
    insights.funFacts = generateFunFacts(insights, messages);

    return insights;
}

function generateClusterNarrative(qType, intent, count, label) {
    // More specific narratives based on question type
    const typeNarratives = {
        'How-to': `Hands-on learner mode! You asked "how" ${count} times about ${label.toLowerCase()}.`,
        'Explanation': `Knowledge seeker! You love diving deep into what ${label.toLowerCase()} really means.`,
        'Why': `Critical thinker - you question the "why" behind ${label.toLowerCase()}, not just the "what".`,
        'Debugging': `Active builder! You're in the trenches fixing and solving ${label.toLowerCase()} issues.`,
        'Creative': `Creator energy! You're generating and producing ${label.toLowerCase()} content.`,
        'Opinion': `Decision maker - you tap AI for guidance on ${label.toLowerCase()} choices.`,
        'Comparison': `Analyst mode - weighing options and alternatives for ${label.toLowerCase()}.`,
        'Code Request': `Developer zone! Turning ${label.toLowerCase()} concepts into working code.`,
    };

    // Fallback narratives based on intent if qType is General
    const intentNarratives = {
        'Learning': `Knowledge hunter! ${count} questions exploring ${label.toLowerCase()} concepts.`,
        'Problem-Solving': `Troubleshooter mode! Tackling ${label.toLowerCase()} challenges head-on.`,
        'Creating': `Maker mindset! Building and creating in the ${label.toLowerCase()} space.`,
        'Improving': `Perfectionist vibes! Refining and enhancing your ${label.toLowerCase()} work.`,
        'Deciding': `Strategic thinker! Seeking clarity on ${label.toLowerCase()} decisions.`,
        'Exploring': `Curious explorer! Brainstorming ideas around ${label.toLowerCase()}.`,
    };

    // Use type narrative if available and not General
    if (qType !== 'General' && typeNarratives[qType]) {
        return typeNarratives[qType];
    }

    // Fall back to intent narrative
    if (intent !== 'General' && intentNarratives[intent]) {
        return intentNarratives[intent];
    }

    // Final fallback with more variety
    const generalVariations = [
        `Mixed bag explorer - ${count} diverse questions about ${label.toLowerCase()}.`,
        `Wide-ranging curiosity about ${label.toLowerCase()} - you cover all angles!`,
        `Versatile questioner - exploring ${label.toLowerCase()} from multiple perspectives.`,
    ];
    return generalVariations[count % generalVariations.length];
}

function derivePersonalityTraits(insights) {
    const traits = [];
    const total = insights.totalPrompts;

    // Curiosity level
    const explanationRatio = (insights.questionTypes['Explanation'] || 0) / total;
    const whyRatio = (insights.questionTypes['Why'] || 0) / total;
    if (explanationRatio + whyRatio > 0.3) {
        traits.push({ trait: 'Deep Curious', icon: '🔍', desc: 'You love understanding how things work' });
    }

    // Builder mentality
    const buildRatio = ((insights.questionTypes['Code Request'] || 0) + (insights.questionTypes['Creative'] || 0)) / total;
    if (buildRatio > 0.25) {
        traits.push({ trait: 'Creator', icon: '🛠️', desc: 'You use AI as a building partner' });
    }

    // Problem solver
    const debugRatio = (insights.questionTypes['Debugging'] || 0) / total;
    if (debugRatio > 0.15) {
        traits.push({ trait: 'Debugger', icon: '🐛', desc: 'You actively solve problems with AI help' });
    }

    // Decision seeker
    const decisionRatio = ((insights.questionTypes['Opinion'] || 0) + (insights.questionTypes['Comparison'] || 0)) / total;
    if (decisionRatio > 0.15) {
        traits.push({ trait: 'Decision Seeker', icon: '⚖️', desc: 'You value second opinions on choices' });
    }

    // Complexity level
    if (parseFloat(insights.avgComplexity) > 3) {
        traits.push({ trait: 'Advanced User', icon: '🎓', desc: 'Your questions show technical depth' });
    } else if (parseFloat(insights.avgComplexity) < 1.5) {
        traits.push({ trait: 'Efficient', icon: '⚡', desc: 'You keep questions clear and concise' });
    }

    // Topic diversity
    if (insights.topicDiversity >= 8) {
        traits.push({ trait: 'Polymath', icon: '🌈', desc: 'Wide-ranging interests across many topics' });
    } else if (insights.topicDiversity <= 4) {
        traits.push({ trait: 'Specialist', icon: '🎯', desc: 'Deep focus on specific areas' });
    }

    // Learning dominant
    const learnRatio = (insights.intents['Learning'] || 0) / total;
    if (learnRatio > 0.3) {
        traits.push({ trait: 'Lifelong Learner', icon: '📚', desc: 'AI is your study buddy' });
    }

    return traits.slice(0, 4); // Top 4 traits
}

function generateFunFacts(insights, messages) {
    const facts = [];

    // Most active hour
    const hours = Object.entries(insights.timePatterns);
    if (hours.length > 0) {
        const peakHour = hours.sort((a, b) => b[1] - a[1])[0];
        const hourLabel = parseInt(peakHour[0]);
        const timeOfDay = hourLabel < 6 ? 'night owl' : hourLabel < 12 ? 'morning' : hourLabel < 18 ? 'afternoon' : 'evening';
        facts.push(`🕐 You're a ${timeOfDay} AI user - most active around ${hourLabel}:00`);
    }

    // Longest question
    const longest = messages.reduce((max, m) => m.text.length > max.text.length ? m : max, messages[0]);
    facts.push(`📏 Your longest prompt was ${longest.text.split(/\s+/).length} words long`);

    // Question type dominance
    const topType = Object.entries(insights.questionTypes).sort((a, b) => b[1] - a[1])[0];
    if (topType) {
        const percentage = Math.round((topType[1] / insights.totalPrompts) * 100);
        facts.push(`💬 ${percentage}% of your prompts are "${topType[0]}" style questions`);
    }

    // Intent pattern
    const topIntent = Object.entries(insights.intents).sort((a, b) => b[1] - a[1])[0];
    if (topIntent) {
        facts.push(`🎯 Your primary AI use: ${topIntent[0]} (${topIntent[1]} times)`);
    }

    // Source comparison
    const sources = {};
    messages.forEach(m => sources[m.source] = (sources[m.source] || 0) + 1);
    if (Object.keys(sources).length > 1) {
        const sorted = Object.entries(sources).sort((a, b) => b[1] - a[1]);
        facts.push(`🤖 You prefer ${sorted[0][0]} (${sorted[0][1]} prompts) over ${sorted[1][0]} (${sorted[1][1]} prompts)`);
    }

    return facts.slice(0, 5);
}

// ============================================
// SCREEN MANAGEMENT
// ============================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ============================================
// FILE UPLOAD HANDLING
// ============================================

function setupUpload() {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');

    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });
}

async function handleFile(file) {
    if (!file.name.endsWith('.json')) {
        alert('Please upload a JSON file');
        return;
    }

    try {
        const text = await file.text();
        const data = JSON.parse(text);
        showScreen('processing-screen');
        await processConversations(data);
    } catch (error) {
        console.error('Error reading file:', error);
        alert('Error reading file. Please ensure it\'s a valid JSON export.');
    }
}

// ============================================
// CONVERSATION PARSING
// ============================================

function parseChatGPTExport(data) {
    const messages = [];
    const conversations = Array.isArray(data) ? data : [];

    for (const conversation of conversations) {
        const title = conversation.title || 'Untitled';
        const createTime = conversation.create_time || 0;
        const mapping = conversation.mapping || {};

        for (const nodeId in mapping) {
            const node = mapping[nodeId];
            const message = node.message;

            if (message && message.author?.role === 'user') {
                const contentParts = message.content?.parts || [];
                const text = contentParts.filter(p => typeof p === 'string').join(' ').trim();

                if (text.length >= CONFIG.minMessageLength) {
                    messages.push({
                        text,
                        source: 'ChatGPT',
                        conversation: title,
                        timestamp: message.create_time || createTime
                    });
                }
            }
        }
    }
    return messages;
}

function parseClaudeExport(data) {
    const messages = [];
    const conversations = Array.isArray(data) ? data : (data.conversations || []);

    for (const conversation of conversations) {
        const title = conversation.name || conversation.title || 'Untitled';
        const chatMessages = conversation.chat_messages || [];

        for (const msg of chatMessages) {
            if (msg.sender === 'human') {
                const text = (msg.text || '').trim();

                if (text.length >= CONFIG.minMessageLength) {
                    let timestamp = 0;
                    if (msg.created_at) {
                        try { timestamp = new Date(msg.created_at).getTime() / 1000; } catch (e) {}
                    }
                    messages.push({ text, source: 'Claude', conversation: title, timestamp });
                }
            }
        }
    }
    return messages;
}

function parseExport(data) {
    let messages = [];

    if (Array.isArray(data) && data.length > 0 && data[0].mapping) {
        messages = parseChatGPTExport(data);
    } else if (Array.isArray(data) && data.length > 0 && data[0].chat_messages) {
        messages = parseClaudeExport(data);
    } else {
        messages = [...parseChatGPTExport(data), ...parseClaudeExport(data)];
    }

    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    if (messages.length > CONFIG.maxMessages) {
        const step = Math.floor(messages.length / CONFIG.maxMessages);
        messages = messages.filter((_, i) => i % step === 0).slice(0, CONFIG.maxMessages);
    }

    return messages;
}

// ============================================
// EMBEDDING & CLUSTERING (same as before)
// ============================================

async function loadEmbeddingPipeline() {
    updateStatus('Loading ML model (first time may take a moment)...', 5);
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1');
    state.pipeline = await pipeline('feature-extraction', CONFIG.embeddingModel, { quantized: true });
    return state.pipeline;
}

async function generateEmbeddings(messages) {
    const pipe = state.pipeline || await loadEmbeddingPipeline();
    const embeddings = [];

    for (let i = 0; i < messages.length; i++) {
        updateStatus(`Analyzing your prompts... (${i + 1}/${messages.length})`, 10 + (i / messages.length) * 50);
        document.getElementById('proc-embedded').textContent = i + 1;

        const output = await pipe(messages[i].text, { pooling: 'mean', normalize: true });
        embeddings.push(Array.from(output.data));
        await new Promise(r => setTimeout(r, 0));
    }

    return embeddings;
}

function umap(embeddings, nComponents = 2, nNeighbors = 15) {
    const n = embeddings.length;
    const dim = embeddings[0].length;

    let positions = embeddings.map(() => Array(nComponents).fill(0).map(() => (Math.random() - 0.5) * 10));

    const distances = [];
    for (let i = 0; i < n; i++) {
        distances[i] = [];
        for (let j = 0; j < n; j++) {
            if (i === j) { distances[i][j] = 0; }
            else {
                let sum = 0;
                for (let d = 0; d < dim; d++) sum += Math.pow(embeddings[i][d] - embeddings[j][d], 2);
                distances[i][j] = Math.sqrt(sum);
            }
        }
    }

    const knn = [];
    for (let i = 0; i < n; i++) {
        const neighbors = distances[i].map((d, j) => ({ j, d })).filter(x => x.j !== i)
            .sort((a, b) => a.d - b.d).slice(0, Math.min(nNeighbors, n - 1));
        knn[i] = neighbors;
    }

    const iterations = 200;
    for (let iter = 0; iter < iterations; iter++) {
        const forces = positions.map(() => Array(nComponents).fill(0));

        for (let i = 0; i < n; i++) {
            for (const { j } of knn[i]) {
                const dx = positions[j][0] - positions[i][0];
                const dy = positions[j][1] - positions[i][1];
                const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
                const attraction = 0.1 * Math.log(dist + 1);
                forces[i][0] += attraction * dx / dist;
                forces[i][1] += attraction * dy / dist;
            }
        }

        const sampleSize = Math.min(30, n);
        for (let i = 0; i < n; i++) {
            for (let s = 0; s < sampleSize; s++) {
                const j = Math.floor(Math.random() * n);
                if (i === j) continue;
                const dx = positions[j][0] - positions[i][0];
                const dy = positions[j][1] - positions[i][1];
                const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
                if (dist < 2) {
                    const repulsion = -0.5 / (dist * dist);
                    forces[i][0] += repulsion * dx / dist;
                    forces[i][1] += repulsion * dy / dist;
                }
            }
        }

        const decay = 1 - iter / iterations;
        for (let i = 0; i < n; i++) {
            positions[i][0] += forces[i][0] * decay;
            positions[i][1] += forces[i][1] * decay;
        }
    }

    return positions;
}

function kmeans(embeddings, k, maxIterations = 50) {
    const n = embeddings.length;
    const dim = embeddings[0].length;

    const centroids = [];
    const usedIndices = new Set();

    let idx = Math.floor(Math.random() * n);
    centroids.push([...embeddings[idx]]);
    usedIndices.add(idx);

    while (centroids.length < k) {
        const distances = embeddings.map((emb, i) => {
            if (usedIndices.has(i)) return 0;
            return Math.min(...centroids.map(c => euclideanDistance(emb, c)));
        });
        const totalDist = distances.reduce((a, b) => a + b, 0);
        let r = Math.random() * totalDist;
        for (let i = 0; i < n; i++) {
            r -= distances[i];
            if (r <= 0) { centroids.push([...embeddings[i]]); usedIndices.add(i); break; }
        }
    }

    let labels = new Array(n).fill(0);
    for (let iter = 0; iter < maxIterations; iter++) {
        const newLabels = embeddings.map(emb => {
            let minDist = Infinity, minIdx = 0;
            for (let c = 0; c < k; c++) {
                const dist = euclideanDistance(emb, centroids[c]);
                if (dist < minDist) { minDist = dist; minIdx = c; }
            }
            return minIdx;
        });

        if (newLabels.every((l, i) => l === labels[i])) break;
        labels = newLabels;

        for (let c = 0; c < k; c++) {
            const clusterPoints = embeddings.filter((_, i) => labels[i] === c);
            if (clusterPoints.length === 0) continue;
            for (let d = 0; d < dim; d++) {
                centroids[c][d] = clusterPoints.reduce((sum, p) => sum + p[d], 0) / clusterPoints.length;
            }
        }
    }

    return labels;
}

function euclideanDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.pow(a[i] - b[i], 2);
    return Math.sqrt(sum);
}

function labelClusters(messages, labels) {
    const clusterTexts = {};
    for (let i = 0; i < messages.length; i++) {
        const cluster = labels[i];
        if (!clusterTexts[cluster]) clusterTexts[cluster] = [];
        clusterTexts[cluster].push(messages[i].text);
    }

    const clusterLabels = {};
    const stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'it', 'its', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'they', 'them', 'their', 'am', 'about', 'get', 'like', 'make', 'know', 'think', 'want', 'see', 'look', 'use', 'find', 'give', 'tell', 'try', 'help', 'please', 'thank', 'thanks', 'hi', 'hello', 'hey', 'yes', 'yeah', 'ok', 'okay', 'sure', 'right', 'using', 'need', 'want', 'something', 'anything', 'everything']);

    for (const cluster in clusterTexts) {
        const texts = clusterTexts[cluster];
        const words = {};

        for (const text of texts) {
            const textWords = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
                .filter(w => w.length > 2 && !stopwords.has(w));
            for (const word of textWords) words[word] = (words[word] || 0) + 1;
        }

        const sorted = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([word]) => word);

        if (sorted.length >= 2) {
            clusterLabels[cluster] = sorted.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' & ');
        } else if (sorted.length === 1) {
            clusterLabels[cluster] = sorted[0].charAt(0).toUpperCase() + sorted[0].slice(1);
        } else {
            clusterLabels[cluster] = `Topic ${parseInt(cluster) + 1}`;
        }
    }

    return clusterLabels;
}

// ============================================
// MAIN PROCESSING PIPELINE
// ============================================

function updateStatus(message, progress) {
    document.getElementById('processing-status').textContent = message;
    document.getElementById('progress-bar').style.width = `${progress}%`;
}

async function processConversations(data) {
    try {
        updateStatus('Parsing conversations...', 2);
        state.messages = parseExport(data);

        if (state.messages.length < 5) {
            alert('Not enough messages found. Need at least 5 user messages.');
            showScreen('upload-screen');
            return;
        }

        document.getElementById('proc-messages').textContent = state.messages.length;

        state.embeddings = await generateEmbeddings(state.messages);

        updateStatus('Mapping your thought patterns...', 65);
        await new Promise(r => setTimeout(r, 50));
        state.coords2d = umap(state.embeddings, 2, Math.min(CONFIG.umapNeighbors, state.messages.length - 1));

        updateStatus('Discovering topic clusters...', 80);
        await new Promise(r => setTimeout(r, 50));

        const numClusters = Math.max(CONFIG.minClusters, Math.min(CONFIG.maxClusters, Math.floor(state.messages.length / CONFIG.messagesPerCluster)));
        const labels = kmeans(state.embeddings, numClusters);
        const clusterLabels = labelClusters(state.messages, labels);

        const clusterCounts = {};
        labels.forEach(l => clusterCounts[l] = (clusterCounts[l] || 0) + 1);

        state.clusters = Object.entries(clusterLabels)
            .map(([id, label]) => ({ id: parseInt(id), label, count: clusterCounts[id] || 0 }))
            .sort((a, b) => b.count - a.count);

        state.points = state.messages.map((msg, i) => ({
            id: i,
            x: state.coords2d[i][0],
            y: state.coords2d[i][1],
            cluster: labels[i],
            clusterLabel: clusterLabels[labels[i]],
            text: msg.text,
            source: msg.source,
            conversation: msg.conversation,
            timestamp: msg.timestamp,
            questionType: analyzeQuestionType(msg.text),
            intent: detectIntent(msg.text),
            complexity: analyzeComplexity(msg.text)
        }));

        updateStatus('Generating your AI personality profile...', 90);
        await new Promise(r => setTimeout(r, 50));
        state.insights = await generateEnhancedInsights(state.messages, state.clusters, clusterLabels);

        updateStatus('Rendering insights...', 95);
        await new Promise(r => setTimeout(r, 50));

        showScreen('results-screen');
        renderResults();

    } catch (error) {
        console.error('Processing error:', error);
        alert('Error processing conversations: ' + error.message);
        showScreen('upload-screen');
    }
}

// ============================================
// VISUALIZATION & UI
// ============================================

function renderResults() {
    renderInsightsSummary();
    renderClusterList();
    renderSourceBreakdown();
    createScatterPlot();
    setupResultsEventListeners();
    showCacheInfoIfNeeded();
}

function showCacheInfoIfNeeded() {
    const cacheInfo = document.getElementById('cache-info');
    const clearCacheBtn = document.getElementById('clear-cache-btn');

    // Show cache info if Browser AI was used
    if (state.insights.enhancedMode === 'webllm' || state.webllmReady) {
        cacheInfo.classList.remove('hidden');

        // Setup clear cache button
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', async () => {
                try {
                    // Clear WebLLM cache from Cache Storage
                    const cacheNames = await caches.keys();
                    for (const name of cacheNames) {
                        if (name.includes('webllm') || name.includes('mlc') || name.includes('transformers')) {
                            await caches.delete(name);
                        }
                    }

                    // Reset state
                    state.webllmEngine = null;
                    state.webllmReady = false;

                    // Update UI
                    clearCacheBtn.textContent = '✓ Cleared!';
                    clearCacheBtn.disabled = true;
                    setTimeout(() => {
                        cacheInfo.classList.add('hidden');
                    }, 2000);
                } catch (error) {
                    console.error('Failed to clear cache:', error);
                    clearCacheBtn.textContent = 'Failed';
                }
            });
        }
    } else {
        cacheInfo.classList.add('hidden');
    }
}

function renderInsightsSummary() {
    document.getElementById('total-prompts').textContent = state.insights.totalPrompts;
    document.getElementById('total-clusters').textContent = state.insights.topicDiversity;

    // Render personality traits
    const traitsContainer = document.getElementById('personality-traits');
    if (traitsContainer) {
        traitsContainer.innerHTML = state.insights.personalityTraits.map(t => `
            <div class="trait-badge">
                <span class="trait-icon">${t.icon}</span>
                <span class="trait-name">${t.trait}</span>
            </div>
        `).join('');
    }

    // Render fun facts (or AI analysis if available)
    const factsContainer = document.getElementById('fun-facts');
    if (factsContainer) {
        let content = '';

        // Show fallback notice if we fell back to basic
        if (state.insights.fallbackToBasic) {
            content += `
                <div class="fallback-notice visible">
                    ⚠️ ${state.insights.fallbackReason}
                </div>
            `;
        }

        if (state.insights.aiAnalysis) {
            // Show AI-generated analysis
            const modeLabel = state.insights.enhancedMode === 'webllm' ? '🧠 Browser AI' : '🔑 API';
            content += `
                <div class="ai-analysis-badge">${modeLabel} Analysis</div>
                <div class="ai-analysis">${formatAIAnalysis(state.insights.aiAnalysis)}</div>
            `;
        } else {
            // Basic mode or fallback - show fun facts
            content += state.insights.funFacts.map(f => `
                <div class="fun-fact">${f}</div>
            `).join('');
        }

        factsContainer.innerHTML = content;
    }
}

function formatAIAnalysis(text) {
    // Format bullet points nicely
    return text
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
            const cleaned = line.replace(/^[\d\.\-\*]+\s*/, '').trim();
            if (cleaned) {
                return `<div class="ai-insight-item">${cleaned}</div>`;
            }
            return '';
        })
        .join('');
}

function renderClusterList() {
    const container = document.getElementById('cluster-list');
    container.innerHTML = '';

    state.clusters.forEach(cluster => {
        const insight = state.insights.clusterInsights[cluster.id] || {};
        const item = document.createElement('div');
        item.className = 'cluster-item';
        item.dataset.cluster = cluster.id;

        item.innerHTML = `
            <div class="cluster-dot" style="background-color: ${CONFIG.colors[cluster.id % CONFIG.colors.length]}"></div>
            <div class="cluster-info">
                <div class="cluster-label">${cluster.label}</div>
                <div class="cluster-meta">${cluster.count} prompts • ${insight.dominantIntent || 'General'}</div>
            </div>
        `;

        item.addEventListener('click', () => selectCluster(cluster.id));

        container.appendChild(item);
    });
}

function renderSourceBreakdown() {
    const container = document.getElementById('source-breakdown');
    container.innerHTML = '';

    const sources = {};
    state.points.forEach(p => sources[p.source] = (sources[p.source] || 0) + 1);

    for (const [source, count] of Object.entries(sources)) {
        const item = document.createElement('div');
        item.className = 'source-item';
        const iconClass = source.toLowerCase().includes('chatgpt') ? 'chatgpt' : 'claude';

        item.innerHTML = `
            <div class="source-icon ${iconClass}">${source.charAt(0)}</div>
            <div class="source-info">
                <div class="source-name">${source}</div>
                <div class="source-count">${count} prompts</div>
            </div>
        `;
        container.appendChild(item);
    }
}

function createScatterPlot() {
    const container = document.getElementById('scatter-plot');
    container.innerHTML = '';

    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 30, right: 30, bottom: 30, left: 30 };

    const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
    const g = svg.append('g');

    const xExtent = d3.extent(state.points, d => d.x);
    const yExtent = d3.extent(state.points, d => d.y);
    const xPadding = (xExtent[1] - xExtent[0]) * 0.1;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1;

    const xScale = d3.scaleLinear().domain([xExtent[0] - xPadding, xExtent[1] + xPadding]).range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear().domain([yExtent[0] - yPadding, yExtent[1] + yPadding]).range([height - margin.bottom, margin.top]);

    g.selectAll('.point')
        .data(state.points)
        .enter()
        .append('circle')
        .attr('class', 'point')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 6)
        .attr('fill', d => CONFIG.colors[d.cluster % CONFIG.colors.length])
        .attr('opacity', 0.75)
        .on('mouseover', handleMouseOver)
        .on('mouseout', handleMouseOut)
        .on('click', handlePointClick);

    state.zoom = d3.zoom().scaleExtent([0.5, 10]).on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(state.zoom);

    state.svg = svg;
    state.g = g;
    state.xScale = xScale;
    state.yScale = yScale;
}

function handleMouseOver(event, d) {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.left = `${event.pageX + 15}px`;
    tooltip.style.top = `${event.pageY + 15}px`;

    tooltip.innerHTML = `
        <div class="tooltip-cluster" style="background-color: ${CONFIG.colors[d.cluster % CONFIG.colors.length]}">
            ${d.clusterLabel}
        </div>
        <div class="tooltip-insight">
            <span class="insight-tag">${d.questionType}</span>
            <span class="insight-tag">${d.intent}</span>
        </div>
        <div class="tooltip-text">${truncateText(d.text, 100)}</div>
    `;

    tooltip.classList.add('visible');
    d3.select(event.target).attr('r', 10).attr('opacity', 1);
}

function handleMouseOut(event, d) {
    document.getElementById('tooltip').classList.remove('visible');
    const isSelected = state.selectedCluster !== null && d.cluster !== state.selectedCluster;
    d3.select(event.target).attr('r', 6).attr('opacity', isSelected ? 0.15 : 0.75);
}

function handlePointClick(event, d) {
    showPointInsight(d);
}

function showPointInsight(d) {
    const modal = document.getElementById('detail-modal');

    document.getElementById('modal-cluster').textContent = d.clusterLabel;
    document.getElementById('modal-cluster').style.backgroundColor = CONFIG.colors[d.cluster % CONFIG.colors.length];

    // Show behavioral insight, not raw text
    document.getElementById('modal-text').innerHTML = `
        <div class="insight-breakdown">
            <div class="insight-row">
                <span class="insight-label">Question Type</span>
                <span class="insight-value">${d.questionType}</span>
            </div>
            <div class="insight-row">
                <span class="insight-label">Your Intent</span>
                <span class="insight-value">${d.intent}</span>
            </div>
            <div class="insight-row">
                <span class="insight-label">Complexity</span>
                <span class="insight-value">${'●'.repeat(d.complexity)}${'○'.repeat(5 - d.complexity)}</span>
            </div>
        </div>
        <div class="original-prompt">
            <div class="prompt-label">Original prompt:</div>
            <div class="prompt-text">${d.text}</div>
        </div>
    `;

    let dateStr = '';
    if (d.timestamp) {
        const date = new Date(d.timestamp * 1000);
        dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    document.getElementById('modal-meta').innerHTML = `
        <span><strong>Source:</strong> ${d.source}</span>
        ${dateStr ? `<span><strong>Date:</strong> ${dateStr}</span>` : ''}
    `;

    modal.classList.add('visible');
}

function selectCluster(clusterId) {
    const clusterItems = document.querySelectorAll('.cluster-item');
    const points = d3.selectAll('.point');

    if (state.selectedCluster === clusterId) {
        // Deselect - show all
        state.selectedCluster = null;
        clusterItems.forEach(item => {
            item.classList.remove('active');
            item.classList.remove('dimmed');
        });
        points.attr('opacity', 0.75).classed('dimmed', false);
    } else {
        // Select this cluster
        state.selectedCluster = clusterId;

        clusterItems.forEach(item => {
            const itemCluster = parseInt(item.dataset.cluster);
            item.classList.toggle('active', itemCluster === clusterId);
            item.classList.toggle('dimmed', itemCluster !== clusterId);
        });

        points.attr('opacity', d => d.cluster === clusterId ? 0.9 : 0.1)
              .classed('dimmed', d => d.cluster !== clusterId);

        // Show cluster insight
        showClusterInsight(clusterId);
    }
}

function showClusterInsight(clusterId) {
    const cluster = state.clusters.find(c => c.id === clusterId);
    const insight = state.insights.clusterInsights[clusterId];
    if (!cluster || !insight) return;

    const modal = document.getElementById('detail-modal');

    document.getElementById('modal-cluster').textContent = cluster.label;
    document.getElementById('modal-cluster').style.backgroundColor = CONFIG.colors[clusterId % CONFIG.colors.length];

    // Use AI narrative if available, otherwise fall back to basic
    const narrative = insight.aiNarrative || insight.insight;
    const narrativeClass = insight.aiNarrative ? 'insight-narrative ai-enhanced' : 'insight-narrative';

    document.getElementById('modal-text').innerHTML = `
        <div class="cluster-insight-card">
            ${insight.aiNarrative ? '<div class="ai-badge">✨ AI Analysis</div>' : ''}
            <div class="${narrativeClass}">${narrative}</div>
            <div class="insight-stats">
                <div class="stat-item">
                    <span class="stat-value">${insight.count}</span>
                    <span class="stat-label">prompts</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${insight.dominantQType}</span>
                    <span class="stat-label">style</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${insight.avgComplexity}/5</span>
                    <span class="stat-label">complexity</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modal-meta').innerHTML = `
        <span>Click points in this cluster to see individual prompts</span>
    `;

    modal.classList.add('visible');
}

function setupResultsEventListeners() {
    document.getElementById('reset-btn').addEventListener('click', () => {
        state = { messages: [], embeddings: [], coords2d: [], clusters: [], points: [], insights: {}, selectedCluster: null, zoom: null, pipeline: state.pipeline };
        showScreen('upload-screen');
    });

    document.getElementById('modal-close').addEventListener('click', () => {
        document.getElementById('detail-modal').classList.remove('visible');
    });

    document.getElementById('detail-modal').addEventListener('click', (e) => {
        if (e.target.id === 'detail-modal') {
            document.getElementById('detail-modal').classList.remove('visible');
        }
    });

    document.getElementById('zoom-in').addEventListener('click', () => state.svg.transition().call(state.zoom.scaleBy, 1.5));
    document.getElementById('zoom-out').addEventListener('click', () => state.svg.transition().call(state.zoom.scaleBy, 0.67));
    document.getElementById('zoom-reset').addEventListener('click', () => state.svg.transition().call(state.zoom.transform, d3.zoomIdentity));

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => { if (state.points.length > 0) createScatterPlot(); }, 250);
    });
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ============================================
// MODE SELECTION & AI INTEGRATIONS
// ============================================

function setupModeSelection() {
    const modeOptions = document.querySelectorAll('.mode-option');
    const stepApiKey = document.getElementById('step-apikey');
    const uploadStepBadge = document.getElementById('upload-step-badge');
    const uploadDisabled = document.getElementById('upload-disabled');
    const providerOptions = document.querySelectorAll('.provider-option');
    const apiKeyInput = document.getElementById('api-key');
    const toggleVisibility = document.getElementById('toggle-key-visibility');
    const validateBtn = document.getElementById('validate-key-btn');
    const validationStatus = document.getElementById('validation-status');

    // Track if key has been validated (used for UI state)
    // eslint-disable-next-line no-unused-vars
    let apiKeyValidated = false;

    // Mode selection
    modeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const mode = option.dataset.mode;
            CONFIG.analysisMode = mode;

            // Update active states
            modeOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');

            // Reset validation state
            apiKeyValidated = false;
            if (validationStatus) {
                validationStatus.textContent = '';
                validationStatus.className = 'validation-status';
            }

            // Handle step visibility based on mode
            if (mode === 'api') {
                // Show API key step, show locked upload
                stepApiKey.classList.remove('hidden');
                uploadStepBadge.textContent = 'Step 3';
                uploadDisabled.classList.remove('hidden');
            } else {
                // Hide API key step, unlock upload directly
                stepApiKey.classList.add('hidden');
                uploadStepBadge.textContent = 'Step 2';
                uploadDisabled.classList.add('hidden');

                // Check WebGPU support for Browser AI
                if (mode === 'webllm') {
                    checkWebGPUSupport();
                }
            }
        });
    });

    // Provider selection
    providerOptions.forEach(option => {
        option.addEventListener('click', () => {
            providerOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            CONFIG.apiProvider = option.querySelector('input').value;
            // Reset validation when provider changes
            apiKeyValidated = false;
            if (validationStatus) {
                validationStatus.textContent = '';
                validationStatus.className = 'validation-status';
            }
            uploadDisabled.classList.remove('hidden');
        });
    });

    // API key input
    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', (e) => {
            CONFIG.apiKey = e.target.value.trim();
            // Reset validation when key changes
            apiKeyValidated = false;
            if (validationStatus) {
                validationStatus.textContent = '';
                validationStatus.className = 'validation-status';
            }
            uploadDisabled.classList.remove('hidden');
        });
    }

    // Validate button
    if (validateBtn) {
        validateBtn.addEventListener('click', async () => {
            if (!CONFIG.apiKey) {
                validationStatus.textContent = '✗ Please enter an API key';
                validationStatus.className = 'validation-status error';
                return;
            }

            // Show loading state
            validateBtn.disabled = true;
            validateBtn.classList.add('loading');
            validationStatus.textContent = 'Validating...';
            validationStatus.className = 'validation-status loading';

            try {
                const isValid = await validateApiKey();
                if (isValid) {
                    apiKeyValidated = true;
                    validationStatus.textContent = '✓ Key validated successfully';
                    validationStatus.className = 'validation-status success';
                    // Unlock the upload step
                    uploadDisabled.classList.add('hidden');
                } else {
                    validationStatus.textContent = '✗ Invalid API key';
                    validationStatus.className = 'validation-status error';
                }
            } catch (error) {
                validationStatus.textContent = `✗ ${error.message}`;
                validationStatus.className = 'validation-status error';
            } finally {
                validateBtn.disabled = false;
                validateBtn.classList.remove('loading');
            }
        });
    }

    // Toggle visibility
    if (toggleVisibility) {
        toggleVisibility.addEventListener('click', () => {
            const input = document.getElementById('api-key');
            if (input.type === 'password') {
                input.type = 'text';
                toggleVisibility.textContent = '🙈';
            } else {
                input.type = 'password';
                toggleVisibility.textContent = '👁';
            }
        });
    }
}

async function validateApiKey() {
    // Test the API key with a minimal request
    if (CONFIG.apiProvider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${CONFIG.apiKey}`
            }
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || 'Invalid OpenAI API key');
        }
        return true;
    } else {
        // For Anthropic, we need to make a minimal completion request
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CONFIG.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hi' }]
            })
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || 'Invalid Anthropic API key');
        }
        return true;
    }
}

function checkWebGPUSupport() {
    if (!navigator.gpu) {
        alert('⚠️ Browser AI requires WebGPU which is not available in your browser.\n\nPlease use:\n• Chrome 113+ or Edge 113+\n• A device with a compatible GPU\n\nAlternatively, try the API Key mode for best results.');
    }
}

// ============================================
// WEBLLM INTEGRATION
// ============================================

async function loadWebLLM() {
    if (state.webllmReady) return state.webllmEngine;

    updateStatus('Loading Browser AI model (~2GB download, please wait)...', 10);

    try {
        const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm');

        let lastProgress = 0;
        state.webllmEngine = await CreateMLCEngine(CONFIG.webllmModel, {
            initProgressCallback: (progress) => {
                // Progress text from WebLLM tells us what stage we're in
                const progressText = progress.text || '';
                const percent = Math.round(progress.progress * 100);

                // Only update if progress increased (avoid flicker)
                if (percent > lastProgress || progressText.includes('Loading')) {
                    lastProgress = percent;

                    if (progressText.includes('Loading model')) {
                        // Model is loaded, now initializing
                        updateStatus('Initializing AI model...', 40);
                    } else if (percent >= 100) {
                        // Download complete, but model still initializing
                        updateStatus('Preparing AI model...', 38);
                    } else {
                        // Downloading - cap at 35% of overall progress
                        updateStatus(`Downloading AI model: ${percent}%`, 10 + Math.min(percent * 0.25, 25));
                    }
                }
            }
        });

        updateStatus('Browser AI ready!', 40);
        state.webllmReady = true;
        return state.webllmEngine;
    } catch (error) {
        console.error('WebLLM loading failed:', error);
        throw new Error('Browser AI not supported. Try Chrome with a good GPU, or use API Key mode.');
    }
}

async function generateWithWebLLM(prompt) {
    if (!state.webllmEngine) {
        await loadWebLLM();
    }

    const response = await state.webllmEngine.chat.completions.create({
        messages: [
            { role: 'system', content: 'You analyze conversation patterns. Be concise and insightful. Always address the person directly as "you/your", never say "the user".' },
            { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7
    });

    return response.choices[0].message.content;
}

// ============================================
// API KEY INTEGRATION
// ============================================

async function generateWithAPI(prompt) {
    if (!CONFIG.apiKey) {
        throw new Error('Please enter your API key');
    }

    if (CONFIG.apiProvider === 'openai') {
        return await callOpenAI(prompt);
    } else {
        return await callAnthropic(prompt);
    }
}

async function callOpenAI(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You analyze conversation patterns. Be concise and insightful. Always address the person directly as "you/your", never say "the user". Respond in 2-3 sentences max.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 200,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function callAnthropic(prompt) {
    // Note: Anthropic API requires server-side proxy due to CORS
    // For browser use, we'll use a workaround or show instructions
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': CONFIG.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 200,
            messages: [
                { role: 'user', content: prompt }
            ],
            system: 'You analyze conversation patterns. Be concise and insightful. Always address the person directly as "you/your", never say "the user". Respond in 2-3 sentences max.'
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Anthropic API error');
    }

    const data = await response.json();
    return data.content[0].text;
}

// ============================================
// ENHANCED INSIGHT GENERATION
// ============================================

async function generateEnhancedInsights(messages, clusters, labels) {
    // First generate basic insights
    const basicInsights = generateInsights(messages, clusters, labels);

    if (CONFIG.analysisMode === 'basic') {
        return basicInsights;
    }

    // For WebLLM or API modes, enhance with AI-generated insights
    try {
        updateStatus('Generating AI-powered personality insights...', 85);

        // Prepare summary for AI
        const topTopics = clusters.slice(0, 5).map(c => c.label).join(', ');
        const topQTypes = Object.entries(basicInsights.questionTypes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([type, count]) => `${type} (${count})`)
            .join(', ');

        const samplePrompts = messages.slice(0, 10).map(m => `"${m.text.substring(0, 100)}"`).join('\n');

        const analysisPrompt = `Analyze these AI conversation patterns and provide personality insights. Address the person directly as "you/your":

Topics discussed most: ${topTopics}
Question types: ${topQTypes}
Avg complexity: ${basicInsights.avgComplexity}/5
Total prompts: ${basicInsights.totalPrompts}

Sample prompts:
${samplePrompts}

Describe:
1. Your primary personality trait as an AI user (one creative name + one sentence about YOU)
2. One surprising or interesting pattern in YOUR conversations
3. One actionable insight about how YOU could get more value from AI

Be specific, insightful, and slightly playful. Use "you/your" not "the user". Format as 3 short bullet points.`;

        let aiAnalysis;
        if (CONFIG.analysisMode === 'webllm') {
            aiAnalysis = await generateWithWebLLM(analysisPrompt);
        } else {
            aiAnalysis = await generateWithAPI(analysisPrompt);
        }

        // Add AI insights to the basic insights
        basicInsights.aiAnalysis = aiAnalysis;
        basicInsights.enhancedMode = CONFIG.analysisMode;

        // Generate AI-powered cluster narratives
        await enhanceClusterInsights(basicInsights, messages, labels);

    } catch (error) {
        console.error('AI enhancement failed:', error);
        // Set fallback flag to show user we fell back to basic
        basicInsights.fallbackToBasic = true;
        basicInsights.fallbackReason = CONFIG.analysisMode === 'api'
            ? `API key error: ${error.message}. Showing results using basic semantic analysis.`
            : `Browser AI error: ${error.message}. Showing results using basic semantic analysis.`;
    }

    return basicInsights;
}

async function enhanceClusterInsights(insights, messages, labels) {
    // Only enhance top 5 clusters to save API calls/time
    const clusterIds = Object.keys(insights.clusterInsights).slice(0, 5);

    for (const clusterId of clusterIds) {
        const clusterMsgs = messages.filter((_m, i) => state.points[i]?.cluster === parseInt(clusterId));
        if (clusterMsgs.length < 3) continue;

        const sampleTexts = clusterMsgs.slice(0, 5).map(m => m.text.substring(0, 80)).join('\n- ');

        const prompt = `In 1-2 sentences, describe what this cluster of prompts reveals about the person's mindset. Address them directly as "you/your":
Topic: ${labels[clusterId]}
Sample prompts:
- ${sampleTexts}

Be insightful and specific. Use "you/your" not "the user".`;

        try {
            let narrative;
            if (CONFIG.analysisMode === 'webllm') {
                narrative = await generateWithWebLLM(prompt);
            } else {
                narrative = await generateWithAPI(prompt);
            }
            insights.clusterInsights[clusterId].aiNarrative = narrative;
        } catch (e) {
            // Silently fail for individual clusters, keep basic narrative
        }
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    setupUpload();
    setupModeSelection();
});
