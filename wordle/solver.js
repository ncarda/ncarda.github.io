let fullDictionary = [];
let candidates = [];

// Load the dictionary on startup
async function loadDictionary() {
    try {
        const response = await fetch('cand.txt');
        const text = await response.text();
        fullDictionary = text.split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length === 5);
        candidates = [...fullDictionary];
        document.getElementById('count').innerText = candidates.length;
        document.getElementById('topGuesses').innerHTML = "<li>Ready. Click 'Calculate' to evaluate all valid words.</li>";
    } catch (error) {
        console.error("Error loading cand.txt. Are you running a local server?", error);
        document.getElementById('topGuesses').innerHTML = "<li>Error loading dictionary. Check the console.</li>";
    }
}

// Generate the color pattern for a guess against a specific target word
function getPattern(guess, target) {
    let pattern = [0, 0, 0, 0, 0];
    let targetChars = target.split('');
    let guessChars = guess.split('');

    // First pass: Find exact matches (Greens - 2)
    for (let i = 0; i < 5; i++) {
        if (guessChars[i] === targetChars[i]) {
            pattern[i] = 2;
            targetChars[i] = null;
            guessChars[i] = null;
        }
    }

    // Second pass: Find partial matches (Yellows - 1)
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

// Rank ALL remaining valid words by entropy
function getBestGuesses() {
    if (candidates.length === 0) {
        document.getElementById('topGuesses').innerHTML = "<li>No valid words remain. Check your spelling or feedback pattern.</li>";
        return;
    }
    
    if (candidates.length === 1) {
        document.getElementById('topGuesses').innerHTML = `<li><strong>${candidates[0].toUpperCase()}</strong> (It is the only word left!)</li>`;
        return;
    }

    let results = [];
    document.getElementById('topGuesses').innerHTML = "<li>Calculating... please wait.</li>";

    setTimeout(() => {
        // Evaluate ONLY the remaining valid candidates
        for (let guess of candidates) {
            let e = calculateEntropy(guess, candidates);
            results.push({ word: guess, entropy: e });
        }

        // Sort by highest entropy descending
        results.sort((a, b) => b.entropy - a.entropy);
        
        // Display ALL remaining candidates
// Display ALL remaining candidates with click events
        let html = '';
        for (let item of results) {
            html += `<li class="clickable-word" onclick="selectWord('${item.word}')"><strong>${item.word.toUpperCase()}</strong> (Entropy: ${item.entropy.toFixed(3)} bits)</li>`;
        }
        document.getElementById('topGuesses').innerHTML = html;
    }, 50);
}

// Filter the candidate list based on user feedback
function applyFeedback() {
    let guess = document.getElementById('guessWord').value.toLowerCase();
    let pattern = document.getElementById('pattern').value;

    if (guess.length !== 5 || pattern.length !== 5) {
        alert("Please enter a 5-letter word and a 5-digit pattern.");
        return;
    }

    // Keep only candidates that would produce the EXACT SAME pattern
    candidates = candidates.filter(target => getPattern(guess, target) === pattern);
    
    document.getElementById('count').innerText = candidates.length;
    document.getElementById('guessWord').value = '';
    document.getElementById('pattern').value = '';
    
    // Auto-calculate the next best guesses for the new, smaller list
    getBestGuesses();
}
function selectWord(word) {
    document.getElementById('guessWord').value = word.toUpperCase();
    document.getElementById('pattern').focus(); 
}
// Event Listeners
document.getElementById('calculateBtn').addEventListener('click', getBestGuesses);
document.getElementById('submitFeedbackBtn').addEventListener('click', applyFeedback);
document.getElementById('resetBtn').addEventListener('click', () => {
    candidates = [...fullDictionary];
    document.getElementById('count').innerText = candidates.length;
    document.getElementById('topGuesses').innerHTML = "<li>Reset complete.</li>";
});
// Trigger submit when pressing Enter in the Guess Word box
document.getElementById('guessWord').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        applyFeedback();
    }
});

// Trigger submit when pressing Enter in the Pattern box
document.getElementById('pattern').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        applyFeedback();
    }
});

// Initialize
loadDictionary();