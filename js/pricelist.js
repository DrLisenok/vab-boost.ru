/**
 * VAB BOOST - Pricelist Page JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize pricelist page
    initPricelist();
    initServiceSelection();
    initFAQ();
    initPricingSwitch();
    
    console.log('✅ Pricelist page loaded');
});

/**
 * Initialize pricelist page
 */
function initPricelist() {
    // Setup smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerHeight = document.getElementById('navbar').offsetHeight;
                const targetPosition = targetElement.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Calculate and display dynamic prices
    calculateDynamicPrices();
}

/**
 * Initialize service selection
 */
function initServiceSelection() {
    // Service selection buttons
    const serviceButtons = document.querySelectorAll('[data-service]');
    
    serviceButtons.forEach(button => {
        button.addEventListener('click', function() {
            const service = this.dataset.service;
            const amount = this.dataset.amount;
            const fromRank = this.dataset.from;
            const toRank = this.dataset.to;
            const wins = this.dataset.wins;
            
            // Store service selection
            const serviceData = {
                service: service,
                amount: amount,
                fromRank: fromRank,
                toRank: toRank,
                wins: wins
            };
            
            localStorage.setItem('selectedService', JSON.stringify(serviceData));
            
            // Redirect to order page
            window.location.href = '/#order';
        });
    });
    
    // Rank calculator
    initRankCalculator();
}

/**
 * Initialize rank calculator
 */
function initRankCalculator() {
    const rankCalculator = document.getElementById('rankCalculator');
    if (!rankCalculator) return;
    
    const fromSelect = rankCalculator.querySelector('#calcFrom');
    const toSelect = rankCalculator.querySelector('#calcTo');
    const resultDiv = rankCalculator.querySelector('#calcResult');
    
    if (!fromSelect || !toSelect || !resultDiv) return;
    
    // Rank order for calculation
    const rankOrder = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'ascendant', 'immortal', 'radiant'];
    
    // Base prices per rank
    const rankPrices = {
        'iron': 800,
        'bronze': 1000,
        'silver': 1200,
        'gold': 1500,
        'platinum': 1800,
        'diamond': 2200,
        'ascendant': 2600,
        'immortal': 3000,
        'radiant': 4000
    };
    
    // Base fee
    const baseFee = 1999;
    
    const calculatePrice = () => {
        const fromRank = fromSelect.value;
        const toRank = toSelect.value;
        
        if (!fromRank || !toRank) {
            resultDiv.innerHTML = '<p class="text-gray">Выберите начальный и конечный ранги</p>';
            return;
        }
        
        const fromIndex = rankOrder.indexOf(fromRank);
        const toIndex = rankOrder.indexOf(toRank);
        
        if (fromIndex === -1 || toIndex === -1) {
            resultDiv.innerHTML = '<p class="text-danger">Ошибка в выборе рангов</p>';
            return;
        }
        
        if (fromIndex >= toIndex) {
            resultDiv.innerHTML = '<p class="text-danger">Конечный ранг должен быть выше начального</p>';
            return;
        }
        
        // Calculate price
        let total = baseFee;
        for (let i = fromIndex; i < toIndex; i++) {
            total += rankPrices[rankOrder[i]] || 1000;
        }
        
        // Apply discount for multiple ranks
        const rankCount = toIndex - fromIndex;
        let discount = 0;
        
        if (rankCount >= 3) discount = 0.1; // 10% for 3+ ranks
        if (rankCount >= 5) discount = 0.15; // 15% for 5+ ranks
        if (rankCount >= 7) discount = 0.2; // 20% for 7+ ranks
        
        const finalPrice = Math.round(total * (1 - discount));
        
        // Display result
        resultDiv.innerHTML = `
            <div class="calculation-result">
                <h4>Результат расчета:</h4>
                <div class="result-details">
                    <p>Повышение с <strong>${fromRank.toUpperCase()}</strong> до <strong>${toRank.toUpperCase()}</strong></p>
                    <p>Количество рангов: <strong>${rankCount}</strong></p>
                    ${discount > 0 ? `<p>Скидка: <strong>${discount * 100}%</strong></p>` : ''}
                    <p class="result-price">Итоговая стоимость: <strong>${finalPrice.toLocaleString('ru-RU')} ₽</strong></p>
                </div>
                <button class="btn btn-primary" 
                        data-service="rank_boost"
                        data-amount="${finalPrice}"
                        data-from="${fromRank}"
                        data-to="${toRank}">
                    Заказать за ${finalPrice.toLocaleString('ru-RU')} ₽
                </button>
            </div>
        `;
        
        // Re-attach event listener to the new button
        const orderButton = resultDiv.querySelector('.btn');
        if (orderButton) {
            orderButton.addEventListener('click', function() {
                const serviceData = {
                    service: this.dataset.service,
                    amount: this.dataset.amount,
                    fromRank: this.dataset.from,
                    toRank: this.dataset.to
                };
                
                localStorage.setItem('selectedService', JSON.stringify(serviceData));
                window.location.href = '/#order';
            });
        }
    };
    
    fromSelect.addEventListener('change', calculatePrice);
    toSelect.addEventListener('change', calculatePrice);
    
    // Initial calculation
    calculatePrice();
}

/**
 * Initialize FAQ
 */
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            // Close other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active');
        });
    });
}

/**
 * Initialize pricing switch
 */
function initPricingSwitch() {
    const switchButtons = document.querySelectorAll('.switch-btn');
    
    switchButtons.forEach(button => {
        button.addEventListener('click', function() {
            const period = this.dataset.period;
            
            // Update active button
            switchButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Show/hide pricing based on period
            updatePricingDisplay(period);
        });
    });
}

/**
 * Update pricing display based on selected period
 */
function updatePricingDisplay(period) {
    // This would typically involve showing different pricing tables
    // For now, we'll just show a notification
    
    const message = period === 'monthly' 
        ? 'Показаны цены за единоразовую оплату' 
        : 'Показаны цены за пакетные услуги';
    
    showNotification(message, 'info');
}

/**
 * Calculate and display dynamic prices
 */
function calculateDynamicPrices() {
    // Update time-based pricing (discounts during off-peak hours)
    updateTimeBasedPricing();
    
    // Update currency conversion if needed
    updateCurrencyConversion();
}

/**
 * Update time-based pricing
 */
function updateTimeBasedPricing() {
    const now = new Date();
    const hour = now.getHours();
    
    // Discount during night hours (00:00 - 06:00)
    if (hour >= 0 && hour < 6) {
        const discountPercent = 15; // 15% night discount
        
        // Update prices with discount
        document.querySelectorAll('.price').forEach(priceElement => {
            const originalText = priceElement.textContent;
            const originalPrice = parseFloat(originalText.replace(/[^\d]/g, ''));
            
            if (!isNaN(originalPrice)) {
                const discountedPrice = Math.round(originalPrice * (1 - discountPercent / 100));
                
                // Add discount badge
                if (!priceElement.parentNode.querySelector('.night-discount')) {
                    const discountBadge = document.createElement('span');
                    discountBadge.className = 'night-discount';
                    discountBadge.textContent = `-${discountPercent}%`;
                    discountBadge.style.cssText = `
                        background: var(--secondary);
                        color: white;
                        padding: 0.25rem 0.5rem;
                        border-radius: var(--border-radius-sm);
                        font-size: 0.75rem;
                        font-weight: 600;
                        margin-left: 0.5rem;
                    `;
                    
                    priceElement.parentNode.appendChild(discountBadge);
                    
                    // Update price display
                    const originalDisplay = document.createElement('span');
                    originalDisplay.className = 'original-price';
                    originalDisplay.textContent = originalText;
                    originalDisplay.style.cssText = `
                        text-decoration: line-through;
                        color: var(--gray);
                        margin-right: 0.5rem;
                    `;
                    
                    priceElement.parentNode.insertBefore(originalDisplay, priceElement);
                    priceElement.textContent = discountedPrice.toLocaleString('ru-RU') + ' ₽';
                }
            }
        });
        
        // Show notification about night discount
        showNotification(`Акция! Ночная скидка ${discountPercent}% действует до 06:00`, 'success');
    }
}

/**
 * Update currency conversion
 */
function updateCurrencyConversion() {
    // This would fetch current exchange rates and show prices in other currencies
    // For now, we'll just show RUB prices
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `pricing-notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${type === 'success' ? 'var(--success)' : 'var(--primary)'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: var(--border-radius-md);
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: var(--shadow-lg);
        max-width: 300px;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Export for global use
window.VABPricelist = {
    initPricelist,
    calculateDynamicPrices,
    showNotification
};