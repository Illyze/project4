const gridElement = document.getElementById('puzzle-grid');
const timerElement = document.getElementById('timer-display');
const victoryModal = document.getElementById('victory-screen-modal');
const modalTimeValue = document.getElementById('modal-time-value');

// --- LOCALIZED AUDIO SYSTEM COMPLIANCE INTERACTION ---
const winSound = new Audio('win.mp3');

let timerInterval;
let secondsElapsed = 0;
let gameActive = false;

const ROWS = 3;
const COLS = 4;

const DIRS = [
    { r: -1, c: 0, idx: 0, opp: 2 }, 
    { r: 0,  c: 1, idx: 1, opp: 3 }, 
    { r: 1,  c: 0, idx: 2, opp: 0 }, 
    { r: 0,  c: -1, idx: 3, opp: 1 }  
];

let gridTilesData = [];

function rotateOpeningsList(openings, angle) {
    const shiftCount = (angle / 90) % 4;
    let result = [...openings];
    for (let i = 0; i < shiftCount; i++) {
        result.unshift(result.pop());
    }
    return result;
}

function generateSolvablePath() {
    let visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    let path = [];

    function dfs(r, c) {
        visited[r][c] = true;
        path.push({ r, c });

        if (r === ROWS - 1 && c === COLS - 1) return true;

        let directions = [...DIRS].sort(() => Math.random() - 0.5);
        for (let dir of directions) {
            let nr = r + dir.r;
            let nc = c + dir.c;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc]) {
                if (dfs(nr, nc)) return true;
            }
        }
        path.pop();
        return false;
    }

    dfs(0, 0);
    return path;
}

function initGridGameBoard() {
    gridElement.innerHTML = '';
    gridTilesData = [];

    // Row 0 Top-cap: Drop Node injection point alignment tracking
    for (let c = 0; c < COLS; c++) {
        const item = document.createElement('div');
        if (c === 0) {
            item.className = 'grid-external-node start-node';
            item.innerHTML = '<i class="bi bi-droplet-fill"></i>';
        } else {
            item.className = 'grid-spacer-cell';
        }
        gridElement.appendChild(item);
    }

    const solutionPath = generateSolvablePath();
    let layoutBlueprints = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

    for (let i = 0; i < solutionPath.length; i++) {
        let curr = solutionPath[i];
        let requiredOpenings = [0, 0, 0, 0];

        if (i === 0) {
            requiredOpenings[0] = 1; 
        } else {
            let prev = solutionPath[i - 1];
            let incoming = DIRS.find(d => d.r === prev.r - curr.r && d.c === prev.c - curr.c);
            requiredOpenings[incoming.idx] = 1;
        }

        if (i === solutionPath.length - 1) {
            requiredOpenings[2] = 1; 
        } else {
            let next = solutionPath[i + 1];
            let outgoing = DIRS.find(d => d.r === next.r - curr.r && d.c === next.c - curr.c);
            requiredOpenings[outgoing.idx] = 1;
        }

        let type = 'corner';
        let baseOpenings = [1, 1, 0, 0];

        if ((requiredOpenings[0] && requiredOpenings[2]) || (requiredOpenings[1] && requiredOpenings[3])) {
            type = 'straight';
            baseOpenings = [0, 1, 0, 1];
        }

        layoutBlueprints[curr.r][curr.c] = { type, baseOpenings };
    }

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (!layoutBlueprints[r][c]) {
                let isStraight = Math.random() > 0.5;
                layoutBlueprints[r][c] = {
                    type: isStraight ? 'straight' : 'corner',
                    baseOpenings: isStraight ? [0, 1, 0, 1] : [1, 1, 0, 0]
                };
            }
        }
    }

    let index = 0;
    const allowedAngles = [0, 90, 180, 270];

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let blueprint = layoutBlueprints[r][c];
            let scrambledAngle = allowedAngles[Math.floor(Math.random() * allowedAngles.length)];

            gridTilesData.push({
                type: blueprint.type,
                baseOpenings: blueprint.baseOpenings,
                currentAngle: scrambledAngle,
                row: r,
                col: c,
                hasWater: false
            });

            const tileDiv = document.createElement('div');
            tileDiv.className = 'pipe-tile';
            tileDiv.id = `tile-${index}`;
            
            let currentIdx = index;
            tileDiv.onclick = () => handleTileInteraction(currentIdx);

            const pipeInner = document.createElement('div');
            pipeInner.className = `pipe-inner ${blueprint.type}`;
            pipeInner.id = `pipe-inner-${index}`;
            pipeInner.style.transform = `rotate(${scrambledAngle}deg)`;

            if (blueprint.type === 'straight') {
                pipeInner.innerHTML = `
                    <div class="pipe-segment"></div>
                    <div class="water-fluid"></div>
                `;
            } else {
                pipeInner.innerHTML = `
                    <div class="pipe-segment pipe-seg-v"></div>
                    <div class="pipe-segment pipe-seg-h"></div>
                    <div class="pipe-joint"></div>
                    <div class="water-fluid fluid-v"></div>
                    <div class="water-fluid fluid-h"></div>
                `;
            }

            tileDiv.appendChild(pipeInner);
            gridElement.appendChild(tileDiv);
            index++;
        }
    }

    // Row 4 Bottom-cap: Target Village House Badge alignment matrix spacer row
    for (let c = 0; c < COLS; c++) {
        const item = document.createElement('div');
        if (c === COLS - 1) {
            item.className = 'grid-external-node game-badge-finish';
            item.id = 'live-finish-node';
            item.innerHTML = '<i class="bi bi-house-fill"></i>';
        } else {
            item.className = 'grid-spacer-cell';
        }
        gridElement.appendChild(item);
    }

    calculatePathFlowNetwork();
}

function handleTileInteraction(index) {
    if (!gameActive && secondsElapsed === 0) {
        startGame();
    }

    gridTilesData[index].currentAngle = (gridTilesData[index].currentAngle + 90) % 360;
    
    const targetEl = document.getElementById(`pipe-inner-${index}`);
    targetEl.style.transform = `rotate(${gridTilesData[index].currentAngle}deg)`;

    calculatePathFlowNetwork();
}

function calculatePathFlowNetwork() {
    gridTilesData.forEach((tile, index) => {
        tile.hasWater = false;
        document.getElementById(`tile-${index}`).classList.remove('flow-active');
    });
    
    const visualFinish = document.getElementById('live-finish-node');
    if (visualFinish) visualFinish.classList.remove('active');

    let queue = [];
    const rootTile = gridTilesData[0];
    const rootOpenings = rotateOpeningsList(rootTile.baseOpenings, rootTile.currentAngle);
    
    if (rootOpenings[0] === 1) { 
        rootTile.hasWater = true;
        queue.push(rootTile);
    }

    while (queue.length > 0) {
        let current = queue.shift();
        let currIndex = current.row * COLS + current.col;
        document.getElementById(`tile-${currIndex}`).classList.add('flow-active');

        let currentOpenings = rotateOpeningsList(current.baseOpenings, current.currentAngle);

        DIRS.forEach(dir => {
            if (currentOpenings[dir.idx] === 1) {
                let nextRow = current.row + dir.r;
                let nextCol = current.col + dir.c;

                if (nextRow >= 0 && nextRow < ROWS && nextCol >= 0 && nextCol < COLS) {
                    let neighbor = gridTilesData[nextRow * COLS + nextCol];
                    
                    if (!neighbor.hasWater) {
                        let neighborOpenings = rotateOpeningsList(neighbor.baseOpenings, neighbor.currentAngle);
                        if (neighborOpenings[dir.opp] === 1) {
                            neighbor.hasWater = true;
                            queue.push(neighbor);
                        }
                    }
                }
            }
        });
    }

    const endTile = gridTilesData[ROWS * COLS - 1];
    const endOpenings = rotateOpeningsList(endTile.baseOpenings, endTile.currentAngle);
    
    if (endTile.hasWater && endOpenings[2] === 1) {
        if (visualFinish) visualFinish.classList.add('active');
        if (gameActive) {
            gameActive = false;
            clearInterval(timerInterval);
            
            setTimeout(() => {
                if (modalTimeValue) {
                    modalTimeValue.textContent = formatTime(secondsElapsed);
                }
                if (victoryModal) {
                    victoryModal.classList.add('visible');
                }
                
                // Audio triggers locally to comply with strict modern autoplay mechanisms
                winSound.currentTime = 0; 
                winSound.play().catch(err => console.log("Audio block context waiting interface event", err));
                
            }, 600);
        }
    }
}

function startGame() {
    gameActive = true;
    secondsElapsed = 0;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        secondsElapsed++;
        timerElement.textContent = formatTime(secondsElapsed);
    }, 1000);
}

function resetGame() {
    clearInterval(timerInterval);
    secondsElapsed = 0;
    timerElement.textContent = "00:00";
    gameActive = false;
    initGridGameBoard();
}

function closeWinModal() {
    if (victoryModal) {
        victoryModal.classList.remove('visible');
    }
}

function formatTime(seconds) {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
}

function goToHome() {
    alert("Navigating back to main campaign dashboard!");
}

initGridGameBoard();