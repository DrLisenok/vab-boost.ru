/**
 * Админ-панель VAB BOOST
 * Взаимодействует с orders.php и stats.php
 */

class AdminPanel {
    constructor() {
        // Базовые настройки API
        this.API_BASE = window.location.origin;
        this.API_ENDPOINTS = {
            login: 'orders.php?action=login',
            logout: 'orders.php?action=logout',
            orders: 'orders.php',
            stats: 'stats.php'
        };
        
        this.currentAdmin = null;
        this.orders = [];
        this.currentPage = 1;
        this.ordersPerPage = 20;
        this.filters = {
            status: '',
            date_from: '',
            date_to: '',
            search: ''
        };

        this.init();
    }

    async init() {
        console.log('Инициализация админ-панели...');
        
        // Проверка авторизации
        await this.checkAuth();
        
        // Инициализация интерфейса
        this.initUI();
        
        // Загрузка данных
        await this.loadOrders();
        await this.loadStats();
        
        // Обновление каждые 30 секунд
        setInterval(() => {
            if (this.currentAdmin) {
                this.loadOrders();
                this.loadStats();
            }
        }, 30000);
    }

    async checkAuth() {
        try {
            const response = await fetch(this.API_ENDPOINTS.orders + '?action=check_auth', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.authenticated) {
                    this.currentAdmin = data.admin;
                    this.showAdminPanel();
                    return true;
                }
            }
        } catch (error) {
            console.warn('Ошибка проверки авторизации:', error);
        }
        
        this.showLoginForm();
        return false;
    }

    async login(username, password) {
        try {
            const response = await fetch(this.API_ENDPOINTS.login, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка авторизации');
            }

            this.currentAdmin = data.admin;
            this.showAdminPanel();
            await this.loadOrders();
            await this.loadStats();
            
            this.showNotification('Успешный вход в систему', 'success');
            return true;

        } catch (error) {
            this.showNotification(error.message, 'error');
            return false;
        }
    }

    async logout() {
        try {
            await fetch(this.API_ENDPOINTS.logout, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Ошибка при выходе:', error);
        } finally {
            this.currentAdmin = null;
            this.showLoginForm();
            this.showNotification('Вы вышли из системы', 'info');
        }
    }

    async loadOrders() {
        try {
            // Формирование URL с параметрами
            const params = new URLSearchParams({
                action: 'list',
                page: this.currentPage,
                per_page: this.ordersPerPage,
                ...this.filters
            });

            const response = await fetch(`${this.API_ENDPOINTS.orders}?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.orders = data.orders || [];
            this.renderOrders();
            this.renderPagination(data.total || 0, data.pages || 1);

        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            this.showNotification('Ошибка загрузки заказов', 'error');
        }
    }

    async loadStats() {
        try {
            const response = await fetch(this.API_ENDPOINTS.stats, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const stats = await response.json();
            this.renderStats(stats);

        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }

    async updateOrderStatus(orderId, newStatus) {
        if (!confirm(`Изменить статус заказа на "${newStatus}"?`)) {
            return;
        }

        try {
            const response = await fetch(this.API_ENDPOINTS.orders, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'update_status',
                    order_id: orderId,
                    status: newStatus
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка обновления статуса');
            }

            // Обновить локальные данные
            const orderIndex = this.orders.findIndex(o => o.id == orderId);
            if (orderIndex !== -1) {
                this.orders[orderIndex].status = newStatus;
                this.orders[orderIndex].updated_at = new Date().toISOString();
                this.renderOrders();
            }

            this.showNotification('Статус заказа обновлен', 'success');

        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async updateOrderAssignment(orderId, adminId) {
        try {
            const response = await fetch(this.API_ENDPOINTS.orders, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'assign',
                    order_id: orderId,
                    admin_id: adminId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка назначения заказа');
            }

            // Обновить локальные данные
            const orderIndex = this.orders.findIndex(o => o.id == orderId);
            if (orderIndex !== -1) {
                this.orders[orderIndex].assigned_to = adminId;
                this.renderOrders();
            }

            this.showNotification('Заказ назначен', 'success');

        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    // ==================== РЕНДЕРИНГ ====================

    initUI() {
        // Обработчики для фильтров
        document.getElementById('status-filter')?.addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.currentPage = 1;
            this.loadOrders();
        });

        document.getElementById('search-input')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.currentPage = 1;
                this.loadOrders();
            }, 500);
        });

        document.getElementById('date-from')?.addEventListener('change', (e) => {
            this.filters.date_from = e.target.value;
            this.currentPage = 1;
            this.loadOrders();
        });

        document.getElementById('date-to')?.addEventListener('change', (e) => {
            this.filters.date_to = e.target.value;
            this.currentPage = 1;
            this.loadOrders();
        });

        // Кнопка выхода
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());

        // Кнопка обновления
        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            this.loadOrders();
            this.loadStats();
            this.showNotification('Данные обновлены', 'info');
        });
    }

    showLoginForm() {
        document.getElementById('login-section')?.classList.remove('hidden');
        document.getElementById('admin-panel')?.classList.add('hidden');
        
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.onsubmit = (e) => {
                e.preventDefault();
                const username = document.getElementById('admin-username').value;
                const password = document.getElementById('admin-password').value;
                this.login(username, password);
            };
        }
    }

    showAdminPanel() {
        document.getElementById('login-section')?.classList.add('hidden');
        document.getElementById('admin-panel')?.classList.remove('hidden');
        
        // Отображение имени администратора
        const adminNameEl = document.getElementById('admin-name');
        if (adminNameEl && this.currentAdmin) {
            adminNameEl.textContent = this.currentAdmin.username;
        }
    }

    renderOrders() {
        const tbody = document.getElementById('orders-tbody');
        if (!tbody) return;

        if (this.orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center">
                        <div style="padding: 40px; color: #666;">
                            <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 20px;"></i>
                            <p>Заказы не найдены</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.orders.map(order => `
            <tr data-order-id="${order.id}">
                <td>${order.order_id}</td>
                <td>
                    <span class="badge badge-${order.service_type || 'secondary'}">
                        ${this.getServiceName(order.service_type)}
                    </span>
                </td>
                <td>
                    ${order.current_rank ? `${order.current_rank} → ${order.target_rank}` : '-'}
                </td>
                <td>${order.region || '-'}</td>
                <td>
                    <span class="contact-info" title="${order.contact_value}">
                        <i class="fab fa-${order.contact_type === 'telegram' ? 'telegram' : 'discord'}"></i>
                        ${order.contact_value?.substring(0, 15)}${order.contact_value?.length > 15 ? '...' : ''}
                    </span>
                </td>
                <td>
                    <span class="badge badge-status-${order.status}">
                        ${this.getStatusText(order.status)}
                    </span>
                </td>
                <td>${order.amount ? `${order.amount} ₽` : '-'}</td>
                <td>${this.formatDate(order.created_at)}</td>
                <td>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                            Действия
                        </button>
                        <div class="dropdown-menu">
                            <button class="dropdown-item" onclick="adminPanel.updateOrderStatus('${order.id}', 'pending')">
                                <i class="fas fa-clock"></i> В ожидании
                            </button>
                            <button class="dropdown-item" onclick="adminPanel.updateOrderStatus('${order.id}', 'in_progress')">
                                <i class="fas fa-spinner"></i> В работе
                            </button>
                            <button class="dropdown-item" onclick="adminPanel.updateOrderStatus('${order.id}', 'completed')">
                                <i class="fas fa-check"></i> Завершен
                            </button>
                            <div class="dropdown-divider"></div>
                            <button class="dropdown-item" onclick="adminPanel.showOrderDetails('${order.id}')">
                                <i class="fas fa-eye"></i> Подробности
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderPagination(totalOrders, totalPages) {
        const pagination = document.getElementById('orders-pagination');
        if (!pagination) return;

        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            html += `
                <li class="page-item ${i === this.currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="adminPanel.goToPage(${i})">${i}</a>
                </li>
            `;
        }

        pagination.innerHTML = html;
    }

    renderStats(stats) {
        // Общая статистика
        if (stats.total_orders !== undefined) {
            document.getElementById('total-orders').textContent = stats.total_orders;
        }
        if (stats.total_revenue !== undefined) {
            document.getElementById('total-revenue').textContent = `${stats.total_revenue} ₽`;
        }
        if (stats.avg_order_value !== undefined) {
            document.getElementById('avg-order-value').textContent = `${stats.avg_order_value} ₽`;
        }

        // Статистика по статусам
        const statusStats = document.getElementById('status-stats');
        if (statusStats && stats.orders_by_status) {
            statusStats.innerHTML = Object.entries(stats.orders_by_status)
                .map(([status, count]) => `
                    <div class="status-item">
                        <span class="status-label">${this.getStatusText(status)}:</span>
                        <span class="status-count">${count}</span>
                    </div>
                `).join('');
        }

        // Статистика по услугам
        const serviceStats = document.getElementById('service-stats');
        if (serviceStats && stats.orders_by_service) {
            serviceStats.innerHTML = Object.entries(stats.orders_by_service)
                .map(([service, count]) => `
                    <div class="service-item">
                        <span class="service-label">${this.getServiceName(service)}:</span>
                        <span class="service-count">${count}</span>
                    </div>
                `).join('');
        }
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

    goToPage(page) {
        this.currentPage = page;
        this.loadOrders();
    }

    getServiceName(serviceType) {
        const services = {
            'rank_boost': 'Повышение ранга',
            'wins_boost': 'Буст побед',
            'placement': 'Калибровка',
            'coaching': 'Коучинг'
        };
        return services[serviceType] || serviceType;
    }

    getStatusText(status) {
        const statuses = {
            'pending': 'Ожидание',
            'paid': 'Оплачен',
            'in_progress': 'В работе',
            'completed': 'Завершен',
            'cancelled': 'Отменен'
        };
        return statuses[status] || status;
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    showNotification(message, type = 'info') {
        // Создание уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#d4edda' : 
                        type === 'error' ? '#f8d7da' : 
                        type === 'warning' ? '#fff3cd' : 
                        '#d1ecf1'};
            color: ${type === 'success' ? '#155724' : 
                    type === 'error' ? '#721c24' : 
                    type === 'warning' ? '#856404' : 
                    '#0c5460'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : 
                              type === 'error' ? '#f5c6cb' : 
                              type === 'warning' ? '#ffeaa7' : 
                              '#bee5eb'};
            border-radius: 4px;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            animation: slideIn 0.3s ease;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: none; border: none; margin-left: 10px; cursor: pointer; color: inherit;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Автоматическое удаление через 5 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    showOrderDetails(orderId) {
        const order = this.orders.find(o => o.id == orderId);
        if (!order) return;

        const modalHtml = `
            <div class="modal" id="order-details-modal" style="display: block;">
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h5>Заказ ${order.order_id}</h5>
                        <span class="modal-close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>Информация о заказе</h6>
                                <table class="table table-sm">
                                    <tr><td>Услуга:</td><td>${this.getServiceName(order.service_type)}</td></tr>
                                    <tr><td>Статус:</td><td><span class="badge badge-status-${order.status}">${this.getStatusText(order.status)}</span></td></tr>
                                    <tr><td>Сумма:</td><td>${order.amount} ₽</td></tr>
                                    <tr><td>Регион:</td><td>${order.region || '-'}</td></tr>
                                    <tr><td>Создан:</td><td>${this.formatDate(order.created_at)}</td></tr>
                                    <tr><td>Обновлен:</td><td>${this.formatDate(order.updated_at)}</td></tr>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h6>Данные клиента</h6>
                                <table class="table table-sm">
                                    <tr><td>Контакт:</td><td>${order.contact_type === 'telegram' ? 'Telegram' : 'Discord'}: ${order.contact_value}</td></tr>
                                    <tr><td>Игровой логин:</td><td>${order.game_login || '-'}</td></tr>
                                    <tr><td>Текущий ранг:</td><td>${order.current_rank || '-'}</td></tr>
                                    <tr><td>Целевой ранг:</td><td>${order.target_rank || '-'}</td></tr>
                                </table>
                            </div>
                        </div>
                        
                        ${order.notes ? `
                            <div class="mt-3">
                                <h6>Примечания клиента</h6>
                                <div class="alert alert-info">${order.notes}</div>
                            </div>
                        ` : ''}
                        
                        ${order.admin_notes ? `
                            <div class="mt-3">
                                <h6>Примечания администратора</h6>
                                <div class="alert alert-warning">${order.admin_notes}</div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.getElementById('order-details-modal').style.display='none'">
                            Закрыть
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Добавление модального окна в документ
        const existingModal = document.getElementById('order-details-modal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Обработчик закрытия
        document.querySelector('#order-details-modal .modal-close').onclick = () => {
            document.getElementById('order-details-modal').style.display = 'none';
        };
    }
}

// Глобальная инициализация
let adminPanel = null;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
    window.adminPanel = adminPanel; // Для глобального доступа
});