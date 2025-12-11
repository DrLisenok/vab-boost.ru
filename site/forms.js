/**
 * Класс для работы с формой заказа
 * Отправляет данные на payments.php для создания заказа и платежа
 */
class OrderForm {
    constructor(formId) {
        this.form = document.getElementById(formId);
        this.apiBase = ''; // Путь к API (пустая строка, если файлы в корне)
        
        // Карта регионов для расчета цены
        this.regionMultipliers = {
            'RU': 1.0,
            'EU': 1.2,
            'NA': 1.3,
            'ASIA': 1.4,
            'OTHER': 1.5
        };

        // Базовые цены услуг (можно брать из настроек БД)
        this.basePrices = {
            'rank_boost': 1999,
            'wins_boost': 299,
            'placement': 2499,
            'coaching': 999
        };

        this.init();
    }

    init() {
        if (!this.form) return;

        // Обработчик отправки формы
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Обработчики изменения полей для пересчета цены
        const priceInputs = this.form.querySelectorAll('select[name="service_type"], select[name="region"], input[name="current_rank"], input[name="target_rank"]');
        priceInputs.forEach(input => {
            input.addEventListener('change', () => this.calculatePrice());
        });

        // Инициализация расчета цены
        this.calculatePrice();
    }

    calculatePrice() {
        try {
            const serviceType = this.form.querySelector('select[name="service_type"]')?.value;
            const region = this.form.querySelector('select[name="region"]')?.value;
            const currentRank = this.form.querySelector('input[name="current_rank"]')?.value;
            const targetRank = this.form.querySelector('input[name="target_rank"]')?.value;

            if (!serviceType || !region) return;

            let price = this.basePrices[serviceType] || 0;

            // Модификатор для региона
            const regionMultiplier = this.regionMultipliers[region] || 1.0;
            price *= regionMultiplier;

            // Дополнительная логика для рангов (если это повышение ранга)
            if (serviceType === 'rank_boost' && currentRank && targetRank) {
                // Здесь можно добавить сложную логику расчета на основе рангов
                const rankDifference = this.getRankDifference(currentRank, targetRank);
                if (rankDifference > 0) {
                    price += rankDifference * 500; // Пример: +500 руб за каждый ранг
                }
            }

            // Округление и форматирование
            price = Math.round(price);
            
            // Обновление отображения цены
            const priceDisplay = this.form.querySelector('.price-display');
            if (priceDisplay) {
                priceDisplay.textContent = `${price} ₽`;
            }

            // Сохранение в скрытое поле
            const amountInput = this.form.querySelector('input[name="amount"]');
            if (amountInput) {
                amountInput.value = price;
            }

            return price;
        } catch (error) {
            console.error('Ошибка расчета цены:', error);
            return 0;
        }
    }

    getRankDifference(current, target) {
        // Упрощенная логика расчета разницы рангов
        const ranks = ['Iron 1', 'Iron 2', 'Iron 3', 'Bronze 1', 'Bronze 2', 'Bronze 3', 
                      'Silver 1', 'Silver 2', 'Silver 3', 'Gold 1', 'Gold 2', 'Gold 3',
                      'Platinum 1', 'Platinum 2', 'Platinum 3', 'Diamond 1', 'Diamond 2', 
                      'Diamond 3', 'Ascendant 1', 'Ascendant 2', 'Ascendant 3', 
                      'Immortal 1', 'Immortal 2', 'Immortal 3', 'Radiant'];
        
        const currentIndex = ranks.indexOf(current);
        const targetIndex = ranks.indexOf(target);
        
        if (currentIndex >= 0 && targetIndex >= 0) {
            return targetIndex - currentIndex;
        }
        return 0;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        try {
            // Показ индикатора загрузки
            const submitBtn = this.form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Отправка...';
            submitBtn.disabled = true;

            // Сбор данных формы
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());

            // Валидация
            if (!this.validate(data)) {
                throw new Error('Пожалуйста, заполните все обязательные поля');
            }

            // Если есть пароль от аккаунта, показать предупреждение
            if (data.game_password) {
                const confirmSend = confirm('Внимание! Вы отправляете пароль от игрового аккаунта. Убедитесь, что это безопасный канал связи. Продолжить?');
                if (!confirmSend) {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                    return;
                }
            }

            // Отправка на сервер
            const response = await fetch('payments.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Ошибка при создании заказа');
            }

            // Успешное создание заказа
            if (result.confirmation_url) {
                // Перенаправление на страницу оплаты ЮKassa
                window.location.href = result.confirmation_url;
            } else {
                this.showSuccessMessage('Заказ успешно создан! Ожидайте связи с менеджером.');
                this.form.reset();
            }

        } catch (error) {
            console.error('Ошибка при отправке формы:', error);
            this.showError(error.message || 'Произошла ошибка при отправке формы');
        } finally {
            // Восстановление кнопки
            const submitBtn = this.form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Оформить заказ';
            }
        }
    }

    validate(data) {
        if (!data.service_type) {
            this.showError('Выберите тип услуги');
            return false;
        }
        if (!data.region) {
            this.showError('Выберите регион');
            return false;
        }
        if (!data.contact_type || !data.contact_value) {
            this.showError('Укажите контакт для связи');
            return false;
        }
        
        // Проверка согласий
        const privacyCheck = this.form.querySelector('input[name="privacy_agreement"]');
        const termsCheck = this.form.querySelector('input[name="terms_agreement"]');
        
        if (privacyCheck && !privacyCheck.checked) {
            this.showError('Необходимо согласие с политикой конфиденциальности');
            return false;
        }
        if (termsCheck && !termsCheck.checked) {
            this.showError('Необходимо согласие с пользовательским соглашением');
            return false;
        }

        return true;
    }

    showError(message) {
        // Удаление старых сообщений об ошибках
        const oldError = this.form.querySelector('.error-message');
        if (oldError) oldError.remove();

        // Создание нового сообщения
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            background-color: #f8d7da;
            color: #721c24;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            border: 1px solid #f5c6cb;
        `;
        errorDiv.textContent = message;

        this.form.prepend(errorDiv);

        // Автоматическое удаление через 5 секунд
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    showSuccessMessage(message) {
        // Удаление старых сообщений
        const oldMessage = this.form.querySelector('.success-message');
        if (oldMessage) oldMessage.remove();

        // Создание нового сообщения
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.style.cssText = `
            background-color: #d4edda;
            color: #155724;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            border: 1px solid #c3e6cb;
        `;
        successDiv.textContent = message;

        this.form.prepend(successDiv);

        // Автоматическое удаление через 5 секунд
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 5000);
    }
}

// Инициализация всех форм заказа на странице
document.addEventListener('DOMContentLoaded', () => {
    const orderForms = document.querySelectorAll('form.order-form');
    orderForms.forEach((form, index) => {
        new OrderForm(form.id || `order-form-${index}`);
    });
});