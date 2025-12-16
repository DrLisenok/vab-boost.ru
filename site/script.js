// ==========================================================================
// VAB BOOST - ПОЛНЫЙ КОМПЛЕКСНЫЙ JavaScript ФАЙЛ
// ==========================================================================

// Конфигурация приложения
const CONFIG = {
    CART_KEY: 'vab_boost_cart',
    THEME_KEY: 'vab_boost_theme',
    USER_KEY: 'vab_boost_user',
    SITE_URL: window.location.origin,
    CURRENCY: '₽',
    TAX_RATE: 0,
    CART_TIMEOUT: 30 * 60 * 1000, // 30 минут
    TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 часа
    YOOKASSA_SHOP_ID: 'ВАШ_SHOP_ID',
    YOOKASSA_SECRET_KEY: 'ВАШ_СЕКРЕТНЫЙ_КЛЮЧ',
    IS_TEST_MODE: true
};

// Класс для управления состояниями приложения
class AppState {
    constructor() {
        this.cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || [];
        this.theme = localStorage.getItem(CONFIG.THEME_KEY) || 'dark';
        this.user = JSON.parse(localStorage.getItem(CONFIG.USER_KEY)) || null;
        this.isCartOpen = false;
        this.isMobileMenuOpen = false;
        this.notifications = [];
        this.initialized = false;
    }

    saveCart() {
        localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(this.cart));
        this.triggerEvent('cartUpdated', this.cart);
    }

    saveTheme() {
        localStorage.setItem(CONFIG.THEME_KEY, this.theme);
        document.documentElement.setAttribute('data-theme', this.theme);
    }

    saveUser() {
        if (this.user) {
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(this.user));
        } else {
            localStorage.removeItem(CONFIG.USER_KEY);
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        this.saveTheme();
        this.triggerEvent('themeChanged', this.theme);
    }

    addToCart(item) {
        const existingItem = this.cart.find(i => i.id === item.id);
        
        if (existingItem) {
            existingItem.quantity += item.quantity || 1;
        } else {
            this.cart.push({
                ...item,
                quantity: item.quantity || 1,
                addedAt: Date.now(),
                id: item.id || this.generateId()
            });
        }
        
        this.saveCart();
        this.triggerEvent('itemAdded', item);
        return this.cart;
    }

    removeFromCart(itemId) {
        this.cart = this.cart.filter(item => item.id !== itemId);
        this.saveCart();
        this.triggerEvent('itemRemoved', itemId);
        return this.cart;
    }

    updateQuantity(itemId, quantity) {
        const item = this.cart.find(item => item.id === itemId);
        if (item) {
            if (quantity <= 0) {
                return this.removeFromCart(itemId);
            }
            item.quantity = quantity;
            this.saveCart();
            this.triggerEvent('quantityUpdated', { itemId, quantity });
        }
        return this.cart;
    }

    clearCart() {
        this.cart = [];
        this.saveCart();
        this.triggerEvent('cartCleared');
        return this.cart;
    }

    getCartTotal() {
        return this.cart.reduce((total, item) => {
            return total + (parseFloat(item.price) * (item.quantity || 1));
        }, 0);
    }

    getCartCount() {
        return this.cart.reduce((count, item) => {
            return count + (item.quantity || 1);
        }, 0);
    }

    addNotification(message, type = 'info', duration = 5000) {
        const notification = {
            id: Date.now() + Math.random(),
            message,
            type,
            timestamp: Date.now(),
            duration
        };
        
        this.notifications.push(notification);
        this.triggerEvent('notificationAdded', notification);
        
        setTimeout(() => {
            this.removeNotification(notification.id);
        }, duration);
        
        return notification.id;
    }

    removeNotification(notificationId) {
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        this.triggerEvent('notificationRemoved', notificationId);
    }

    clearNotifications() {
        this.notifications = [];
        this.triggerEvent('notificationsCleared');
    }

    // Система событий
    events = {};
    
    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    }
    
    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
    
    triggerEvent(event, data) {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => callback(data));
    }

    generateId() {
        return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// Класс для управления UI элементами
class UIManager {
    constructor(appState) {
        this.state = appState;
        this.init();
    }

    init() {
        this.initCart();
        this.initTheme();
        this.initMobileMenu();
        this.initScrollEffects();
        this.initAnimations();
        this.initFormValidation();
        this.initTooltips();
        this.initModals();
        this.initBackToTop();
        this.initAOS();
        this.setupEventListeners();
        this.updateAllUI();
    }

    initCart() {
        // Обновление счетчика корзины
        this.state.on('cartUpdated', () => {
            this.updateCartCount();
            this.updateCartTotal();
            this.renderCartItems();
        });

        // Анимация добавления в корзину
        this.state.on('itemAdded', (item) => {
            this.showNotification(`${item.name} добавлен в корзину!`, 'success');
            this.animateAddToCart(item);
        });

        // Открытие/закрытие корзины
        const cartToggle = document.getElementById('cart-toggle');
        const cartClose = document.getElementById('cart-close');
        const cartOverlay = document.getElementById('cart-overlay');

        if (cartToggle) {
            cartToggle.addEventListener('click', () => this.openCart());
        }
        if (cartClose) {
            cartClose.addEventListener('click', () => this.closeCart());
        }
        if (cartOverlay) {
            cartOverlay.addEventListener('click', () => this.closeCart());
        }
    }

    initTheme() {
        // Установка темы
        document.documentElement.setAttribute('data-theme', this.state.theme);
        
        // Кнопка переключения темы
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.state.toggleTheme());
        }

        // Слушатель изменения темы
        this.state.on('themeChanged', (theme) => {
            document.documentElement.setAttribute('data-theme', theme);
            this.showNotification(`Тема изменена на ${theme === 'dark' ? 'темную' : 'светлую'}`, 'info');
        });
    }

    initMobileMenu() {
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const mobileMenu = document.getElementById('mobile-menu');
        const mobileMenuClose = document.getElementById('mobile-menu-close');

        if (mobileMenuToggle && mobileMenu) {
            mobileMenuToggle.addEventListener('click', () => {
                this.state.isMobileMenuOpen = !this.state.isMobileMenuOpen;
                mobileMenu.classList.toggle('open', this.state.isMobileMenuOpen);
                document.body.style.overflow = this.state.isMobileMenuOpen ? 'hidden' : '';
            });
        }

        if (mobileMenuClose) {
            mobileMenuClose.addEventListener('click', () => {
                this.state.isMobileMenuOpen = false;
                mobileMenu.classList.remove('open');
                document.body.style.overflow = '';
            });
        }
    }

    initScrollEffects() {
        let lastScroll = 0;
        const header = document.querySelector('.main-header');
        
        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;
            
            // Эффект скрытия/показа шапки
            if (header) {
                if (currentScroll > 100) {
                    header.classList.add('scrolled');
                    if (currentScroll > lastScroll && currentScroll > 200) {
                        header.classList.add('hidden');
                    } else {
                        header.classList.remove('hidden');
                    }
                } else {
                    header.classList.remove('scrolled', 'hidden');
                }
            }
            
            // Активация пунктов навигации при скролле
            this.updateActiveNavLink();
            
            lastScroll = currentScroll;
        });
    }

    initAnimations() {
        // Анимация появления элементов при скролле
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animated');
                    
                    // Добавление задержки для последовательной анимации
                    if (entry.target.dataset.animationDelay) {
                        entry.target.style.animationDelay = entry.target.dataset.animationDelay;
                    }
                    
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Наблюдаем за всеми элементами с анимацией
        document.querySelectorAll('[data-aos]').forEach(element => {
            observer.observe(element);
        });
    }

    initFormValidation() {
        // Валидация форм
        document.addEventListener('blur', (e) => {
            if (e.target.matches('.form-control[required]')) {
                this.validateField(e.target);
            }
        }, true);

        document.addEventListener('input', (e) => {
            if (e.target.matches('.form-control[required]')) {
                this.validateField(e.target);
            }
        });

        // Обработка отправки форм
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.classList.contains('needs-validation')) {
                if (!this.validateForm(form)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });
    }

    initTooltips() {
        // Инициализация тултипов
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                const tooltipText = e.target.dataset.tooltip;
                this.showTooltip(e, tooltipText);
            });
            
            element.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }

    initModals() {
        // Инициализация модальных окон
        const modalTriggers = document.querySelectorAll('[data-modal]');
        modalTriggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                const modalId = trigger.dataset.modal;
                this.openModal(modalId);
            });
        });

        // Закрытие модальных окон
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') || 
                e.target.classList.contains('modal-close') ||
                e.target.classList.contains('btn-close-modal')) {
                this.closeModal(e.target.closest('.modal'));
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal.open');
                if (openModal) this.closeModal(openModal);
            }
        });
    }

    initBackToTop() {
        // Кнопка "Наверх"
        const backToTop = document.createElement('button');
        backToTop.id = 'back-to-top';
        backToTop.className = 'btn btn-primary';
        backToTop.innerHTML = '<i class="fas fa-chevron-up"></i>';
        backToTop.title = 'Наверх';
        document.body.appendChild(backToTop);

        backToTop.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });

        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        });
    }

    initAOS() {
        // Анимация появления элементов
        const aosElements = document.querySelectorAll('[data-aos]');
        aosElements.forEach(el => {
            const animation = el.dataset.aos;
            const delay = el.dataset.aosDelay || 0;
            const duration = el.dataset.aosDuration || 400;
            
            el.style.opacity = '0';
            el.style.transform = this.getAOSTransform(animation);
            el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
            el.style.transitionDelay = `${delay}ms`;
        });
    }

    getAOSTransform(animation) {
        const transforms = {
            'fade-up': 'translateY(30px)',
            'fade-down': 'translateY(-30px)',
            'fade-left': 'translateX(-30px)',
            'fade-right': 'translateX(30px)',
            'zoom-in': 'scale(0.9)',
            'zoom-out': 'scale(1.1)',
            'flip-left': 'rotateY(-90deg)',
            'flip-right': 'rotateY(90deg)'
        };
        return transforms[animation] || 'translateY(30px)';
    }

    setupEventListeners() {
        // Добавление товаров в корзину
        document.addEventListener('click', (e) => {
            const addBtn = e.target.closest('.add-to-cart');
            if (addBtn) {
                e.preventDefault();
                const item = this.getItemFromButton(addBtn);
                if (item) {
                    this.state.addToCart(item);
                }
            }
        });

        // Управление количеством в корзине
        document.addEventListener('click', (e) => {
            const minusBtn = e.target.closest('.quantity-minus');
            const plusBtn = e.target.closest('.quantity-plus');
            const removeBtn = e.target.closest('.remove-item');
            
            if (minusBtn || plusBtn || removeBtn) {
                e.preventDefault();
                const itemId = e.target.closest('[data-item-id]').dataset.itemId;
                
                if (minusBtn) {
                    const item = this.state.cart.find(item => item.id === itemId);
                    if (item) {
                        this.state.updateQuantity(itemId, item.quantity - 1);
                    }
                }
                
                if (plusBtn) {
                    const item = this.state.cart.find(item => item.id === itemId);
                    if (item) {
                        this.state.updateQuantity(itemId, item.quantity + 1);
                    }
                }
                
                if (removeBtn) {
                    this.state.removeFromCart(itemId);
                }
            }
        });

        // Очистка корзины
        const clearCartBtn = document.getElementById('clear-cart');
        if (clearCartBtn) {
            clearCartBtn.addEventListener('click', () => {
                if (confirm('Вы уверены, что хотите очистить корзину?')) {
                    this.state.clearCart();
                    this.showNotification('Корзина очищена', 'info');
                }
            });
        }

        // Оформление заказа
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (this.state.cart.length === 0) {
                    this.showNotification('Корзина пуста', 'warning');
                    return;
                }
                
                await this.processCheckout();
            });
        }

        // Поиск
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Фильтры
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const filter = e.target.dataset.filter;
                this.handleFilter(filter);
            });
        });
    }

    updateAllUI() {
        this.updateCartCount();
        this.updateCartTotal();
        this.renderCartItems();
        this.updateActiveNavLink();
        this.updateYear();
        this.updateServiceStats();
    }

    updateCartCount() {
        const cartCountElements = document.querySelectorAll('.cart-count, #cart-count');
        const count = this.state.getCartCount();
        
        cartCountElements.forEach(element => {
            element.textContent = count;
            if (count > 0) {
                element.classList.add('has-items');
            } else {
                element.classList.remove('has-items');
            }
        });
    }

    updateCartTotal() {
        const cartTotalElements = document.querySelectorAll('#cart-total-price, .cart-total-price');
        const total = this.state.getCartTotal();
        
        cartTotalElements.forEach(element => {
            element.textContent = total.toLocaleString('ru-RU') + CONFIG.CURRENCY;
        });
    }

    renderCartItems() {
        const cartItemsContainer = document.getElementById('cart-items');
        const emptyCartMsg = document.querySelector('.empty-cart-msg');
        const checkoutBtn = document.getElementById('checkout-btn');
        
        if (!cartItemsContainer) return;
        
        if (this.state.cart.length === 0) {
            if (emptyCartMsg) emptyCartMsg.style.display = 'block';
            if (checkoutBtn) checkoutBtn.disabled = true;
            cartItemsContainer.innerHTML = `
                <div class="cart-empty-state">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Ваша корзина пуста</p>
                    <a href="pricing.html" class="btn btn-outline">Перейти к услугам</a>
                </div>
            `;
            return;
        }
        
        if (emptyCartMsg) emptyCartMsg.style.display = 'none';
        if (checkoutBtn) checkoutBtn.disabled = false;
        
        cartItemsContainer.innerHTML = this.state.cart.map(item => `
            <div class="cart-item" data-item-id="${item.id}">
                <div class="cart-item-image">
                    <i class="fas fa-${item.icon || 'gamepad'}"></i>
                </div>
                <div class="cart-item-info">
                    <h4 class="cart-item-title">${item.name}</h4>
                    <div class="cart-item-meta">
                        <span class="cart-item-price">${parseFloat(item.price).toLocaleString('ru-RU')}${CONFIG.CURRENCY}</span>
                        <span class="cart-item-time"><i class="far fa-clock"></i> ${item.duration || '1-2 дня'}</span>
                    </div>
                </div>
                <div class="cart-item-actions">
                    <div class="quantity-control">
                        <button class="quantity-btn quantity-minus" title="Уменьшить">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="quantity-value">${item.quantity}</span>
                        <button class="quantity-btn quantity-plus" title="Увеличить">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <button class="btn btn-icon btn-danger remove-item" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    openCart() {
        this.state.isCartOpen = true;
        document.getElementById('cart-sidebar').classList.add('open');
        document.getElementById('cart-overlay').classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeCart() {
        this.state.isCartOpen = false;
        document.getElementById('cart-sidebar').classList.remove('open');
        document.getElementById('cart-overlay').classList.remove('show');
        document.body.style.overflow = '';
    }

    animateAddToCart(item) {
        const cartBtn = document.getElementById('cart-toggle');
        if (!cartBtn) return;
        
        // Создаем летающий элемент
        const flyingItem = document.createElement('div');
        flyingItem.className = 'flying-item';
        flyingItem.innerHTML = `<i class="fas fa-${item.icon || 'gamepad'}"></i>`;
        
        // Определяем начальную позицию (предполагаем, что кнопка добавления имеет класс .add-to-cart)
        const addButton = document.querySelector('.add-to-cart[data-id="' + item.id + '"]');
        if (!addButton) return;
        
        const startRect = addButton.getBoundingClientRect();
        const endRect = cartBtn.getBoundingClientRect();
        
        // Устанавливаем начальную позицию
        flyingItem.style.cssText = `
            position: fixed;
            left: ${startRect.left + startRect.width / 2}px;
            top: ${startRect.top + startRect.height / 2}px;
            z-index: 10000;
            background: var(--valorant-red);
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            pointer-events: none;
            transform: translate(-50%, -50%);
        `;
        
        document.body.appendChild(flyingItem);
        
        // Анимация
        flyingItem.animate([
            {
                transform: `translate(-50%, -50%) scale(1)`,
                opacity: 1
            },
            {
                transform: `translate(${endRect.left + endRect.width / 2 - startRect.left - startRect.width / 2}px, ${endRect.top + endRect.height / 2 - startRect.top - startRect.height / 2}px) scale(0)`,
                opacity: 0
            }
        ], {
            duration: 800,
            easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
        }).onfinish = () => {
            flyingItem.remove();
            // Анимация кнопки корзины
            cartBtn.classList.add('pulse');
            setTimeout(() => cartBtn.classList.remove('pulse'), 300);
        };
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notificationId = this.state.addNotification(message, type, duration);
        
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.dataset.id = notificationId;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Добавляем в контейнер уведомлений
        let container = document.getElementById('notifications-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notifications-container';
            container.className = 'notifications-container';
            document.body.appendChild(container);
            
            // Стили для контейнера
            const styles = document.createElement('style');
            styles.textContent = `
                .notifications-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    max-width: 400px;
                }
                
                .notification {
                    background: var(--bg-card);
                    border-left: 4px solid;
                    border-radius: 8px;
                    padding: 15px 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    box-shadow: var(--shadow-lg);
                    transform: translateX(120%);
                    transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                }
                
                .notification.show {
                    transform: translateX(0);
                }
                
                .notification-info { border-color: var(--info-color); }
                .notification-success { border-color: var(--success-color); }
                .notification-warning { border-color: var(--warning-color); }
                .notification-error { border-color: var(--danger-color); }
                
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex: 1;
                }
                
                .notification-content i {
                    font-size: 1.2rem;
                }
                
                .notification-info .notification-content i { color: var(--info-color); }
                .notification-success .notification-content i { color: var(--success-color); }
                .notification-warning .notification-content i { color: var(--warning-color); }
                .notification-error .notification-content i { color: var(--danger-color); }
                
                .notification-close {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    font-size: 1rem;
                    padding: 4px;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                
                .notification-close:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: var(--text-primary);
                }
            `;
            document.head.appendChild(styles);
        }
        
        container.appendChild(notification);
        
        // Анимация появления
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Кнопка закрытия
        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.removeNotification(notificationId);
        });
        
        // Автоматическое закрытие
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(notificationId);
            }, duration);
        }
        
        return notificationId;
    }

    removeNotification(notificationId) {
        const notification = document.querySelector(`.notification[data-id="${notificationId}"]`);
        if (notification) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
        this.state.removeNotification(notificationId);
    }

    getNotificationIcon(type) {
        const icons = {
            'info': 'info-circle',
            'success': 'check-circle',
            'warning': 'exclamation-triangle',
            'error': 'exclamation-circle'
        };
        return icons[type] || 'info-circle';
    }

    getItemFromButton(button) {
        return {
            id: button.dataset.id,
            name: button.dataset.name,
            price: parseFloat(button.dataset.price),
            icon: button.dataset.icon || 'gamepad',
            duration: button.dataset.duration,
            category: button.dataset.category
        };
    }

    updateActiveNavLink() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.main-nav a');
        
        navLinks.forEach(link => {
            const linkPath = link.getAttribute('href');
            if (linkPath === currentPath || 
                (currentPath.includes(linkPath) && linkPath !== '/')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    updateYear() {
        const yearElements = document.querySelectorAll('.current-year');
        const currentYear = new Date().getFullYear();
        
        yearElements.forEach(element => {
            element.textContent = currentYear;
        });
    }

    updateServiceStats() {
        // Обновление статистики услуг
        const stats = {
            totalOrders: this.state.cart.length,
            totalRevenue: this.state.getCartTotal(),
            popularService: this.getPopularService()
        };
        
        // Можно добавить обновление элементов статистики на странице
    }

    getPopularService() {
        if (this.state.cart.length === 0) return null;
        
        const serviceCount = {};
        this.state.cart.forEach(item => {
            serviceCount[item.name] = (serviceCount[item.name] || 0) + item.quantity;
        });
        
        return Object.keys(serviceCount).reduce((a, b) => 
            serviceCount[a] > serviceCount[b] ? a : b
        );
    }

    validateField(field) {
        const value = field.value.trim();
        const feedback = field.parentElement.querySelector('.invalid-feedback');
        
        field.classList.remove('is-valid', 'is-invalid');
        
        if (field.required && !value) {
            field.classList.add('is-invalid');
            if (feedback) feedback.textContent = 'Это поле обязательно для заполнения';
            return false;
        }
        
        if (field.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                field.classList.add('is-invalid');
                if (feedback) feedback.textContent = 'Введите корректный email';
                return false;
            }
        }
        
        if (field.type === 'tel' && value) {
            const phoneRegex = /^[\d\s\-\+\(\)]+$/;
            if (!phoneRegex.test(value)) {
                field.classList.add('is-invalid');
                if (feedback) feedback.textContent = 'Введите корректный номер телефона';
                return false;
            }
        }
        
        field.classList.add('is-valid');
        return true;
    }

    validateForm(form) {
        let isValid = true;
        const requiredFields = form.querySelectorAll('.form-control[required]');
        
        requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        
        form.classList.add('was-validated');
        return isValid;
    }

    showTooltip(event, text) {
        // Удаляем существующий тултип
        this.hideTooltip();
        
        // Создаем новый тултип
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        
        // Позиционируем
        const x = event.clientX;
        const y = event.clientY;
        
        tooltip.style.cssText = `
            position: fixed;
            left: ${x + 10}px;
            top: ${y + 10}px;
            background: var(--bg-card);
            color: var(--text-primary);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 0.875rem;
            z-index: 9999;
            box-shadow: var(--shadow-md);
            border: 1px solid var(--border-color);
            max-width: 200px;
            pointer-events: none;
            transform: translateY(-10px);
            opacity: 0;
            transition: transform 0.2s, opacity 0.2s;
        `;
        
        document.body.appendChild(tooltip);
        
        // Анимация появления
        setTimeout(() => {
            tooltip.style.transform = 'translateY(0)';
            tooltip.style.opacity = '1';
        }, 10);
        
        // Сохраняем ссылку
        this.currentTooltip = tooltip;
    }

    hideTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    async processCheckout() {
        // Показываем индикатор загрузки
        const checkoutBtn = document.getElementById('checkout-btn');
        const originalText = checkoutBtn.innerHTML;
        checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка...';
        checkoutBtn.disabled = true;
        
        try {
            // Создаем данные заказа
            const orderData = {
                items: this.state.cart,
                total: this.state.getCartTotal(),
                currency: CONFIG.CURRENCY,
                timestamp: Date.now(),
                orderId: 'VAB-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase()
            };
            
            // Сохраняем заказ
            localStorage.setItem('last_order', JSON.stringify(orderData));
            
            // Показываем модальное окно оплаты
            this.showPaymentModal(orderData);
            
        } catch (error) {
            console.error('Checkout error:', error);
            this.showNotification('Произошла ошибка при оформлении заказа', 'error');
        } finally {
            // Восстанавливаем кнопку
            checkoutBtn.innerHTML = originalText;
            checkoutBtn.disabled = false;
        }
    }

    showPaymentModal(orderData) {
        const modal = document.createElement('div');
        modal.className = 'modal payment-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-lock"></i> Безопасная оплата</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="payment-summary">
                        <h4>Детали заказа #${orderData.orderId}</h4>
                        <div class="order-items">
                            ${orderData.items.map(item => `
                                <div class="order-item">
                                    <span>${item.name} × ${item.quantity}</span>
                                    <span>${(item.price * item.quantity).toLocaleString('ru-RU')}${CONFIG.CURRENCY}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="order-total">
                            <strong>Итого к оплате:</strong>
                            <span class="total-price">${orderData.total.toLocaleString('ru-RU')}${CONFIG.CURRENCY}</span>
                        </div>
                    </div>
                    
                    <div class="payment-form">
                        <div class="form-group">
                            <label for="payment-email">Email для чека</label>
                            <input type="email" id="payment-email" class="form-control" required 
                                   placeholder="your@email.com">
                        </div>
                        
                        <div class="form-group">
                            <label for="payment-telegram">Telegram для связи</label>
                            <input type="text" id="payment-telegram" class="form-control"
                                   placeholder="@username (необязательно)">
                        </div>
                        
                        ${CONFIG.IS_TEST_MODE ? `
                            <div class="test-notice">
                                <i class="fas fa-info-circle"></i>
                                <strong>Тестовый режим:</strong> Используйте тестовые данные карты
                                <div class="test-data">
                                    <div><strong>Карта:</strong> 5555 5555 5555 4477</div>
                                    <div><strong>Срок:</strong> 12/25</div>
                                    <div><strong>CVC:</strong> 123</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <div class="security-info">
                        <i class="fas fa-shield-alt"></i>
                        <span>Платеж защищен технологиями ЮKassa</span>
                    </div>
                    <button class="btn btn-primary" id="confirm-payment">
                        <i class="fas fa-credit-card"></i> Оплатить ${orderData.total.toLocaleString('ru-RU')}${CONFIG.CURRENCY}
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Стили для модального окна
        const styles = document.createElement('style');
        styles.textContent = `
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(5px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s;
            }
            
            .modal.open {
                opacity: 1;
                visibility: visible;
            }
            
            .modal-content {
                background: var(--bg-card);
                border-radius: 12px;
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                border: 1px solid var(--border-color);
                box-shadow: var(--shadow-heavy);
                transform: translateY(-20px);
                transition: transform 0.3s;
            }
            
            .modal.open .modal-content {
                transform: translateY(0);
            }
            
            .modal-header {
                padding: 20px;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: var(--bg-secondary);
                border-radius: 12px 12px 0 0;
            }
            
            .modal-header h3 {
                margin: 0;
                color: var(--text-primary);
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .modal-close {
                background: none;
                border: none;
                color: var(--text-muted);
                font-size: 1.5rem;
                cursor: pointer;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s;
            }
            
            .modal-close:hover {
                background: var(--bg-light);
                color: var(--text-primary);
            }
            
            .modal-body {
                padding: 20px;
            }
            
            .modal-footer {
                padding: 20px;
                border-top: 1px solid var(--border-color);
                display: flex;
                flex-direction: column;
                gap: 15px;
                background: var(--bg-secondary);
                border-radius: 0 0 12px 12px;
            }
            
            .security-info {
                display: flex;
                align-items: center;
                gap: 10px;
                color: var(--success-color);
                font-size: 0.9rem;
            }
            
            .payment-summary {
                margin-bottom: 30px;
            }
            
            .order-items {
                background: var(--bg-light);
                border-radius: 8px;
                padding: 15px;
                margin: 15px 0;
            }
            
            .order-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid var(--border-color);
            }
            
            .order-item:last-child {
                border-bottom: none;
            }
            
            .order-total {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                background: var(--bg-light);
                border-radius: 8px;
                border: 2px solid var(--primary-color);
            }
            
            .total-price {
                font-size: 1.5rem;
                font-weight: bold;
                color: var(--primary-color);
            }
            
            .test-notice {
                background: var(--warning-color);
                color: var(--text-dark);
                padding: 15px;
                border-radius: 8px;
                margin-top: 20px;
                font-size: 0.9rem;
            }
            
            .test-notice i {
                margin-right: 10px;
            }
            
            .test-data {
                margin-top: 10px;
                padding: 10px;
                background: rgba(0, 0, 0, 0.1);
                border-radius: 6px;
                font-family: monospace;
            }
            
            .test-data div {
                margin: 5px 0;
            }
        `;
        document.head.appendChild(styles);
        
        // Анимация появления
        setTimeout(() => modal.classList.add('open'), 10);
        
        // Обработчики событий
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.classList.remove('open');
            setTimeout(() => {
                modal.remove();
                styles.remove();
            }, 300);
        });
        
        modal.querySelector('#confirm-payment').addEventListener('click', async () => {
            const emailInput = modal.querySelector('#payment-email');
            const telegramInput = modal.querySelector('#payment-telegram');
            
            if (!emailInput.value.trim()) {
                this.showNotification('Введите email для получения чека', 'warning');
                emailInput.focus();
                return;
            }
            
            // Симуляция процесса оплаты
            const confirmBtn = modal.querySelector('#confirm-payment');
            const originalBtnText = confirmBtn.innerHTML;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка платежа...';
            confirmBtn.disabled = true;
            
            try {
                // Имитация задержки платежа
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Успешная оплата
                this.showNotification('Оплата прошла успешно! Чек отправлен на почту', 'success');
                
                // Очищаем корзину
                this.state.clearCart();
                
                // Закрываем модальное окно
                modal.classList.remove('open');
                setTimeout(() => {
                    modal.remove();
                    styles.remove();
                    
                    // Показываем страницу успеха
                    this.showSuccessPage(orderData);
                }, 300);
                
            } catch (error) {
                console.error('Payment error:', error);
                this.showNotification('Ошибка при обработке платежа', 'error');
                confirmBtn.innerHTML = originalBtnText;
                confirmBtn.disabled = false;
            }
        });
    }

    showSuccessPage(orderData) {
        const successHTML = `
            <div class="success-container">
                <div class="success-content">
                    <div class="success-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h1>Оплата прошла успешно!</h1>
                    <div class="success-details">
                        <p><strong>Номер заказа:</strong> ${orderData.orderId}</p>
                        <p><strong>Сумма:</strong> ${orderData.total.toLocaleString('ru-RU')}${CONFIG.CURRENCY}</p>
                        <p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</p>
                    </div>
                    <div class="success-message">
                        <p>Спасибо за заказ! Наш менеджер свяжется с вами в течение 15 минут для уточнения деталей.</p>
                        <p>Чек отправлен на указанную почту.</p>
                    </div>
                    <div class="success-actions">
                        <a href="index.html" class="btn btn-primary">
                            <i class="fas fa-home"></i> На главную
                        </a>
                        <a href="pricing.html" class="btn btn-outline">
                            <i class="fas fa-shopping-cart"></i> Новый заказ
                        </a>
                    </div>
                </div>
            </div>
            
            <style>
                .success-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    background: var(--bg-primary);
                }
                
                .success-content {
                    background: var(--bg-card);
                    border-radius: 16px;
                    padding: 40px;
                    text-align: center;
                    max-width: 600px;
                    border: 2px solid var(--success-color);
                    box-shadow: var(--shadow-heavy);
                }
                
                .success-icon {
                    font-size: 5rem;
                    color: var(--success-color);
                    margin-bottom: 30px;
                }
                
                .success-content h1 {
                    color: var(--text-primary);
                    margin-bottom: 30px;
                }
                
                .success-details {
                    background: var(--bg-light);
                    border-radius: 12px;
                    padding: 20px;
                    margin: 30px 0;
                    text-align: left;
                }
                
                .success-details p {
                    margin: 10px 0;
                    color: var(--text-secondary);
                }
                
                .success-details strong {
                    color: var(--text-primary);
                }
                
                .success-message {
                    margin: 30px 0;
                    color: var(--text-secondary);
                    line-height: 1.6;
                }
                
                .success-actions {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                
                @media (max-width: 576px) {
                    .success-content {
                        padding: 30px 20px;
                    }
                    
                    .success-actions {
                        flex-direction: column;
                    }
                    
                    .success-actions .btn {
                        width: 100%;
                    }
                }
            </style>
        `;
        
        // Заменяем содержимое страницы
        document.body.innerHTML = successHTML;
    }

    handleSearch(query) {
        if (query.length < 2) return;
        
        // Поиск по услугам
        const services = document.querySelectorAll('.service-card, .package-card');
        services.forEach(service => {
            const text = service.textContent.toLowerCase();
            if (text.includes(query.toLowerCase())) {
                service.style.display = 'block';
                service.classList.add('highlight');
            } else {
                service.style.display = 'none';
                service.classList.remove('highlight');
            }
        });
    }

    handleFilter(filter) {
        const services = document.querySelectorAll('.service-card, .package-card');
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        // Обновляем активную кнопку фильтра
        filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        // Применяем фильтр
        services.forEach(service => {
            if (filter === 'all' || service.dataset.category === filter) {
                service.style.display = 'block';
            } else {
                service.style.display = 'none';
            }
        });
    }
}

// Класс для работы с API
class APIService {
    constructor() {
        this.baseURL = CONFIG.SITE_URL;
        this.endpoints = {
            services: '/api/services',
            orders: '/api/orders',
            payment: '/api/payment',
            auth: '/api/auth'
        };
    }

    async request(endpoint, method = 'GET', data = null) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        const options = {
            method,
            headers,
            mode: 'cors',
            cache: 'no-cache'
        };

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const responseData = await response.json();
            return responseData;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async getServices() {
        return this.request(this.endpoints.services);
    }

    async createOrder(orderData) {
        return this.request(this.endpoints.orders, 'POST', orderData);
    }

    async processPayment(paymentData) {
        return this.request(this.endpoints.payment, 'POST', paymentData);
    }

    async login(credentials) {
        return this.request(`${this.endpoints.auth}/login`, 'POST', credentials);
    }

    async register(userData) {
        return this.request(`${this.endpoints.auth}/register`, 'POST', userData);
    }

    async getOrderStatus(orderId) {
        return this.request(`${this.endpoints.orders}/${orderId}`);
    }
}

// Класс для аналитики
class Analytics {
    constructor() {
        this.events = [];
        this.pageViews = 0;
        this.startTime = Date.now();
    }

    track(event, data = {}) {
        const eventData = {
            event,
            data,
            timestamp: Date.now(),
            page: window.location.pathname,
            userAgent: navigator.userAgent
        };

        this.events.push(eventData);
        this.saveToStorage();
        
        // Отправка на сервер (в реальном проекте)
        // this.sendToServer(eventData);
        
        console.log(`[Analytics] ${event}:`, data);
    }

    trackPageView() {
        this.pageViews++;
        this.track('page_view', {
            page: window.location.pathname,
            referrer: document.referrer,
            pageViews: this.pageViews
        });
    }

    trackCartEvent(action, item) {
        this.track(`cart_${action}`, {
            item_id: item.id,
            item_name: item.name,
            item_price: item.price,
            cart_total: window.app?.state?.getCartTotal() || 0
        });
    }

    trackPaymentEvent(action, amount) {
        this.track(`payment_${action}`, {
            amount,
            currency: CONFIG.CURRENCY,
            timestamp: Date.now()
        });
    }

    saveToStorage() {
        localStorage.setItem('vab_analytics', JSON.stringify({
            events: this.events.slice(-100), // Последние 100 событий
            pageViews: this.pageViews,
            startTime: this.startTime
        }));
    }

    loadFromStorage() {
        const data = JSON.parse(localStorage.getItem('vab_analytics') || '{}');
        this.events = data.events || [];
        this.pageViews = data.pageViews || 0;
        this.startTime = data.startTime || Date.now();
    }

    getStats() {
        const sessionDuration = Date.now() - this.startTime;
        const cartEvents = this.events.filter(e => e.event.startsWith('cart_'));
        const paymentEvents = this.events.filter(e => e.event.startsWith('payment_'));
        
        return {
            totalEvents: this.events.length,
            pageViews: this.pageViews,
            sessionDuration,
            cartEvents: cartEvents.length,
            paymentEvents: paymentEvents.length,
            lastEvent: this.events[this.events.length - 1]
        };
    }
}

// Главный класс приложения
class VABBoostApp {
    constructor() {
        this.state = new AppState();
        this.ui = new UIManager(this.state);
        this.api = new APIService();
        this.analytics = new Analytics();
        this.init();
    }

    async init() {
        try {
            // Загрузка данных из localStorage
            this.analytics.loadFromStorage();
            
            // Отслеживание просмотра страницы
            this.analytics.trackPageView();
            
            // Инициализация отслеживания событий
            this.setupAnalyticsTracking();
            
            // Проверка авторизации
            await this.checkAuth();
            
            // Загрузка услуг (если нужно)
            await this.loadServices();
            
            // Обновление UI
            this.ui.updateAllUI();
            
            // Установка обработчиков событий
            this.setupGlobalEventListeners();
            
            // Инициализация завершена
            this.state.initialized = true;
            console.log('VAB Boost App initialized successfully');
            
        } catch (error) {
            console.error('App initialization failed:', error);
            this.ui.showNotification('Ошибка инициализации приложения', 'error');
        }
    }

    setupAnalyticsTracking() {
        // Отслеживание добавления в корзину
        this.state.on('itemAdded', (item) => {
            this.analytics.trackCartEvent('add', item);
        });
        
        // Отслеживание удаления из корзины
        this.state.on('itemRemoved', (itemId) => {
            const item = this.state.cart.find(i => i.id === itemId);
            if (item) {
                this.analytics.trackCartEvent('remove', item);
            }
        });
        
        // Отслеживание очистки корзины
        this.state.on('cartCleared', () => {
            this.analytics.track('cart_clear');
        });
        
        // Отслеживание оформления заказа
        document.addEventListener('checkoutInitiated', (e) => {
            this.analytics.trackPaymentEvent('initiated', e.detail.amount);
        });
        
        // Отслеживание успешной оплаты
        document.addEventListener('paymentSuccess', (e) => {
            this.analytics.trackPaymentEvent('success', e.detail.amount);
        });
    }

    async checkAuth() {
        const token = localStorage.getItem('auth_token');
        if (token && this.isTokenValid(token)) {
            try {
                // Проверка токена через API
                // const user = await this.api.getUserProfile();
                // this.state.user = user;
                // this.state.saveUser();
            } catch (error) {
                // Токен невалиден
                localStorage.removeItem('auth_token');
                this.state.user = null;
                this.state.saveUser();
            }
        }
    }

    isTokenValid(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp * 1000 > Date.now();
        } catch {
            return false;
        }
    }

    async loadServices() {
        // Загрузка услуг с сервера (если нужно)
        // В демо-режиме используем статические данные
        const servicesContainer = document.getElementById('services-container');
        if (servicesContainer && servicesContainer.children.length === 0) {
            try {
                // const services = await this.api.getServices();
                // this.renderServices(services);
            } catch (error) {
                console.warn('Could not load services from API:', error);
            }
        }
    }

    setupGlobalEventListeners() {
        // Обработка кликов по внешним ссылкам
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="http"]');
            if (link && !link.href.includes(window.location.hostname)) {
                this.analytics.track('external_link_click', {
                    url: link.href,
                    text: link.textContent
                });
            }
        });
        
        // Сохранение аналитики перед закрытием страницы
        window.addEventListener('beforeunload', () => {
            this.analytics.saveToStorage();
        });
        
        // Обработка онлайн/офлайн состояния
        window.addEventListener('online', () => {
            this.ui.showNotification('Соединение восстановлено', 'success');
            this.analytics.track('connection_restored');
        });
        
        window.addEventListener('offline', () => {
            this.ui.showNotification('Отсутствует соединение с интернетом', 'warning');
            this.analytics.track('connection_lost');
        });
        
        // Изменение размера окна
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.analytics.track('window_resize', {
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            }, 250);
        });
    }

    renderServices(services) {
        // Рендер услуг (пример)
        const container = document.getElementById('services-container');
        if (!container) return;
        
        // container.innerHTML = services.map(service => `
        //     <div class="service-card" data-category="${service.category}">
        //         <div class="service-icon">
        //             <i class="fas fa-${service.icon}"></i>
        //         </div>
        //         <h3>${service.name}</h3>
        //         <p>${service.description}</p>
        //         <div class="service-price">${service.price}${CONFIG.CURRENCY}</div>
        //         <button class="btn btn-outline add-to-cart" 
        //                 data-id="${service.id}"
        //                 data-name="${service.name}"
        //                 data-price="${service.price}"
        //                 data-icon="${service.icon}">
        //             <i class="fas fa-cart-plus"></i> Добавить
        //         </button>
        //     </div>
        // `).join('');
    }

    // Вспомогательные методы
    formatPrice(price) {
        return parseFloat(price).toLocaleString('ru-RU') + CONFIG.CURRENCY;
    }

    formatDate(date) {
        return new Date(date).toLocaleString('ru-RU');
    }

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
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Инициализация приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    // Создаем глобальный объект приложения
    window.app = new VABBoostApp();
    
    // Экспортируем основные методы
    window.VABBoost = {
        addToCart: (item) => window.app.state.addToCart(item),
        removeFromCart: (itemId) => window.app.state.removeFromCart(itemId),
        clearCart: () => window.app.state.clearCart(),
        getCart: () => window.app.state.cart,
        getCartTotal: () => window.app.state.getCartTotal(),
        showNotification: (message, type) => window.app.ui.showNotification(message, type),
        openCart: () => window.app.ui.openCart(),
        closeCart: () => window.app.ui.closeCart(),
        processCheckout: () => window.app.ui.processCheckout()
    };
    
    console.log('VAB Boost initialized and ready!');
});

// Service Worker для PWA (опционально)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').then(registration => {
            console.log('ServiceWorker registered:', registration);
        }).catch(error => {
            console.log('ServiceWorker registration failed:', error);
        });
    });
}

// Обработка ошибок
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', { message, source, lineno, colno, error });
    
    if (window.app && window.app.ui) {
        window.app.ui.showNotification('Произошла ошибка. Пожалуйста, обновите страницу.', 'error');
    }
    
    // Отправка ошибки в аналитику
    if (window.app && window.app.analytics) {
        window.app.analytics.track('global_error', {
            message: message.toString(),
            source,
            line: lineno,
            column: colno,
            error: error?.toString()
        });
    }
    
    return false;
};

// Обработка неперехваченных промисов
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    
    if (window.app && window.app.ui) {
        window.app.ui.showNotification('Ошибка при выполнении операции', 'error');
    }
    
    // Отправка ошибки в аналитику
    if (window.app && window.app.analytics) {
        window.app.analytics.track('unhandled_promise_rejection', {
            reason: event.reason?.toString()
        });
    }
});