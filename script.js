document.addEventListener('DOMContentLoaded', () => {
    // STATE MANAGEMENT
    let state = {
        games: [],
        players: [],
        scores: {},
        currentGame: null,
        gameStartTime: null,
        gameHistory: [],
        contender: null,         // NEW: Name of the player who is the current contender
        contenderWinStreak: 0    // NEW: How many consecutive rounds the contender has won
    };

    // DOM ELEMENTS
    const screens = {
        setup: document.getElementById('setup-screen'),
        game: document.getElementById('game-screen'),
        history: document.getElementById('history-screen')
    };
    const modals = {
        winner: document.getElementById('winner-modal'),
        manageGames: document.getElementById('manage-games-modal'),
        endOfRound: document.getElementById('end-of-round-modal')
    };
    const gameStatus = document.getElementById('game-status'); // NEW
    const gameSelect = document.getElementById('game-select');
    const playerNameInputsContainer = document.getElementById('player-inputs');
    const scoreboard = document.getElementById('scoreboard');
    const historyList = document.getElementById('history-list');

    // --- DATA PERSISTENCE ---
    function saveState() {
        localStorage.setItem('gameCounterState', JSON.stringify({
            games: state.games,
            gameHistory: state.gameHistory
        }));
    }

    function loadState() {
        const savedState = JSON.parse(localStorage.getItem('gameCounterState'));
        if (savedState) {
            state.games = savedState.games || [];
            state.gameHistory = savedState.gameHistory || [];
        }
        if (state.games.length === 0) {
            state.games.push({ name: 'Rummikub', winningScore: 100 });
        }
    }

    // --- UI & SCREEN LOGIC ---
    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
    }

    function showModal(modalName, show = true) {
        modals[modalName].classList.toggle('active', show);
    }
    
    function updateGameStatus(message) {
        if (message) {
            gameStatus.textContent = message;
            gameStatus.style.display = 'block';
        } else {
            gameStatus.style.display = 'none';
        }
    }

    function updateGameSelect() {
        gameSelect.innerHTML = state.games.map(g => `<option value="${g.name}">${g.name}</option>`).join('');
    }
    
    function updateManageGamesList() {
        const listEl = document.getElementById('saved-games-list');
        listEl.innerHTML = state.games.map((game, index) => `
            <div>
                ${game.name} (${game.winningScore} points)
                <button data-index="${index}" class="delete-game-btn">X</button>
            </div>
        `).join('');
    }

    function renderScoreboard() {
        const game = state.games.find(g => g.name === state.currentGame);
        document.getElementById('game-title').textContent = state.currentGame;
        document.getElementById('winning-score-display').textContent = `Winning Score: ${game.winningScore}`;

        scoreboard.innerHTML = state.players.map(player => `
            <div class="player-score-card" id="player-card-${player.replace(/\s+/g, '-')}">
                <div class="player-header">
                    <span class="player-name">${player}</span>
                    <div>
                        <div class="current-score">${state.scores[player]}</div>
                        <div class="current-score-label">POINTS</div>
                    </div>
                </div>
                <div class="score-input-area">
                    <input type="number" class="score-input" placeholder="Add points...">
                    <button class="add-score-btn primary" data-player="${player}">Add</button>
                </div>
            </div>
        `).join('');
        
        if (state.contender) {
             const card = document.getElementById(`player-card-${state.contender.replace(/\s+/g, '-')}`);
             if(card) card.style.border = '3px solid var(--secondary-color)';
        }
    }
    
    function renderHistory() {
        historyList.innerHTML = state.gameHistory.map((entry, index) => `
            <div class="history-entry">
                <div class="history-summary" data-index="${index}">
                    <h3>${entry.game}</h3>
                    <p>Winner: ${entry.winner || 'Incomplete'} (${new Date(entry.startTime).toLocaleDateString()})</p>
                    <p>Duration: ${entry.duration}</p>
                </div>
                <div class="history-details" id="details-${index}">
                    <p><strong>Players:</strong> ${entry.players.join(', ')}</p>
                    <p><strong>Point Log:</strong></p>
                    <ul>
                        ${entry.pointLog.map(log => `<li>${log.player} scored ${log.pointsAdded} (New Total: ${log.newScore})</li>`).join('')}
                    </ul>
                </div>
            </div>
        `).join('');
    }

    // --- GAME LOGIC ---
    function startGame() {
        state.players = [...document.querySelectorAll('.player-name-input')]
            .map(input => input.value.trim())
            .filter(name => name);
        
        if (state.players.length < 1) {
            alert('Please enter at least one player name.');
            return;
        }

        state.currentGame = gameSelect.value;
        state.scores = {};
        state.players.forEach(p => state.scores[p] = 0);
        state.gameStartTime = new Date().getTime();
        state.contender = null;
        state.contenderWinStreak = 0;
        updateGameStatus('');
        
        state.gameHistory.unshift({
            game: state.currentGame,
            players: state.players,
            startTime: state.gameStartTime,
            endTime: null,
            duration: 'In Progress',
            winner: null,
            pointLog: []
        });

        renderScoreboard();
        showScreen('game');
    }

    function addScore(player, points) {
        if (isNaN(points)) return; // Allow 0 points to be entered

        state.scores[player] += points;
        
        state.gameHistory[0].pointLog.push({
            player: player,
            pointsAdded: points,
            newScore: state.scores[player],
            timestamp: new Date().getTime()
        });
        saveState();
        renderScoreboard();
        showModal('endOfRound');
    }

    function processEndOfRound() {
        showModal('endOfRound', false);
        const game = state.games.find(g => g.name === state.currentGame);

        const topScore = Math.max(...Object.values(state.scores));
        const topPlayers = state.players.filter(p => state.scores[p] === topScore);

        // Rule: Game is normal if no one has reached the winning score
        if (topScore < game.winningScore) {
            updateGameStatus("The round is over. No one has reached the winning score yet.");
            // If there was a contender, they've lost their status
            if (state.contender) {
                state.contender = null;
                state.contenderWinStreak = 0;
                renderScoreboard(); // Re-render to remove highlight
            }
            return;
        }
        
        // From here on, topScore >= winningScore

        // Rule: If there's a tie for the lead, any win streak is broken
        if (topPlayers.length > 1) {
            state.contender = null;
            state.contenderWinStreak = 0;
            renderScoreboard(); // Re-render to remove any highlights
            updateGameStatus(`It's a tie for the lead between ${topPlayers.join(', ')}! The win streak is broken.`);
            return;
        }

        // Rule: There is one clear leader
        const leader = topPlayers[0];

        if (leader === state.contender) {
            // The current contender won the round again
            state.contenderWinStreak++;
            updateGameStatus(`${leader} won the round again! Win streak is now ${state.contenderWinStreak}.`);
        } else {
            // A new contender has emerged
            state.contender = leader;
            state.contenderWinStreak = 1;
            renderScoreboard(); // Re-render to highlight the new contender
            updateGameStatus(`${leader} is the new Contender! They must win the next round to win the game.`);
        }

        // Final Win Condition Check
        if (state.contenderWinStreak === 2) {
            updateGameStatus(`${leader} has won 2 consecutive rounds and wins the game!`);
            declareWinner(leader);
        }
    }
    
    function declareWinner(winnerName) {
        document.getElementById(`player-card-${winnerName.replace(/\s+/g, '-')}`).classList.add('winner');
        document.getElementById('winner-name').textContent = winnerName;

        const endTime = new Date().getTime();
        const durationMs = endTime - state.gameHistory[0].startTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = ((durationMs % 60000) / 1000).toFixed(0);

        state.gameHistory[0].endTime = endTime;
        state.gameHistory[0].winner = winnerName;
        state.gameHistory[0].duration = `${minutes}m ${seconds}s`;
        saveState();

        setTimeout(() => {
            showModal('winner');
            state.contender = null;
            state.contenderWinStreak = 0;
        }, 1000); // Delay to allow reading the final status message
    }
    
    function startNewGame() {
        showModal('winner', false);
        playerNameInputsContainer.innerHTML = `
            <input type="text" placeholder="Player 1 Name" class="player-name-input">
            <input type="text" placeholder="Player 2 Name" class="player-name-input">
        `;
        showScreen('setup');
    }

    // --- EVENT LISTENERS ---
    document.getElementById('add-player-field-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Player ${playerNameInputsContainer.children.length + 1} Name`;
        input.className = 'player-name-input';
        playerNameInputsContainer.appendChild(input);
    });

    document.getElementById('start-game-btn').addEventListener('click', startGame);

    scoreboard.addEventListener('click', e => {
        if (e.target.classList.contains('add-score-btn')) {
            const player = e.target.dataset.player;
            const input = e.target.previousElementSibling;
            const points = parseInt(input.value, 10);
            if (!isNaN(points)) { // Check if it's a valid number
                addScore(player, points);
                input.value = '';
            }
        }
    });
    
    document.getElementById('confirm-round-end-yes').addEventListener('click', processEndOfRound);
    document.getElementById('confirm-round-end-no').addEventListener('click', () => showModal('endOfRound', false));
    document.getElementById('new-game-from-winner-btn').addEventListener('click', startNewGame);
    document.getElementById('new-game-from-game-btn').addEventListener('click', startNewGame);
    document.getElementById('manage-games-btn').addEventListener('click', () => { updateManageGamesList(); showModal('manageGames'); });
    document.getElementById('close-manage-games-btn').addEventListener('click', () => showModal('manageGames', false));
    document.getElementById('save-new-game-btn').addEventListener('click', () => {
        const name = document.getElementById('new-game-name').value.trim();
        const score = parseInt(document.getElementById('new-game-score').value, 10);
        if (name && score > 0) {
            state.games.push({ name, winningScore: score });
            saveState();
            updateGameSelect();
            updateManageGamesList();
            document.getElementById('new-game-name').value = '';
            document.getElementById('new-game-score').value = '';
        } else { alert('Please enter a valid name and winning score.'); }
    });
    document.getElementById('saved-games-list').addEventListener('click', e => {
        if (e.target.classList.contains('delete-game-btn')) {
            const index = e.target.dataset.index;
            if (confirm(`Are you sure you want to delete ${state.games[index].name}?`)) {
                state.games.splice(index, 1);
                saveState();
                updateGameSelect();
                updateManageGamesList();
            }
        }
    });

    document.getElementById('view-history-btn').addEventListener('click', () => { renderHistory(); showScreen('history'); });
    document.getElementById('back-to-setup-btn').addEventListener('click', () => showScreen('setup'));
    historyList.addEventListener('click', e => {
        if (e.target.closest('.history-summary')) {
            const index = e.target.closest('.history-summary').dataset.index;
            const details = document.getElementById(`details-${index}`);
            details.style.display = details.style.display === 'block' ? 'none' : 'block';
        }
    });
    
    loadState();
    updateGameSelect();
    showScreen('setup');
});