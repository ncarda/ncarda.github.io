let masterDictionary = [];
let fullCandidates = [];
let candidates = [];
let allowedGuesses = [];
let currentLength = 5;

async function loadDictionary() {
    try {
        const response = await fetch('/wordle/wordl.txt');
        if (!response.ok) throw new Error("Dictionary file not found");
        const text = await response.text();
        
        masterDictionary = text.split('\n')
            .map(w => w.trim().toLowerCase())
            .filter(w => w.length >= 4 && w.length <= 11);

        const wordLengthSelect = document.getElementById('wordLength');
        const initialLength = wordLengthSelect ? wordLengthSelect.value : 5;
        setWordLength(initialLength);
    } catch (error) {
        console.error("Error loading text file.", error);
        const tg = document.getElementById('topGuesses');
        if (tg) tg.innerHTML = "<li style='padding: 1rem; color: red;'>Error loading dictionary. Make sure wordl.txt is in the folder and you are running via a local web server (not file://).</li>";
    }
}

function setWordLength(len) {
    currentLength = parseInt(len);
    
    let wordsOfLength = masterDictionary.filter(w => w.length === currentLength);
    
    fullCandidates = [...wordsOfLength];
    candidates = [...wordsOfLength];
    allowedGuesses = [...wordsOfLength];

    const guessInput = document.getElementById('guessWord');
    const patternInput = document.getElementById('pattern');
    
    if (guessInput && patternInput) {
        guessInput.setAttribute('maxlength', currentLength);
        patternInput.setAttribute('maxlength', currentLength);
        guessInput.placeholder = `e.g. ${"A".repeat(currentLength)}`;
        patternInput.placeholder = `e.g. ${"0".repeat(currentLength - 1)}2`;
        
        guessInput.value = '';
        patternInput.value = '';
    }
    
    updateStats();
    const tg = document.getElementById('topGuesses');
    if (tg) tg.innerHTML = `<li style="padding: 1rem; text-align: center; color: #64748b;">Ready. Loaded ${candidates.length} valid words for length ${currentLength}.</li>`;
}

function getPattern(guess, target) {
    let len = guess.length;
    let pattern = new Array(len).fill(0);
    let targetChars = target.split('');
    let guessChars = guess.split('');

    for (let i = 0; i < len; i++) {
        if (guessChars[i] === targetChars[i]) {
            pattern[i] = 2;
            targetChars[i] = null;
            guessChars[i] = null;
        }
    }

    for (let i = 0; i < len; i++) {
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

function selectWord(word) {
    const guessInput = document.getElementById('guessWord');
    const patternInput = document.getElementById('pattern');
    if (guessInput && patternInput) {
        guessInput.value = word.toUpperCase();
        patternInput.focus(); 
    }
}

function getBestGuesses() {
    const tg = document.getElementById('topGuesses');
    if (!tg) return;

    if (candidates.length === 0) {
        tg.innerHTML = "<li style='padding:1rem;'>No valid words remain. Check your spelling or feedback pattern.</li>";
        return;
    }
    
    if (candidates.length === 1) {
        tg.innerHTML = `<li class="clickable-word" onclick="selectWord('${candidates[0]}')">
            <div><strong>${candidates[0].toUpperCase()}</strong> <span style="font-size: 0.75rem; background: #2563eb; color: white; padding: 2px 6px; border-radius: 12px; margin-left: 8px;">Winner!</span></div>
            <div class="entropy-val">Only word left</div>
        </li>`;
        return;
    }

    // Protection against browser crash for large datasets
    if (candidates.length > 5000) {
        tg.innerHTML = `<li style='padding: 1rem; text-align: center; color: #64748b;'>More than 5,000 candidates remain. Skipping entropy calculation to prevent freezing. Showing valid words:</li>`;
        
        let html = tg.innerHTML;
        let displayLimit = Math.min(200, candidates.length);
        
        for (let i = 0; i < displayLimit; i++) {
            let word = candidates[i];
            html += `<li class="clickable-word" onclick="selectWord('${word}')">
                <div><strong>${word.toUpperCase()}</strong><span style="font-size: 0.7rem; background: #10b981; color: white; padding: 2px 6px; border-radius: 12px; margin-left: 8px;">Possible Answer</span></div>
                <div class="entropy-val">N/A</div>
            </li>`;
        }
        tg.innerHTML = html;
        return;
    }

    let results = [];
    tg.innerHTML = "<li style='padding: 1rem; text-align: center; color: #64748b;'>Calculating optimal moves... please wait.</li>";

    setTimeout(() => {
        for (let guess of allowedGuesses) {
            let isCand = candidates.includes(guess);
            let e = calculateEntropy(guess, candidates);
            
            let winBonus = isCand ? (1 / Math.log2(candidates.length)) : 0; 
            let score = e + winBonus;

            results.push({ 
                word: guess, 
                entropy: e,     
                score: score,   
                isCandidate: isCand
            });
        }

        // Sort by score, forcing possible answers to the top when entropies are similar
        results.sort((a, b) => {
            if (Math.abs(b.entropy - a.entropy) < 0.5) {
                if (a.isCandidate && !b.isCandidate) return -1;
                if (!a.isCandidate && b.isCandidate) return 1;
            }
            return b.score - a.score;
        });
        
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
        tg.innerHTML = html;
    }, 50); 
}

function applyFeedback() {
    const guessInput = document.getElementById('guessWord');
    const patternInput = document.getElementById('pattern');
    if (!guessInput || !patternInput) return;

    let guess = guessInput.value.toLowerCase();
    let pattern = patternInput.value;

    if (guess.length !== currentLength || pattern.length !== currentLength) {
        alert(`Please enter a ${currentLength}-letter word and a ${currentLength}-digit pattern.`);
        return;
    }

    candidates = candidates.filter(target => getPattern(guess, target) === pattern);
    
    updateStats();
    guessInput.value = '';
    patternInput.value = '';
    
    getBestGuesses();
}

function updateStats() {
    const countEl = document.getElementById('count');
    const bonusDisplay = document.getElementById('winBonusDisplay');
    
    if (countEl) countEl.innerText = candidates.length;
    
    if (bonusDisplay) {
        if (candidates.length <= 1) {
            bonusDisplay.innerText = "N/A";
        } else {
            let currentBonus = 1 / Math.log2(candidates.length);
            bonusDisplay.innerText = currentBonus.toFixed(3);
        }
    }
}

// Event Listeners with Null Checks
const wordLengthSelect = document.getElementById('wordLength');
if (wordLengthSelect) {
    wordLengthSelect.addEventListener('change', (e) => setWordLength(e.target.value));
}

const calcBtn = document.getElementById('calculateBtn');
if (calcBtn) calcBtn.addEventListener('click', getBestGuesses);

const submitBtn = document.getElementById('submitFeedbackBtn');
if (submitBtn) submitBtn.addEventListener('click', applyFeedback);

const resetBtn = document.getElementById('resetBtn');
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        candidates = [...fullCandidates];
        updateStats();
        const guessInput = document.getElementById('guessWord');
        const patternInput = document.getElementById('pattern');
        if (guessInput) guessInput.value = '';
        if (patternInput) patternInput.value = '';
        
        const tg = document.getElementById('topGuesses');
        if (tg) tg.innerHTML = "<li style='padding:1rem; text-align:center;'>Reset complete.</li>";
    });
}

const guessInputEl = document.getElementById('guessWord');
if (guessInputEl) {
    guessInputEl.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') applyFeedback();
    });
}

const patternInputEl = document.getElementById('pattern');
if (patternInputEl) {
    patternInputEl.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') applyFeedback();
    });
}

// Initialize
loadDictionary();