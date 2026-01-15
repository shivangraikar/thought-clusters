#!/usr/bin/env python3
"""
Thought Clusters - Process AI conversation exports into semantic clusters.

This script:
1. Parses ChatGPT and/or Claude conversation exports
2. Extracts user messages (your prompts/questions)
3. Generates embeddings using OpenAI's API
4. Reduces dimensions with UMAP
5. Clusters with K-means
6. Labels clusters using GPT
7. Outputs JSON for visualization

Usage:
    python process_conversations.py --chatgpt path/to/conversations.json
    python process_conversations.py --claude path/to/claude_export.json
    python process_conversations.py --chatgpt chatgpt.json --claude claude.json
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
from openai import OpenAI
from sklearn.cluster import KMeans
from umap import UMAP
from tqdm import tqdm


def parse_chatgpt_export(filepath: str) -> list[dict]:
    """Parse ChatGPT data export JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    messages = []
    for conversation in data:
        title = conversation.get('title', 'Untitled')
        create_time = conversation.get('create_time', 0)

        mapping = conversation.get('mapping', {})
        for node_id, node in mapping.items():
            message = node.get('message')
            if message and message.get('author', {}).get('role') == 'user':
                content_parts = message.get('content', {}).get('parts', [])
                text = ' '.join(str(p) for p in content_parts if isinstance(p, str))

                if text.strip() and len(text.strip()) > 10:  # Filter very short messages
                    msg_time = message.get('create_time', create_time)
                    messages.append({
                        'text': text.strip(),
                        'source': 'chatgpt',
                        'conversation_title': title,
                        'timestamp': msg_time if msg_time else create_time,
                    })

    return messages


def parse_claude_export(filepath: str) -> list[dict]:
    """Parse Claude data export JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    messages = []

    # Claude export format may vary - handle common structures
    conversations = data if isinstance(data, list) else data.get('conversations', [])

    for conversation in conversations:
        title = conversation.get('name', conversation.get('title', 'Untitled'))
        created_at = conversation.get('created_at', '')

        chat_messages = conversation.get('chat_messages', [])
        for msg in chat_messages:
            if msg.get('sender') == 'human':
                text = msg.get('text', '')

                if text.strip() and len(text.strip()) > 10:
                    # Parse timestamp
                    msg_time = msg.get('created_at', created_at)
                    if isinstance(msg_time, str) and msg_time:
                        try:
                            dt = datetime.fromisoformat(msg_time.replace('Z', '+00:00'))
                            timestamp = dt.timestamp()
                        except:
                            timestamp = 0
                    else:
                        timestamp = msg_time if isinstance(msg_time, (int, float)) else 0

                    messages.append({
                        'text': text.strip(),
                        'source': 'claude',
                        'conversation_title': title,
                        'timestamp': timestamp,
                    })

    return messages


def get_embeddings(texts: list[str], client: OpenAI, model: str = "text-embedding-3-small") -> np.ndarray:
    """Get embeddings for a list of texts using OpenAI API."""
    embeddings = []
    batch_size = 100  # OpenAI allows up to 2048, but smaller is safer

    print(f"Generating embeddings for {len(texts)} messages...")

    for i in tqdm(range(0, len(texts), batch_size)):
        batch = texts[i:i + batch_size]
        response = client.embeddings.create(
            model=model,
            input=batch
        )
        batch_embeddings = [item.embedding for item in response.data]
        embeddings.extend(batch_embeddings)

    return np.array(embeddings)


def reduce_dimensions(embeddings: np.ndarray, n_components: int = 2) -> np.ndarray:
    """Reduce embedding dimensions using UMAP."""
    print("Reducing dimensions with UMAP...")

    # Adjust parameters based on dataset size
    n_neighbors = min(15, len(embeddings) - 1)

    reducer = UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,
        min_dist=0.1,
        metric='cosine',
        random_state=42
    )

    return reducer.fit_transform(embeddings)


def cluster_embeddings(embeddings: np.ndarray, n_clusters: int = None) -> tuple[np.ndarray, int]:
    """Cluster embeddings using K-means."""
    print("Clustering messages...")

    # Auto-determine number of clusters if not specified
    if n_clusters is None:
        n_clusters = max(5, min(25, len(embeddings) // 20))

    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(embeddings)

    return labels, n_clusters


def label_clusters(messages: list[dict], labels: np.ndarray, client: OpenAI) -> dict[int, str]:
    """Use GPT to generate descriptive labels for each cluster."""
    print("Generating cluster labels with GPT...")

    cluster_labels = {}
    unique_labels = sorted(set(labels))

    for cluster_id in tqdm(unique_labels):
        # Get sample messages from this cluster
        cluster_messages = [m['text'] for i, m in enumerate(messages) if labels[i] == cluster_id]

        # Sample up to 10 messages for labeling
        sample = cluster_messages[:10] if len(cluster_messages) > 10 else cluster_messages
        sample_text = "\n".join(f"- {msg[:200]}..." if len(msg) > 200 else f"- {msg}" for msg in sample)

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that categorizes user questions/prompts. Given a sample of messages from a cluster, provide a short, descriptive label (2-5 words) that captures the common theme. Be specific and descriptive. Just respond with the label, nothing else."
                },
                {
                    "role": "user",
                    "content": f"What theme connects these messages?\n\n{sample_text}"
                }
            ],
            max_tokens=20,
            temperature=0.3
        )

        cluster_labels[cluster_id] = response.choices[0].message.content.strip()

    return cluster_labels


def compute_statistics(messages: list[dict], labels: np.ndarray, cluster_labels: dict) -> dict:
    """Compute statistics for the visualization."""
    stats = {
        'total_messages': len(messages),
        'num_clusters': len(cluster_labels),
        'sources': {},
        'cluster_sizes': {},
    }

    # Count by source
    for msg in messages:
        source = msg['source']
        stats['sources'][source] = stats['sources'].get(source, 0) + 1

    # Cluster sizes
    for cluster_id, label in cluster_labels.items():
        size = sum(1 for l in labels if l == cluster_id)
        stats['cluster_sizes'][label] = size

    return stats


def main():
    parser = argparse.ArgumentParser(description='Process AI conversation exports into semantic clusters.')
    parser.add_argument('--chatgpt', type=str, help='Path to ChatGPT export JSON')
    parser.add_argument('--claude', type=str, help='Path to Claude export JSON')
    parser.add_argument('--clusters', type=int, default=None, help='Number of clusters (auto if not specified)')
    parser.add_argument('--output', type=str, default='../data/clusters.json', help='Output JSON path')

    args = parser.parse_args()

    if not args.chatgpt and not args.claude:
        print("Error: Please provide at least one export file (--chatgpt or --claude)")
        sys.exit(1)

    # Check for API key
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable not set")
        print("Run: export OPENAI_API_KEY='your-key-here'")
        sys.exit(1)

    client = OpenAI(api_key=api_key)

    # Parse conversation exports
    messages = []

    if args.chatgpt:
        print(f"Parsing ChatGPT export: {args.chatgpt}")
        messages.extend(parse_chatgpt_export(args.chatgpt))

    if args.claude:
        print(f"Parsing Claude export: {args.claude}")
        messages.extend(parse_claude_export(args.claude))

    print(f"Found {len(messages)} user messages")

    if len(messages) < 10:
        print("Error: Need at least 10 messages for meaningful clustering")
        sys.exit(1)

    # Sort by timestamp
    messages.sort(key=lambda x: x['timestamp'] or 0)

    # Get embeddings
    texts = [m['text'] for m in messages]
    embeddings = get_embeddings(texts, client)

    # Reduce dimensions for visualization
    coords_2d = reduce_dimensions(embeddings)

    # Cluster
    labels, n_clusters = cluster_embeddings(embeddings, args.clusters)

    # Label clusters
    cluster_labels = label_clusters(messages, labels, client)

    # Compute statistics
    stats = compute_statistics(messages, labels, cluster_labels)

    # Build output data
    output_data = {
        'metadata': {
            'generated_at': datetime.now().isoformat(),
            'total_messages': stats['total_messages'],
            'num_clusters': stats['num_clusters'],
            'sources': stats['sources'],
        },
        'clusters': [
            {
                'id': cid,
                'label': label,
                'count': stats['cluster_sizes'][label]
            }
            for cid, label in cluster_labels.items()
        ],
        'points': [
            {
                'id': i,
                'x': float(coords_2d[i][0]),
                'y': float(coords_2d[i][1]),
                'cluster': int(labels[i]),
                'cluster_label': cluster_labels[int(labels[i])],
                'text': messages[i]['text'][:500],  # Truncate for smaller file
                'full_text': messages[i]['text'],
                'source': messages[i]['source'],
                'conversation': messages[i]['conversation_title'],
                'timestamp': messages[i]['timestamp'],
            }
            for i in range(len(messages))
        ]
    }

    # Ensure output directory exists
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write output
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)

    print(f"\nSuccess! Output written to: {output_path}")
    print(f"Total messages: {stats['total_messages']}")
    print(f"Clusters: {stats['num_clusters']}")
    print("\nCluster distribution:")
    for label, count in sorted(stats['cluster_sizes'].items(), key=lambda x: -x[1]):
        print(f"  {label}: {count}")


if __name__ == '__main__':
    main()
