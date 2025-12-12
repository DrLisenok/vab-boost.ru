/**
 * Payment System for VAB BOOST
 */

class PaymentSystem {
    constructor() {
        this.csrfToken = '';
        this.paymentStatusInterval = null;
        this.initialized = false;
    }
    
    /**
     * Initialize payment system
     */
    async init() {
        if (this.initialized) return true;
        
        try {
            // Get CSRF token
            await this.getCSRFToken();
            
            // Check URL for payment callback
            this.handlePaymentCallback();
            
            this.initialized = true;
            console.log('✅ Payment system initialized');
            return true;
        } catch (error) {
            console.error('❌ Payment system initialization failed:', error);
            return false;
        }
    }
    
    /**
     * Get CSRF token from server
     */
    async getCSRFToken() {
        try {
            const response = await fetch('/api/csrf');
            const data = await response.json();
            
            if (data.csrf_token) {
                this.csrfToken = data.csrf_token;
                return this.csrfToken;
            }
        } catch (error) {
            console.error('Failed to get CSRF token:', error);
        }
        
        return null;
    }
    
    /**
     * Create payment
     * @param {Object} orderData - Order data
     */
    async createPayment(orderData) {
        if (!this.csrfToken) {
            await this.getCSRFToken();
        }
        
        try {
            const response = await fetch('/api/payments.php?action=create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({
                    ...orderData,
                    csrf_token: this.csrfToken
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Update CSRF token if provided
                if (result.csrf_token) {
                    this.csrfToken = result.csrf_token;
                }
                
                return {
                    success: true,
                    payment: result.payment
                };
            } else {
                throw new Error(result.error || 'Ошибка создания платежа');
            }
        } catch (error) {
            console.error('Payment creation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Get payment status
     * @param {string} paymentId - Payment ID
     */
    async getPaymentStatus(paymentId) {
        try {
            const response = await fetch(`/api/payments.php?action=status&id=${paymentId}`);
            const data = await response.json();
            
            return {
                success: response.ok,
                payment: data.payment || data
            };
        } catch (error) {
            console.error('Payment status check error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Monitor payment status
     * @param {string} paymentId - Payment ID
     * @param {Function} onStatusChange - Callback when status changes
     */
    monitorPayment(paymentId, onStatusChange) {
        let lastStatus = '';
        
        this.paymentStatusInterval = setInterval(async () => {
            const result = await this.getPaymentStatus(paymentId);
            
            if (result.success && result.payment) {
                const currentStatus = result.payment.status;
                
                if (currentStatus !== lastStatus) {
                    lastStatus = currentStatus;
                    onStatusChange(currentStatus, result.payment);
                    
                    // Stop monitoring if payment is finalized
                    if (['succeeded', 'canceled', 'refunded'].includes(currentStatus)) {
                        this.stopMonitoring();
                    }
                }
            }
        }, 5000); // Check every 5 seconds
        
        // Auto stop after 30 minutes
        setTimeout(() => this.stopMonitoring(), 30 * 60 * 1000);
    }
    
    /**
     * Stop payment monitoring
     */
    stopMonitoring() {
        if (this.paymentStatusInterval) {
            clearInterval(this.paymentStatusInterval);
            this.paymentStatusInterval = null;
        }
    }
    
    /**
     * Handle payment callback from URL
     */
    handlePaymentCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentId = urlParams.get('payment_id');
        const status = urlParams.get('status');
        const orderId = urlParams.get('order_id');
        
        if (paymentId && status) {
            this.showPaymentResult(paymentId, status, orderId);
            
            // Clean URL
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    }
    
    /**
     * Show payment result
     * @param {string} paymentId - Payment ID
     * @param {string} status - Payment status
     * @param {string} orderId - Order ID
     */
    showPaymentResult(paymentId, status, orderId = null) {
        let title, message, icon, color;
        
        switch (status) {
            case 'succeeded':
                title = '✅ Оплата успешна!';
                message = 'Спасибо за оплату. Ваш заказ принят в работу.';
                icon = 'check-circle';
                color = 'var(--success)';
                break;
                
            case 'canceled':
                title = '❌ Платеж отменен';
                message = 'Вы можете повторить попытку оплаты.';
                icon = 'times-circle';
                color = 'var(--danger)';
                break;
                
            case 'pending':
                title = '⏳ Ожидание оплаты';
                message = 'Ожидаем подтверждения платежа от банка.';
                icon = 'clock';
                color = 'var(--warning)';
                break;
                
            default:
                title = 'ℹ️ Статус платежа';
                message = `Статус: ${status}`;
                icon = 'info-circle';
                color = 'var(--primary)';
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'payment-modal';
        modal.innerHTML = `
            <div class="payment-modal-content">
                <div class="payment-modal-icon" style="color: ${color};">
                    <i class="fas fa-${icon} fa-4x"></i>
                </div>
                <h3>${title}</h3>
                <p>${message}</p>
                
                ${paymentId ? `<p><small>ID платежа: ${paymentId}</small></p>` : ''}
                
                <div class="payment-modal-actions">
                    ${status === 'succeeded' ? `
                        <button class="btn btn-primary" onclick="window.location.href='/success.html'">
                            <i class="fas fa-ticket-alt"></i> Детали заказа
                        </button>
                    ` : ''}
                    
                    ${status === 'canceled' ? `
                        <button class="btn btn-outline" onclick="window.location.href='/#order'">
                            <i class="fas fa-redo"></i> Попробовать снова
                        </button>
                    ` : ''}
                    
                    <button class="btn btn-primary" onclick="this.closest('.payment-modal').remove()">
                        <i class="fas fa-home"></i> На главную
                    </button>
                </div>
            </div>
        `;
        
        // Styles
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '10000';
        modal.style.animation = 'fadeIn 0.3s ease';
        
        const content = modal.querySelector('.payment-modal-content');
        content.style.background = 'white';
        content.style.padding = '2rem';
        content.style.borderRadius = 'var(--border-radius-lg)';
        content.style.maxWidth = '400px';
        content.style.width = '90%';
        content.style.textAlign = 'center';
        
        if (document.body.classList.contains('dark-mode')) {
            content.style.background = 'var(--dark)';
            content.style.color = 'white';
        }
        
        document.body.appendChild(modal);
        
        // Auto close for success after 10 seconds
        if (status === 'succeeded') {
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.remove();
                    window.location.href = '/success.html';
                }
            }, 10000);
        }
    }
    
    /**
     * Redirect to payment page
     * @param {string} url - Payment URL
     */
    redirectToPayment(url) {
        // Open in new tab
        window.open(url, '_blank');
        
        // Or redirect current page
        // window.location.href = url;
    }
    
    /**
     * Validate payment data
     * @param {Object} data - Payment data
     */
    validatePaymentData(data) {
        const errors = [];
        
        if (!data.amount || data.amount < 1) {
            errors.push('Неверная сумма оплаты');
        }
        
        if (!data.order_id) {
            errors.push('Отсутствует ID заказа');
        }
        
        if (!data.description) {
            errors.push('Отсутствует описание платежа');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Format amount for display
     * @param {number} amount - Amount
     */
    formatAmount(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(amount);
    }
    
    /**
     * Generate payment QR code (for alternative payment methods)
     * @param {string} paymentUrl - Payment URL
     * @param {HTMLElement} container - Container element
     */
    async generateQRCode(paymentUrl, container) {
        // Using QRCode.js library would be needed
        // This is a placeholder implementation
        console.log('Generating QR code for:', paymentUrl);
        
        // You would typically use a library like:
        // new QRCode(container, paymentUrl);
        
        // For now, create a simple placeholder
        const qrPlaceholder = document.createElement('div');
        qrPlaceholder.style.textAlign = 'center';
        qrPlaceholder.style.padding = '1rem';
        qrPlaceholder.innerHTML = `
            <div style="
                width: 200px;
                height: 200px;
                background: linear-gradient(45deg, #6c63ff, #00d4ff);
                margin: 0 auto;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
            ">
                QR Code
            </div>
            <p style="margin-top: 1rem; color: var(--gray);">
                Отсканируйте для оплаты
            </p>
        `;
        
        container.appendChild(qrPlaceholder);
    }
}

// Create global instance
window.paymentSystem = new PaymentSystem();

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    window.paymentSystem.init();
});