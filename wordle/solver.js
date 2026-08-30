let fullCandidates = [];
let candidates = [];
let allowedGuesses = [];

// Load both dictionaries on startup
async function loadDictionaries() {
    try {
        // Load possible answers
        const candResponse = await fetch('cand.txt');
        const candText = await candResponse.text();
        fullCandidates = candText.split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length === 5);
        candidates = [...fullCandidates];

        // Load all allowed guesses
        const guessResponse = await fetch('guess.txt');
        const guessText = await guessResponse.text();
        allowedGuesses = guessText.split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length === 5);

        //document.getElementById('count').innerText = candidates.length;
        updateStats();
        document.getElementById('topGuesses').innerHTML = `<li style="padding: 1rem; text-align: center; color: #64748b;">Ready. Loaded ${candidates.length} candidates and ${allowedGuesses.length} valid guesses.</li>`;
    } catch (error) {
        console.error("Error loading text files.", error);
        document.getElementById('topGuesses').innerHTML = "<li style='padding: 1rem; color: red;'>Error loading dictionaries. Make sure both cand.txt and guess.txt are in the folder.</li>";
    }
}

// Generate the color pattern for a guess against a specific target word
function getPattern(guess, target) {
    let pattern = [0, 0, 0, 0, 0];
    let targetChars = target.split('');
    let guessChars = guess.split('');

    for (let i = 0; i < 5; i++) {
        if (guessChars[i] === targetChars[i]) {
            pattern[i] = 2;
            targetChars[i] = null;
            guessChars[i] = null;
        }
    }

    for (let i = 0; i < 5; i++) {
        if (guessChars[i] !== null) {
            let idx = targetChars.indexOf(guessChars[i]);
            if (idx !== -1) {
                pattern[i] = 1;
                targetChars[idx] = null;
            }
        }
    }
    return pattern.join('');
}

// Calculate the entropy for a specific guess against the remaining candidates
function calculateEntropy(guess, currentCandidates) {
    let patternCounts = {};
    
    for (let target of currentCandidates) {
        let p = getPattern(guess, target);
        patternCounts[p] = (patternCounts[p] || 0) + 1;
    }

    let entropy = 0;
    let total = currentCandidates.length;

    for (let p in patternCounts) {
        let prob = patternCounts[p] / total;
        entropy -= prob * Math.log2(prob);
    }
    return entropy;
}

// Helper function to auto-fill the clicked word
function selectWord(word) {
    document.getElementById('guessWord').value = word.toUpperCase();
    document.getElementById('pattern').focus(); 
}

// Rank ALL allowed guesses by entropy + win probability
function getBestGuesses() {
    if (candidates.length === 0) {
        document.getElementById('topGuesses').innerHTML = "<li style='padding:1rem;'>No valid words remain. Check your spelling or feedback pattern.</li>";
        return;
    }
    
    if (candidates.length === 1) {
        document.getElementById('topGuesses').innerHTML = `<li class="clickable-word" onclick="selectWord('${candidates[0]}')">
            <div><strong>${candidates[0].toUpperCase()}</strong> <span style="font-size: 0.75rem; background: var(--primary); color: white; padding: 2px 6px; border-radius: 12px; margin-left: 8px;">Winner!</span></div>
            <div class="entropy-val">Only word left</div>
        </li>`;
        return;
    }

    let results = [];
    document.getElementById('topGuesses').innerHTML = "<li style='padding: 1rem; text-align: center; color: #64748b;'>Calculating optimal moves... please wait.</li>";

    setTimeout(() => {
        for (let guess of allowedGuesses) {
            let isCand = candidates.includes(guess);
            let e = calculateEntropy(guess, candidates);
            
            // Apply a bonus to possible winners based on the number of possible winners
            let winBonus = isCand ? (1 / Math.log2(candidates.length)) : 0; 
            let score = e + winBonus;

            results.push({ 
                word: guess, 
                entropy: e,     
                score: score,   
                isCandidate: isCand
            });
        }

        // Sort by the composite SCORE descending
        results.sort((a, b) => b.score - a.score);
        
        let html = '';
        let displayLimit = Math.min(200, results.length);
        
        for (let i = 0; i < displayLimit; i++) {
            let item = results[i];
            let badge = item.isCandidate ? '<span style="font-size: 0.7rem; background: #10b981; color: white; padding: 2px 6px; border-radius: 12px; margin-left: 8px;">Possible Answer</span>' : '';
            
            html += `<li class="clickable-word" onclick="selectWord('${item.word}')">
                <div><strong>${item.word.toUpperCase()}</strong>${badge}</div>
                <div class="entropy-val">${item.entropy.toFixed(3)} bits</div>
            </li>`;
        }
        document.getElementById('topGuesses').innerHTML = html;
    }, 50); // Small delay allows the "Calculating..." UI update to render
}

// Filter the candidate list based on user feedback
function applyFeedback() {
    let guess = document.getElementById('guessWord').value.toLowerCase();
    let pattern = document.getElementById('pattern').value;

    if (guess.length !== 5 || pattern.length !== 5) {
        alert("Please enter a 5-letter word and a 5-digit pattern.");
        return;
    }

    // Winnow down the candidates list
    candidates = candidates.filter(target => getPattern(guess, target) === pattern);
    
    //document.getElementById('count').innerText = candidates.length;
    updateStats();
    document.getElementById('guessWord').value = '';
    document.getElementById('pattern').value = '';
    
    // Auto-calculate the next optimal moves
    getBestGuesses();
}

// Helper to update candidate count and win bonus display
function updateStats() {
    document.getElementById('count').innerText = candidates.length;
    
    let bonusDisplay = document.getElementById('winBonusDisplay');
    if (candidates.length <= 1) {
        bonusDisplay.innerText = "N/A";
    } else {
        let currentBonus = 1 / Math.log2(candidates.length);
        bonusDisplay.innerText = currentBonus.toFixed(3);
    }
}

// Event Listeners
document.getElementById('calculateBtn').addEventListener('click', getBestGuesses);
document.getElementById('submitFeedbackBtn').addEventListener('click', applyFeedback);

document.getElementById('resetBtn').addEventListener('click', () => {
    candidates = [...fullCandidates];
    //document.getElementById('count').innerText = candidates.length;
    updateStats();
    document.getElementById('topGuesses').innerHTML = "<li style='padding:1rem; text-align:center;'>Reset complete.</li>";
});

// "Enter" key shortcuts
document.getElementById('guessWord').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') applyFeedback();
});
document.getElementById('pattern').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') applyFeedback();
});

// Initialize
loadDictionaries();