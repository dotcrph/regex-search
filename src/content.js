(() => {
    if (window.hasRun) {
        return;
    }
    window.hasRun = true;

    var matches = null;

    const selectionNodeIterator = document.createNodeIterator(
        document.body, 
        NodeFilter.SHOW_ELEMENT, 
        {
            acceptNode(node) {
                return matches.includes(node) 
                       ? NodeFilter.FILTER_ACCEPT 
                       : NodeFilter.FILTER_REJECT;
            }
        }
    );
    var lastSelection = null;

    const colors = ["yellow", "blue", "red", "aqua", "lime", "fuchsia"];
    var lastColor = 0;

    var lastRegex = null;

    function sanitizeInputRegex(str) {
        const emptyRegex = /^[\^\$]*$/

        if (str === "" 
            || str === "\\B"
            || emptyRegex.test(str)) {
            return null;
        }

        return str;
    }

    function getSelectionIndex() {
        if (matches === null) return null;
        let index = matches.indexOf(lastSelection)
        return (index >= 0) ? index : null;
    }

    function selectTextInElement(element) {
        const selection = window.getSelection();
        const range = document.createRange();

        range.selectNodeContents(element); 

        selection.removeAllRanges();
        selection.addRange(range);
    }

    function clearPreviousMatches() {
        if (matches === null) return;

        for (const span of matches) {
            if (span === null || span === undefined) {
                console.warn("Lost a reference to span, continuing");
                continue;
            }

            if (span.parentNode === null || span.parentNode === undefined) {
                console.warn("Span does not have a parent node, continuing");
                continue;
            }

            const spanText = span.textContent;
            const newText = document.createTextNode(spanText);

            span.replaceWith(newText);
            newText.parentNode.normalize();
        }

        matches = null;
        lastColor = 0;
    }

    function highlightMatches(regexStr) {
        regexStr = sanitizeInputRegex(regexStr);
        if (regexStr === null) return;

        lastRegex = regexStr;

        const regex = new RegExp(regexStr, 'dg');
        console.log("Highlighting matches for: ", regex);

        const nodeIterator = document.createNodeIterator(
            document.body, 
            NodeFilter.SHOW_TEXT, 
            {
                acceptNode(node) {
                    return node.parentElement !== null
                           && node.parentElement.checkVisibility()
                           && regex.test(node.textContent)
                           ? NodeFilter.FILTER_ACCEPT 
                           : NodeFilter.FILTER_REJECT;
                }
            }
        );

        let matchedNodes = [];
        let node;
        while ((node = nodeIterator.nextNode())) {
            console.log("Found match in node: ", node);
            matchedNodes.push(node);
        }

        matches ??= [];

        for (const node of matchedNodes) {
            let regexExec;
            let leftoverNode = node;
            while ((regexExec = regex.exec(leftoverNode.textContent)) !== null) {
                console.log("Operating on node: ", leftoverNode);
                console.log("Match: ", regexExec);

                const startIndex = regexExec.indices[0][0];
                const endIndex = regexExec.indices[0][1];

                const matchLength = endIndex - startIndex;

                leftoverNode = leftoverNode.splitText(startIndex);

                const newSpan = document.createElement("span");
                newSpan.textContent = leftoverNode.nodeValue.substring(0, matchLength);
                newSpan.title = "/" + regexStr + "/";
                newSpan.style.backgroundColor = colors[lastColor];
                newSpan.style.outline = "1px solid " + colors[lastColor];

                leftoverNode.parentNode.insertBefore(newSpan, leftoverNode);
                leftoverNode.nodeValue = leftoverNode.nodeValue.substring(matchLength);

                console.log("Created new span and text node: ", leftoverNode);

                matches.push(newSpan);
                regex.lastIndex = 0;
            }
        }

        lastSelection = null;
        lastColor = (lastColor + 1) % colors.length;
        console.log("Generated match table:", matches);
    }

    function selectMatch(regexStr, isNext) {
        if (matches === null || matches.length === 0) {
            return;
        }

        var newSelection;
        if (isNext) {
            newSelection = selectionNodeIterator.nextNode();
            if (newSelection == lastSelection) {
                newSelection = selectionNodeIterator.nextNode();
            }
        } else {
            newSelection = selectionNodeIterator.previousNode();
            if (newSelection == lastSelection) {
                newSelection = selectionNodeIterator.previousNode();
            }
        }

        console.log(newSelection);
        if (newSelection === null) return;

        selectTextInElement(newSelection);
        newSelection.scrollIntoView({ block: 'center' });

        lastSelection = newSelection;

        if (lastSelection === null) {
            console.warn("Selection node iterator accepted a node "
                         + "that was not found in matches!");
        }
    }

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
            case "QUICKSEARCH": 
                clearPreviousMatches();
                highlightMatches(message.regex);
                break;
            case "HIGHLIGHT": 
                highlightMatches(message.regex);
                break;
            case "CLEAR_HIGHLIGHT": 
                clearPreviousMatches();
                break;
            case "SHOW_NEXT": 
                selectMatch(message.regex, true);
                break;
            case "SHOW_PREV": 
                selectMatch(message.regex, false);
                break;

            case "GET_LAST_REGEX":
                sendResponse({ lastRegex: lastRegex });
                break;
            case "GET_MATCHES":
                sendResponse({ matches: matches ? matches.length : null });
                break;
            case "GET_SELECTION":
                sendResponse({ selection: getSelectionIndex() });
                break;

            default:
                console.error(`Unknown message from popup.js ${message.action}!`);
                break;
        }
    });
})();
