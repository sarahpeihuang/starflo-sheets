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

    const helperLayer = document.querySelector('.introjs-helperLayer');
    if (helperLayer) {
        helperLayer.style.pointerEvents = 'auto';
    }

    const overlayLayer = document.querySelector('.introjs-overlay');
    if (overlayLayer) {
        overlayLayer.style.pointerEvents = 'auto';
    }
}

function simulateRealClick(element) {
    if (element.focus) {
        element.focus();
    }

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const mousedownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: centerX,
        clientY: centerY,
        button: 0,
        buttons: 1
    });

    const mouseupEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: centerX,
        clientY: centerY,
        button: 0,
        buttons: 0
    });

    const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: centerX,
        clientY: centerY,
        button: 0,
        buttons: 0
    });

    element.dispatchEvent(mousedownEvent);

    setTimeout(() => {
        element.dispatchEvent(mouseupEvent);
        element.dispatchEvent(clickEvent);

        const pointerEvent = new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            clientX: centerX,
            clientY: centerY
        });
        element.dispatchEvent(pointerEvent);
    }, 10);
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
            z-index: 999999999;
            cursor: pointer;
        `;

        document.body.appendChild(decoyStar);

        decoyStar.onclick = () => {
            realStar.click();
            decoyStar.remove();
        };
    }
}

function findIconPatiently(elementId, ariaLabel, wrapperSelector) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50;

        const interval = setInterval(() => {
            attempts++;
            let icon = document.getElementById(elementId.substring(1));

            if (!icon) {
                const wrapper = document.querySelector(wrapperSelector);
                if (wrapper) {
                    const allElements = wrapper.querySelectorAll('*');
                    for (const el of allElements) {
                        const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase().trim();
                        if (label === ariaLabel.toLowerCase()) {
                            const innerBox = el.querySelector('.goog-toolbar-button-inner-box');
                            icon = innerBox || el;
                            break;
                        }
                    }
                }
            }

            if (icon) {
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

function closeColorPalette() {
    const palette = document.querySelector('.docs-material-colorpalette');
    if (palette && palette.offsetParent !== null) {
        findIconPatiently('#text-color-tool-icon', 'Text color', '#docs-toolbar-wrapper')
            .then(textColorButton => {
                textColorButton.click();
            })
            .catch(error => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            });
    }
}

function runOnboardingTour() {
    const intro = introJs.tour();
    let storageListener;
    let fileClickListener;
    let importPlaceholder = null;
    let colorPalettePlaceholder = null;
    let currentStepHandlers = new Map();

    window.tourInstance = intro;

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
            handlers.forEach(cleanup => cleanup());
            currentStepHandlers.delete(stepNumber);
        }

        if (storageListener) {
            chrome.storage.onChanged.removeListener(storageListener);
            storageListener = null;
        }
        if (fileClickListener) {
            const fileBtn = document.querySelector('#docs-file-menu');
            if (fileBtn) fileBtn.removeEventListener('click', fileClickListener);
            fileClickListener = null;
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
                    el.offsetParent !== null && el.textContent.includes('Import')
                );

                if (importItem) {
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

        const helperLayer = document.querySelector('.introjs-helperLayer');
        if (helperLayer) {
            helperLayer.style.pointerEvents = 'auto';
        }

        const overlayLayer = document.querySelector('.introjs-overlay');
        if (overlayLayer) {
            overlayLayer.style.pointerEvents = 'auto';
        }

        if (currentStep === 1) {
            const fileMenuButton = document.querySelector('#docs-file-menu');
            if (fileMenuButton) {
                fileClickListener = () => waitForImportAndAdvance();
                fileMenuButton.addEventListener('click', fileClickListener, { once: true });
               
                currentStepHandlers.set(currentStep, [
                    () => {
                        if (fileClickListener && fileMenuButton) {
                            fileMenuButton.removeEventListener('click', fileClickListener);
                        }
                    }
                ]);
            }
        }

        if (currentStep === 2) {
            storageListener = (changes, area) => {
                if (area === 'local' && changes.pinnedFunctions) {
                    const newPins = changes.pinnedFunctions.newValue || [];
                    const oldPins = changes.pinnedFunctions.oldValue || [];

                    const newImportWasPinned = newPins.some(pin =>
                        pin.toLowerCase().includes('import') && !oldPins.includes(pin)
                    );

                    if (newImportWasPinned) {
                        chrome.storage.onChanged.removeListener(storageListener);
                        storageListener = null;
                        window.tourInstance.nextStep();
                    }
                }
            };
            chrome.storage.onChanged.addListener(storageListener);
           
            currentStepHandlers.set(currentStep, [
                () => {
                    if (storageListener) {
                        chrome.storage.onChanged.removeListener(storageListener);
                        storageListener = null;
                    }
                }
            ]);
        }

        if (currentStep === 3) {
            let attempts = 0;
            const findButtonInterval = setInterval(() => {
                attempts++;
                const pinnedButton = document.querySelector('#tour-import-button-wrapper');

                if (pinnedButton || attempts > 30) {
                    clearInterval(findButtonInterval);
                    if (pinnedButton) {
                        window.tourInstance.refresh();
                    }
                }
            }, 100);
           
            currentStepHandlers.set(currentStep, [
                () => clearInterval(findButtonInterval)
            ]);
        }

        if (currentStep === 5) {
            closeColorPalette();

            findIconPatiently('#text-color-tool-icon', 'Text color', '#docs-toolbar-wrapper')
                .then(textColorButton => {
                    const oldShowElement = document.querySelector('.introjs-showElement');
                    if (oldShowElement) {
                        oldShowElement.classList.remove('introjs-showElement');
                    }
                    textColorButton.classList.add('introjs-showElement');

                    if (window.tourInstance) {
                        const currentStepOptions = window.tourInstance._options.steps[window.tourInstance.currentStep()];
                        if (currentStepOptions) {
                            currentStepOptions.element = textColorButton;
                        }
                        window.tourInstance.refresh();
                    }

                    const clickHandler = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                       
                        if (window.tourInstance && window.tourInstance.currentStep() === 5) {
                            window.tourInstance.nextStep();
                        }
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

        if (currentStep === 6) {
            let existingPalette = document.querySelector('.docs-material-colorpalette');
           
            if (existingPalette && existingPalette.offsetParent !== null) {
                setupStep7WithPalette(existingPalette);
            } else {
                openColorPalette()
                    .then(palette => {
                        setupStep7WithPalette(palette);
                    })
                    .catch(error => {
                        setupStep7WithoutPalette();
                    });
            }

            function setupStep7WithPalette(palette) {
                const placeholder = document.getElementById('color-palette-placeholder');
                const rect = palette.getBoundingClientRect();
                placeholder.style.top = `${rect.top}px`;
                placeholder.style.left = `${rect.left}px`;
                placeholder.style.width = `${rect.width}px`;
                placeholder.style.height = `${rect.height}px`;
                window.tourInstance.refresh();

                setTimeout(() => {
                    const helperLayer = document.querySelector('.introjs-helperLayer');
                    const overlayLayer = document.querySelector('.introjs-overlay');

                    if (helperLayer) {
                        helperLayer.style.pointerEvents = 'none';
                    }

                    if (overlayLayer) {
                        overlayLayer.style.pointerEvents = 'none';
                    }

                    const currentPalette = document.querySelector('.docs-material-colorpalette');
                    if (currentPalette) {
                        currentPalette.style.pointerEvents = 'auto';
                        currentPalette.style.zIndex = '999999999';

                        const colorSwatches = currentPalette.querySelectorAll('[aria-label], [title]');
                        colorSwatches.forEach(swatch => {
                            swatch.style.pointerEvents = 'auto';
                            swatch.style.zIndex = '999999999';
                        });
                    }
                }, 100);

                setupStep7StorageListener();
            }

            function setupStep7WithoutPalette() {
                const placeholder = document.getElementById('color-palette-placeholder');
                window.tourInstance.refresh();

                setTimeout(() => {
                    const helperLayer = document.querySelector('.introjs-helperLayer');
                    const overlayLayer = document.querySelector('.introjs-overlay');

                    if (helperLayer) {
                        helperLayer.style.pointerEvents = 'none';
                    }

                    if (overlayLayer) {
                        overlayLayer.style.pointerEvents = 'none';
                    }
                }, 100);

                setupStep7StorageListener();
            }

            function setupStep7StorageListener() {
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
                            window.tourInstance.nextStep();
                        }
                    }
                };
                chrome.storage.onChanged.addListener(storageListener);
               
                currentStepHandlers.set(currentStep, [
                    () => {
                        if (storageListener) {
                            chrome.storage.onChanged.removeListener(storageListener);
                            storageListener = null;
                        }
                    }
                ]);
            }
        }

        if (currentStep === 7) {
            closeColorPalette();

            let attempts = 0;
            const maxAttempts = 50;

            const findButtonInterval = setInterval(() => {
                attempts++;
                const editButton = document.getElementById('starbar-edit-button');

                if (editButton && editButton.offsetParent !== null && editButton.style.display !== 'none') {
                    clearInterval(findButtonInterval);

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

        if (currentStep === 8) {
            closeColorPalette();
        }
    }

    createImportPlaceholder();
    createColorPalettePlaceholder();

    intro.setOptions({
        tooltipClass: 'starbar-tour-theme',
        showProgress: true,
        showStepNumbers: true,
        showBullets: false,
        exitOnEsc: true,
        exitOnOverlayClick: false,
        disableInteraction: false,
        keyboardNavigation: false,

        steps: [
  {
    title: "Welcome to StarBar 👋",
    intro: "Let’s set up your custom toolbar so your favorite tools are always within reach. This quick tour will guide you step-by-step.",
    disableInteraction: true,
    hidePrev: true,
    nextLabel: "Let’s Begin"
  },
  {
    element: '#docs-file-menu',
    title: "Start Here: The File Menu",
    intro: "Click on <b>File</b> in the top menu. We'll pin your first function from here.",
    position: 'bottom',
    hideNext: true
  },
  {
    element: '#import-step-placeholder',
    title: "Pin Your First Tool ⭐",
    intro: "Find the ‘Import’ option in the File menu and click the star <b>☆</b> next to it. This pins it to your toolbar for quick access.",
    position: 'right',
    hideNext: true
  },
  {
    element: '#quickbar-buttons',
    title: "Nice — It’s Pinned!",
    intro: "You just added your first tool to StarBar. You can do this with any menu item or feature you use often.",
    position: 'left',
    disableInteraction: true
  },
  {
    title: "Let’s Pin a Color",
    intro: "StarBar works with more than just menu items. Let’s try pinning a text color next.",
    disableInteraction: true
  },
  {
    element: '#text-color-tool-icon',
    title: "Pick a Text Color",
    intro: "Click this icon to open the text color palette.",
    position: 'bottom',
    disableInteraction: false
  },
  {
    element: '#color-palette-placeholder',
    title: "Pin a Favorite Color",
    intro: "The color palette is now open. <b>Right-click</b> on a color to pin it — just like you did with 'Import'.",
    position: 'right',
    hideNext: true
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
    intro: "You’ve learned how to pin tools and colors to your toolbar. Go make StarBar your own — and enjoy the faster workflow!",
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
                    tourContainer.classList.remove('introjs-step-'.concat(i));
                }
            }

            tooltip.classList.add('introjs-step-' + currentStepNumber);
            tourContainer.classList.add('introjs-step-'.concat(currentStepNumber));
        }

        const currentStepNumber = this.currentStep() + 1;

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
            if (nextButton && (currentStepNumber === 2 || currentStepNumber === 3 || currentStepNumber === 7)) {
                nextButton.style.display = 'none';
            }
        }, 10);

        onTourStepChange();
    });

    intro.onexit(() => {
        cleanupDecoyStar();
       
        currentStepHandlers.forEach((handlers, stepNumber) => {
            handlers.forEach(cleanup => cleanup());
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

        if (storageListener) chrome.storage.onChanged.removeListener(storageListener);

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
    });

    intro.start();
}