const colors = [
    '#e94560', '#00d9ff', '#00ff88', '#ffaa00', 
    '#ff66cc', '#66ffcc', '#ff6666', '#9966ff'
];

let players = [];
let chart = null;
let colorIndex = 0;

// Initialise chart
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
        pointRadius: 1,
        pointHoverRadius: 3,
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

// Initialise
initChart();
loadSampleData();

// Chess.com API integration - fetches all time controls at once
async function fetchChessComRatingHistory(username) {
    const statusMsg = document.getElementById('statusMessage');
    statusMsg.textContent = 'Fetching data...';
    statusMsg.className = 'status-info';
    
    try {
        // Fetch player's game archives
        const archivesResponse = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`, {
            headers: {
                'User-Agent': 'chess-rating-graphs/1.0 (username: 62WestWallaby; contact: mrgwbland@gmail.com)'
            }
        });
        
        if (!archivesResponse.ok) {
            throw new Error(`Player not found or API error (${archivesResponse.status})`);
        }
        
        const archivesData = await archivesResponse.json();
        const archives = archivesData.archives || [];
        
        if (archives.length === 0) {
            throw new Error('No game history found for this player');
        }
        
        statusMsg.textContent = `Found ${archives.length} months of data. Processing...`;
        
        // Store ratings by time control
        const ratingsByTimeControl = {
            bullet: [],
            blitz: [],
            rapid: [],
            daily: []
        };
        
        // Fetch all monthly archives
        for (const archiveUrl of archives) {
            try {
                const gamesResponse = await fetch(archiveUrl, {
                    headers: {
                        'User-Agent': 'chess-rating-graphs/1.0 (username: 62WestWallaby; contact: mrgwbland@gmail.com)'
                    }
                });
                
                if (gamesResponse.ok) {
                    const gamesData = await gamesResponse.json();
                    const games = gamesData.games || [];
                    
                    // Extract ratings for all time controls
                    games.forEach(game => {
                        // Only include standard chess games, not variants like 960, bughouse, etc.
                        if (game.rules === 'chess' && ratingsByTimeControl[game.time_class]) {
                            const date = new Date(game.end_time * 1000);
                            const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
                            const rating = isWhite ? game.white.rating : game.black.rating;
                            
                            if (rating) {
                                ratingsByTimeControl[game.time_class].push({
                                    date: date.toISOString().split('T')[0],
                                    rating: rating
                                });
                            }
                        }
                    });
                }
                
            } catch (err) {
                console.log(`Skipped archive: ${archiveUrl}`);
            }
        }
        
        // Process each time control: sort by date and remove duplicates (keep last rating of each day)
        const results = {};
        let totalDataPoints = 0;
        
        Object.entries(ratingsByTimeControl).forEach(([timeControl, ratings]) => {
            if (ratings.length > 0) {
                const ratingByDate = {};
                ratings.forEach(entry => {
                    ratingByDate[entry.date] = entry.rating;
                });
                
                results[timeControl] = Object.entries(ratingByDate)
                    .map(([date, rating]) => ({ date, rating }))
                    .sort((a, b) => new Date(a.date) - new Date(b.date));
                
                totalDataPoints += results[timeControl].length;
            }
        });
        
        if (totalDataPoints === 0) {
            throw new Error('No games found for this player');
        }
        
        const foundControls = Object.keys(results).join(', ');
        statusMsg.textContent = `Success! Found ${totalDataPoints} data points across ${Object.keys(results).length} time controls (${foundControls}).`;
        statusMsg.className = 'status-success';
        
        return results;
        
    } catch (error) {
        statusMsg.textContent = `Error: ${error.message}`;
        statusMsg.className = 'status-error';
        throw error;
    }
}

// Generate CSV content from rating history
function generateCSV(ratingHistory) {
    const header = 'date,rating\n';
    const rows = ratingHistory.map(entry => `${entry.date},${entry.rating}`).join('\n');
    return header + rows;
}

// Download CSV file
function downloadCSV(content, username, timeControl) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${username}_${timeControl}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Handle chess.com download button
document.getElementById('downloadBtn').addEventListener('click', async () => {
    const username = document.getElementById('username').value.trim();
    
    if (!username) {
        const statusMsg = document.getElementById('statusMessage');
        statusMsg.textContent = 'Please enter a username';
        statusMsg.className = 'status-error';
        return;
    }
    
    try {
        const ratingHistories = await fetchChessComRatingHistory(username);
        
        // Download CSV for each time control
        let downloadedCount = 0;
        Object.entries(ratingHistories).forEach(([timeControl, ratingHistory]) => {
            const csvContent = generateCSV(ratingHistory);
            downloadCSV(csvContent, username, timeControl);        
            downloadedCount++;
        });
        
        // Update status message
        const statusMsg = document.getElementById('statusMessage');
        statusMsg.textContent += ` Downloaded ${downloadedCount} CSV files!`;
        
    } catch (error) {
        console.error('Error fetching chess.com data:', error);
    }
});
