/**
 * VAB BOOST - Success Page JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize success page
    initSuccessPage();
    initOrderTracking();
    initPrintFunctionality();
    
    console.log('✅ Success page loaded');
});

/**
 * Initialize success page
 */
function initSuccessPage() {
    // Get order details from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order') || localStorage.getItem('lastOrderId');
    const paymentId = urlParams.get('payment_id') || localStorage.getItem('lastPaymentId');
    
    if (orderId || paymentId) {
        loadOrderDetails(orderId, paymentId);
    } else {
        // Show demo data
        showDemoData();
    }
    
    // Update timeline based on order status
    updateTimeline();
    
    // Setup auto refresh for order status
    if (orderId) {
        startOrderStatusPolling(orderId);
    }
}

/**
 * Load order details from server
 */
async function loadOrderDetails(orderId, paymentId) {
    try {
        let orderData = null;
        
        if (orderId) {
            // Try to load by order ID
            const response = await fetch(`/api/orders.php?action=get&id=${orderId}`);
            orderData = await response.json();
        } else if (paymentId) {
            // Try to load by payment ID
            const response = await fetch(`/api/payments.php?action=status&id=${paymentId}`);
            const paymentData = await response.json();
            
            if (paymentData.payment && paymentData.payment.order_id) {
                const orderResponse = await fetch(`/api/orders.php?action=get&id=${paymentData.payment.order_id}`);
                orderData = await orderResponse.json();
            }
        }
        
        if (orderData && orderData.order) {
            updateOrderDisplay(orderData.order);
            saveOrderToLocalStorage(orderData.order);
        } else {
            throw new Error('Order not found');
        }
    } catch (error) {
        console.error('Failed to load order details:', error);
        showDemoData();
    }
}

/**
 * Update order display with real data
 */
function updateOrderDisplay(order) {
    // Update order number
    const orderNumberElement = document.getElementById('orderNumber');
    if (orderNumberElement && order.order_number) {
        orderNumberElement.textContent = order.order_number;
    }
    
    // Update order date
    const orderDateElement = document.getElementById('orderDate');
    if (orderDateElement && order.created_at) {
        const date = new Date(order.created_at);
        orderDateElement.textContent = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    // Update order amount
    const orderAmountElement = document.getElementById('orderAmount');
    if (orderAmountElement && order.amount) {
        orderAmountElement.textContent = new Intl.NumberFormat('ru-RU').format(order.amount) + ' ₽';
    }
    
    // Update timeline times
    updateTimelineTimes(order);
}

/**
 * Update timeline with order times
 */
function updateTimelineTimes(order) {
    const step1Time = document.getElementById('step1Time');
    if (step1Time && order.created_at) {
        const date = new Date(order.created_at);
        step1Time.textContent = 'Сегодня, ' + date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    const step2Time = document.getElementById('step2Time');
    if (step2Time && order.updated_at) {
        const date = new Date(order.updated_at);
        step2Time.textContent = 'Сегодня, ' + date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}

/**
 * Save order to localStorage
 */
function saveOrderToLocalStorage(order) {
    try {
        localStorage.setItem('lastOrderId', order.id);
        localStorage.setItem('lastOrderNumber', order.order_number);
        localStorage.setItem('lastOrderDate', order.created_at);
        localStorage.setItem('lastOrderAmount', order.amount);
    } catch (error) {
        console.error('Failed to save order to localStorage:', error);
    }
}

/**
 * Show demo data for testing
 */
function showDemoData() {
    // Generate a demo order number
    const demoOrderNumber = 'VAB-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + 
                           Math.random().toString(36).substr(2, 6).toUpperCase();
    
    // Update display with demo data
    document.getElementById('orderNumber').textContent = demoOrderNumber;
    document.getElementById('orderDate').textContent = new Date().toLocaleDateString('ru-RU') + ' ' + 
                                                     new Date().toLocaleTimeString('ru-RU', { 
                                                         hour: '2-digit', 
                                                         minute: '2-digit' 
                                                     });
    document.getElementById('orderAmount').textContent = '1 999 ₽';
}

/**
 * Initialize order tracking
 */
function initOrderTracking() {
    // Setup timeline interaction
    const timelineSteps = document.querySelectorAll('.timeline-step');
    
    timelineSteps.forEach((step, index) => {
        step.addEventListener('click', () => {
            // Show more details about this step
            showStepDetails(index);
        });
    });
    
    // Setup tracking number copy
    const orderNumberElement = document.getElementById('orderNumber');
    if (orderNumberElement) {
        orderNumberElement.addEventListener('click', () => {
            copyToClipboard(orderNumberElement.textContent);
            showNotification('Номер заказа скопирован в буфер обмена', 'success');
        });
        
        // Add tooltip
        orderNumberElement.title = 'Нажмите, чтобы скопировать номер заказа';
        orderNumberElement.style.cursor = 'pointer';
    }
}

/**
 * Update timeline based on order status
 */
function updateTimeline() {
    // This would be updated based on real order status from server
    // For now, we'll simulate progression
    
    const steps = document.querySelectorAll('.timeline-step');
    let activeSteps = 2; // Default: order created and payment confirmed
    
    // Simulate progress over time
    setTimeout(() => {
        if (steps.length > 2) {
            steps[2].classList.add('active');
            steps[2].querySelector('.step-time').textContent = 'Сегодня, ' + 
                new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        }
    }, 3000);
    
    setTimeout(() => {
        if (steps.length > 3) {
            steps[3].classList.add('active');
            steps[3].querySelector('.step-time').textContent = 'Сегодня, ' + 
                new Date(Date.now() + 60000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        }
    }, 6000);
}

/**
 * Show step details
 */
function showStepDetails(stepIndex) {
    const stepTitles = [
        'Заказ оформлен',
        'Оплата подтверждена',
        'Назначен бустер',
        'В процессе выполнения',
        'Завершено'
    ];
    
    const stepDescriptions = [
        'Ваш заказ успешно создан и добавлен в очередь на обработку. Все данные сохранены в нашей системе.',
        'Платеж успешно получен и подтвержден платежной системой. Средства зарезервированы для выполнения заказа.',
        'Профессиональный игрок назначен для выполнения вашего заказа. Он свяжется с вами для уточнения деталей.',
        'Бустер приступил к выполнению заказа. Вы можете отслеживать прогресс через личный кабинет.',
        'Заказ успешно выполнен и проверен. Все условия выполнены в полном объеме.'
    ];
    
    const modalHTML = `
        <div class="step-details-modal">
            <div class="modal-header">
                <h3>${stepTitles[stepIndex]}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>${stepDescriptions[stepIndex]}</p>
                
                ${stepIndex === 1 ? `
                <div class="payment-details">
                    <h4>Детали оплаты:</h4>
                    <p>• Способ оплаты: Банковская карта</p>
                    <p>• Платежная система: ЮKassa</p>
                    <p>• Статус: Успешно</p>
                </div>
                ` : ''}
                
                ${stepIndex === 2 ? `
                <div class="booster-details">
                    <h4>Информация о бустере:</h4>
                    <p>• Рейтинг: Radiant</p>
                    <p>• Опыт: 3+ года</p>
                    <p>• Выполнено заказов: 250+</p>
                    <p>• Рейтинг доверия: 4.9/5</p>
                </div>
                ` : ''}
                
                ${stepIndex === 3 ? `
                <div class="progress-details">
                    <h4>Прогресс выполнения:</h4>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 65%"></div>
                    </div>
                    <p>Примерное время до завершения: 4-6 часов</p>
                </div>
                ` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary close-modal">Закрыть</button>
            </div>
        </div>
    `;
    
    // Create and show modal
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-overlay';
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        }
        
        .step-details-modal {
            background: white;
            border-radius: var(--border-radius-lg);
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow: hidden;
            animation: slideUp 0.3s ease;
        }
        
        .dark-mode .step-details-modal {
            background: var(--dark);
            color: var(--light);
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid var(--gray-light);
        }
        
        .dark-mode .modal-header {
            border-color: var(--gray-dark);
        }
        
        .modal-header h3 {
            margin: 0;
        }
        
        .modal-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--gray);
        }
        
        .modal-body {
            padding: 1.5rem;
            max-height: 60vh;
            overflow-y: auto;
        }
        
        .modal-footer {
            padding: 1.5rem;
            border-top: 1px solid var(--gray-light);
            text-align: right;
        }
        
        .dark-mode .modal-footer {
            border-color: var(--gray-dark);
        }
        
        .payment-details,
        .booster-details,
        .progress-details {
            margin-top: 1.5rem;
            padding: 1rem;
            background: var(--gray-light);
            border-radius: var(--border-radius-md);
        }
        
        .dark-mode .payment-details,
        .dark-mode .booster-details,
        .dark-mode .progress-details {
            background: var(--gray-dark);
        }
        
        .progress-bar {
            height: 8px;
            background: var(--gray-light);
            border-radius: 4px;
            overflow: hidden;
            margin: 1rem 0;
        }
        
        .dark-mode .progress-bar {
            background: var(--gray-dark);
        }
        
        .progress-fill {
            height: 100%;
            background: var(--gradient-primary);
            border-radius: 4px;
        }
    `;
    document.head.appendChild(style);
    
    // Setup close handlers
    const closeBtn = modalContainer.querySelector('.modal-close');
    const closeModalBtn = modalContainer.querySelector('.close-modal');
    const overlay = modalContainer;
    
    const closeModal = () => {
        modalContainer.style.animation = 'fadeIn 0.3s ease reverse';
        setTimeout(() => {
            document.body.removeChild(modalContainer);
            document.head.removeChild(style);
        }, 300);
    };
    
    closeBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

/**
 * Initialize print functionality
 */
function initPrintFunctionality() {
    // Add print-specific styles
    const printStyles = `
        @media print {
            .no-print {
                display: none !important;
            }
            
            body {
                font-size: 12pt;
                line-height: 1.5;
            }
            
            .success-hero {
                padding: 1cm 0 !important;
                background: white !important;
                color: black !important;
            }
            
            .success-icon {
                color: black !important;
                font-size: 48pt !important;
            }
            
            .order-details-card {
                background: white !important;
                border: 2pt solid black !important;
                color: black !important;
                margin: 1cm auto !important;
            }
            
            .info-item {
                border-color: #ccc !important;
            }
            
            .status-paid {
                color: black !important;
            }
            
            a {
                color: black !important;
                text-decoration: none !important;
            }
        }
    `;
    
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = printStyles;
    document.head.appendChild(styleSheet);
    
    // Add no-print class to elements that shouldn't print
    document.querySelectorAll('.navbar, .success-actions, .tracking-section, .support-section, .footer')
        .forEach(el => el.classList.add('no-print'));
}

/**
 * Start polling for order status updates
 */
function startOrderStatusPolling(orderId) {
    let pollingInterval;
    let pollCount = 0;
    const maxPolls = 60; // Poll for up to 5 minutes (every 5 seconds)
    
    const pollOrderStatus = async () => {
        if (pollCount >= maxPolls) {
            clearInterval(pollingInterval);
            return;
        }
        
        pollCount++;
        
        try {
            const response = await fetch(`/api/orders.php?action=status&id=${orderId}`);
            const data = await response.json();
            
            if (response.ok && data.status) {
                updateOrderStatus(data.status);
                
                // Stop polling if order is completed or cancelled
                if (['completed', 'cancelled'].includes(data.status.status)) {
                    clearInterval(pollingInterval);
                    showOrderCompletion(data.status.status);
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    };
    
    // Start polling every 5 seconds
    pollingInterval = setInterval(pollOrderStatus, 5000);
    
    // Initial poll
    pollOrderStatus();
}

/**
 * Update order status display
 */
function updateOrderStatus(statusData) {
    const statusElement = document.querySelector('.status-paid');
    if (statusElement && statusData.status) {
        const statusText = {
            'pending': 'Ожидание оплаты',
            'paid': 'Оплачено',
            'processing': 'В работе',
            'completed': 'Завершено',
            'cancelled': 'Отменено'
        };
        
        statusElement.textContent = statusText[statusData.status] || statusData.status;
        
        // Update status class
        statusElement.className = 'info-value status-' + statusData.status;
    }
    
    // Update timeline based on status
    updateTimelineFromStatus(statusData.status);
}

/**
 * Update timeline based on order status
 */
function updateTimelineFromStatus(status) {
    const steps = document.querySelectorAll('.timeline-step');
    
    // Reset all steps
    steps.forEach(step => step.classList.remove('active'));
    
    // Activate steps based on status
    switch (status) {
        case 'pending':
            steps[0].classList.add('active');
            break;
        case 'paid':
            steps[0].classList.add('active');
            steps[1].classList.add('active');
            break;
        case 'processing':
            steps[0].classList.add('active');
            steps[1].classList.add('active');
            steps[2].classList.add('active');
            steps[3].classList.add('active');
            break;
        case 'completed':
            steps.forEach(step => step.classList.add('active'));
            break;
    }
}

/**
 * Show order completion message
 */
function showOrderCompletion(status) {
    if (status === 'completed') {
        const completionHTML = `
            <div class="completion-message">
                <div class="completion-icon">
                    <i class="fas fa-trophy"></i>
                </div>
                <h3>Заказ выполнен!</h3>
                <p>Ваш заказ успешно выполнен. Проверьте свой аккаунт в Valorant.</p>
                <button class="btn btn-primary close-completion">Отлично!</button>
            </div>
        `;
        
        const completionDiv = document.createElement('div');
        completionDiv.className = 'completion-overlay';
        completionDiv.innerHTML = completionHTML;
        document.body.appendChild(completionDiv);
        
        // Add styles
        const completionStyle = document.createElement('style');
        completionStyle.textContent = `
            .completion-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                animation: fadeIn 0.3s ease;
            }
            
            .completion-message {
                background: white;
                border-radius: var(--border-radius-lg);
                padding: 3rem;
                text-align: center;
                max-width: 400px;
                width: 90%;
                animation: slideUp 0.3s ease;
            }
            
            .dark-mode .completion-message {
                background: var(--dark);
                color: var(--light);
            }
            
            .completion-icon {
                font-size: 4rem;
                color: var(--success);
                margin-bottom: 1.5rem;
            }
            
            .completion-message h3 {
                margin-bottom: 1rem;
            }
            
            .completion-message p {
                margin-bottom: 2rem;
                color: var(--gray);
            }
        `;
        document.head.appendChild(completionStyle);
        
        // Setup close handler
        const closeBtn = completionDiv.querySelector('.close-completion');
        closeBtn.addEventListener('click', () => {
            completionDiv.style.animation = 'fadeIn 0.3s ease reverse';
            setTimeout(() => {
                document.body.removeChild(completionDiv);
                document.head.removeChild(completionStyle);
            }, 300);
        });
    }
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'var(--success)' : 'var(--primary)'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: var(--border-radius-md);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        box-shadow: var(--shadow-lg);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Utility function to format dates
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Add to global namespace for easy access
window.VABSuccess = {
    initSuccessPage,
    loadOrderDetails,
    showStepDetails,
    copyToClipboard
};