var currentTab;
var lastRegexInput = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function validateCurrentTab() {
    if (currentTab === null || currentTab === undefined) {
        console.error(`Current tab is ${currentTab}!`);
        return false;
    }

    return true;
}

function updateOnRegexClean(isClean) {
    if (isClean !== false && isClean !== true) {
        isClean = lastRegexInput === null || regexField.value === lastRegexInput;
    }

    asterisk.hidden = isClean;
}

function updateRegexHint() {
    browser.tabs.sendMessage(
        currentTab.id,
        {
            action: "GET_LAST_REGEX"
        },
        (response) => {
            if (!response) return;

            regexField.placeholder = response.lastRegex ?? "regex" ;
        }
    );
}

function updateSelection() {
    browser.tabs.sendMessage(
        currentTab.id,
        {
            action: "GET_SELECTION"
        },
        (response) => {
            if (!response) return;

            selection.innerText = response.selection !== null 
                                  ? response.selection + 1 : "";
        }
    );
}

function updateCounters() {
    browser.tabs.sendMessage(
        currentTab.id,
        {
            action: "GET_MATCHES"
        },
        (response) => {
            if (!response) return;

            matchCounter.innerText = response.matches ?? "";
        }
    );

    updateSelection();
}

document.addEventListener('DOMContentLoaded', async (event) => {
    updateOnRegexClean(true);

    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        currentTab = tabs[0]; 
    });

    await sleep(20); // because browser.tabs.query just cant be async for whatever reason

    console.log("Current tab: ", currentTab);

    updateCounters();
    updateRegexHint();
});


regexField.addEventListener('input', updateOnRegexClean);

function quickSearch() {
    if (!validateCurrentTab()) return;

    lastRegexInput = regexField.value;
    updateOnRegexClean(true);

    browser.tabs.sendMessage(
        currentTab.id, 
        {
            action: "QUICKSEARCH",
            regex: regexField.value
        }
    );

    console.log("Sent QUICKSEARCH for id " + currentTab.id);

    updateCounters();
}

function highlight() {
    if (!validateCurrentTab()) return;

    lastRegexInput = regexField.value;
    updateOnRegexClean(true);

    browser.tabs.sendMessage(
        currentTab.id, 
        {
            action: "HIGHLIGHT",
            regex: regexField.value
        }
    );

    console.log("Sent HIGHLIGHT for id " + currentTab.id);

    updateCounters();
}

function clear() {
    if (!validateCurrentTab()) return;

    lastRegexInput = null;
    updateOnRegexClean(true);
    matchCounter.innerText = "";
    selection.innerText = "";

    browser.tabs.sendMessage(
        currentTab.id, 
        {
            action: "CLEAR_HIGHLIGHT",
        }
    );

    console.log("Sent CLEAR_HIGHLIGHT for id " + currentTab.id);
}

function showNext() {
    if (!validateCurrentTab()) return;

    browser.tabs.sendMessage(
        currentTab.id, 
        {
            action: "SHOW_NEXT"
        }
    );

    console.log("Sent SHOW_NEXT for id " + currentTab.id);

    updateSelection();
}

function showPrev() {
    if (!validateCurrentTab()) return;

    browser.tabs.sendMessage(
        currentTab.id, 
        {
            action: "SHOW_PREV"
        }
    );

    console.log("Sent SHOW_PREV for id " + currentTab.id);

    updateSelection();
}

bQuicksearch.addEventListener("click", quickSearch);
bHighlight.addEventListener("click", highlight);
bClear.addEventListener("click", clear);
bNext.addEventListener("click", showNext);
bPrev.addEventListener("click", showPrev);

document.addEventListener('keydown', (event) => {
    if (event.key === "Enter") {
        quickSearch();
        return;
    }

    if (event.target === regexField) return;

    switch (event.key) {
        case "s":
        case "j":
        case "n":
        case "ArrowDown":
            showNext();
            break;

        case "r":
        case "k":
        case "N":
        case "ArrowUp":
            showPrev();
            break;
    }
});
