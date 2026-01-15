# Thought Clusters

**Discover hidden patterns in your AI conversations - entirely in your browser.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Browser](https://img.shields.io/badge/runs%20in-browser-green.svg)
![Privacy](https://img.shields.io/badge/data-never%20leaves%20your%20device-purple.svg)

Thought Clusters uses machine learning to analyze your ChatGPT and Claude conversation exports, revealing your conversation topics, questioning patterns, and AI personality traits. All processing happens in your browser - your data never leaves your device.

## Try It Now

**[Launch Thought Clusters](https://shivangraikar.github.io/thought-clusters)**

No installation. No signup. No data collection.

---

## Features

### Three Analysis Modes

| Mode | Description | Best For |
|------|-------------|----------|
| **Basic** | Fast pattern analysis using keyword extraction | Quick results, works everywhere |
| **Browser AI** | Local LLM (Phi-3) runs entirely in your browser | Deep insights without API costs |
| **API Key** | Use your OpenAI or Anthropic key | Best quality AI-generated insights |

### What You'll Discover

- **Topic Bubbles** - Visual map of your conversation themes (bigger = more prompts)
- **AI Personality** - Traits derived from your questioning style (Creator, Debugger, Learner, etc.)
- **Question Patterns** - How-to, Explanation, Debugging, Creative, Opinion, and more
- **Complexity Analysis** - How technical your prompts tend to be
- **Source Breakdown** - Compare your ChatGPT vs Claude usage

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        YOUR BROWSER (100% LOCAL)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐       │
│   │  Upload  │────▶│  Parse   │────▶│  Embed   │────▶│ Cluster  │       │
│   │   JSON   │     │ Messages │     │   (ML)   │     │ (K-means)│       │
│   └──────────┘     └──────────┘     └──────────┘     └──────────┘       │
│                                           │                             │
│                                           ▼                             │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐                        │
│   │ Insights │◀────│ Analyze  │◀────│  Label   │                        │
│   │ & Traits │     │ Behavior │     │ Clusters │                        │
│   └──────────┘     └──────────┘     └──────────┘                        │
│         │                                                               │
│         ▼                                                               │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │           Interactive Bubble Chart Visualization            │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                            🔒 Data stays here
                         Nothing sent to servers*

*Unless you choose API mode with your own key
```

### The Pipeline

1. **Choose Mode** - Select Basic, Browser AI, or API Key analysis
2. **Upload** - Drop your `conversations.json` export file
3. **Parse** - Extract your questions/prompts from the conversation data
4. **Embed** - Convert text to vectors using Transformers.js (MiniLM model)
5. **Cluster** - Group similar prompts using K-means++
6. **Analyze** - Detect question types, intents, and complexity
7. **Visualize** - Interactive bubble chart with D3.js

---

## Quick Start

### Option 1: Use the Hosted Version
1. Visit [shivangraikar.github.io/thought-clusters](https://shivangraikar.github.io/thought-clusters)
2. Choose your analysis mode
3. Export your conversations (see below)
4. Drop the JSON file
5. Explore your topic bubbles and personality insights

### Option 2: Run Locally
```bash
git clone https://github.com/shivangraikar/thought-clusters.git
cd thought-clusters
python -m http.server 8000
# Open http://localhost:8000
```

---

## Exporting Your Conversations

### ChatGPT
1. Go to [chat.openai.com](https://chat.openai.com)
2. Click your profile → **Settings**
3. **Data controls** → **Export data**
4. Wait for email, download ZIP
5. Extract and find `conversations.json`

### Claude
1. Go to [claude.ai](https://claude.ai)
2. Click your profile → **Settings**
3. **Export data**
4. Download your JSON export

---

## Analysis Modes Explained

### Basic Mode (Default)
- Uses keyword extraction for cluster labeling
- Rule-based personality trait detection
- No external dependencies beyond the embedding model
- Works on any device

### Browser AI Mode
- Downloads Phi-3 model (~2GB, cached for future use)
- Runs entirely locally via WebLLM
- Requires Chrome 113+ with WebGPU support
- Generates AI-powered insights about your patterns

### API Key Mode
- Uses OpenAI (GPT-4o-mini) or Anthropic (Claude Haiku)
- Best quality insights and narratives
- Your key is never stored - session only
- Validates key before processing

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| **Embeddings** | [Transformers.js](https://huggingface.co/docs/transformers.js) (MiniLM-L6-v2) |
| **Browser LLM** | [WebLLM](https://github.com/mlc-ai/web-llm) (Phi-3-mini) |
| **Clustering** | K-means++ with adaptive k |
| **Visualization** | D3.js v7 (Bubble Pack Layout) |
| **Frontend** | Vanilla JavaScript (ES Modules) |
| **Styling** | CSS3 with custom properties |
| **Hosting** | GitHub Pages (static) |

---

## Privacy Guarantee

**Your data never leaves your browser** (unless you choose API mode).

- No analytics or tracking
- No cookies or local storage (except optional WebLLM cache)
- Page refresh = data gone
- ML models run via WebAssembly
- API keys are session-only, never persisted

Network requests:
- Transformers.js model (~30MB, cached)
- WebLLM model (~2GB, optional, cached)
- API calls only if you provide your own key

---

## Limitations

- **Performance**: Large exports (500+ messages) may be slow
- **First Load**: ML model download takes a moment
- **Browser AI**: Requires Chrome with WebGPU and decent GPU
- **Browser Memory**: Very large files may cause issues

---

## Project Structure

```
thought-clusters/
├── index.html              # Main application
├── app.js                  # Processing, analysis & visualization
├── style.css               # Dark theme styling
├── README.md               # This file
└── scripts/
    └── process_conversations.py  # (Legacy) Python processor
```

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Ideas for Contribution

- [ ] Temporal visualization (timeline view)
- [ ] Export results as PNG/PDF
- [ ] Support for additional AI platforms
- [ ] Offline PWA support
- [ ] More personality trait categories

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Transformers.js](https://huggingface.co/docs/transformers.js) - Browser ML embeddings
- [WebLLM](https://github.com/mlc-ai/web-llm) - Browser-based LLM inference
- [D3.js](https://d3js.org) - Visualization
- [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) - Embedding model

---

**Built by [@shivangraikar](https://github.com/shivangraikar)**

*Your thoughts, visualized. Your data, protected.*
