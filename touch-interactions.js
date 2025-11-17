// Módulo de interacciones táctiles y gestos
const TouchInteractions = {
    touchStartX: 0,
    touchStartY: 0,
    touchStartTime: 0,
    lastTapTime: 0,
    longPressTimer: null,
    
    // Inicializar interacciones táctiles
    init() {
        if (!Utils.isTouchDevice()) {
            return; // No es necesario en dispositivos no táctiles
        }
        
        this.setupTouchEvents();
        this.setupLongPress();
        this.setupSwipeGestures();
        this.setupDoubleTap();
        this.setupPullToRefresh();
    },
    
    // Configurar eventos táctiles básicos
    setupTouchEvents() {
        document.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            this.touchStartTime = Date.now();
            
            // Feedback háptico en elementos interactivos
            if (e.target.closest('.btn, .alert-item, .invoice-card, .task-card, tbody tr')) {
                Utils.vibrate(10);
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0];
            const touchEndX = touch.clientX;
            const touchEndY = touch.clientY;
            const touchDuration = Date.now() - this.touchStartTime;
            
            // Detectar toque simple
            const deltaX = Math.abs(touchEndX - this.touchStartX);
            const deltaY = Math.abs(touchEndY - this.touchStartY);
            
            if (deltaX < 10 && deltaY < 10 && touchDuration < 300) {
                this.handleTap(e.target);
            }
        }, { passive: true });
    },
    
    // Manejar toque simple
    handleTap(target) {
        // Mejorar accesibilidad: expandir área táctil
        const clickable = target.closest('.btn, .alert-item, .invoice-card, .task-card, tbody tr, .card');
        if (clickable) {
            // Agregar efecto visual
            clickable.style.transform = 'scale(0.98)';
            setTimeout(() => {
                clickable.style.transform = '';
            }, 100);
        }
    },
    
    // Configurar presión larga (long press)
    setupLongPress() {
        let longPressTimer;
        
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.alert-item, .invoice-card, .task-card, tbody tr');
            if (!target) return;
            
            longPressTimer = setTimeout(() => {
                this.handleLongPress(target, e);
                Utils.vibrate([100, 50, 100]); // Feedback háptico
            }, CONFIG.touch.longPressDelay);
        }, { passive: true });
        
        document.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        }, { passive: true });
        
        document.addEventListener('touchmove', () => {
            clearTimeout(longPressTimer);
        }, { passive: true });
    },
    
    // Manejar presión larga
    handleLongPress(element, event) {
        // Mostrar menú contextual o acciones rápidas
        if (element.classList.contains('alert-item')) {
            this.showContextMenu(element, event, [
                { label: 'Ver detalles', action: () => element.click() },
                { label: 'Marcar como leída', action: () => this.markAsRead(element) }
            ]);
        } else if (element.classList.contains('invoice-card')) {
            this.showContextMenu(element, event, [
                { label: 'Ver detalles', action: () => element.click() },
                { label: 'Marcar como pagada', action: () => this.markInvoicePaid(element) }
            ]);
        } else if (element.classList.contains('task-card')) {
            this.showContextMenu(element, event, [
                { label: 'Ver detalles', action: () => element.click() },
                { label: 'Completar tarea', action: () => this.completeTask(element) }
            ]);
        }
    },
    
    // Mostrar menú contextual
    showContextMenu(element, event, options) {
        // Remover menú anterior si existe
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${event.touches[0].clientX}px;
            top: ${event.touches[0].clientY}px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            min-width: 200px;
            padding: 8px;
        `;
        
        options.forEach(option => {
            const item = document.createElement('div');
            item.textContent = option.label;
            item.style.cssText = `
                padding: 12px 16px;
                font-size: 18px;
                cursor: pointer;
                border-radius: 6px;
                min-height: 44px;
                display: flex;
                align-items: center;
            `;
            item.addEventListener('click', () => {
                option.action();
                menu.remove();
            });
            item.addEventListener('touchstart', () => {
                item.style.background = '#f3f4f6';
            });
            item.addEventListener('touchend', () => {
                item.style.background = '';
            });
            menu.appendChild(item);
        });
        
        document.body.appendChild(menu);
        
        // Cerrar menú al tocar fuera
        setTimeout(() => {
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('touchstart', closeMenu);
                }
            };
            document.addEventListener('touchstart', closeMenu);
        }, 100);
    },
    
    // Configurar gestos de deslizamiento (swipe)
    setupSwipeGestures() {
        let touchStartX, touchStartY, touchEndX, touchEndY;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            this.handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
        }, { passive: true });
    },
    
    // Manejar deslizamiento
    handleSwipe(startX, startY, endX, endY) {
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        
        if (absDeltaX < CONFIG.touch.swipeThreshold && absDeltaY < CONFIG.touch.swipeThreshold) {
            return; // No es un swipe significativo
        }
        
        if (absDeltaX > absDeltaY) {
            // Swipe horizontal
            if (deltaX > 0) {
                this.handleSwipeRight();
            } else {
                this.handleSwipeLeft();
            }
        } else {
            // Swipe vertical
            if (deltaY > 0) {
                this.handleSwipeDown();
            } else {
                this.handleSwipeUp();
            }
        }
    },
    
    handleSwipeLeft() {
        // Cerrar modales al deslizar izquierda
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
            activeModal.classList.remove('active');
            Utils.vibrate(50);
        }
    },
    
    handleSwipeRight() {
        // Navegar hacia atrás
        if (window.history.length > 1) {
            window.history.back();
            Utils.vibrate(50);
        }
    },
    
    handleSwipeUp() {
        // Scroll hacia arriba suave
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    },
    
    handleSwipeDown() {
        // Scroll hacia abajo suave
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
    },
    
    // Configurar doble toque
    setupDoubleTap() {
        document.addEventListener('touchend', (e) => {
            const currentTime = Date.now();
            const tapLength = currentTime - this.lastTapTime;
            
            if (tapLength < CONFIG.touch.doubleTapDelay && tapLength > 0) {
                // Doble toque detectado
                this.handleDoubleTap(e.target);
                e.preventDefault();
            }
            
            this.lastTapTime = currentTime;
        }, { passive: false });
    },
    
    // Manejar doble toque
    handleDoubleTap(target) {
        // Zoom o acción rápida en doble toque
        const card = target.closest('.card, .kpi-card');
        if (card) {
            card.style.transform = 'scale(1.05)';
            setTimeout(() => {
                card.style.transform = '';
            }, 200);
            Utils.vibrate([50, 30, 50]);
        }
    },
    
    // Configurar pull to refresh
    setupPullToRefresh() {
        let startY = 0;
        let isPulling = false;
        
        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (!isPulling) return;
            
            const currentY = e.touches[0].clientY;
            const pullDistance = currentY - startY;
            
            if (pullDistance > 100 && window.scrollY === 0) {
                // Mostrar indicador de refresh
                this.showRefreshIndicator(pullDistance);
            }
        }, { passive: true });
        
        document.addEventListener('touchend', () => {
            if (isPulling) {
                this.hideRefreshIndicator();
                isPulling = false;
            }
        }, { passive: true });
    },
    
    showRefreshIndicator(distance) {
        // Implementar indicador visual de refresh
        let indicator = document.getElementById('pull-refresh-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'pull-refresh-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--primary);
                color: white;
                padding: 12px 24px;
                border-radius: 24px;
                font-size: 18px;
                z-index: 10000;
                display: none;
            `;
            indicator.textContent = 'Suelta para actualizar';
            document.body.appendChild(indicator);
        }
        
        if (distance > 100) {
            indicator.style.display = 'block';
        }
    },
    
    hideRefreshIndicator() {
        const indicator = document.getElementById('pull-refresh-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    },
    
    // Funciones auxiliares
    markAsRead(element) {
        element.style.opacity = '0.6';
        if (window.app && window.app.showToast) {
            window.app.showToast('Alerta marcada como leída');
        }
    },
    
    markInvoicePaid(element) {
        element.style.opacity = '0.6';
        if (window.app && window.app.showToast) {
            window.app.showToast('Factura marcada como pagada');
        }
    },
    
    completeTask(element) {
        element.style.opacity = '0.6';
        if (window.app && window.app.showToast) {
            window.app.showToast('Tarea completada');
        }
    }
};

