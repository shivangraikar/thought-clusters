/**
 * Thought Clusters - Browser-based Semantic Analysis
 *
 * This application runs entirely in the browser:
 * - Parses ChatGPT/Claude conversation exports
 * - Generates embeddings using Transformers.js
 * - Reduces dimensions with custom UMAP implementation
 * - Clusters with K-means
 * - Visualizes with D3.js
 *
 * No data is stored or sent to any server.
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // Embedding model (runs in browser via Transformers.js)
    embeddingModel: 'Xenova/all-MiniLM-L6-v2',

    // Clustering
    minClusters: 4,
    maxClusters: 15,
    messagesPerCluster: 15,

    // UMAP
    umapNeighbors: 15,
    umapMinDist: 0.1,

    // Filtering
    minMessageLength: 15,
    maxMessages: 500, // Limit for browser performance

    // Colors for clusters
    colors: [
        '#f472b6', '#818cf8', '#34d399', '#fbbf24', '#f87171',
        '#38bdf8', '#a78bfa', '#4ade80', '#fb923c', '#e879f9',
        '#22d3ee', '#facc15', '#c084fc', '#fb7185', '#2dd4bf'
    ]
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
    selectedCluster: null,
    zoom: null,
    pipeline: null
};

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

    // ChatGPT export is an array of conversations
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
                const text = contentParts
                    .filter(p => typeof p === 'string')
                    .join(' ')
                    .trim();

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

    // Claude export format
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
                        try {
                            timestamp = new Date(msg.created_at).getTime() / 1000;
                        } catch (e) {}
                    }

                    messages.push({
                        text,
                        source: 'Claude',
                        conversation: title,
                        timestamp
                    });
                }
            }
        }
    }

    return messages;
}

function parseExport(data) {
    // Try to detect format
    let messages = [];

    // Check if it's ChatGPT format (has mapping property in conversations)
    if (Array.isArray(data) && data.length > 0 && data[0].mapping) {
        messages = parseChatGPTExport(data);
    }
    // Check if it's Claude format (has chat_messages)
    else if (Array.isArray(data) && data.length > 0 && data[0].chat_messages) {
        messages = parseClaudeExport(data);
    }
    // Try both and combine
    else {
        messages = [...parseChatGPTExport(data), ...parseClaudeExport(data)];
    }

    // Sort by timestamp and limit
    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    if (messages.length > CONFIG.maxMessages) {
        // Sample evenly from the timeline
        const step = Math.floor(messages.length / CONFIG.maxMessages);
        messages = messages.filter((_, i) => i % step === 0).slice(0, CONFIG.maxMessages);
    }

    return messages;
}

// ============================================
// EMBEDDING GENERATION (Transformers.js)
// ============================================

async function loadEmbeddingPipeline() {
    updateStatus('Loading ML model (first time may take a moment)...', 5);

    // Dynamic import of Transformers.js
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1');

    state.pipeline = await pipeline('feature-extraction', CONFIG.embeddingModel, {
        quantized: true
    });

    return state.pipeline;
}

async function generateEmbeddings(messages) {
    const pipe = state.pipeline || await loadEmbeddingPipeline();
    const embeddings = [];

    for (let i = 0; i < messages.length; i++) {
        updateStatus(`Embedding messages... (${i + 1}/${messages.length})`, 10 + (i / messages.length) * 50);
        document.getElementById('proc-embedded').textContent = i + 1;

        const output = await pipe(messages[i].text, { pooling: 'mean', normalize: true });
        embeddings.push(Array.from(output.data));

        // Allow UI to update
        await new Promise(r => setTimeout(r, 0));
    }

    return embeddings;
}

// ============================================
// UMAP IMPLEMENTATION (Simplified)
// ============================================

function umap(embeddings, nComponents = 2, nNeighbors = 15, minDist = 0.1) {
    const n = embeddings.length;
    const dim = embeddings[0].length;

    // Initialize random positions
    let positions = embeddings.map(() =>
        Array(nComponents).fill(0).map(() => (Math.random() - 0.5) * 10)
    );

    // Compute pairwise distances
    const distances = [];
    for (let i = 0; i < n; i++) {
        distances[i] = [];
        for (let j = 0; j < n; j++) {
            if (i === j) {
                distances[i][j] = 0;
            } else {
                let sum = 0;
                for (let d = 0; d < dim; d++) {
                    sum += Math.pow(embeddings[i][d] - embeddings[j][d], 2);
                }
                distances[i][j] = Math.sqrt(sum);
            }
        }
    }

    // Find k-nearest neighbors for each point
    const knn = [];
    for (let i = 0; i < n; i++) {
        const neighbors = distances[i]
            .map((d, j) => ({ j, d }))
            .filter(x => x.j !== i)
            .sort((a, b) => a.d - b.d)
            .slice(0, Math.min(nNeighbors, n - 1));
        knn[i] = neighbors;
    }

    // Simple force-directed layout optimization
    const iterations = 200;
    const learningRate = 1.0;

    for (let iter = 0; iter < iterations; iter++) {
        const forces = positions.map(() => Array(nComponents).fill(0));

        // Attractive forces (neighbors)
        for (let i = 0; i < n; i++) {
            for (const { j, d: origDist } of knn[i]) {
                const dx = positions[j][0] - positions[i][0];
                const dy = positions[j][1] - positions[i][1];
                const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;

                const attraction = 0.1 * Math.log(dist + 1);
                forces[i][0] += attraction * dx / dist;
                forces[i][1] += attraction * dy / dist;
            }
        }

        // Repulsive forces (all points, sampled for efficiency)
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

        // Apply forces
        const decay = 1 - iter / iterations;
        for (let i = 0; i < n; i++) {
            positions[i][0] += forces[i][0] * learningRate * decay;
            positions[i][1] += forces[i][1] * learningRate * decay;
        }
    }

    return positions;
}

// ============================================
// K-MEANS CLUSTERING
// ============================================

function kmeans(embeddings, k, maxIterations = 50) {
    const n = embeddings.length;
    const dim = embeddings[0].length;

    // Initialize centroids using k-means++
    const centroids = [];
    const usedIndices = new Set();

    // First centroid: random
    let idx = Math.floor(Math.random() * n);
    centroids.push([...embeddings[idx]]);
    usedIndices.add(idx);

    // Remaining centroids: weighted by distance
    while (centroids.length < k) {
        const distances = embeddings.map((emb, i) => {
            if (usedIndices.has(i)) return 0;
            return Math.min(...centroids.map(c => euclideanDistance(emb, c)));
        });

        const totalDist = distances.reduce((a, b) => a + b, 0);
        let r = Math.random() * totalDist;

        for (let i = 0; i < n; i++) {
            r -= distances[i];
            if (r <= 0) {
                centroids.push([...embeddings[i]]);
                usedIndices.add(i);
                break;
            }
        }
    }

    // Iterate
    let labels = new Array(n).fill(0);

    for (let iter = 0; iter < maxIterations; iter++) {
        // Assign points to nearest centroid
        const newLabels = embeddings.map(emb => {
            let minDist = Infinity;
            let minIdx = 0;

            for (let c = 0; c < k; c++) {
                const dist = euclideanDistance(emb, centroids[c]);
                if (dist < minDist) {
                    minDist = dist;
                    minIdx = c;
                }
            }

            return minIdx;
        });

        // Check convergence
        if (newLabels.every((l, i) => l === labels[i])) break;
        labels = newLabels;

        // Update centroids
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
    for (let i = 0; i < a.length; i++) {
        sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
}

// ============================================
// CLUSTER LABELING (Keyword Extraction)
// ============================================

function labelClusters(messages, labels) {
    const clusterTexts = {};

    // Group messages by cluster
    for (let i = 0; i < messages.length; i++) {
        const cluster = labels[i];
        if (!clusterTexts[cluster]) clusterTexts[cluster] = [];
        clusterTexts[cluster].push(messages[i].text);
    }

    const clusterLabels = {};

    // Extract keywords for each cluster
    for (const cluster in clusterTexts) {
        const texts = clusterTexts[cluster];
        const words = {};

        // Stopwords
        const stopwords = new Set([
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
            'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
            'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
            'below', 'between', 'under', 'again', 'further', 'then', 'once',
            'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
            'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
            'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and',
            'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that',
            'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'it',
            'its', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
            'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his',
            'himself', 'she', 'her', 'hers', 'herself', 'they', 'them', 'their',
            'theirs', 'themselves', 'am', 'about', 'get', 'like', 'make', 'know',
            'think', 'want', 'see', 'look', 'use', 'find', 'give', 'tell', 'try',
            'leave', 'call', 'keep', 'let', 'begin', 'seem', 'help', 'show',
            'hear', 'play', 'run', 'move', 'live', 'believe', 'hold', 'bring',
            'happen', 'write', 'provide', 'sit', 'stand', 'lose', 'pay', 'meet',
            'include', 'continue', 'set', 'learn', 'change', 'lead', 'understand',
            'watch', 'follow', 'stop', 'create', 'speak', 'read', 'spend', 'grow',
            'open', 'walk', 'win', 'offer', 'remember', 'love', 'consider', 'appear',
            'buy', 'wait', 'serve', 'die', 'send', 'expect', 'build', 'stay',
            'fall', 'cut', 'reach', 'kill', 'remain', 'suggest', 'raise', 'pass',
            'sell', 'require', 'report', 'decide', 'pull', 'please', 'thank', 'thanks',
            'hi', 'hello', 'hey', 'yes', 'yeah', 'ok', 'okay', 'sure', 'right'
        ]);

        // Count words
        for (const text of texts) {
            const textWords = text.toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 2 && !stopwords.has(w));

            for (const word of textWords) {
                words[word] = (words[word] || 0) + 1;
            }
        }

        // Get top keywords
        const sorted = Object.entries(words)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([word]) => word);

        // Create label
        if (sorted.length >= 2) {
            clusterLabels[cluster] = sorted.slice(0, 2)
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' & ');
        } else if (sorted.length === 1) {
            clusterLabels[cluster] = sorted[0].charAt(0).toUpperCase() + sorted[0].slice(1) + ' Topics';
        } else {
            clusterLabels[cluster] = `Cluster ${parseInt(cluster) + 1}`;
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
        // Parse messages
        updateStatus('Parsing conversations...', 2);
        state.messages = parseExport(data);

        if (state.messages.length < 5) {
            alert('Not enough messages found. Need at least 5 user messages.');
            showScreen('upload-screen');
            return;
        }

        document.getElementById('proc-messages').textContent = state.messages.length;

        // Generate embeddings
        state.embeddings = await generateEmbeddings(state.messages);

        // Reduce dimensions
        updateStatus('Computing semantic space...', 65);
        await new Promise(r => setTimeout(r, 50)); // Allow UI update
        state.coords2d = umap(
            state.embeddings,
            2,
            Math.min(CONFIG.umapNeighbors, state.messages.length - 1),
            CONFIG.umapMinDist
        );

        // Cluster
        updateStatus('Discovering topic clusters...', 80);
        await new Promise(r => setTimeout(r, 50));

        const numClusters = Math.max(
            CONFIG.minClusters,
            Math.min(CONFIG.maxClusters, Math.floor(state.messages.length / CONFIG.messagesPerCluster))
        );

        const labels = kmeans(state.embeddings, numClusters);
        const clusterLabels = labelClusters(state.messages, labels);

        // Build clusters array
        const clusterCounts = {};
        labels.forEach(l => clusterCounts[l] = (clusterCounts[l] || 0) + 1);

        state.clusters = Object.entries(clusterLabels)
            .map(([id, label]) => ({
                id: parseInt(id),
                label,
                count: clusterCounts[id] || 0
            }))
            .sort((a, b) => b.count - a.count);

        // Build points array
        state.points = state.messages.map((msg, i) => ({
            id: i,
            x: state.coords2d[i][0],
            y: state.coords2d[i][1],
            cluster: labels[i],
            clusterLabel: clusterLabels[labels[i]],
            text: msg.text,
            source: msg.source,
            conversation: msg.conversation,
            timestamp: msg.timestamp
        }));

        updateStatus('Rendering visualization...', 95);
        await new Promise(r => setTimeout(r, 50));

        // Show results
        showScreen('results-screen');
        renderResults();

    } catch (error) {
        console.error('Processing error:', error);
        alert('Error processing conversations: ' + error.message);
        showScreen('upload-screen');
    }
}

// ============================================
// VISUALIZATION
// ============================================

function renderResults() {
    updateStats();
    renderClusterList();
    renderSourceBreakdown();
    createScatterPlot();
    setupResultsEventListeners();
}

function updateStats() {
    document.getElementById('total-prompts').textContent = state.points.length;
    document.getElementById('total-clusters').textContent = state.clusters.length;
}

function renderClusterList() {
    const container = document.getElementById('cluster-list');
    container.innerHTML = '';

    state.clusters.forEach(cluster => {
        const item = document.createElement('div');
        item.className = 'cluster-item';
        item.dataset.cluster = cluster.id;

        item.innerHTML = `
            <div class="cluster-dot" style="background-color: ${CONFIG.colors[cluster.id % CONFIG.colors.length]}"></div>
            <div class="cluster-info">
                <div class="cluster-label">${cluster.label}</div>
                <div class="cluster-count">${cluster.count} prompts</div>
            </div>
        `;

        item.addEventListener('click', () => toggleClusterFilter(cluster.id));
        item.addEventListener('mouseenter', () => highlightCluster(cluster.id));
        item.addEventListener('mouseleave', () => highlightCluster(null));

        container.appendChild(item);
    });
}

function renderSourceBreakdown() {
    const container = document.getElementById('source-breakdown');
    container.innerHTML = '';

    const sources = {};
    state.points.forEach(p => {
        sources[p.source] = (sources[p.source] || 0) + 1;
    });

    for (const [source, count] of Object.entries(sources)) {
        const item = document.createElement('div');
        item.className = 'source-item';

        const iconClass = source.toLowerCase().includes('chatgpt') ? 'chatgpt' : 'claude';
        const initial = source.charAt(0);

        item.innerHTML = `
            <div class="source-icon ${iconClass}">${initial}</div>
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

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Create a group for zoomable content
    const g = svg.append('g');

    // Calculate scales
    const xExtent = d3.extent(state.points, d => d.x);
    const yExtent = d3.extent(state.points, d => d.y);

    const xPadding = (xExtent[1] - xExtent[0]) * 0.1;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1;

    const xScale = d3.scaleLinear()
        .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
        .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
        .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
        .range([height - margin.bottom, margin.top]);

    // Create points
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
        .on('click', handleClick);

    // Setup zoom
    state.zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(state.zoom);

    // Store references
    state.svg = svg;
    state.g = g;
    state.xScale = xScale;
    state.yScale = yScale;
}

function handleMouseOver(event, d) {
    const tooltip = document.getElementById('tooltip');

    // Position tooltip
    const x = event.pageX + 15;
    const y = event.pageY + 15;

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;

    // Format content
    tooltip.innerHTML = `
        <div class="tooltip-cluster" style="background-color: ${CONFIG.colors[d.cluster % CONFIG.colors.length]}">
            ${d.clusterLabel}
        </div>
        <div class="tooltip-text">${truncateText(d.text, 150)}</div>
        <div class="tooltip-meta">
            <span>${d.source}</span>
        </div>
    `;

    tooltip.classList.add('visible');

    // Highlight point
    d3.select(event.target)
        .attr('r', 10)
        .attr('opacity', 1);
}

function handleMouseOut(event, d) {
    document.getElementById('tooltip').classList.remove('visible');

    if (state.selectedCluster === null || d.cluster === state.selectedCluster) {
        d3.select(event.target)
            .attr('r', 6)
            .attr('opacity', 0.75);
    }
}

function handleClick(event, d) {
    const modal = document.getElementById('detail-modal');

    document.getElementById('modal-cluster').textContent = d.clusterLabel;
    document.getElementById('modal-cluster').style.backgroundColor = CONFIG.colors[d.cluster % CONFIG.colors.length];
    document.getElementById('modal-text').textContent = d.text;

    let dateStr = '';
    if (d.timestamp) {
        const date = new Date(d.timestamp * 1000);
        dateStr = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    document.getElementById('modal-meta').innerHTML = `
        <span><strong>Source:</strong> ${d.source}</span>
        <span><strong>Conversation:</strong> ${d.conversation}</span>
        ${dateStr ? `<span><strong>Date:</strong> ${dateStr}</span>` : ''}
    `;

    modal.classList.add('visible');
}

function highlightCluster(clusterId) {
    if (state.selectedCluster !== null) return;

    const points = d3.selectAll('.point');
    const clusterItems = document.querySelectorAll('.cluster-item');

    if (clusterId === null) {
        points.classed('dimmed', false).classed('highlighted', false);
        clusterItems.forEach(item => item.classList.remove('dimmed'));
    } else {
        points
            .classed('dimmed', d => d.cluster !== clusterId)
            .classed('highlighted', d => d.cluster === clusterId);
        clusterItems.forEach(item => {
            item.classList.toggle('dimmed', parseInt(item.dataset.cluster) !== clusterId);
        });
    }
}

function toggleClusterFilter(clusterId) {
    const clusterItems = document.querySelectorAll('.cluster-item');

    if (state.selectedCluster === clusterId) {
        state.selectedCluster = null;
        highlightCluster(null);
        clusterItems.forEach(item => item.classList.remove('active'));
    } else {
        state.selectedCluster = clusterId;

        d3.selectAll('.point')
            .classed('dimmed', d => d.cluster !== clusterId)
            .classed('highlighted', d => d.cluster === clusterId);

        clusterItems.forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.cluster) === clusterId);
            item.classList.toggle('dimmed', parseInt(item.dataset.cluster) !== clusterId);
        });
    }
}

function setupResultsEventListeners() {
    // Reset button
    document.getElementById('reset-btn').addEventListener('click', () => {
        state = {
            messages: [],
            embeddings: [],
            coords2d: [],
            clusters: [],
            points: [],
            selectedCluster: null,
            zoom: null,
            pipeline: state.pipeline // Keep the model loaded
        };
        showScreen('upload-screen');
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', () => {
        document.getElementById('detail-modal').classList.remove('visible');
    });

    document.getElementById('detail-modal').addEventListener('click', (e) => {
        if (e.target.id === 'detail-modal') {
            document.getElementById('detail-modal').classList.remove('visible');
        }
    });

    // Zoom controls
    document.getElementById('zoom-in').addEventListener('click', () => {
        state.svg.transition().call(state.zoom.scaleBy, 1.5);
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        state.svg.transition().call(state.zoom.scaleBy, 0.67);
    });

    document.getElementById('zoom-reset').addEventListener('click', () => {
        state.svg.transition().call(state.zoom.transform, d3.zoomIdentity);
    });

    // Window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (state.points.length > 0) {
                createScatterPlot();
            }
        }, 250);
    });
}

// ============================================
// UTILITIES
// ============================================

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    setupUpload();
});
