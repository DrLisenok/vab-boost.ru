/**
 * Основной скрипт сайта VAB BOOST
 * Только базовые функции, обработка заказов - в forms.js
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 VAB BOOST - Инициализация...');

    // Инициализация базовых компонентов
    initMobileMenu();
    initSmoothScroll();
    initTabs();
    initAccordions();
    initAnimations();
    
    // Инициализация платежной системы (без блокировки загрузки)
    setTimeout(async () => {
        try {
            if (typeof initPaymentSystem === 'function') {
                await initPaymentSystem();
                console.log('✅ Платежная система инициализирована');
            }
        } catch (error) {
            console.warn('⚠️ Платежная система не инициализирована:', error);
        }
    }, 1500);

    // Инициализация счетчиков (если есть)
    initCounters();
    
    // Проверка статуса платежа на success.html
    checkSuccessPage();
});

// ==================== БАЗОВЫЕ ФУНКЦИИ ====================

function initMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            menuToggle.classList.toggle('active');
            document.body.classList.toggle('menu-open');
        });

        // Закрытие меню при клике на ссылку
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                menuToggle.classList.remove('active');
                document.body.classList.remove('menu-open');
            });
        });

        // Закрытие меню при клике вне его
        document.addEventListener('click', function(event) {
            if (!navMenu.contains(event.target) && !menuToggle.contains(event.target)) {
                navMenu.classList.remove('active');
                menuToggle.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });
    }
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Если это якорная ссылка на текущей странице
            if (href.startsWith('#') && document.querySelector(href)) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    window.scrollTo({
                        top: target.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            }
            // Если ссылка ведет на другую страницу с якорем, 
            // стандартное поведение - переход на страницу с прокруткой
        });
    });
}

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            const tabContainer = this.closest('.tabs-container');
            
            if (!tabContainer || !tabId) return;
            
            // Убрать активный класс у всех кнопок и контента
            tabContainer.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            tabContainer.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Добавить активный класс текущим элементам
            this.classList.add('active');
            const targetContent = tabContainer.querySelector(`#${tabId}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

function initAccordions() {
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', function() {
            const accordion = this.parentElement;
            const content = this.nextElementSibling;
            
            accordion.classList.toggle('active');
            
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    });
}

function initAnimations() {
    // Анимация появления элементов при скролле
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
}

function initCounters() {
    const counters = document.querySelectorAll('.counter');
    
    counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        const duration = 2000; // 2 секунды
        const step = target / (duration / 16); // 60fps
        
        let current = 0;
        
        const updateCounter = () => {
            current += step;
            if (current < target) {
                counter.textContent = Math.round(current);
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = target;
            }
        };
        
        // Запуск при появлении в viewport
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                updateCounter();
                observer.unobserve(counter);
            }
        });
        
        observer.observe(counter);
    });
}

function checkSuccessPage() {
    // Если это страница успеха (success.html)
    if (window.location.pathname.includes('success.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('order_id');
        const amount = urlParams.get('amount');
        
        if (orderId) {
            console.log('Заказ успешно оплачен:', { orderId, amount });
            
            // Можно отправить статистику или обновить UI
            if (typeof window.ym === 'function') {
                window.ym(XXXXXXX, 'reachGoal', 'order_success', { order_id: orderId }); // Замените XXXXXXX
            }
        }
    }
}

// ==================== ГЛОБАЛЬНЫЕ ФУНКЦИИ (для обратной совместимости) ====================

// УДАЛЕНО: window.processOrder - теперь в forms.js
// УДАЛЕНО: window.submitOrderForm - теперь в forms.js

// Сохранена только эта функция для глобального доступа
window.showOrderModal = function(orderDetails) {
    const modal = document.getElementById('order-modal');
    if (modal) {
        // Заполнение модального окна данными
        if (orderDetails.service) {
            modal.querySelector('[data-field="service"]').textContent = orderDetails.service;
        }
        if (orderDetails.price) {
            modal.querySelector('[data-field="price"]').textContent = orderDetails.price;
        }
        
        // Показать модальное окно
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
    }
};

// Закрытие модальных окон
document.addEventListener('click', function(e) {
    // Закрытие по клику на крестик или фон
    if (e.target.classList.contains('modal-close') || 
        e.target.classList.contains('modal') && e.target.id) {
        e.target.closest('.modal').style.display = 'none';
        document.body.classList.remove('modal-open');
    }
});

// Закрытие по ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.classList.remove('modal-open');
    }
});