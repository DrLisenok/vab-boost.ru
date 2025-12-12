/**
 * VAB BOOST - Main JavaScript
 */

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize everything
    initPreloader();
    initTheme();
    initNavigation();
    initServiceSelection();
    initOrderForm();
    initFAQ();
    initAnimations();
    initStatsCounter();
    initParticles();
    
    console.log('✅ VAB BOOST loaded successfully');
});

/**
 * Preloader
 */
function initPreloader() {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;
    
    // Simulate loading
    setTimeout(() => {
        preloader.classList.add('loaded');
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 500);
    }, 1500);
}

/**
 * Theme Management
 */
function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    
    // Check saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        updateThemeIcon(true);
    }
    
    // Toggle theme
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = body.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcon(isDark);
        });
    }
}

function updateThemeIcon(isDark) {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    const icon = themeToggle.querySelector('i');
    if (icon) {
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
}

/**
 * Navigation
 */
function initNavigation() {
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    const navbar = document.getElementById('navbar');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Mobile menu toggle
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            navToggle.innerHTML = navMenu.classList.contains('active') 
                ? '<i class="fas fa-times"></i>' 
                : '<i class="fas fa-bars"></i>';
        });
    }
    
    // Close menu on link click (mobile)
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                navToggle.innerHTML = '<i class="fas fa-bars"></i>';
            }
        });
    });
    
    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        // Update active nav link
        updateActiveNavLink();
    });
    
    // Smooth scrolling
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
}

function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    
    let currentSection = '';
    const scrollPosition = window.scrollY + 100;
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');
        
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            currentSection = sectionId;
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === `#${currentSection}`) {
            link.classList.add('active');
        }
    });
}

/**
 * Service Selection
 */
function initServiceSelection() {
    const serviceButtons = document.querySelectorAll('.select-service');
    const serviceSelect = document.getElementById('service_type');
    const amountInput = document.getElementById('amount');
    
    if (!serviceButtons.length || !serviceSelect || !amountInput) return;
    
    // Service buttons click
    serviceButtons.forEach(button => {
        button.addEventListener('click', () => {
            const service = button.dataset.service;
            const amount = button.dataset.amount;
            const description = button.dataset.description;
            
            // Update form
            serviceSelect.value = service;
            amountInput.value = amount;
            
            // Scroll to form
            document.getElementById('order').scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
            
            // Highlight selected service
            serviceButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            
            console.log(`Service selected: ${description} - ${amount} ₽`);
        });
    });
    
    // Service select change
    if (serviceSelect) {
        serviceSelect.addEventListener('change', function() {
            updatePriceBasedOnService(this.value);
        });
    }
    
    // Amount buttons
    document.querySelectorAll('.amount-btn').forEach(button => {
        button.addEventListener('click', function() {
            const change = parseInt(this.dataset.change);
            const currentAmount = parseInt(amountInput.value) || 0;
            const newAmount = Math.max(1, currentAmount + change);
            
            amountInput.value = newAmount;
        });
    });
}

function updatePriceBasedOnService(serviceType) {
    const amountInput = document.getElementById('amount');
    if (!amountInput) return;
    
    const basePrices = {
        'rank_boost': 1999,
        'wins_boost': 299,
        'placement': 2499,
        'coaching': 999,
        'custom': 1000
    };
    
    if (basePrices[serviceType]) {
        amountInput.value = basePrices[serviceType];
    }
}

/**
 * Order Form Handling
 */
function initOrderForm() {
    const orderForm = document.getElementById('orderForm');
    if (!orderForm) return;
    
    // CSRF Token
    let csrfToken = '';
    
    // Get CSRF token
    fetch('/api/csrf')
        .then(response => response.json())
        .then(data => {
            if (data.csrf_token) {
                csrfToken = data.csrf_token;
            }
        })
        .catch(console.error);
    
    // Calculate price button
    const calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', calculatePrice);
    }
    
    // Form submission
    orderForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!validateOrderForm()) {
            return;
        }
        
        // Get form data
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());
        
        // Add CSRF token
        data.csrf_token = csrfToken;
        
        // Show loading
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch('/orders.php?action=create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Show success message
                showPaymentRedirect(result.payment.confirmation_url);
                
                // Update CSRF token
                if (result.csrf_token) {
                    csrfToken = result.csrf_token;
                }
            } else {
                throw new Error(result.error || 'Ошибка создания заказа');
            }
        } catch (error) {
            console.error('Order creation error:', error);
            showNotification(error.message, 'error');
        } finally {
            // Restore button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
    
    // Live validation
    const inputs = orderForm.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', validateField);
        input.addEventListener('input', clearFieldError);
    });
}

function validateOrderForm() {
    const form = document.getElementById('orderForm');
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!validateField({ target: field })) {
            isValid = false;
        }
    });
    
    // Check terms agreement
    const termsCheckbox = form.querySelector('#terms');
    if (termsCheckbox && !termsCheckbox.checked) {
        showFieldError(termsCheckbox, 'Необходимо согласиться с условиями');
        isValid = false;
    }
    
    return isValid;
}

function validateField(e) {
    const field = e.target;
    const value = field.value.trim();
    const fieldName = field.name;
    
    clearFieldError(field);
    
    // Required validation
    if (field.required && !value) {
        showFieldError(field, 'Это поле обязательно для заполнения');
        return false;
    }
    
    // Email validation
    if (fieldName === 'contact' && field.closest('[name="contact_type"]')?.value === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            showFieldError(field, 'Введите корректный email');
            return false;
        }
    }
    
    // Amount validation
    if (fieldName === 'amount') {
        const amount = parseFloat(value);
        if (isNaN(amount) || amount < 1 || amount > 100000) {
            showFieldError(field, 'Введите корректную сумму (от 1 до 100 000 ₽)');
            return false;
        }
    }
    
    return true;
}

function showFieldError(field, message) {
    clearFieldError(field);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.color = 'var(--danger)';
    errorDiv.style.fontSize = '0.875rem';
    errorDiv.style.marginTop = '0.25rem';
    errorDiv.textContent = message;
    
    field.parentNode.appendChild(errorDiv);
    field.style.borderColor = 'var(--danger)';
}

function clearFieldError(e) {
    const field = e.target || e;
    const errorDiv = field.parentNode.querySelector('.field-error');
    
    if (errorDiv) {
        errorDiv.remove();
    }
    
    field.style.borderColor = '';
}

async function calculatePrice() {
    const form = document.getElementById('orderForm');
    const serviceType = form.querySelector('#service_type').value;
    const currentRank = form.querySelector('#current_rank').value;
    const targetRank = form.querySelector('#target_rank').value;
    const wins = form.querySelector('#wins')?.value || 1;
    const hours = form.querySelector('#hours')?.value || 1;
    
    if (!serviceType) {
        showNotification('Выберите тип услуги', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/orders.php?action=calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                service_type: serviceType,
                current_rank: currentRank,
                target_rank: targetRank,
                wins: wins,
                hours: hours
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            const amountInput = document.getElementById('amount');
            if (amountInput) {
                amountInput.value = result.final_price;
                showNotification(`Рассчитанная стоимость: ${result.final_price} ₽`, 'success');
            }
        } else {
            throw new Error(result.error || 'Ошибка расчета');
        }
    } catch (error) {
        console.error('Price calculation error:', error);
        showNotification(error.message, 'error');
    }
}

function showPaymentRedirect(url) {
    const paymentResult = document.getElementById('paymentResult');
    const orderForm = document.getElementById('orderForm');
    
    if (paymentResult && orderForm) {
        orderForm.classList.add('hidden');
        paymentResult.classList.remove('hidden');
        
        // Redirect after 2 seconds
        setTimeout(() => {
            window.location.href = url;
        }, 2000);
    } else {
        window.location.href = url;
    }
}

/**
 * FAQ
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
 * Animations
 */
function initAnimations() {
    // Intersection Observer for fade-in animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
            }
        });
    }, observerOptions);
    
    // Observe elements
    document.querySelectorAll('[data-aos]').forEach(el => observer.observe(el));
}

/**
 * Stats Counter
 */
function initStatsCounter() {
    const statNumbers = document.querySelectorAll('.stat-number');
    
    if (!statNumbers.length) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const statNumber = entry.target;
                const target = parseInt(statNumber.dataset.count);
                const duration = 2000;
                const increment = target / (duration / 16);
                let current = 0;
                
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        statNumber.textContent = target;
                        clearInterval(timer);
                    } else {
                        statNumber.textContent = Math.floor(current);
                    }
                }, 16);
                
                observer.unobserve(statNumber);
            }
        });
    }, { threshold: 0.5 });
    
    statNumbers.forEach(stat => observer.observe(stat));
}

/**
 * Particles Background
 */
function initParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        createParticle(particlesContainer);
    }
}

function createParticle(container) {
    const particle = document.createElement('div');
    particle.style.position = 'absolute';
    particle.style.width = Math.random() * 4 + 1 + 'px';
    particle.style.height = particle.style.width;
    particle.style.background = `rgba(108, 99, 255, ${Math.random() * 0.3 + 0.1})`;
    particle.style.borderRadius = '50%';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    
    container.appendChild(particle);
    
    // Animation
    animateParticle(particle);
}

function animateParticle(particle) {
    let x = parseFloat(particle.style.left);
    let y = parseFloat(particle.style.top);
    let dx = (Math.random() - 0.5) * 0.5;
    let dy = (Math.random() - 0.5) * 0.5;
    
    function move() {
        x += dx;
        y += dy;
        
        // Bounce off edges
        if (x <= 0 || x >= 100) dx *= -1;
        if (y <= 0 || y >= 100) dy *= -1;
        
        particle.style.left = x + '%';
        particle.style.top = y + '%';
        
        requestAnimationFrame(move);
    }
    
    move();
}

/**
 * Notification System
 */
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Styles
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '10000';
    notification.style.padding = '1rem 1.5rem';
    notification.style.borderRadius = 'var(--border-radius-md)';
    notification.style.background = getNotificationColor(type);
    notification.style.color = 'white';
    notification.style.display = 'flex';
    notification.style.alignItems = 'center';
    notification.style.gap = '0.75rem';
    notification.style.boxShadow = 'var(--shadow-lg)';
    notification.style.animation = 'slideIn 0.3s ease';
    
    // Close button
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = 'inherit';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.marginLeft = '1rem';
    
    closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
    
    document.body.appendChild(notification);
}

function getNotificationIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function getNotificationColor(type) {
    const colors = {
        'success': 'var(--success)',
        'error': 'var(--danger)',
        'warning': 'var(--warning)',
        'info': 'var(--primary)'
    };
    return colors[type] || 'var(--primary)';
}

/**
 * Utility Functions
 */
function debounce(func, wait) {
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

function throttle(func, limit) {
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

// Export for global use
window.VABBoost = {
    showNotification,
    debounce,
    throttle
};