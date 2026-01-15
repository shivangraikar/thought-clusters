// Thought Clusters - Interactive Visualization
// Semantic analysis of AI conversation history

const COLORS = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
    '#2980b9', '#27ae60', '#d35400', '#8e44ad', '#f1c40f',
    '#95a5a6', '#1abc9c', '#e91e63', '#00bcd4', '#ff5722',
    '#673ab7', '#4caf50', '#ff9800', '#607d8b', '#795548'
];

let data = null;
let selectedCluster = null;

// Initialize the visualization
async function init() {
    try {
        // Show loading state
        document.getElementById('scatter-plot').innerHTML = '<div class="loading">Loading data</div>';

        // Load the data
        const response = await fetch('data/clusters.json');
        if (!response.ok) {
            throw new Error('Data file not found. Run the processing script first.');
        }
        data = await response.json();

        // Update stats
        updateStats();

        // Create visualizations
        createScatterPlot();
        createBarChart();
        createLegend();

        // Setup event listeners
        setupEventListeners();

    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('scatter-plot').innerHTML = `
            <div class="loading" style="flex-direction: column; gap: 12px;">
                <span style="color: #e74c3c;">Error: ${error.message}</span>
                <span style="font-size: 12px;">Make sure to run the processing script first.</span>
            </div>
        `;
    }
}

function updateStats() {
    document.getElementById('stat-messages').textContent =
        data.metadata.total_messages.toLocaleString();
    document.getElementById('stat-clusters').textContent =
        data.metadata.num_clusters;
    document.getElementById('stat-chatgpt').textContent =
        (data.metadata.sources.chatgpt || 0).toLocaleString();
    document.getElementById('stat-claude').textContent =
        (data.metadata.sources.claude || 0).toLocaleString();
}

function createScatterPlot() {
    const container = document.getElementById('scatter-plot');
    container.innerHTML = '';

    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Calculate scales
    const xExtent = d3.extent(data.points, d => d.x);
    const yExtent = d3.extent(data.points, d => d.y);

    // Add some padding
    const xPadding = (xExtent[1] - xExtent[0]) * 0.05;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.05;

    const xScale = d3.scaleLinear()
        .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
        .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
        .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
        .range([height - margin.bottom, margin.top]);

    // Create points
    const points = svg.selectAll('.point')
        .data(data.points)
        .enter()
        .append('circle')
        .attr('class', 'point')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 5)
        .attr('fill', d => COLORS[d.cluster % COLORS.length])
        .attr('opacity', 0.7)
        .on('mouseover', handleMouseOver)
        .on('mouseout', handleMouseOut)
        .on('click', handleClick);

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on('zoom', (event) => {
            svg.selectAll('.point')
                .attr('transform', event.transform);
        });

    svg.call(zoom);
}

function createBarChart() {
    const container = document.getElementById('bar-chart');
    container.innerHTML = '';

    // Sort clusters by count
    const sortedClusters = [...data.clusters].sort((a, b) => b.count - a.count);
    const maxCount = sortedClusters[0].count;

    sortedClusters.forEach(cluster => {
        const row = document.createElement('div');
        row.className = 'bar-row';
        row.dataset.cluster = cluster.id;

        const label = document.createElement('div');
        label.className = 'bar-label';
        label.textContent = cluster.label;
        label.title = cluster.label;

        const barContainer = document.createElement('div');
        barContainer.className = 'bar-container';

        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.width = `${(cluster.count / maxCount) * 100}%`;
        bar.style.backgroundColor = COLORS[cluster.id % COLORS.length];

        const count = document.createElement('span');
        count.className = 'bar-count';
        count.textContent = cluster.count;

        bar.appendChild(count);
        barContainer.appendChild(bar);
        row.appendChild(label);
        row.appendChild(barContainer);
        container.appendChild(row);

        // Add hover interaction
        row.addEventListener('mouseenter', () => highlightCluster(cluster.id));
        row.addEventListener('mouseleave', () => highlightCluster(null));
        row.addEventListener('click', () => toggleClusterFilter(cluster.id));
    });
}

function createLegend() {
    const container = document.getElementById('legend');
    container.innerHTML = '';

    // Sort clusters by count for legend
    const sortedClusters = [...data.clusters].sort((a, b) => b.count - a.count);

    sortedClusters.forEach(cluster => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.dataset.cluster = cluster.id;

        const dot = document.createElement('div');
        dot.className = 'legend-dot';
        dot.style.backgroundColor = COLORS[cluster.id % COLORS.length];

        const label = document.createElement('span');
        label.textContent = cluster.label;

        item.appendChild(dot);
        item.appendChild(label);
        container.appendChild(item);

        // Add interactions
        item.addEventListener('mouseenter', () => highlightCluster(cluster.id));
        item.addEventListener('mouseleave', () => highlightCluster(null));
        item.addEventListener('click', () => toggleClusterFilter(cluster.id));
    });
}

function handleMouseOver(event, d) {
    const tooltip = document.getElementById('tooltip');
    const container = document.getElementById('scatter-plot');
    const rect = container.getBoundingClientRect();

    // Position tooltip
    let x = event.clientX - rect.left + 15;
    let y = event.clientY - rect.top + 15;

    // Prevent tooltip from going off screen
    if (x + 350 > rect.width) {
        x = event.clientX - rect.left - 360;
    }
    if (y + 200 > rect.height) {
        y = event.clientY - rect.top - 210;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;

    // Format date
    let dateStr = '';
    if (d.timestamp) {
        const date = new Date(d.timestamp * 1000);
        dateStr = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    tooltip.innerHTML = `
        <div class="tooltip-cluster" style="background-color: ${COLORS[d.cluster % COLORS.length]}">
            ${d.cluster_label}
        </div>
        <div class="tooltip-text">${truncateText(d.text, 200)}</div>
        <div class="tooltip-meta">
            <span>${d.source}</span>
            ${dateStr ? `<span>${dateStr}</span>` : ''}
        </div>
    `;

    tooltip.classList.add('visible');

    // Highlight this point
    d3.select(event.target)
        .attr('r', 8)
        .attr('opacity', 1);
}

function handleMouseOut(event, d) {
    const tooltip = document.getElementById('tooltip');
    tooltip.classList.remove('visible');

    // Reset point size if not filtered
    if (selectedCluster === null || d.cluster === selectedCluster) {
        d3.select(event.target)
            .attr('r', 5)
            .attr('opacity', 0.7);
    }
}

function handleClick(event, d) {
    const panel = document.getElementById('detail-panel');
    const title = document.getElementById('detail-title');
    const meta = document.getElementById('detail-meta');
    const text = document.getElementById('detail-text');

    // Format date
    let dateStr = '';
    if (d.timestamp) {
        const date = new Date(d.timestamp * 1000);
        dateStr = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    title.innerHTML = `<span style="color: ${COLORS[d.cluster % COLORS.length]}">${d.cluster_label}</span>`;
    meta.innerHTML = `
        <span><strong>Source:</strong> ${d.source}</span>
        <span><strong>Conversation:</strong> ${d.conversation}</span>
        ${dateStr ? `<span><strong>Date:</strong> ${dateStr}</span>` : ''}
    `;
    text.textContent = d.full_text || d.text;

    panel.classList.add('visible');
}

function highlightCluster(clusterId) {
    if (selectedCluster !== null) return; // Don't highlight if filtered

    const points = d3.selectAll('.point');
    const legendItems = document.querySelectorAll('.legend-item');
    const barRows = document.querySelectorAll('.bar-row');

    if (clusterId === null) {
        // Reset all
        points.classed('dimmed', false).classed('highlighted', false);
        legendItems.forEach(item => item.classList.remove('dimmed'));
        barRows.forEach(row => row.style.opacity = '1');
    } else {
        // Highlight matching, dim others
        points.classed('dimmed', d => d.cluster !== clusterId)
              .classed('highlighted', d => d.cluster === clusterId);
        legendItems.forEach(item => {
            item.classList.toggle('dimmed', parseInt(item.dataset.cluster) !== clusterId);
        });
        barRows.forEach(row => {
            row.style.opacity = parseInt(row.dataset.cluster) === clusterId ? '1' : '0.3';
        });
    }
}

function toggleClusterFilter(clusterId) {
    if (selectedCluster === clusterId) {
        // Deselect
        selectedCluster = null;
        highlightCluster(null);
    } else {
        // Select this cluster
        selectedCluster = clusterId;

        const points = d3.selectAll('.point');
        const legendItems = document.querySelectorAll('.legend-item');
        const barRows = document.querySelectorAll('.bar-row');

        points.classed('dimmed', d => d.cluster !== clusterId)
              .classed('highlighted', d => d.cluster === clusterId);
        legendItems.forEach(item => {
            item.classList.toggle('dimmed', parseInt(item.dataset.cluster) !== clusterId);
        });
        barRows.forEach(row => {
            row.style.opacity = parseInt(row.dataset.cluster) === clusterId ? '1' : '0.3';
        });
    }
}

function setupEventListeners() {
    // Close detail panel
    document.getElementById('close-detail').addEventListener('click', () => {
        document.getElementById('detail-panel').classList.remove('visible');
    });

    // Click outside to close
    document.addEventListener('click', (event) => {
        const panel = document.getElementById('detail-panel');
        const scatterPlot = document.getElementById('scatter-plot');

        if (!panel.contains(event.target) && !scatterPlot.contains(event.target)) {
            panel.classList.remove('visible');
        }
    });

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            createScatterPlot();
        }, 250);
    });
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
