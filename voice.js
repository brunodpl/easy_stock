// Módulo de reconocimiento de voz mejorado
const VoiceRecognition = {
    recognition: null,
    isRecording: false,
    isSupported: false,
    callbacks: {},
    
    // Inicializar reconocimiento de voz
    init() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.lang = CONFIG.voice.lang;
            this.recognition.continuous = CONFIG.voice.continuous;
            this.recognition.interimResults = CONFIG.voice.interimResults;
            this.isSupported = true;
            
            this.setupEventHandlers();
            return true;
        } else {
            console.warn('Reconocimiento de voz no disponible en este navegador');
            this.isSupported = false;
            return false;
        }
    },
    
    // Configurar manejadores de eventos
    setupEventHandlers() {
        this.recognition.onstart = () => {
            this.isRecording = true;
            this.updateUI('recording');
            this.triggerCallback('onStart');
            Utils.vibrate(100); // Feedback háptico
        };
        
        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const confidence = event.results[0][0].confidence;
            
            this.updateUI('result', transcript);
            this.triggerCallback('onResult', { transcript, confidence });
            this.processCommand(transcript);
        };
        
        this.recognition.onerror = (event) => {
            console.error('Error en reconocimiento de voz:', event.error);
            this.updateUI('error', event.error);
            this.triggerCallback('onError', event.error);
            this.isRecording = false;
            this.updateUI('stopped');
        };
        
        this.recognition.onend = () => {
            this.isRecording = false;
            this.updateUI('stopped');
            this.triggerCallback('onEnd');
        };
    },
    
    // Actualizar UI
    updateUI(status, data = null) {
        const btn = document.getElementById('voiceBtn');
        const statusEl = document.getElementById('voiceStatus');
        const statusText = document.getElementById('voiceStatusText');
        
        if (!btn || !statusEl || !statusText) return;
        
        switch (status) {
            case 'recording':
                btn.classList.add('recording');
                statusEl.classList.add('active');
                statusText.textContent = 'Escuchando...';
                break;
            case 'result':
                statusText.textContent = `Comando: ${data}`;
                break;
            case 'error':
                statusText.textContent = `Error: ${data}`;
                btn.classList.remove('recording');
                setTimeout(() => {
                    statusEl.classList.remove('active');
                }, 3000);
                break;
            case 'stopped':
                btn.classList.remove('recording');
                setTimeout(() => {
                    statusEl.classList.remove('active');
                }, 2000);
                break;
        }
    },
    
    // Procesar comando de voz
    processCommand(transcript) {
        const lowerCommand = transcript.toLowerCase().trim();
        
        // Buscar comando en configuración
        for (const [key, action] of Object.entries(CONFIG.voice.commands)) {
            if (lowerCommand.includes(key)) {
                this.executeCommand(action, transcript);
                return;
            }
        }
        
        // Comandos especiales con parámetros
        if (lowerCommand.includes('ver producto') || lowerCommand.includes('mostrar producto')) {
            const match = transcript.match(/\d+/);
            if (match) {
                const productId = parseInt(match[0]);
                this.executeCommand('viewProduct', productId);
                return;
            }
        }
        
        // Comando no reconocido
        this.triggerCallback('onUnknownCommand', transcript);
        if (window.app && window.app.showToast) {
            window.app.showToast(`Comando reconocido: ${transcript}`);
        }
    },
    
    // Ejecutar comando
    executeCommand(action, param = null) {
        if (window.app) {
            switch (action) {
                case 'viewProduct':
                    if (param && typeof param === 'number') {
                        const product = window.app.products.find(p => p.id === param);
                        if (product) {
                            window.app.viewProduct(param);
                            window.app.showToast(`Mostrando producto ${product.nombre}`);
                        } else {
                            window.app.showToast(`Producto ${param} no encontrado`);
                        }
                    }
                    break;
                case 'addProduct':
                    window.app.openAddProductModal();
                    window.app.showToast('Abriendo formulario para añadir producto');
                    break;
                case 'viewAlerts':
                    Utils.scrollToElement('alertsContainer', 100);
                    window.app.showToast('Mostrando alertas');
                    break;
                case 'viewInvoices':
                    Utils.scrollToElement('invoicesContainer', 100);
                    window.app.showToast('Mostrando facturas');
                    break;
                case 'viewTasks':
                    Utils.scrollToElement('tasksContainer', 100);
                    window.app.showToast('Mostrando tareas');
                    break;
                case 'closeModal':
                    // Cerrar cualquier modal abierto
                    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                        modal.classList.remove('active');
                    });
                    window.app.showToast('Modal cerrado');
                    break;
                case 'goBack':
                    window.history.back();
                    break;
            }
        }
    },
    
    // Iniciar reconocimiento
    start() {
        if (!this.isSupported) {
            console.warn('Reconocimiento de voz no está disponible');
            return false;
        }
        
        if (this.isRecording) {
            this.stop();
            return false;
        }
        
        try {
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('Error al iniciar reconocimiento:', error);
            return false;
        }
    },
    
    // Detener reconocimiento
    stop() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
    },
    
    // Registrar callback
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    },
    
    // Ejecutar callbacks
    triggerCallback(event, data = null) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error en callback ${event}:`, error);
                }
            });
        }
    },
    
    // Verificar si está disponible
    checkSupport() {
        return this.isSupported;
    }
};

