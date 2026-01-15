# Thought Clusters: Publication Starter Pack

**A Privacy-Preserving Browser-Based Tool for Semantic Analysis of Human-AI Conversational Patterns**

---

## Abstract Template

> This paper presents **Thought Clusters**, a privacy-preserving web application for semantic analysis and visualization of human-AI conversation histories. Unlike server-based approaches, our tool processes all data locally in the user's browser using WebAssembly-powered machine learning (Transformers.js). By combining lightweight sentence embeddings, dimensionality reduction, and unsupervised clustering, we enable users to discover latent patterns in their questioning behavior across multiple AI platforms (ChatGPT, Claude) without any data leaving their device. Our architecture demonstrates how modern browser capabilities enable sophisticated ML applications while maintaining complete user privacy.

---

## 1. Research Context & Motivation

### 1.1 The Problem Space

As conversational AI becomes ubiquitous, users accumulate extensive interaction histories. These histories represent a rich, underexplored data source for understanding human-AI interaction patterns. However, analyzing this data traditionally requires:

- Uploading sensitive personal data to external servers
- API keys and authentication setup
- Technical expertise to run processing scripts

**Our Solution**: A zero-friction, privacy-first web application where all computation happens locally.

### 1.2 Research Questions

1. Can browser-based ML effectively cluster conversational data without external APIs?
2. How do questioning behaviors differ between ChatGPT and Claude users?
3. What patterns emerge from analyzing personal AI conversation histories?
4. Can keyword extraction provide meaningful cluster labels without LLM assistance?

### 1.3 Key Contributions

1. **Privacy-preserving architecture** - All processing occurs in-browser
2. **Zero-friction deployment** - No installation, API keys, or backend required
3. **Multi-platform support** - Unified analysis of ChatGPT and Claude exports
4. **Open-source implementation** - Fully transparent, inspectable code

---

## 2. Technical Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                                │
│                     (All Processing Happens Here)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      FILE UPLOAD (Drag & Drop)                   │   │
│  │                     conversations.json from user                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      CONVERSATION PARSER                         │   │
│  │            Extracts user messages from ChatGPT/Claude            │   │
│  │                   Filters by minimum length                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    TRANSFORMERS.JS EMBEDDINGS                    │   │
│  │              Model: all-MiniLM-L6-v2 (quantized)                 │   │
│  │                    384-dimensional vectors                       │   │
│  │                   Runs via ONNX + WebAssembly                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  DIMENSIONALITY REDUCTION                        │   │
│  │            Force-directed graph layout (UMAP-inspired)           │   │
│  │           384 dimensions → 2 dimensions for visualization        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         K-MEANS CLUSTERING                       │   │
│  │                    K-means++ initialization                      │   │
│  │              k = max(4, min(15, messages / 15))                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     KEYWORD EXTRACTION                           │   │
│  │              TF-based labeling (stopword filtered)               │   │
│  │                  Top 2 keywords per cluster                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     D3.JS VISUALIZATION                          │   │
│  │          Interactive scatter plot with zoom/pan/hover            │   │
│  │              Cluster sidebar with filtering                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ╔═════════════════════╗
                         ║   NO DATA LEAVES    ║
                         ║    THE BROWSER      ║
                         ╚═════════════════════╝
```

### 2.2 Embedding Generation

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Model | `all-MiniLM-L6-v2` | Lightweight, fast, good quality |
| Dimensions | 384 | Smaller than OpenAI embeddings, still effective |
| Quantization | ONNX (quantized) | Reduced model size (~30MB) |
| Runtime | WebAssembly | Near-native performance in browser |
| Processing | Sequential | Required for browser main thread |

### 2.3 Dimensionality Reduction

Custom force-directed layout inspired by UMAP:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Target dimensions | 2 | 2D visualization |
| k-nearest neighbors | 15 | Local structure preservation |
| Iterations | 200 | Convergence balance |
| Attraction force | 0.1 * log(dist) | Pull neighbors together |
| Repulsion force | -0.5 / dist² | Push non-neighbors apart |

### 2.4 Clustering (K-Means++)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Algorithm | K-means++ | Better centroid initialization |
| k (clusters) | `max(4, min(15, n/15))` | Adaptive to dataset size |
| Max iterations | 50 | Convergence threshold |
| Distance metric | Euclidean | Standard for embeddings |
| Input space | 384-dim embeddings | Cluster in semantic space |

### 2.5 Cluster Labeling

Instead of LLM-based labeling, we use keyword extraction:

1. Group messages by cluster
2. Tokenize and filter stopwords
3. Count term frequencies
4. Select top 2 keywords
5. Capitalize and join as label

---

## 3. Privacy Architecture

### 3.1 Data Flow Analysis

| Stage | Data Location | Network Activity |
|-------|--------------|------------------|
| File Upload | Browser memory | None |
| Parsing | Browser memory | None |
| Embedding | Browser (WASM) | Model download only (cached) |
| Clustering | Browser memory | None |
| Visualization | Browser DOM | None |
| Page Refresh | Data destroyed | None |

### 3.2 What IS Transmitted

- Transformers.js library (~30MB, CDN)
- MiniLM model weights (~30MB, HuggingFace)
- D3.js library (~500KB, CDN)

**All cached after first load. No user data ever transmitted.**

### 3.3 What is NOT Stored

- No localStorage
- No sessionStorage
- No IndexedDB
- No cookies
- No server-side storage
- No analytics/tracking

---

## 4. Experimental Design Suggestions

### 4.1 User Study Protocol

**Participants**: N users with ChatGPT/Claude history (>50 messages)

**Procedure**:
1. Collect conversation exports (with consent)
2. Participants use the tool independently
3. Think-aloud protocol during exploration
4. Post-task questionnaire on insights discovered

**Metrics**:
- Time to insight discovery
- Number of clusters explored
- Self-reported "aha moments"
- Accuracy of cluster labels (human evaluation)

### 4.2 Hypotheses

- **H1**: Users can identify their dominant topic areas using the visualization
- **H2**: Cluster labels provide meaningful topic descriptions
- **H3**: Browser-based processing completes in acceptable time (<2 min for 200 messages)
- **H4**: Users trust the privacy guarantees of local processing

### 4.3 Baseline Comparisons

- Server-based OpenAI embedding + GPT labeling
- Simple TF-IDF + LDA topic modeling
- Manual categorization by users
- BERTopic (Python-based)

---

## 5. Limitations & Future Work

### 5.1 Current Limitations

| Limitation | Impact | Potential Solution |
|------------|--------|-------------------|
| Sequential embedding | Slow for large datasets | Web Workers parallelization |
| Keyword-based labels | Less descriptive than LLM | Local LLM (WebLLM) |
| Memory constraints | Browser limits on large files | Streaming/chunked processing |
| Single-session only | No persistence across sessions | Optional export/import |

### 5.2 Future Research Directions

1. **Temporal Analysis**: Visualize how topics evolve over time
2. **Cross-User Patterns**: Anonymized aggregate analysis
3. **Local LLM Labeling**: Use WebLLM for better cluster names
4. **Comparative Visualization**: Side-by-side ChatGPT vs Claude patterns
5. **Export Capabilities**: PDF reports, shareable visualizations

---

## 6. Ethical Considerations

### 6.1 Privacy

- **Data sovereignty**: Users maintain complete control
- **No data collection**: Zero telemetry or analytics
- **Transparent processing**: All code client-side and inspectable
- **Ephemeral by design**: Data exists only during session

### 6.2 Informed Consent

- Users explicitly choose to upload their data
- Clear communication that data stays local
- No account creation or identification required

### 6.3 Limitations to Disclose

- Embedding models may encode biases
- Cluster labels are automated, not vetted
- Visualization may over-simplify relationships
- Not suitable for clinical or diagnostic use

---

## 7. Related Work

### 7.1 Browser-Based ML
- TensorFlow.js
- ONNX Runtime Web
- Transformers.js (Hugging Face)
- WebLLM

### 7.2 Topic Modeling
- Latent Dirichlet Allocation (Blei et al., 2003)
- BERTopic (Grootendorst, 2022)
- Top2Vec (Angelov, 2020)

### 7.3 Privacy-Preserving Analytics
- Differential privacy
- Federated learning
- Local-first software movement

### 7.4 Human-AI Interaction
- Conversation analysis in HCI
- User modeling from chat logs
- AI assistant usage patterns

---

## 8. Reproduction Instructions

### 8.1 Local Development

```bash
# Clone repository
git clone https://github.com/shivangraikar/thought-clusters.git
cd thought-clusters

# Serve locally (any static server)
python -m http.server 8000
# or: npx serve
# or: php -S localhost:8000

# Open http://localhost:8000
```

### 8.2 Deployment

```bash
# GitHub Pages (automatic)
# Push to main branch, enable Pages in settings

# Or any static hosting:
# - Netlify
# - Vercel
# - Cloudflare Pages
# - AWS S3 + CloudFront
```

### 8.3 Testing

1. Export conversations from ChatGPT/Claude
2. Upload JSON to the application
3. Verify cluster generation
4. Check visualization rendering

---

## 9. Citation Template

```bibtex
@software{thought_clusters_2026,
  author = {Raikar, Shivang},
  title = {Thought Clusters: Privacy-Preserving Semantic Analysis of AI Conversations},
  year = {2026},
  url = {https://github.com/shivangraikar/thought-clusters},
  note = {Browser-based tool using Transformers.js for local ML processing}
}
```

---

## 10. Appendix

### A. Sample Cluster Output

| Cluster | Auto-Generated Label | Count | Example Prompts |
|---------|---------------------|-------|-----------------|
| 0 | Code & Python | 28 | "Fix this Python error", "Debug my code" |
| 1 | Learning & Concepts | 24 | "Explain transformers", "What is UMAP" |
| 2 | Writing & Help | 22 | "Write an email", "Improve this paragraph" |
| 3 | API & Data | 19 | "REST endpoint", "Parse JSON" |

### B. Performance Benchmarks

| Dataset Size | Embedding Time | Total Time | Memory Usage |
|--------------|---------------|------------|--------------|
| 50 messages | ~15s | ~20s | ~100MB |
| 100 messages | ~30s | ~40s | ~150MB |
| 200 messages | ~60s | ~80s | ~200MB |
| 500 messages | ~150s | ~180s | ~400MB |

*Benchmarks on M1 MacBook Air, Chrome 120*

### C. Supported Export Formats

**ChatGPT**:
```json
[
  {
    "title": "Conversation Title",
    "mapping": {
      "node_id": {
        "message": {
          "author": { "role": "user" },
          "content": { "parts": ["message text"] }
        }
      }
    }
  }
]
```

**Claude**:
```json
[
  {
    "name": "Conversation Title",
    "chat_messages": [
      { "sender": "human", "text": "message text" }
    ]
  }
]
```

---

## Contact

For collaboration inquiries or questions about this research:
- GitHub: [@shivangraikar](https://github.com/shivangraikar)
- Repository: [thought-clusters](https://github.com/shivangraikar/thought-clusters)
- Live Demo: [shivangraikar.github.io/thought-clusters](https://shivangraikar.github.io/thought-clusters)
