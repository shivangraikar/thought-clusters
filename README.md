# Thought Clusters

**Discover hidden patterns in your AI conversations - entirely in your browser.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Browser](https://img.shields.io/badge/runs%20in-browser-green.svg)
![Privacy](https://img.shields.io/badge/data-never%20leaves%20your%20device-purple.svg)

Thought Clusters uses machine learning to analyze your ChatGPT and Claude conversation exports, automatically discovering the topics you discuss most. All processing happens in your browser - your data never leaves your device.

## Try It Now

**[Launch Thought Clusters](https://shivangraikar.github.io/thought-clusters)**

No installation. No signup. No data collection.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        YOUR BROWSER (100% LOCAL)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     │
│   │  Upload  │────▶│  Parse   │────▶│  Embed   │────▶│ Cluster  │     │
│   │   JSON   │     │ Messages │     │   (ML)   │     │ (K-means)│     │
│   └──────────┘     └──────────┘     └──────────┘     └──────────┘     │
│                                                           │             │
│                                                           ▼             │
│                                      ┌─────────────────────────────┐   │
│                                      │    Interactive Scatter      │   │
│                                      │    Plot Visualization       │   │
│                                      └─────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                            🔒 Data stays here
                         Nothing sent to servers
```

### The Pipeline

1. **Upload** - Drop your `conversations.json` export file
2. **Parse** - Extract your questions/prompts from the conversation data
3. **Embed** - Convert text to vectors using Transformers.js (MiniLM model)
4. **Reduce** - Project to 2D space for visualization
5. **Cluster** - Group similar prompts using K-means
6. **Label** - Auto-generate topic names from keywords
7. **Visualize** - Interactive scatter plot with D3.js

---

## Quick Start

### Option 1: Use the Hosted Version
1. Visit [shivangraikar.github.io/thought-clusters](https://shivangraikar.github.io/thought-clusters)
2. Export your conversations (see below)
3. Drop the JSON file
4. Explore your semantic map

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

## Features

| Feature | Description |
|---------|-------------|
| **Zero Setup** | No API keys, no installation, just upload |
| **Privacy First** | All ML runs in browser via WebAssembly |
| **Multi-Platform** | Supports ChatGPT and Claude exports |
| **Interactive** | Zoom, pan, hover, click for details |
| **Auto-Labeling** | Keyword extraction names each cluster |
| **Ephemeral** | Refresh the page and it's all gone |

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| **Embeddings** | [Transformers.js](https://huggingface.co/docs/transformers.js) (MiniLM-L6-v2) |
| **Dimensionality Reduction** | Custom force-directed UMAP |
| **Clustering** | K-means++ with adaptive k |
| **Visualization** | D3.js v7 |
| **Frontend** | Vanilla JavaScript (ES Modules) |
| **Styling** | CSS3 with custom properties |
| **Hosting** | GitHub Pages (static) |

### Why Browser-Based?

- **Privacy**: Your conversations contain personal data. They never leave your device.
- **No Backend**: No servers to maintain, no costs, no rate limits.
- **Instant Access**: No signup, no API keys, no configuration.
- **Transparent**: All code runs client-side - inspect it yourself.

---

## Privacy Guarantee

**Your data never leaves your browser.**

- No network requests to external APIs
- No analytics or tracking
- No cookies or local storage
- Page refresh = data gone
- ML model runs via WebAssembly

The only network request is loading the Transformers.js model (~30MB, cached by browser).

---

## Limitations

- **Performance**: Large exports (500+ messages) may be slow
- **First Load**: ML model download takes a moment
- **Labels**: Keyword extraction isn't as smart as LLM labeling
- **Browser Memory**: Very large files may cause issues

---

## Project Structure

```
thought-clusters/
├── index.html          # Main application
├── app.js              # Processing & visualization logic
├── style.css           # Dark theme styling
├── README.md           # This file
├── PUBLICATION_STARTER.md  # Research documentation
└── scripts/
    └── process_conversations.py  # (Legacy) Python processor
```

---

## For Researchers

See [PUBLICATION_STARTER.md](PUBLICATION_STARTER.md) for:
- Research questions and hypotheses
- Technical methodology documentation
- Experimental design suggestions
- Citation templates

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
- [ ] More sophisticated cluster labeling
- [ ] Support for additional AI platforms
- [ ] Offline PWA support

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Transformers.js](https://huggingface.co/docs/transformers.js) - Browser ML
- [D3.js](https://d3js.org) - Visualization
- [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) - Embedding model

---

**Built by [@shivangraikar](https://github.com/shivangraikar)**

*Your thoughts, visualized. Your data, protected.*
