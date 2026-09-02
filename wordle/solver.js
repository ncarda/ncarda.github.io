const WordleSolver = (() => {

    // ==========================
    // Constants
    // ==========================
    const ENTROPY_SKIP_THRESHOLD = 5000000;
    const DISPLAY_LIMIT = 250;

    // ==========================
    // State
    // ==========================
    let masterDictionary = [];
    let fullCandidates = [];
    let candidates = [];
    let guessPool = [];
    let allowedGuesses = [];
    let currentLength = 5;

    // Precomputed per-length arrays
    let wordArrays = {};        // word -> array of chars
    let patternCache = {};      // guess -> target -> pattern
    let entropyCache = {};      // candidateCount -> guess -> entropy

    // ==========================
    // DOM Cache
    // ==========================
    const DOM = {
        tg: document.getElementById("topGuesses"),
        count: document.getElementById("count"),
        maxEvalCount: document.getElementById("maxEvalCount"),
        bonusDisplay: document.getElementById("winBonusDisplay"),
        wordLength: document.getElementById("wordLength"),
        guessWord: document.getElementById("guessWord"),
        pattern: document.getElementById("pattern"),
        calculateBtn: document.getElementById("calculateBtn"),
        submitBtn: document.getElementById("submitFeedbackBtn"),
        resetBtn: document.getElementById("resetBtn"),
        hardModeToggle: document.getElementById("hardModeToggle")
    };

    // ==========================
    // Helper: Build badge
    // ==========================
    const badge = (text, color) =>
        `<span class="badge-${color}">${text}</span>`;

    // ==========================
    // Helper: Build list item
    // ==========================
    const listItem = (word, entropy, isCandidate) => `
        <li class="clickable-word" onclick="WordleSolver.selectWord('${word}')">
            <div>
                <strong>${word.toUpperCase()}</strong>
                ${candidates.length === 1 ? badge("Winner!", "blue") : isCandidate ? badge("Possible Answer", "green") : ""}
            </div>
            <div class="entropy-val">${entropy === null ? "N/A" : `${entropy.toFixed(3)} bits`}</div>
        </li>`;

    // ==========================
    // Dictionary Loading
    // ==========================
    async function loadDictionary() {
        try {
            const response = await fetch("/wordle/wordl.txt");
            if (!response.ok) throw new Error("Dictionary missing");

            const text = await response.text();
            masterDictionary = text.split("\n")
                .map(w => w.trim().toLowerCase())
                .filter(w => w.length >= 4 && w.length <= 11);

            const initialLen = DOM.wordLength ? DOM.wordLength.value : 5;
            preloadWordArrays();
            setWordLength(initialLen);

        } catch (e) {
            console.error("Error loading dictionary", e);
            if (DOM.tg) {
                DOM.tg.innerHTML = `<li class="error-message">Error loading dictionary.</li>`;
            }
        }
    }

    // ==========================
    // Precompute char arrays
    // ==========================
    function preloadWordArrays() {
        wordArrays = {};
        for (const word of masterDictionary) {
            wordArrays[word] = [...word];
        }
    }

    // ==========================
    // Reset caches when word length changes
    // ==========================
    function clearCaches() {
        patternCache = {};
        entropyCache = {};
    }

    // ==========================
    // Word Length Handling
    // ==========================
    function setWordLength(len) {
        currentLength = Number(len);
        clearCaches();

        const list = masterDictionary.filter(w => w.length === currentLength);
        fullCandidates = [...list];
        candidates = [...list];
        allowedGuesses = [...list];

        if (DOM.guessWord && DOM.pattern) {
            DOM.guessWord.maxLength = currentLength;
            DOM.pattern.maxLength = currentLength;

            DOM.guessWord.placeholder = `e.g. ${"A".repeat(currentLength)}`;
            DOM.pattern.placeholder = `e.g. ${"0".repeat(currentLength - 1)}2`;

            DOM.guessWord.value = "";
            DOM.pattern.value = "";
        }

        updateStats();

        if (DOM.tg) {
            DOM.tg.innerHTML =
                `<li class="center-note">Ready. ${candidates.length} words loaded.</li>`;
        }
    }

    // ==========================
    // High-performance pattern generator
    // ==========================
    function getPattern(guess, target) {
        if (!patternCache[guess]) patternCache[guess] = {};
        if (patternCache[guess][target]) return patternCache[guess][target];

        const gArr = wordArrays[guess];
        const tArr = wordArrays[target];

        const len = currentLength;
        const result = new Array(len).fill(0);

        // Frequency map for yellow-phase
        const freq = {};
        for (let i = 0; i < len; i++) {
            const c = tArr[i];
            freq[c] = (freq[c] || 0) + 1;
        }

        // Green pass
        for (let i = 0; i < len; i++) {
            if (gArr[i] === tArr[i]) {
                result[i] = 2;
                freq[gArr[i]]--;
            }
        }

        // Yellow pass
        for (let i = 0; i < len; i++) {
            if (result[i] === 0) {
                const c = gArr[i];
                if (freq[c] > 0) {
                    result[i] = 1;
                    freq[c]--;
                }
            }
        }

        const pattern = result.join("");
        patternCache[guess][target] = pattern;
        return pattern;
    }

    // ==========================
    // Optimized entropy function with caching
    // ==========================
    function calculateEntropy(guess, candidateList) {
        const countKey = candidateList.length;

        if (!entropyCache[countKey]) entropyCache[countKey] = {};
        if (entropyCache[countKey][guess]) return entropyCache[countKey][guess];

        const patternCounts = Object.create(null);

        let sum = 0;
        const total = candidateList.length;

        for (const target of candidateList) {
            const p = getPattern(guess, target);
            patternCounts[p] = (patternCounts[p] || 0) + 1;
        }

        for (const p in patternCounts) {
            const prob = patternCounts[p] / total;
            sum -= prob * Math.log2(prob);
        }

        entropyCache[countKey][guess] = sum;
        return sum;
    }

    // ==========================
    // Select Word
    // ==========================
    function selectWord(word) {
        if (DOM.guessWord && DOM.pattern) {
            DOM.guessWord.value = word.toUpperCase();
            DOM.pattern.focus();
        }
    }

    // ==========================
    // Main Entropy Ranking
    // ==========================
    function getBestGuesses() {
        if (!DOM.tg) return;

        if (candidates.length === 0) {
            DOM.tg.innerHTML =
                `<li class="center-note">No valid words remain.</li>`;
            return;
        }

        if (candidates.length === 1) {
            DOM.tg.innerHTML = listItem(candidates[0], null, true)
                .replace("N/A", "Only word left");
            return;
        }

        DOM.tg.innerHTML =
            `<li class="center-note">Computing optimal guesses...</li>`;

        setTimeout(() => {
            const candidateSet = new Set(candidates);
            const results = [];
            
            // Switch evaluation pool based on Hard Mode toggle
            const guessPool = (DOM.hardModeToggle && DOM.hardModeToggle.checked) 
                ? candidates 
                : allowedGuesses;

            const len = guessPool.length;
            const maxItems = Math.floor(ENTROPY_SKIP_THRESHOLD / guessPool.length);
            const startIndex = len > maxItems ? Math.floor(Math.random() * (len - maxItems + 1)) : 0;
            const endIndex = Math.min(len, startIndex + maxItems);

            for (let i = startIndex; i < endIndex; i++) {
                const guess = guessPool[i];
                const entropy = calculateEntropy(guess, guessPool);
                const isCandidate = candidateSet.has(guess);
                const winBonus = isCandidate ? (1 / Math.log2(len)) : 0;

                results.push({
                    word: guess,
                    entropy,
                    isCandidate,
                    score: entropy + winBonus
                });
            }
            
            results.sort((a, b) => b.score - a.score);

            DOM.tg.innerHTML = results
                .slice(0, DISPLAY_LIMIT)
                .map(r => listItem(r.word, r.entropy, r.isCandidate))
                .join("");
        }, 30);
    }

    // ==========================
    // Apply Feedback
    // ==========================
    function applyFeedback() {
        if (!DOM.guessWord || !DOM.pattern) return;

        const guess = DOM.guessWord.value.toLowerCase();
        const pattern = DOM.pattern.value;

        if (guess.length !== currentLength || pattern.length !== currentLength) {
            alert(`Please enter a ${currentLength}-letter guess and pattern.`);
            return;
        }
        
        // Optional hard mode enforcement for manual input
        if (DOM.hardModeToggle && DOM.hardModeToggle.checked && !candidates.includes(guess)) {
            alert("Hard Mode is enabled. You can only guess words that are possible remaining answers.");
            return;
        }

        candidates = candidates.filter(
            target => getPattern(guess, target) === pattern
        );

        updateStats();
        DOM.guessWord.value = "";
        DOM.pattern.value = "";
        getBestGuesses();
    }

    // ==========================
    // Stats Update
    // ==========================
    function updateStats() {
        if (DOM.count) DOM.count.innerText = candidates.length;
        if (DOM.maxEvalCount) DOM.maxEvalCount.innerText = Math.ceil(ENTROPY_SKIP_THRESHOLD / guessPool.length);

        if (DOM.bonusDisplay) {
            DOM.bonusDisplay.innerText =
                candidates.length <= 1
                    ? "N/A"
                    : (1 / Math.log2(candidates.length)).toFixed(3);
        }
    }

    // ==========================
    // Event Listeners
    // ==========================
    DOM.wordLength?.addEventListener("change", e => setWordLength(e.target.value));
    DOM.calculateBtn?.addEventListener("click", getBestGuesses);
    DOM.submitBtn?.addEventListener("click", applyFeedback);

    DOM.resetBtn?.addEventListener("click", () => {
        candidates = [...fullCandidates];
        updateStats();

        if (DOM.guessWord) DOM.guessWord.value = "";
        if (DOM.pattern) DOM.pattern.value = "";

        if (DOM.tg)
            DOM.tg.innerHTML = `<li class="center-note">Reset complete.</li>`;
    });

    // Enter key shortcuts
    DOM.guessWord?.addEventListener("keydown", e => {
        if (e.key === "Enter") applyFeedback();
    });

    DOM.pattern?.addEventListener("keydown", e => {
        if (e.key === "Enter") applyFeedback();
    });

    // ==========================
    // Initialize
    // ==========================
    loadDictionary();

    return { selectWord };

})();