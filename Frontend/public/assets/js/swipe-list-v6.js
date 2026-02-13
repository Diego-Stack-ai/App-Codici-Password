/**
 * SwipeList Utility
 * Handles swipe gestures for list items (Left: Archive, Right: Delete)
 * Supports Touch and Mouse (Desktop) interactions.
 */
export class SwipeList {
    constructor(selector, options = {}) {
        this.selector = selector;
        this.options = {
            onSwipeLeft: options.onSwipeLeft || (() => { }),   // Action: Archive
            onSwipeRight: options.onSwipeRight || (() => { }), // Action: Delete
            threshold: options.threshold || 0.3, // 30% of width to trigger
            ...options
        };

        this.activeItem = null;
        this.startX = 0;
        this.currentX = 0;
        this.isDragging = false;
        this.hasMoved = false; // Rileva se il mouse/tocco si è spostato significativamente
        this.blockNextClick = false; // Flag per bloccare il click successivo

        this.init();
    }

    init() {
        // Delegate events

        // Touch
        document.addEventListener('touchstart', this.handleStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleEnd.bind(this));

        // Mouse (Desktop)
        document.addEventListener('mousedown', this.handleStart.bind(this));
        document.addEventListener('mousemove', this.handleMove.bind(this));
        document.addEventListener('mouseup', this.handleEnd.bind(this));

        // Block Click if we were dragging
        document.addEventListener('click', this.handleClick.bind(this), true); // Capture phase CRITICAL
    }

    handleClick(e) {
        if (this.blockNextClick) {
            e.preventDefault();
            e.stopPropagation();
            this.blockNextClick = false;
            console.log("[SwipeList] Click blocked due to drag");
        }
    }

    getItem(e) {
        return e.target.closest(this.selector);
    }

    // Unified Handlers
    handleStart(e) {
        // Setup coordinate extraction
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;

        const item = this.getItem(e);
        if (!item) {
            // Check if we clicked outside ANY active item to close it
            if (this.activeItem && !this.activeItem.contains(e.target)) {
                this.closeAll();
            }
            return;
        }

        // Close others if different item
        if (this.activeItem && this.activeItem !== item) {
            this.resetItem(this.activeItem);
        }

        this.activeItem = item;
        this.startX = clientX;
        this.isDragging = true;
        this.hasMoved = false; // Reset to false on start
        this.blockNextClick = false; // Reset block

        // Remove transitions during drag for immediate response
        const content = item.querySelector('.swipe-content');
        if (content) {
            content.style.transition = 'none';
        }
    }

    handleMove(e) {
        if (!this.isDragging || !this.activeItem) return;

        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const diff = clientX - this.startX;
        this.currentX = diff;

        // Threshold to consider it a real "move" (avoid accidental micro-movements)
        if (Math.abs(diff) > 5) {
            this.hasMoved = true;
        }

        // Prevent vertical scrolling if horizontal swipe is detected (only for touch)
        if (!e.type.includes('mouse') && Math.abs(diff) > 10 && e.cancelable) {
            e.preventDefault();
        }

        const content = this.activeItem.querySelector('.swipe-content');
        if (content) {
            // Damping
            const resist = 0.5;
            const translate = diff * resist;

            content.style.transform = `translateX(${translate}px)`;

            // Visual Feedback triggers
            this.updateBackgrounds(this.activeItem, translate);
        }
    }

    handleEnd(e) {
        if (!this.isDragging || !this.activeItem) return;
        this.isDragging = false;

        // If we moved significantly, we should block the next click event
        if (this.hasMoved) {
            this.blockNextClick = true;
            // In case click doesn't fire (e.g. mouse moved off), clear it shortly
            setTimeout(() => { this.blockNextClick = false; }, 100);
        }

        const content = this.activeItem.querySelector('.swipe-content');
        if (!content) return;

        // Restore transition for smooth animation
        content.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';

        const width = this.activeItem.offsetWidth;
        const ratio = this.currentX / width;

        if (ratio < -this.options.threshold) {
            // Swiped Left (Archive) -> Fly out to Left
            this.completeSwipe(this.activeItem, 'left');
        } else if (ratio > this.options.threshold) {
            // Swiped Right (Delete) -> Fly out to Right
            this.completeSwipe(this.activeItem, 'right');
        } else {
            // Not enough -> Snap Back
            this.resetItem(this.activeItem);
        }

        this.currentX = 0;
    }

    updateBackgrounds(item, translate) {
        const bgLeft = item.querySelector('.swipe-bg-left'); // Delete (Red)
        const bgRight = item.querySelector('.swipe-bg-right'); // Archive (Yellow/Green)

        // Ensure backgrounds are full width visually
        if (bgLeft) bgLeft.style.width = '100%';
        if (bgRight) bgRight.style.width = '100%';

        if (translate > 0) {
            // Dragging Right -> Show Left BG (Delete)
            if (bgLeft) {
                bgLeft.style.opacity = '1';
                bgLeft.style.zIndex = '1';
            }
            if (bgRight) {
                bgRight.style.opacity = '0';
                bgRight.style.zIndex = '0';
            }
        } else {
            // Dragging Left -> Show Right BG (Archive)
            if (bgLeft) {
                bgLeft.style.opacity = '0';
                bgLeft.style.zIndex = '0';
            }
            if (bgRight) {
                bgRight.style.opacity = '1';
                bgRight.style.zIndex = '1';
            }
        }
    }

    completeSwipe(item, direction) {
        const content = item.querySelector('.swipe-content');
        if (content) {
            // 0. PREVENT GHOST CLICKs (CRITICAL)
            item.style.pointerEvents = 'none';

            // 1. Fly out completely (NO SNAP BACK)
            const x = direction === 'left' ? '-110%' : '110%'; // Go further than 100%
            content.style.transform = `translateX(${x})`;
            content.style.opacity = '0'; // Fade out while moving

            // 2. Collapse Height ("Slittare verso l'alto")
            // Start shrinking almost immediately so the list moves up while the card exits
            setTimeout(() => {
                // Add margins to transition to ensure gap removal
                item.style.transition = 'max-height 0.3s ease-out, margin 0.3s ease-out, opacity 0.2s ease-out';
                item.style.maxHeight = '0px';
                item.style.margin = '0px'; // Crucial for "slittare verso l'alto"
                item.style.opacity = '0';

                // 3. Trigger Callback (Data Update)
                if (direction === 'left') {
                    this.options.onSwipeLeft(item);
                } else {
                    this.options.onSwipeRight(item);
                }

                // 4. Remove from DOM after transition
                setTimeout(() => item.remove(), 350);

            }, 100);
        }
    }

    resetItem(item) {
        const content = item.querySelector('.swipe-content');
        if (content) {
            content.style.transform = 'translateX(0)';
            content.style.opacity = '1';
        }
        item.querySelectorAll('.swipe-bg-left, .swipe-bg-right').forEach(bg => {
            bg.style.opacity = '0';
            bg.style.zIndex = '0';
        });
    }

    closeAll() {
        if (this.activeItem) {
            this.resetItem(this.activeItem);
            this.activeItem = null;
        }
    }
}
