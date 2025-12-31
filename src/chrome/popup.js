var currentTab;
var lastRegexInput = null;
var lastFlagsInput = null;

async function checkConnection(tab) {
    try {
        const response = await chrome.tabs.sendMessage(
            tab.id, 
            { action: "CHECK_CONNECTION" }
        );

        if (response !== true) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

async function injectContentScript(tabId) {
    try {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ["content.js"] 
            });

            console.log("Injected content script in tab id", tabId);

            return;
        } catch (e) {
            console.warn("Failed to inject content script into tab " 
                            + tabId + "(" + e + ")");
            return;
        }
    } catch (e) {
        console.warn("Something happened while injecting content scripts. Chances are you aren't using Chromium, and in that case you can ignore this error, otherwise see this:\n"
                        + e);
        return
    }
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
        isClean = lastRegexInput === null 
                  || regexField.value === lastRegexInput;
    }

    asterisk.hidden = isClean;
}

async function updateLastInput() {
    const response = await chrome.tabs.sendMessage(
        currentTab.id, { action: "GET_LAST_INPUT" }
    );

    if (!response) return;
    lastRegexInput = response.lastRegex;
    regexField.placeholder = lastRegexInput ?? "regex" ;
    lastFlagsInput = response.lastFlags;
    flagsField.placeholder = lastFlagsInput ?? "flags" ;
}

async function updateSelection() {
    const response = await chrome.tabs.sendMessage(
        currentTab.id, { action: "GET_SELECTION" }
    );

    if (!response) return;

    selection.textContent = response.selection !== null 
                          ? response.selection + 1 : "";
}

async function updateCounters() {
    const response = await chrome.tabs.sendMessage(
        currentTab.id, { action: "GET_MATCHES" }
    );

    if (!response || !response.matches) return;
    matchCounter.textContent = response.matches ?? "";

    await updateSelection();
}

document.addEventListener('DOMContentLoaded', async (event) => {
    const tabs = await chrome.tabs.query({ 
        active: true,
        currentWindow: true 
    });

    const newTab = tabs[0];

    let isConnected = await checkConnection(newTab);

    if (!isConnected) {
        // Trying to inject the content script manually here,
        // because chrome just wont do it automatically for old
        // tabs for whatever reason?
        await injectContentScript(newTab.id);

        await new Promise(resolve => setTimeout(resolve, 10));

        isConnected = await checkConnection(newTab);

        if (!isConnected) {
            errorText.textContent = "Failed to connect to this tab, try another :(";
            return;
        }
    }

    dMain.hidden = false;
    dError.hidden = true;

    currentTab = newTab;
    console.log("Current tab: ", currentTab);

    await updateCounters();
    await updateLastInput();

    updateOnRegexClean();
});


regexField.addEventListener('input', updateOnRegexClean);

function quickSearch() {
    if (!validateCurrentTab()) return;

    lastRegexInput = regexField.value;
    updateOnRegexClean(true);

    chrome.tabs.sendMessage(
        currentTab.id, 
        {
            action: "QUICKSEARCH",
            regex: regexField.value,
            flags: flagsField.value
        }
    );

    console.log("Sent QUICKSEARCH for id " + currentTab.id);

    updateCounters();
}

function clear() {
    if (!validateCurrentTab()) return;

    chrome.tabs.sendMessage(
        currentTab.id, { action: "CLEAR_HIGHLIGHT", }
    );

    console.log("Sent CLEAR_HIGHLIGHT for id " + currentTab.id);

    updateCounters(); // TODO: await for clearPreviousMatches() to finish
}

function showNext() {
    if (!validateCurrentTab()) return;

    chrome.tabs.sendMessage(
        currentTab.id, { action: "SHOW_NEXT" }
    );

    console.log("Sent SHOW_NEXT for id " + currentTab.id);

    updateSelection();
}

function showPrev() {
    if (!validateCurrentTab()) return;

    chrome.tabs.sendMessage(
        currentTab.id, { action: "SHOW_PREV" }
    );

    console.log("Sent SHOW_PREV for id " + currentTab.id);

    updateSelection();
}

bQuicksearch.addEventListener("click", quickSearch);
bClear.addEventListener("click", clear);
bNext.addEventListener("click", showNext);
bPrev.addEventListener("click", showPrev);

document.addEventListener('keydown', (event) => {
    if (event.key === "Enter") {
        quickSearch();
        return;
    }

    if (event.target === regexField
        || event.target === flagsField) return;

    switch (event.key) {
        case "s":
        case "v":

        case "j":
        case "n":
        case "ArrowDown":
            showNext();
            break;

        case "r":
        case "p":
        case "V":

        case "k":
        case "N":
        case "ArrowUp":
            showPrev();
            break;
    }
});
