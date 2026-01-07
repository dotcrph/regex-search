var currentTab;
var lastRegexInput = null;
var lastFlagsInput = null;

async function checkTabConnection(tab) {
    try {
        const response = await chrome.tabs.sendMessage(
            tab.id, { action: "CHECK_CONNECTION" }
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
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["content.js"] 
        });

        console.debug("Injected content script in tab id", tabId);
    } catch (e) {
        console.warn("Failed to inject content script into tab " 
                        + tabId + "(" + e + ")");
    }
}

function validateCurrentTab() {
    if (currentTab === null || currentTab === undefined) {
        console.error(`Current tab is ${currentTab}!`);
        return false;
    }

    return true;
}

function toggleAsterisk() {
    asterisk.hidden = lastRegexInput === null 
                      || regexField.value === lastRegexInput;
}

function toggleSelectionButtons(isEnabled) {
    bNext.disabled = !isEnabled;
    bPrev.disabled = !isEnabled;
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

async function updateSelectionIndex() {
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

    if (!response) return;

    toggleSelectionButtons(response.matches !== null
                           && response.matches !== 0);

    matchCounter.textContent = response.matches ?? "";

    await updateSelectionIndex();
}

document.addEventListener('DOMContentLoaded', async (event) => {
    const tabs = await chrome.tabs.query({ 
        active: true,
        currentWindow: true 
    });

    const newTab = tabs[0];

    let isConnected = await checkTabConnection(newTab);

    if (!isConnected) {
        await injectContentScript(newTab.id); 

        // FIXME: do this in literally any other way
        await new Promise(resolve => setTimeout(resolve, 10));

        isConnected = await checkTabConnection(newTab);

        if (!isConnected) {
            errorText.textContent = "Failed to connect to this tab, try another :(";
            return;
        }
    }

    dMain.hidden = false;
    dError.hidden = true;

    currentTab = newTab;
    console.debug("Current tab: ", currentTab);

    await updateCounters();
    await updateLastInput();

    toggleAsterisk();
    regexField.focus();
});

regexField.addEventListener('input', toggleAsterisk);

function quickSearch() {
    if (!validateCurrentTab()) return;

    lastRegexInput = regexField.value;
    asterisk.hidden = true;

    chrome.tabs.sendMessage(
        currentTab.id, 
        {
            action: "QUICK_SEARCH",
            regex: regexField.value,
            flags: flagsField.value
        }
    );

    console.debug("Sent QUICK_SEARCH for id " + currentTab.id);

    updateCounters();
}

function clearMatches() {
    if (!validateCurrentTab()) return;

    chrome.tabs.sendMessage(
        currentTab.id, { action: "CLEAR_MATCHES", }
    );

    console.debug("Sent CLEAR_MATCHES for id " + currentTab.id);

    updateCounters();
}

function showNext() {
    if (!validateCurrentTab()) return;

    chrome.tabs.sendMessage(
        currentTab.id, { action: "SHOW_NEXT" }
    );

    console.debug("Sent SHOW_NEXT for id " + currentTab.id);

    updateSelectionIndex();
}

function showPrev() {
    if (!validateCurrentTab()) return;

    chrome.tabs.sendMessage(
        currentTab.id, { action: "SHOW_PREV" }
    );

    console.debug("Sent SHOW_PREV for id " + currentTab.id);

    updateSelectionIndex();
}

bQuicksearch.addEventListener("click", quickSearch);
bClear.addEventListener("click", clearMatches);
bNext.addEventListener("click", showNext);
bPrev.addEventListener("click", showPrev);

document.addEventListener('keydown', (event) => {
    if (event.target === regexField || event.target === flagsField) {
        switch (event.key) {
            case "Enter":
                if (regexField.value !== "") {
                    document.activeElement?.blur();
                    quickSearch();
                    break;
                }

                regexField.value = regexField.value === ""
                                   ? lastRegexInput ?? ""
                                   : regexField.value;

                flagsField.value = flagsField.value === ""
                                   ? lastFlagsInput ?? ""
                                   : flagsField.value;

                break;
            case "Tab":
                if (event.target !== flagsField) break;

                window.requestAnimationFrame(() => {
                    regexField.focus();
                }); // because it will tab twice

                break;
        }

        return;
    }

    switch (event.key) {
        /*E*/ case "g":
        /*V*/ case "q":
            window.requestAnimationFrame(() => {
                regexField.focus();
            }); // because it will insert q/g in the text field
            clearMatches();
            break;

        /*E*/ case "s":
        /*V*/ case "j":
        /*EV*/ case "n":
        /*G*/ case "ArrowDown":
            showNext();
            break;

        /*E*/ case "r":
        /*E*/ case "p":
        /*V*/ case "k":
        /*V*/ case "N":
        /*G*/ case "ArrowUp":
            showPrev();
            break;

        /*EVG*/ case "Enter":
            window.close();
            break;
    }
});
