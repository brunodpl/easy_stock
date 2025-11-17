// Utilidades generales de la aplicación
const Utils = {
    // Formatear números con separadores de miles
    formatNumber(num, decimals = 0) {
        return num.toLocaleString('es-ES', { 
            minimumFractionDigits: decimals, 
            maximumFractionDigits: decimals 
        });
    },
    
    // Formatear moneda
    formatCurrency(amount, currency = 'EUR') {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: currency
        }).format(amount);
    },
    
    // Formatear fecha
    formatDate(date, options = {}) {
        const defaultOptions = {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        };
        return new Date(date).toLocaleDateString('es-ES', { ...defaultOptions, ...options });
    },
    
    // Calcular días entre fechas
    daysBetween(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.ceil((new Date(date2) - new Date(date1)) / oneDay);
    },
    
    // Scroll suave a un elemento
    scrollToElement(elementId, offset = 0) {
        const element = document.getElementById(elementId);
        if (element) {
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    },
    
    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Detectar si es dispositivo móvil
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    
    // Detectar si es dispositivo táctil
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },
    
    // Copiar al portapapeles
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback para navegadores antiguos
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (err) {
                document.body.removeChild(textArea);
                return false;
            }
        }
    },
    
    // Vibrar dispositivo (si está disponible)
    vibrate(pattern = 200) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    },
    
    // Generar ID único
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    // Validar email
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    // Validar teléfono
    validatePhone(phone) {
        const re = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
        return re.test(phone);
    },
    
    // Sanitizar HTML
    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    
    // Obtener color según porcentaje
    getColorByPercentage(percentage) {
        if (percentage <= 33) return 'red';
        if (percentage <= 66) return 'orange';
        return 'green';
    },
    
    // Calcular porcentaje
    calculatePercentage(value, total) {
        if (total === 0) return 0;
        return Math.round((value / total) * 100);
    }
};

