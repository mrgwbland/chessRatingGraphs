const colors = [
    '#e94560', '#00d9ff', '#00ff88', '#ffaa00', 
    '#ff66cc', '#66ffcc', '#ff6666', '#9966ff'
];

let players = [];
let chart = null;
let colorIndex = 0;

// Initialize chart
function initChart() {
    const ctx = document.getElementById('ratingChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: { datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'month',
                        displayFormats: { month: 'MMM yyyy' }
                    },
                    grid: { color: '#333' },
                    ticks: { color: '#aaa' }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Rating',
                        color: '#aaa'
                    },
                    grid: { color: '#333' },
                    ticks: { color: '#aaa' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#16213e',
                    borderColor: '#333',
                    borderWidth: 1
                }
            }
        }
    });
}

// Parse CSV content
function parseCSV(content) {
    const lines = content.trim().split('\n');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const [date, rating] = lines[i].split(',');
        if (date && rating) {
            data.push({
                x: new Date(date.trim()),
                y: parseInt(rating.trim())
            });
        }
    }
    
    return data.sort((a, b) => a.x - b.x);
}

// Get player name from filename
function getPlayerName(filename) {
    return filename.replace('.csv', '').replace(/^player\d+_/, '').replace(/_/g, ' ');
}

// Add player to chart
function addPlayer(name, data) {
    const color = colors[colorIndex % colors.length];
    colorIndex++;
    
    players.push({ name, data, color });
    updateChart();
    updatePlayerList();
}

// Remove player from chart
function removePlayer(name) {
    players = players.filter(p => p.name !== name);
    updateChart();
    updatePlayerList();
}

// Filter data by date range
function filterByDateRange(data) {
    const startDate = new Date(document.getElementById('startDate').value);
    const endDate = new Date(document.getElementById('endDate').value);
    
    return data.filter(point => point.x >= startDate && point.x <= endDate);
}

// Update chart with current players and date range
function updateChart() {
    chart.data.datasets = players.map(player => ({
        label: player.name,
        data: filterByDateRange(player.data),
        borderColor: player.color,
        backgroundColor: player.color + '20',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.1
    }));
    
    chart.update();
}

// Update player list UI
function updatePlayerList() {
    const list = document.getElementById('playerList');
    list.innerHTML = players.map(player => `
        <div class="player-tag">
            <span class="color-dot" style="background: ${player.color}"></span>
            <span>${player.name}</span>
            <button class="remove-btn" onclick="removePlayer('${player.name}')">&times;</button>
        </div>
    `).join('');
}

// Handle file input
document.getElementById('csvInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    
    for (const file of files) {
        const content = await file.text();
        const data = parseCSV(content);
        const name = getPlayerName(file.name);
        
        if (!players.find(p => p.name === name)) {
            addPlayer(name, data);
        }
    }
    
    e.target.value = '';
});

// Handle date range changes
document.getElementById('applyDateRange').addEventListener('click', updateChart);

// Load sample data on page load
async function loadSampleData() {
    const sampleFiles = [
        'data/player1_magnus.csv',
        'data/player2_hikaru.csv',
        'data/player3_fabiano.csv'
    ];
    
    for (const path of sampleFiles) {
        try {
            const response = await fetch(path);
            if (response.ok) {
                const content = await response.text();
                const data = parseCSV(content);
                const name = getPlayerName(path.split('/').pop());
                addPlayer(name, data);
            }
        } catch (err) {
            console.log(`Could not load ${path}`);
        }
    }
}

// Initialize
initChart();
loadSampleData();
