// onboarding.js


function cleanupDecoyStar() {
    const decoy = document.getElementById('tour-decoy-star');
    if (decoy) {
        decoy.remove();
    }


    const colorDecoy = document.getElementById('tour-decoy-fill-color');
    if (colorDecoy) {
        colorDecoy.remove();
    }


    const textColorOverlay = document.getElementById('text-color-clickable-overlay');
    if (textColorOverlay) {
        textColorOverlay.remove();
    }
}


function resetPointerEvents() {
    const helperLayer = document.querySelector('.introjs-helperLayer');
    if (helperLayer) {
        helperLayer.style.pointerEvents = 'none';
    }


    const overlayLayer = document.querySelector('.introjs-overlay');
    if (overlayLayer) {
        overlayLayer.style.pointerEvents = 'none';
    }
}


function allowOnlyHighlightedClick() {
    // We now rely on lockClicks() to whitelist specific areas.
    const helperLayer = document.querySelector('.introjs-helperLayer');
    const overlayLayer = document.querySelector('.introjs-overlay');
    if (helperLayer) helperLayer.style.pointerEvents = 'none';
    if (overlayLayer) overlayLayer.style.pointerEvents = 'none';
}


function simulateRealClick(element) {
    if (!element) return;
    if (element.focus) element.focus();

    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const ev = (type, init) =>
    (type.startsWith('pointer')
        ? new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX: cx, clientY: cy, ...init })
        : new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, ...init }));

    // Natural sequence: pointerdown -> mousedown -> (delay) -> mouseup -> click -> pointerup
    element.dispatchEvent(ev('pointerdown'));
    element.dispatchEvent(ev('mousedown', { buttons: 1 }));

    setTimeout(() => {
        element.dispatchEvent(ev('mouseup'));
        element.dispatchEvent(ev('click'));
        element.dispatchEvent(ev('pointerup'));
    }, 10);
}


let _removeTransitionGuards = null;
function addTransitionGuards() {
    if (_removeTransitionGuards) return _removeTransitionGuards;
    const types = [
        'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click',
        'touchstart', 'touchend',
        'focus', 'blur', 'focusin', 'focusout',
        'keydown', 'keyup', 'keypress'
    ];
    const stop = (e) => {
        // Allow the color palette itself
        const pal = document.querySelector('.docs-material-colorpalette');
        if (pal && pal.contains(e.target)) return;


        // Allow Intro tooltip + controls (X/Back/Next/Done)
        const introUi = e.target.closest(
            '.introjs-tooltip, .introjs-tooltipReferenceLayer, ' +
            '.introjs-skipbutton, .introjs-closebutton, ' +
            '.introjs-prevbutton, .introjs-nextbutton, .introjs-donebutton'
        );
        if (introUi) return;


        // Otherwise block during transition
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
    };


    types.forEach(t => document.addEventListener(t, stop, true));
    _removeTransitionGuards = () => {
        types.forEach(t => document.removeEventListener(t, stop, true));
        _removeTransitionGuards = null;
    };
    return _removeTransitionGuards;
}


function repositionTourElements(targetElement) {
    const helperLayer = document.querySelector('.introjs-helperLayer');
    const tooltipReference = document.querySelector('.introjs-tooltipReferenceLayer');

    cleanupDecoyStar();

    if (!helperLayer || !tooltipReference || !targetElement) {
        return;
    }

    const oldShowElement = document.querySelector('.introjs-showElement');
    if (oldShowElement) {
        oldShowElement.classList.remove('introjs-showElement');
    }
    targetElement.classList.add('introjs-showElement');


    if (window.tourInstance) {
        const currentStepOptions = window.tourInstance._options.steps[window.tourInstance.currentStep()];
        if (currentStepOptions) {
            currentStepOptions.element = targetElement;
        }
    }

    const targetRect = targetElement.getBoundingClientRect();
    const padding = 5;
    helperLayer.style.width = (targetRect.width + padding) + 'px';
    helperLayer.style.height = (targetRect.height + padding) + 'px';
    helperLayer.style.top = (targetRect.top - (padding / 2)) + 'px';
    helperLayer.style.left = (targetRect.left - (padding / 2)) + 'px';


    tooltipReference.style.left = (targetRect.right + 15) + 'px';
    tooltipReference.style.top = targetRect.top + 'px';


    const realStar = targetElement.querySelector('.pin-star');

    if (realStar) {
        const decoyStar = document.createElement('div');
        decoyStar.id = 'tour-decoy-star';
        const starRect = realStar.getBoundingClientRect();
        decoyStar.style.cssText = `
    position: fixed;
    top: ${starRect.top}px;
    left: ${starRect.left}px;
    width: ${starRect.width}px;
    height: ${starRect.height}px;
    z-index: 2147483647;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  `;
        decoyStar.setAttribute('aria-hidden', 'true');
        decoyStar.setAttribute('tabindex', '-1');
        document.body.appendChild(decoyStar);

        // Make sure the lock allows the very first click right away
const menuRoot = document.querySelector('.goog-menu[role="menu"]');
setClickLockAllowList({
  nodes: [menuRoot, targetElement].filter(Boolean),
  selectors: ['#tour-decoy-star', '.pin-star']
});


        let forwarding = false;

        // Stop anything from reaching the menu
        const stop = (e) => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); };

        const forwardClick = () => {
            if (forwarding) return;
            forwarding = true;
            try {
                realStar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            } catch {
                realStar?.click?.();
            }
            setTimeout(() => { forwarding = false; }, 0);
        };

        decoyStar.addEventListener('pointerdown', stop, true);
        decoyStar.addEventListener('pointerup', (e) => { stop(e); forwardClick(); }, true);
        decoyStar.addEventListener('mouseup', (e) => { stop(e); forwardClick(); }, true);
        decoyStar.addEventListener('click', (e) => { stop(e); forwardClick(); }, true);

    }


}


function findIconPatiently(elementId, ariaLabel, wrapperSelector) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50;




        const interval = setInterval(() => {
            attempts++;
            let icon = null;




            if (elementId && elementId.startsWith('#')) {
                icon = document.getElementById(elementId.substring(1));
            }




            if (!icon && wrapperSelector) {
                const wrapper = document.querySelector(wrapperSelector);
                if (wrapper) {
                    const allElements = wrapper.querySelectorAll('*');
                    for (const el of allElements) {
                        const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase().trim();
                        if (label === ariaLabel.toLowerCase()) {
                            // Find the actual button, not just the inner box
                            // Look for the parent button or the element itself
                            let actualButton = el;
                            if (el.classList.contains('goog-toolbar-button-inner-box')) {
                                actualButton = el.closest('.goog-toolbar-button') || el.parentElement;
                            }
                            icon = actualButton;
                            break;
                        }
                    }
                }
            }




            if (icon && icon.offsetParent !== null) {
                clearInterval(interval);
                resolve(icon);
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                reject(new Error(`Element with aria-label "${ariaLabel}" not found after ${maxAttempts} attempts.`));
            }
        }, 100);
    });
}


function openColorPalette() {
    return new Promise((resolve, reject) => {
        findIconPatiently('#text-color-tool-icon', 'Text color', '#docs-toolbar-wrapper')
            .then(textColorButton => {
                simulateRealClick(textColorButton);


                let attempts = 0;
                const maxAttempts = 30;
                const waitForPalette = setInterval(() => {
                    attempts++;
                    const palette = document.querySelector('.docs-material-colorpalette');




                    if (palette && palette.offsetParent !== null) {
                        clearInterval(waitForPalette);
                        resolve(palette);
                    } else if (attempts >= maxAttempts) {
                        clearInterval(waitForPalette);
                        reject(new Error("Timeout waiting for palette"));
                    }
                }, 100);
            })
            .catch(error => {
                reject(error);
            });
    });
}


// --- Persistent global click-lock (no rebind race) ---
let _lockActive = false;
let _lockHandler = null;
let _lockAllowedNodes = new Set();
let _lockAllowedSelectors = new Set();


function _isInsideIntroButton(node) {
    // Allow ONLY the actual buttons inside the tooltip (NOT the reference layer)
    return !!(node && node.closest &&
        node.closest('.introjs-tooltip .introjs-prevbutton, .introjs-tooltip .introjs-nextbutton, .introjs-tooltip .introjs-donebutton, .introjs-tooltip .introjs-skipbutton, .introjs-tooltip .introjs-closebutton'));
}


function _isAllowedNode(node) {
    if (!node) return false;


    // Allow Intro.js buttons (back/next/done/skip/x) explicitly
    if (_isInsideIntroButton(node)) return true;


    // Allow explicit nodes
    for (const n of _lockAllowedNodes) {
        if (n && (node === n || (n.contains && n.contains(node)))) return true;
    }
    // Allow selectors
    for (const sel of _lockAllowedSelectors) {
        if (node.closest && node.closest(sel)) return true;
    }
    return false;
}


function _ensureLockBound() {
    if (_lockActive) return;


    const handler = (e) => {
        // composedPath check to handle nested DOM/shadow DOM
        const path = (typeof e.composedPath === 'function') ? e.composedPath() : [];


        let allowed = _isAllowedNode(e.target);
        if (!allowed) {
            for (const p of path) {
                if (_isAllowedNode(p)) { allowed = true; break; }
            }
        }


        if (!allowed) {
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
        }
    };


    const types = [
        'pointerdown', 'pointerup', 'click', 'mousedown', 'mouseup',
        'touchstart', 'touchend', 'contextmenu', 'keydown'
    ];
    types.forEach(t => document.addEventListener(t, handler, true));
    _lockHandler = handler;
    _lockActive = true;
}


function setClickLockAllowList({ nodes = [], selectors = [] } = {}) {
    // Update live allowlist without unbinding listeners
    _lockAllowedNodes = new Set(nodes.filter(Boolean));
    _lockAllowedSelectors = new Set(selectors.filter(Boolean));
    _ensureLockBound();
}


function unlockClicks() {
    if (!_lockActive) return;
    const types = [
        'pointerdown', 'pointerup', 'click', 'mousedown', 'mouseup',
        'touchstart', 'touchend', 'contextmenu', 'keydown'
    ];
    if (_lockHandler) {
        types.forEach(t => document.removeEventListener(t, _lockHandler, true));
    }
    _lockHandler = null;
    _lockActive = false;
    _lockAllowedNodes.clear();
    _lockAllowedSelectors.clear();
}
function closeColorPalette() {
    const palette = document.querySelector('.docs-material-colorpalette');
    if (palette && palette.offsetParent !== null) {
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            bubbles: true
        }));
    }
}
function runOnboardingTour() {
    const intro = introJs.tour();
    let storageListener = null;
    let fileClickListener = null;
    let importPlaceholder = null;
    let colorPalettePlaceholder = null;
    let currentStepHandlers = new Map();


    window.tourInstance = intro;
    let textColorPlaceholder = null;
    function createTextColorPlaceholder() {
        if (textColorPlaceholder) return textColorPlaceholder;




        textColorPlaceholder = document.createElement('div');
        textColorPlaceholder.id = 'text-color-placeholder';
        textColorPlaceholder.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: 1px; height: 1px;
    visibility: hidden;
    pointer-events: none;
    z-index: -1;
  `;
        document.body.appendChild(textColorPlaceholder);
        return textColorPlaceholder;
    }
    function createImportPlaceholder() {
        if (importPlaceholder) return importPlaceholder;
        importPlaceholder = document.createElement('div');
        importPlaceholder.id = 'import-step-placeholder';
        importPlaceholder.style.cssText = `
            position: absolute;
            top: 200px;
            left: 200px;
            width: 200px;
            height: 30px;
            visibility: hidden;
            pointer-events: none;
            z-index: -1;
        `;
        document.body.appendChild(importPlaceholder);
        return importPlaceholder;
    }


    function createColorPalettePlaceholder() {
        if (colorPalettePlaceholder) return colorPalettePlaceholder;


        colorPalettePlaceholder = document.createElement('div');
        colorPalettePlaceholder.id = 'color-palette-placeholder';
        colorPalettePlaceholder.style.cssText = `
            position: absolute;
            top: 150px;
            left: 400px;
            width: 250px;
            height: 150px;
            visibility: hidden;
            pointer-events: none;
            z-index: -1;
        `;
        document.body.appendChild(colorPalettePlaceholder);
        return colorPalettePlaceholder;
    }


    function cleanupStepHandlers(stepNumber) {
        const handlers = currentStepHandlers.get(stepNumber);
        if (handlers) {
            handlers.forEach(cleanup => {
                try {
                    cleanup();
                } catch (e) {
                    console.warn('Cleanup handler error:', e);
                }
            });
            currentStepHandlers.delete(stepNumber);
        }
    }
    function waitForImportAndAdvance() {
        if (window.tourInstance.currentStep() !== 1) return;




        window.tourInstance.nextStep();




        setTimeout(() => {
            const fileMenuButton = document.querySelector('#docs-file-menu');
            if (fileMenuButton) {
                fileMenuButton.click();
            }




            let attempts = 0;
            const findAndRepositionInterval = setInterval(() => {
                attempts++;
                const menuItems = document.querySelectorAll('.goog-menuitem-content');
                const importItem = Array.from(menuItems).find(el =>
                    el.offsetParent !== null && el.textContent.trim().toLowerCase().includes('import')
                );




                if (importItem && importItem.parentElement) {
                    clearInterval(findAndRepositionInterval);
                    repositionTourElements(importItem.parentElement);
                } else if (attempts > 20) {
                    clearInterval(findAndRepositionInterval);
                }
            }, 100);
        }, 500);
    }




    function onTourStepChange() {
        const currentStep = intro.currentStep();
        cleanupStepHandlers(currentStep - 1);
        cleanupStepHandlers(currentStep + 1);
        // Default: block all clicks except tooltip
        resetPointerEvents();
        // Step 0: Welcome screen - no interaction needed
        if (currentStep === 0) {
            resetPointerEvents();
        }
        // Step 1: Click File menu
        if (currentStep === 1) {
            allowOnlyHighlightedClick();


            const fileMenuButton = document.querySelector('#docs-file-menu');
            if (fileMenuButton) {
                if (fileClickListener) {
                    fileMenuButton.removeEventListener('click', fileClickListener);
                }

                fileClickListener = () => waitForImportAndAdvance();
                fileMenuButton.addEventListener('click', fileClickListener, { once: true });

                currentStepHandlers.set(currentStep, [
                    () => {
                        if (fileClickListener && fileMenuButton) {
                            fileMenuButton.removeEventListener('click', fileClickListener);
                            fileClickListener = null;
                        }
                    }
                ]);
            }
        }

        // Step 2: Click star on Import (menu must stay open until Import is starred)
        if (currentStep === 2) {
            allowOnlyHighlightedClick();

            // Clean any old listener
            if (storageListener) chrome.storage.onChanged.removeListener(storageListener);

            let importRowPoll = null;
            let keepMenuOpen = true;              // while on step 2, keep File menu open
            let bindButtonsInterval = null;
            let unbindPrev = null, unbindClose = null;
            let menuObserver = null;
            let starGuardCleanup = null;          // to remove capture guards on leave


            // Allow menu to close when we're leaving this step
            const allowMenuToClose = () => { keepMenuOpen = false; };

            // Reopen helper: next frame + retry in case Docs defers close
            const reopenSoon = () => {
                if (!keepMenuOpen) return;
                const btn = document.querySelector('#docs-file-menu');
                if (!btn) return;
                requestAnimationFrame(() => {
                    btn.click();
                    setTimeout(() => {
                        const open = document.querySelector('.goog-menu[role="menu"]');
                        if (!open && keepMenuOpen) btn.click();
                    }, 120);
                });
            };

            // Ensure menu stays open and focused (prevents blur-close)
            const ensureMenuOpen = () => {
                if (!keepMenuOpen) return;
                const menuRoot = document.querySelector('.goog-menu[role="menu"]');
                const isOpen = menuRoot && menuRoot.offsetParent !== null;
                if (!isOpen) {
                    reopenSoon();
                } else {
                    if (!menuRoot.hasAttribute('tabindex')) menuRoot.setAttribute('tabindex', '-1');
                    try { menuRoot.focus({ preventScroll: true }); } catch { }
                }
            };

            // Attach capture-phase guards on the current menu (ONLY swallow the decoy)
            const attachStarGuards = (menuRoot) => {
                if (!menuRoot || menuRoot._tourStarGuardsApplied) return;

                const isDecoy = (el) =>
                    !!(el && (el.id === 'tour-decoy-star' || (el.closest && el.closest('#tour-decoy-star'))));

                // CAPTURE: swallow only the decoy so outside-click logic never sees it
                const types = ['pointerdown', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'contextmenu'];
                const guard = (e) => {
                    if (isDecoy(e.target)) {
                        e.stopImmediatePropagation();
                        e.stopPropagation();
                        if (e.cancelable) e.preventDefault();
                    }
                    // IMPORTANT: do NOT block real .pin-star here — let it reach target handler
                };

                const refocusOnBlur = () => { if (keepMenuOpen) setTimeout(reopenSoon, 0); };

                types.forEach(t => menuRoot.addEventListener(t, guard, true));
                menuRoot.addEventListener('focusout', refocusOnBlur, true);
                menuRoot.addEventListener('blur', refocusOnBlur, true);

                menuRoot._tourStarGuardsApplied = true;
                starGuardCleanup = () => {
                    try {
                        types.forEach(t => menuRoot.removeEventListener(t, guard, true));
                        menuRoot.removeEventListener('focusout', refocusOnBlur, true);
                        menuRoot.removeEventListener('blur', refocusOnBlur, true);
                        delete menuRoot._tourStarGuardsApplied;
                    } catch { }
                };
            };

            // Watch for menu removal/close and reopen instantly
            try {
                menuObserver = new MutationObserver(() => {
                    const menuRoot = document.querySelector('.goog-menu[role="menu"]');
                    if (menuRoot) attachStarGuards(menuRoot);
                    if (!menuRoot && keepMenuOpen) reopenSoon();
                });
                menuObserver.observe(document.body, { childList: true, subtree: true });
            } catch { }

            // Bind Intro.js Prev/Close/Skip to allow menu to close (we're leaving step 2)
            const bindOnce = (btn, cb) => {
                if (!btn || btn._tourBound) return null;
                const handler = () => cb();
                ['pointerdown', 'mousedown', 'click', 'keydown', 'touchstart']
                    .forEach(t => btn.addEventListener(t, handler, true));
                btn._tourBound = { handler };
                return () => ['pointerdown', 'mousedown', 'click', 'keydown', 'touchstart']
                    .forEach(t => btn.removeEventListener(t, handler, true));
            };

            bindButtonsInterval = setInterval(() => {
                const prevBtn = document.querySelector('.introjs-prevbutton');
                const closeBtn = document.querySelector('.introjs-closebutton, .introjs-skipbutton');
                if (!unbindPrev && prevBtn) unbindPrev = bindOnce(prevBtn, allowMenuToClose);
                if (!unbindClose && closeBtn) unbindClose = bindOnce(closeBtn, allowMenuToClose);
            }, 50);

            // Advance only when "Import" becomes newly pinned
            storageListener = (changes, area) => {
                if (area !== 'local' || !changes.pinnedFunctions) return;
                const newPins = changes.pinnedFunctions.newValue || [];
                const oldPins = changes.pinnedFunctions.oldValue || [];
                const newImportWasPinned = newPins.some(pin =>
                    pin.toLowerCase().includes('import') && !oldPins.includes(pin)
                );
                if (newImportWasPinned) {
                    // We're advancing—allow menu to close, then close it and go next
                    allowMenuToClose();
                    unlockClicks();
                    document.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true
                    }));
                    setTimeout(() => window.tourInstance.nextStep(), 300);
                } else {
                    // If user unstars Import, reopen the menu immediately
                    const wasUnstarred = oldPins.some(pin =>
                        pin.toLowerCase().includes('import') && !newPins.includes(pin)
                    );
                    if (wasUnstarred && keepMenuOpen) {
                        // Immediately reopen - multiple attempts to beat Docs' close timing
                        reopenSoon();
                        setTimeout(reopenSoon, 10);
                        setTimeout(reopenSoon, 50);
                        setTimeout(reopenSoon, 100);
                    }
                }
            };
            chrome.storage.onChanged.addListener(storageListener);

            // Main poller: keep menu open, highlight Import row, and lock clicks to menu/decoy star
            importRowPoll = setInterval(() => {
                if (window.tourInstance?.currentStep?.() !== 2) {
                    clearInterval(importRowPoll);
                    return;
                }

                ensureMenuOpen();

                const menuRoot = document.querySelector('.goog-menu[role="menu"]');
                if (menuRoot) attachStarGuards(menuRoot);

                const allowNodes = [];
                if (menuRoot && menuRoot.offsetParent !== null) {
                    allowNodes.push(menuRoot); // trap clicks inside the open menu
                }

                // Find visible "Import"
                const importRowContent = Array.from(document.querySelectorAll('.goog-menuitem-content'))
                    .find(el => el.offsetParent !== null && /(^|\s)import(\s|$)/i.test(el.textContent.trim()));

                if (importRowContent?.parentElement) {
                    const rowEl = importRowContent.parentElement;
                    repositionTourElements(rowEl);
                    allowNodes.push(rowEl);

                    if (!rowEl._tourStarRowBubblePatch) {
                        rowEl._tourStarRowBubblePatch = true;
                        const bubbleStop = (e) => {
                            if (e.target && e.target.closest && e.target.closest('.pin-star')) {
                                e.stopPropagation(); // stop at row; star already handled
                            }
                        };
                        ['click', 'mouseup'].forEach(t => rowEl.addEventListener(t, bubbleStop, false)); // bubble phase
                    }



                    // (optional) keep your fallback reopen on the real star
                    const realStar = rowEl.querySelector('.pin-star');
                    if (realStar && !realStar._tourKeepOpenPatch) {
                        realStar._tourKeepOpenPatch = true;
                        realStar.addEventListener('click', () => { if (keepMenuOpen) reopenSoon(); }, true);
                        realStar.addEventListener('mouseup', () => { if (keepMenuOpen) reopenSoon(); }, true);
                    }
                }


                // Patch the DECOY star to also reopen after it forwards the click
                const decoy = document.getElementById('tour-decoy-star');
                if (decoy && !decoy._tourKeepOpenPatch) {
                    decoy._tourKeepOpenPatch = true;
                    const orig = decoy.onclick;
                    decoy.onclick = (e) => {
                        if (orig) orig.call(decoy, e);
                        if (keepMenuOpen) reopenSoon();
                    };
                }

                // Allow clicking the (decoy/real) star; keep clicks trapped to the menu
                const allowSelectors = ['#tour-decoy-star', '.pin-star'];
                setClickLockAllowList({ nodes: allowNodes, selectors: allowSelectors });
            }, 100);

            // Cleanup for step 2
            const prev = currentStepHandlers.get(currentStep) || [];
            currentStepHandlers.set(currentStep, [
                ...prev,
                () => { if (importRowPoll) clearInterval(importRowPoll); },
                () => {
                    if (storageListener) {
                        chrome.storage.onChanged.removeListener(storageListener);
                        storageListener = null;
                    }
                },
                () => unlockClicks(),
                () => { keepMenuOpen = false; }, // don't reopen after we leave this step
                () => {
                    clearInterval(bindButtonsInterval);
                    if (unbindPrev) unbindPrev();
                    if (unbindClose) unbindClose();
                },
                () => { try { menuObserver && menuObserver.disconnect(); } catch { } },
                () => { try { starGuardCleanup && starGuardCleanup(); } catch { } },


            ]);
        }







        // Step 3: Just showing what they pinned - no interaction
        if (currentStep === 3) {
            resetPointerEvents();

            // keep your existing refresh polling
            let attempts = 0;
            const findButtonInterval = setInterval(() => {
                attempts++;
                const quickbarButtons = document.getElementById('quickbar-buttons');
                const hasPinnedButtons = quickbarButtons && quickbarButtons.children.length > 0;
                if (hasPinnedButtons || attempts > 30) {
                    clearInterval(findButtonInterval);
                    if (hasPinnedButtons) {
                        window.tourInstance.refresh();
                    }
                }
            }, 100);

            // --- Prev override: from step 3 -> go to step 1 (zero-based index 1; one-based goToStep(2))
            const inst = window.tourInstance;
            if (inst) {
                const targetStepOneBased = 2; // step 1 (File menu) in zero-based = 1, so goToStep(2)
                const origPrev = inst.previousStep ? inst.previousStep.bind(inst) : null;

                // override programmatic previousStep while on step 3
                inst.previousStep = function () {
                    this.goToStep(targetStepOneBased);
                    return this;
                };

                // also hijack the visible Prev button
                let unbind = null;
                const bindPrevHijack = () => {
                    const btn = document.querySelector('.introjs-prevbutton');
                    if (!btn) return false;

                    const jump = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                        inst.goToStep(targetStepOneBased);
                    };

                    ['pointerdown', 'mousedown', 'click', 'keydown', 'touchstart']
                        .forEach(t => btn.addEventListener(t, jump, true));

                    unbind = () => {
                        ['pointerdown', 'mousedown', 'click', 'keydown', 'touchstart']
                            .forEach(t => btn.removeEventListener(t, jump, true));
                    };
                    return true;
                };

                const bindInterval = setInterval(() => {
                    if (bindPrevHijack()) clearInterval(bindInterval);
                }, 50);

                const prev = currentStepHandlers.get(currentStep) || [];
                currentStepHandlers.set(currentStep, [
                    ...prev,
                    () => clearInterval(findButtonInterval),
                    () => clearInterval(bindInterval),
                    () => unbind && unbind(),
                    () => { if (origPrev) inst.previousStep = origPrev; } // restore on leave
                ]);
            } else {
                currentStepHandlers.set(currentStep, [
                    () => clearInterval(findButtonInterval)
                ]);
            }
        }




        // Step 4: Information screen - no interaction
        if (currentStep === 4) {
            resetPointerEvents();
        }




        // Step 5: Click text color button
        if (currentStep === 5) {
            closeColorPalette();
            allowOnlyHighlightedClick();




            findIconPatiently('#text-color-tool-icon', 'Text color', '#docs-toolbar-wrapper')
                .then(textColorButton => {
                    repositionTourElements(textColorButton);




                    const clickHandler = () => {
                        const start = Date.now();




                        const check = setInterval(() => {
                            const palette = document.querySelector('.docs-material-colorpalette');
                            const open = palette && palette.offsetParent !== null;
                            if (open) {
                                clearInterval(check);




                                // Make overlay inert right away
                                const helper = document.querySelector('.introjs-helperLayer');
                                const overlay = document.querySelector('.introjs-overlay');
                                if (helper) helper.style.pointerEvents = 'none';
                                if (overlay) overlay.style.pointerEvents = 'none';




                                // Point the NEXT step (index 6) at the real palette, not the placeholder
                                const palette = document.querySelector('.docs-material-colorpalette');
                                if (window.tourInstance && palette && window.tourInstance._options?.steps?.[6]) {
                                    window.tourInstance._options.steps[6].element = palette;
                                }




                                // Keep focus inside the palette so Docs doesn't close it on blur
                                if (palette) {
                                    if (!palette.hasAttribute('tabindex')) palette.setAttribute('tabindex', '-1');
                                    try { palette.focus({ preventScroll: true }); } catch (_) { }
                                }




                                // Block any outside click/blur during Intro overlay re-draw
                                addTransitionGuards();




                                // Advance on the next frame(s) to ensure palette is fully in DOM
                                requestAnimationFrame(() => {
                                    requestAnimationFrame(() => {
                                        if (window.tourInstance && window.tourInstance.currentStep() === 5) {
                                            window.tourInstance.nextStep();
                                        }
                                    });
                                });
                            }
                            else if (Date.now() - start > 300) {
                                // Fallback if the native click didn’t open it
                                simulateRealClick(textColorButton);
                            }
                        }, 80);
                    };


                    textColorButton.addEventListener('click', clickHandler, { once: true });




                    currentStepHandlers.set(currentStep, [
                        () => textColorButton.removeEventListener('click', clickHandler)
                    ]);
                })
                .catch(error => {
                    console.error("Tour failed at Step 6:", error);
                });
        }


        // Step 6: Right-click on a color
        if (currentStep === 6) {
            let paletteSetupComplete = false;


            const helperLayer = document.querySelector('.introjs-helperLayer');
            const overlayLayer = document.querySelector('.introjs-overlay');
            if (helperLayer) helperLayer.style.pointerEvents = 'none';
            if (overlayLayer) overlayLayer.style.pointerEvents = 'none';


            function setupStep6WithPalette(palette) {
                if (paletteSetupComplete) return;
                paletteSetupComplete = true;


                const placeholder = document.getElementById('color-palette-placeholder');
                if (placeholder && palette) {
                    const rect = palette.getBoundingClientRect();
                    placeholder.style.top = `${rect.top}px`;
                    placeholder.style.left = `${rect.left}px`;
                    placeholder.style.width = `${rect.width}px`;
                    placeholder.style.height = `${rect.height}px`;
                }


                if (window.tourInstance) {
                    const stepOpts = window.tourInstance._options.steps[window.tourInstance.currentStep()];
                    if (stepOpts) stepOpts.element = palette;
                }
                window.tourInstance.refresh();


                setTimeout(() => {
                    const helperLayer = document.querySelector('.introjs-helperLayer');
                    const overlayLayer = document.querySelector('.introjs-overlay');
                    if (helperLayer) helperLayer.style.pointerEvents = 'none';
                    if (overlayLayer) overlayLayer.style.pointerEvents = 'none';


                    const currentPalette = document.querySelector('.docs-material-colorpalette') || palette;
                    if (currentPalette) {
                        currentPalette.style.pointerEvents = 'auto';
                        currentPalette.style.zIndex = '2147483647';


                        const swatches = currentPalette.querySelectorAll('[aria-label], [title]');
                        swatches.forEach(s => {
                            s.style.pointerEvents = 'auto';
                            s.style.zIndex = '2147483647';
                        });


                        if (!currentPalette.hasAttribute('tabindex')) currentPalette.setAttribute('tabindex', '-1');
                        try { currentPalette.focus({ preventScroll: true }); } catch { }


                        // Only allow: the open palette (and its swatches) + optional decoy fill + Intro buttons
                        const decoyFill = document.getElementById('tour-decoy-fill-color');
                        const allowNodes = [currentPalette];
                        if (decoyFill) allowNodes.push(decoyFill);
                        const allowSelectors = ['#tour-decoy-fill-color'];


                        setClickLockAllowList({ nodes: allowNodes, selectors: allowSelectors });
                    }


                    if (_removeTransitionGuards) _removeTransitionGuards();
                }, 100);


                setupStep6StorageListener();


                const prev = currentStepHandlers.get(6) || [];
                currentStepHandlers.set(6, [...prev, () => unlockClicks()]);
            }


            function setupStep6WithoutPalette() {
                if (paletteSetupComplete) return;
                paletteSetupComplete = true;


                window.tourInstance.refresh();


                setTimeout(() => {
                    const helperLayer = document.querySelector('.introjs-helperLayer');
                    const overlayLayer = document.querySelector('.introjs-overlay');
                    if (helperLayer) helperLayer.style.pointerEvents = 'none';
                    if (overlayLayer) overlayLayer.style.pointerEvents = 'none';


                    // While closed (fallback), allow only the trigger so the user can re-open
                    setClickLockAllowList({ selectors: ['#text-color-tool-icon'] });
                }, 100);


                setupStep6StorageListener();


                const prev = currentStepHandlers.get(6) || [];
                currentStepHandlers.set(6, [...prev, () => unlockClicks()]);
            }


            function setupStep6StorageListener() {
                if (storageListener) chrome.storage.onChanged.removeListener(storageListener);


                storageListener = (changes, area) => {
                    if (area === 'local' && changes.pinnedFunctions) {
                        const newPins = changes.pinnedFunctions.newValue || [];
                        const oldPins = changes.pinnedFunctions.oldValue || [];
                        const newColorWasPinned = newPins.some(pin =>
                            pin.toLowerCase().includes('color') && !oldPins.includes(pin)
                        );


                        if (newColorWasPinned) {
                            chrome.storage.onChanged.removeListener(storageListener);
                            storageListener = null;


                            unlockClicks();
                            closeColorPalette();


                            setTimeout(() => window.tourInstance.nextStep(), 300);
                        }
                    }
                };
                chrome.storage.onChanged.addListener(storageListener);


                const prev = currentStepHandlers.get(6) || [];
                currentStepHandlers.set(6, [
                    ...prev,
                    () => {
                        if (storageListener) {
                            chrome.storage.onChanged.removeListener(storageListener);
                            storageListener = null;
                        }
                    }
                ]);
            }


            const existingPalette = document.querySelector('.docs-material-colorpalette');
            if (existingPalette && existingPalette.offsetParent !== null) {
                setupStep6WithPalette(existingPalette);
            } else {
                let waitAttempts = 0;
                const waitForPaletteInterval = setInterval(() => {
                    waitAttempts++;
                    const palette = document.querySelector('.docs-material-colorpalette');


                    if (palette && palette.offsetParent !== null) {
                        clearInterval(waitForPaletteInterval);
                        setupStep6WithPalette(palette);
                    } else if (waitAttempts > 30) {
                        clearInterval(waitForPaletteInterval);
                        findIconPatiently('#text-color-tool-icon', 'Text color', '#docs-toolbar-wrapper')
                            .then(btn => {
                                simulateRealClick(btn);
                                const recheck = setInterval(() => {
                                    const pal = document.querySelector('.docs-material-colorpalette');
                                    if (pal && pal.offsetParent !== null) {
                                        clearInterval(recheck);
                                        setupStep6WithPalette(pal);
                                    }
                                }, 80);
                                setTimeout(() => clearInterval(recheck), 1500);
                            })
                            .catch(() => setupStep6WithoutPalette());
                    }
                }, 100);
            }
        }
        // Step 7: Click edit button
        if (currentStep === 7) {
            closeColorPalette();
            allowOnlyHighlightedClick();


            let attempts = 0;
            const maxAttempts = 50;
            const findButtonInterval = setInterval(() => {
                attempts++;
                const quickbar = document.getElementById('quickbar');
                const editButton = quickbar ? quickbar.editButton : document.querySelector('button[id*="edit"]');
                if (editButton && editButton.offsetParent !== null && editButton.style.display !== 'none') {
                    clearInterval(findButtonInterval);


                    if (!editButton.id) {
                        editButton.id = 'starbar-edit-button';
                    }
                    if (window.tourInstance) {
                        const currentStepOptions = window.tourInstance._options.steps[window.tourInstance.currentStep()];
                        if (currentStepOptions) {
                            currentStepOptions.element = editButton;
                        }


                        const oldShowElement = document.querySelector('.introjs-showElement');
                        if (oldShowElement) {
                            oldShowElement.classList.remove('introjs-showElement');
                        }
                        editButton.classList.add('introjs-showElement');




                        window.tourInstance.refresh();
                    }
                } else if (attempts > maxAttempts) {
                    clearInterval(findButtonInterval);
                }
            }, 100);




            currentStepHandlers.set(currentStep, [
                () => clearInterval(findButtonInterval)
            ]);
        }
        // Step 8: Final screen - no interaction
        if (currentStep === 8) {
            closeColorPalette();
            resetPointerEvents();
        }
    }


    createImportPlaceholder();
    createColorPalettePlaceholder();
    createTextColorPlaceholder();


    intro.setOptions({
        tooltipClass: 'starbar-tour-theme',
        showProgress: true,
        showStepNumbers: true,
        showBullets: false,
        exitOnEsc: true,
        exitOnOverlayClick: false,
        disableInteraction: true, // CRITICAL: Global disable, we'll enable per-step
        keyboardNavigation: false,




        steps: [
            {
                title: "Welcome to StarBar 👋",
                intro: "Let's set up your custom toolbar so your favorite tools are always within reach. This quick tour will guide you step-by-step.",
                hidePrev: true,
                nextLabel: "Let's Begin"
            },
            {
                element: '#docs-file-menu',
                title: "Start Here: The File Menu",
                intro: "Click on <b>File</b> in the top menu. We'll pin your first function from here.",
                position: 'bottom',
                hideNext: true,
                disableInteraction: false
            },
            {
                element: '#import-step-placeholder',
                title: "Pin Your First Tool ⭐",
                intro: "Find the 'Import' option in the File menu and click the star <b>☆</b> next to it. This pins it to your toolbar for quick access.",
                position: 'right',
                hideNext: true,
                disableInteraction: false
            },
            {
                element: '#quickbar-buttons',
                title: "Nice – It's Pinned!",
                intro: "You just added your first tool to StarBar. You can do this with any menu item or feature you use often.",
                position: 'left'
            },
            {
                title: "Let's Pin a Color",
                intro: "StarBar works with more than just menu items. Let's try pinning a text color next."
            },
            {
                element: '#text-color-placeholder',
                title: "Pick a Text Color",
                intro: "Click the <b>text color icon</b> (looks like an 'A' with color) to open the color palette.",
                position: 'bottom',
                disableInteraction: false
            },
            {
                element: '#color-palette-placeholder',
                title: "Pin a Favorite Color",
                intro: "The color palette is now open. <b>Right-click</b> on a color to pin it – just like you did with 'Import'.",
                position: 'right',
                hideNext: true,
                disableInteraction: false
            },
            {
                element: '#starbar-edit-button',
                title: "Customize Your StarBar",
                intro: "Click the ✏️ icon to rearrange or remove items from your toolbar anytime.",
                position: 'left',
                disableInteraction: false
            },
            {
                title: "You're All Set! 🎉",
                intro: "You've learned how to pin tools and colors to your toolbar. Go make StarBar your own – and enjoy the faster workflow!"
            }
        ]
    });


    intro.onchange(function () {
        cleanupDecoyStar();
        const tourContainer = document.querySelector('.introjs-tour');
        const tooltip = document.querySelector('.introjs-tooltip');
        if (tooltip && tourContainer) {
            const currentStepNumber = this.currentStep() + 1;


            if (this._options && this._options.steps) {
                for (let i = 1; i <= this._options.steps.length; i++) {
                    tooltip.classList.remove('introjs-step-' + i);
                    tourContainer.classList.remove('introjs-step-' + i);
                }
            }
            tooltip.classList.add('introjs-step-' + currentStepNumber);
            tourContainer.classList.add('introjs-step-' + currentStepNumber);
        }
        const overlayLayerForCleanup = document.querySelector('.introjs-overlay');
        if (overlayLayerForCleanup && overlayLayerForCleanup.style.display === 'none') {
            const helperLayer = document.querySelector('.introjs-helperLayer');


            if (helperLayer) {
                helperLayer.removeAttribute('style');
            }
            overlayLayerForCleanup.style.display = 'block';
        }
        setTimeout(() => {
            const nextButton = document.querySelector('.introjs-nextbutton');
            const currentStepNumber = this.currentStep() + 1;
            if (nextButton && (currentStepNumber === 2 || currentStepNumber === 3 || currentStepNumber === 7)) {
                nextButton.style.display = 'none';
            }
        }, 10);
        onTourStepChange();
    });
    intro.onexit(() => {
        cleanupDecoyStar();
        currentStepHandlers.forEach((handlers, stepNumber) => {
            handlers.forEach(cleanup => {
                try {
                    cleanup();
                } catch (e) {
                    console.warn('Cleanup error on exit:', e);
                }
            });
        });
        currentStepHandlers.clear();
        const helperLayer = document.querySelector('.introjs-helperLayer');
        if (helperLayer) {
            helperLayer.removeAttribute('style');
        }
        const overlayLayer = document.querySelector('.introjs-overlay');
        if (overlayLayer) {
            overlayLayer.style.display = 'block';
            overlayLayer.removeAttribute('style');
        }
        closeColorPalette();
        chrome.storage.local.set({ hasSeenOnboarding: true });
        if (storageListener) {
            chrome.storage.onChanged.removeListener(storageListener);
            storageListener = null;
        }
        if (importPlaceholder) {
            importPlaceholder.remove();
            importPlaceholder = null;
        }


        if (colorPalettePlaceholder) {
            colorPalettePlaceholder.remove();
            colorPalettePlaceholder = null;
        }
        if (window.tourInstance) {
            delete window.tourInstance;
        }
        if (textColorPlaceholder) {
            textColorPlaceholder.remove();
            textColorPlaceholder = null;
        }
    });


    intro.start();
}


window.startOnboardingTour = () => runOnboardingTour();

