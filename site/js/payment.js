/**
 * Система оплаты через ЮKassa
 * Взаимодействует с payments.php
 */
class PaymentSystem {
    constructor() {
        this.initialized = false;
        this.paymentInProgress = false;
    }

    async init() {
        if (this.initialized) return true;

        try {
            console.log('Инициализация платежной системы...');
            
            // Проверка доступности платежной системы
            const testResponse = await fetch('payments.php', {
                method: 'HEAD'
            }).catch(() => null);

            if (testResponse && testResponse.ok) {
                this.initialized = true;
                console.log('✅ Платежная система готова');
                return true;
            } else {
                console.warn('⚠️ Платежная система временно недоступна');
                return false;
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации платежной системы:', error);
            return false;
        }
    }

    async createPayment(orderData) {
        if (this.paymentInProgress) {
            throw new Error('Платеж уже в процессе обработки');
        }

        this.paymentInProgress = true;

        try {
            console.log('Создание платежа для заказа:', orderData);

            const response = await fetch('payments.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            if (!result.confirmation_url) {
                throw new Error('Не получен URL для оплаты');
            }

            console.log('✅ Платеж создан, URL подтверждения:', result.confirmation_url);
            return result;

        } catch (error) {
            console.error('❌ Ошибка создания платежа:', error);
            throw error;
        } finally {
            this.paymentInProgress = false;
        }
    }

    redirectToPayment(confirmationUrl) {
        if (!confirmationUrl) {
            throw new Error('Не указан URL для оплаты');
        }

        // Можно добавить отслеживание перед редиректом
        if (typeof window.ym === 'function') {
            window.ym(XXXXXXX, 'reachGoal', 'payment_redirect'); // Замените XXXXXXX на ID Яндекс.Метрики
        }

        // Редирект на страницу оплаты ЮKassa
        window.location.href = confirmationUrl;
    }

    checkPaymentStatus(paymentId) {
        return new Promise((resolve, reject) => {
            if (!paymentId) {
                reject(new Error('Не указан ID платежа'));
                return;
            }

            const checkInterval = setInterval(async () => {
                try {
                    const response = await fetch(`payments.php?payment_id=${paymentId}`);
                    const result = await response.json();

                    if (result.status === 'succeeded') {
                        clearInterval(checkInterval);
                        resolve(result);
                    } else if (result.status === 'canceled') {
                        clearInterval(checkInterval);
                        reject(new Error('Платеж отменен'));
                    }
                    // Если статус pending, продолжаем опрос
                } catch (error) {
                    clearInterval(checkInterval);
                    reject(error);
                }
            }, 3000); // Проверка каждые 3 секунды

            // Таймаут через 5 минут
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Таймаут проверки статуса платежа'));
            }, 300000);
        });
    }

    // Вспомогательный метод для обработки callback от ЮKassa
    handleYookassaCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentId = urlParams.get('paymentId');
        const status = urlParams.get('status');

        if (paymentId && status) {
            console.log('Callback от ЮKassa:', { paymentId, status });
            
            // Здесь можно обновить UI в зависимости от статуса
            if (status === 'succeeded') {
                this.showPaymentSuccess(paymentId);
            } else if (status === 'canceled') {
                this.showPaymentCanceled();
            }
        }
    }

    showPaymentSuccess(paymentId) {
        // Можно показать модальное окно или перенаправить на success.html
        const successHtml = `
            <div style="text-align: center; padding: 40px;">
                <h2 style="color: #4CAF50;">✅ Оплата успешно завершена!</h2>
                <p>ID платежа: ${paymentId}</p>
                <p>Спасибо за заказ! С вами свяжется наш менеджер.</p>
                <button onclick="window.location.href = 'index.html'" 
                        style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Вернуться на главную
                </button>
            </div>
        `;

        // Замена содержимого страницы (или показать в модальном окне)
        document.body.innerHTML = successHtml;
    }

    showPaymentCanceled() {
        alert('Платеж был отменен. Вы можете попробовать снова.');
    }
}

// Глобальная инициализация (для обратной совместимости)
let globalPaymentSystem = null;

async function initPaymentSystem() {
    if (!globalPaymentSystem) {
        globalPaymentSystem = new PaymentSystem();
    }
    return await globalPaymentSystem.init();
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentSystem;
} else {
    window.PaymentSystem = PaymentSystem;
    window.initPaymentSystem = initPaymentSystem;
}