document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const ROUNDS_TO_WIN = 2; // Must hold the lead for this many consecutive rounds to win.

    // --- STATE MANAGEMENT ---
    let state = {
        games: [],
        players: [],
        scores: {},
        currentGame: null,
        gameStartTime: null,
        gameHistory: [],
        isFinalRound: false,
        potentialWinner: null, // Who is currently in the lead at the end of a round
        consecutiveWinRounds: 0 // How many rounds they've been in the lead
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

    function updateGameSelect() {
        gameSelect.innerHTML = state.games.map(g => `<option value="<span class="math-inline">\{g\.name\}"\></span>{g.name}</option>`).join('');
    }
    
    function updateManageGamesList() {
        const listEl = document.getElementById('saved-games-list');
        listEl.innerHTML = state.games.map((game, index) => `
            <div>
                <span class="math-inline">\{game\.name\} \(</span>{game.winningScore} points)
                <button data-index="${index}" class="delete-game-btn">X</button>
            </div>
        `).join('');
    }

    function renderScoreboard() {
        const game = state.games.find(g => g.name === state.currentGame);
        if (!game) return;
        document.getElementById('game-title').textContent = state.currentGame;
        document.getElementById('winning-score-display').textContent = `First to ${game.winningScore} wins!`;

        scoreboard.innerHTML = state.players.map(player => `
            <div class="player-score-card" id="player-card-<span class="math-inline">\{player\.replace\(/\\s\+/g, '\-'\)\}"\>
<div class\="player\-header"\>
<span class\="player\-name"\></span>{player}</span>
                    <div class="current-score-container">
                        <div class="current-score"><span class="math-inline">\{state\.scores\[player\]\}</div\>
<div class\="current\-score\-label"\>POINTS</div\>
</div\>
</div\>
<div class\="score\-input\-area"\>
<input type\="number" class\="score\-input" placeholder\="Add points\.\.\."\>
<button class\="add\-score\-btn primary" data\-player\="</span>{player}">Add</button>
                </div>
            </div>
        `).join('');
    }
    
    function renderHistory() {
        historyList.innerHTML = state.gameHistory.map((entry, index) => `
            <div class="history-entry">
                <div class="history-summary" data-index="<span class="math-inline">\{index\}"\>
<h3\></span>{entry.game}</h3>
                    <p>Winner: <span class="math-inline">\{entry\.winner \|\| 'Incomplete'\} \(</span>{new Date(entry.startTime).toLocaleDateString()})</p>
                    <p>Duration: <span class="math-inline">\{entry\.duration\}</p\>
</div\>
<div class\="history\-details" id\="details\-</span>{index}">
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
        
        if (state.players.length < 2) {
            alert('Please enter at least two player names.');
            return;
        }

        state.currentGame = gameSelect.value;
        state.scores = {};
        state.players.forEach(p => state.scores[p] = 0);
        state.gameStartTime = new Date().getTime();
        // Reset all endgame state variables
        state.isFinalRound = false; 
        state.potentialWinner = null;
        state.consecutiveWinRounds = 0;
        
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
        if (isNaN(points) || points === 0) return;
        state.scores[player] += points;
        state.gameHistory[0].pointLog.push({
            player,
            pointsAdded: points,
            newScore: state.scores[player],
            timestamp: new Date().getTime()
        });
        saveState();
        renderScoreboard();
        checkGameState();
    }

    function checkGameState() {
        if (state.isFinalRound) return;

        const game = state.games.find(g => g.name === state.currentGame);
        const someoneReachedWinningScore = state.players.some(p => state.scores[p] >= game.winningScore);

        if (someoneReachedWinningScore) {
            state.isFinalRound = true;
            showModal('endOfRound');
        }
    }

    function evaluateEndOfRound() {
        let highScore = -Infinity;
        state.players.forEach(p => {
            if (state.scores[p] > highScore) {
                highScore = state.scores[p];
            }
        });

        const leaders = state.players.filter(p => state.scores[p] === highScore);

        if (leaders.length > 1) {
            // TIE for the lead
            state.potentialWinner = null;
            state.consecutiveWinRounds = 0;
            alert(`Tie for the lead at ${highScore} points! The game continues. Start the next round.`);
        } else {
            // ONE person is in the lead
            const soleLeader = leaders[0];
            if (state.potentialWinner === soleLeader) {
                // The same person is still in the lead
                state.consecutiveWinRounds++;
            } else {
                // A new person has taken the lead
                state.potentialWinner = soleLeader;
                state.consecutiveWinRounds = 1;
            }

            // Now, check if they have won
            if (state.consecutiveWinRounds >= ROUNDS_TO_WIN) {
                declareWinner(soleLeader);
            } else {
                const roundsRemaining = ROUNDS_TO_WIN - state.consecutiveWinRounds;
                alert(`${soleLeader} has the lead with ${highScore} points! They must hold the lead for ${roundsRemaining} more round(s) to win. Start the next round.`);
            }
        }
    }

    function declareWinner(winner) {
        document.getElementById(`player-card-${winner.replace(/\s+/g, '-')}`).classList.add('winner');
        document.getElementById('winner-name').textContent = winner;

        const endTime = new Date().getTime();
        const durationMs = endTime - state.gameHistory[0].startTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = ((durationMs % 60000) / 1000).toFixed(0);
        
        state.gameHistory[0].endTime = endTime;