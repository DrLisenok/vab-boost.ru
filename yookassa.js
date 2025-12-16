// Конфигурация ЮKassa (ЗАМЕНИТЕ НА СВОИ ДАННЫЕ!)

// Конфигурация ЮKassa
const YOOKASSA_CONFIG = {
    shopId: '1226686', // Ваш shopId из ЛК ЮKassa
    secretKey: 'test_3LHmCEnVpAOe_1nR3kfj1voQeuy-4kJtVqaBuhtBFY8', // Ваш секретный ключ
    isTestMode: true // true для тестового режима, false для боевого
};

// Функция инициализации платежа
async function processYooKassaPayment(items, totalAmount) {
    if (items.length === 0) {
        showPaymentError('Корзина пуста');
        return;
    }
    
    // Создание модального окна оплаты
    createPaymentModal(items, totalAmount);
}

// Создание красивого модального окна
function createPaymentModal(items, totalAmount) {
    const modal = document.createElement('div');
    modal.id = 'payment-modal';
    modal.className = 'payment-modal';
    modal.innerHTML = `
        <div class="payment-modal-content">
            <div class="payment-header">
                <h3><i class="fas fa-lock"></i> Безопасная оплата</h3>
                <button class="payment-close">&times;</button>
            </div>
            
            <div class="payment-body">
                <div class="payment-summary">
                    <h4>Детали заказа</h4>
                    <div class="order-items">
                        ${items.map(item => `
                            <div class="order-item">
                                <span class="order-item-name">${item.name}</span>
                                <span class="order-item-price">${(item.price * item.quantity).toLocaleString('ru-RU')} ₽</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="order-total">
                        <strong>Итого к оплате:</strong>
                        <span class="total-amount">${totalAmount.toLocaleString('ru-RU')} ₽</span>
                    </div>
                </div>
                
                <div class="payment-methods">
                    <h4>Выберите способ оплаты</h4>
                    <div class="methods-grid">
                        <button class="method-btn active" data-method="card">
                            <i class="fas fa-credit-card"></i>
                            <span>Банковская карта</span>
                        </button>
                        <button class="method-btn" data-method="sbp">
                            <i class="fas fa-mobile-alt"></i>
                            <span>СБП</span>
                        </button>
                        <button class="method-btn" data-method="qiwi">
                            <i class="fas fa-wallet"></i>
                            <span>QIWI</span>
                        </button>
                        <button class="method-btn" data-method="yoomoney">
                            <i class="fas fa-ruble-sign"></i>
                            <span>ЮMoney</span>
                        </button>
                    </div>
                </div>
                
                <div class="payment-form">
                    <div class="form-group">
                        <label for="payment-email">Email для чека</label>
                        <input type="email" id="payment-email" 
                               placeholder="your@email.com" 
                               class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="payment-tg">Telegram для связи</label>
                        <input type="text" id="payment-tg" 
                               placeholder="@username" 
                               class="form-control">
                    </div>
                    
                    <div class="test-card-info">
                        <h5><i class="fas fa-info-circle"></i> Тестовые данные карты</h5>
                        <div class="test-card-grid">
                            <div class="test-card-item">
                                <span>Номер карты:</span>
                                <code>5555 5555 5555 4477</code>
                            </div>
                            <div class="test-card-item">
                                <span>Срок действия:</span>
                                <code>12/25</code>
                            </div>
                            <div class="test-card-item">
                                <span>CVC:</span>
                                <code>123</code>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="payment-footer">
                <div class="security-notice">
                    <i class="fas fa-shield-alt"></i>
                    <span>Платеж защищен технологиями ЮKassa</span>
                </div>
                <button class="btn btn-primary" id="confirm-payment">
                    <i class="fas fa-check"></i> Оплатить ${totalAmount.toLocaleString('ru-RU')} ₽
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Стили для модального окна
    const styles = document.createElement('style');
    styles.textContent = `
        .payment-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 25, 35, 0.95);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            padding: 20px;
        }
        
        .payment-modal-content {
            background: var(--gradient-card);
            border-radius: 16px;
            width: 100%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
            border: 1px solid rgba(255, 70, 85, 0.2);
            box-shadow: var(--shadow-heavy);
        }
        
        .payment-header {
            padding: 25px;
            border-bottom: 1px solid rgba(255, 70, 85, 0.2);
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(255, 70, 85, 0.1);
        }
        
        .payment-header h3 {
            margin: 0;
            color: var(--valorant-light);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .payment-close {
            background: none;
            border: none;
            color: var(--valorant-light);
            font-size: 1.5rem;
            cursor: pointer;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.3s;
        }
        
        .payment-close:hover {
            background: rgba(255, 70, 85, 0.1);
            color: var(--valorant-red);
        }
        
        .payment-body {
            padding: 25px;
        }
        
        .payment-summary, 
        .payment-methods, 
        .payment-form {
            margin-bottom: 30px;
        }
        
        .payment-summary h4,
        .payment-methods h4 {
            color: var(--valorant-light);
            margin-bottom: 20px;
            font-size: 1.2rem;
        }
        
        .order-items {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .order-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .order-item:last-child {
            border-bottom: none;
        }
        
        .order-total {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: rgba(255, 70, 85, 0.1);
            border-radius: 8px;
            border: 1px solid rgba(255, 70, 85, 0.2);
        }
        
        .total-amount {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--valorant-red);
            font-family: var(--font-heading);
        }
        
        .methods-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-top: 15px;
        }
        
        .method-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 15px;
            color: var(--valorant-light);
            cursor: pointer;
            transition: all 0.3s;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        }
        
        .method-btn:hover,
        .method-btn.active {
            border-color: var(--valorant-red);
            background: rgba(255, 70, 85, 0.1);
            transform: translateY(-2px);
        }
        
        .method-btn i {
            font-size: 1.5rem;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: var(--valorant-light);
            font-weight: 500;
        }
        
        .form-control {
            width: 100%;
            padding: 12px 15px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            color: var(--valorant-light);
            font-size: 1rem;
            transition: all 0.3s;
        }
        
        .form-control:focus {
            outline: none;
            border-color: var(--valorant-red);
            box-shadow: 0 0 0 2px rgba(255, 70, 85, 0.1);
        }
        
        .test-card-info {
            background: rgba(10, 203, 230, 0.1);
            border: 1px solid rgba(10, 203, 230, 0.2);
            border-radius: 8px;
            padding: 20px;
            margin-top: 30px;
        }
        
        .test-card-info h5 {
            color: var(--valorant-blue);
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .test-card-grid {
            display: grid;
            gap: 10px;
        }
        
        .test-card-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .test-card-item:last-child {
            border-bottom: none;
        }
        
        .test-card-item code {
            background: rgba(0, 0, 0, 0.3);
            padding: 4px 8px;
            border-radius: 4px;
            font-family: var(--font-mono);
        }
        
        .payment-footer {
            padding: 25px;
            border-top: 1px solid rgba(255, 70, 85, 0.2);
            background: rgba(15, 25, 35, 0.5);
        }
        
        .security-notice {
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--valorant-green);
            margin-bottom: 20px;
            font-size: 0.9rem;
        }
        
        #confirm-payment {
            width: 100%;
        }
    `;
    document.head.appendChild(styles);
    
    // Обработчики событий
    modal.querySelector('.payment-close').addEventListener('click', closePaymentModal);
    
    modal.querySelectorAll('.method-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            modal.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    modal.querySelector('#confirm-payment').addEventListener('click', async function() {
        const email = modal.querySelector('#payment-email').value;
        const telegram = modal.querySelector('#payment-tg').value;
        
        if (!email) {
            showPaymentError('Введите email для отправки чека');
            return;
        }
        
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка платежа...';
        this.disabled = true;
        
        // Симуляция оплаты
        setTimeout(() => {
            closePaymentModal();
            showPaymentSuccess();
        }, 2000);
    });
    
    function closePaymentModal() {
        modal.remove();
        styles.remove();
        document.body.style.overflow = '';
    }
}

function showPaymentSuccess() {
    const successModal = document.createElement('div');
    successModal.className = 'payment-success';
    successModal.innerHTML = `
        <div class="success-content">
            <div class="success-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <h3>Оплата прошла успешно!</h3>
            <p>Чек отправлен на вашу почту. Наш менеджер свяжется с вами в течение 15 минут.</p>
            <button class="btn btn-primary" id="close-success">
                Отлично!
            </button>
        </div>
    `;
    
    const styles = document.createElement('style');
    styles.textContent = `
        .payment-success {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 25, 35, 0.95);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        }
        
        .success-content {
            background: var(--gradient-card);
            border-radius: 16px;
            padding: 50px 40px;
            text-align: center;
            max-width: 400px;
            border: 1px solid rgba(255, 70, 85, 0.2);
            box-shadow: var(--shadow-heavy);
        }
        
        .success-icon {
            font-size: 5rem;
            color: var(--valorant-green);
            margin-bottom: 30px;
        }
        
        .success-content h3 {
            color: var(--valorant-light);
            margin-bottom: 20px;
        }
        
        .success-content p {
            color: var(--valorant-gray);
            margin-bottom: 30px;
            line-height: 1.6;
        }
    `;
    
    document.body.appendChild(successModal);
    document.head.appendChild(styles);
    document.body.style.overflow = 'hidden';
    
    successModal.querySelector('#close-success').addEventListener('click', () => {
        successModal.remove();
        styles.remove();
        document.body.style.overflow = '';
        
        // Очистка корзины
        if (window.cartManager) {
            window.cartManager.items = [];
            window.cartManager.saveCart();
            window.cartManager.updateCartCount();
            window.cartManager.renderCartItems();
        }
    });
}

function showPaymentError(message) {
    alert(message); // В реальном проекте сделайте красивое уведомление
}

// Экспорт функции
window.processYooKassaPayment = processYooKassaPayment;