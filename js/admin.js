/**
 * VAB BOOST - Admin Panel JavaScript
 */

class AdminPanel {
    constructor() {
        this.csrfToken = '';
        this.currentUser = null;
        this.currentPage = 1;
        this.ordersPerPage = 20;
        this.currentOrderId = null;
        this.charts = {};
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize admin panel
     */
    async init() {
        // Check authentication
        await this.checkAuth();
        
        // Initialize components if authenticated
        if (this.currentUser) {
            this.initComponents();
            this.loadDashboard();
            this.startClock();
        } else {
            this.showLogin();
        }
    }
    
    /**
     * Check authentication status
     */
    async checkAuth() {
        try {
            const response = await fetch('/api/login.php?action=check_auth');
            const data = await response.json();
            
            if (data.authenticated) {
                this.currentUser = data.admin;
                this.csrfToken = data.csrf_token || '';
                this.showDashboard();
            } else {
                this.currentUser = null;
                this.showLogin();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showLogin();
        }
    }
    
    /**
     * Show login form
     */
    showLogin() {
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('adminDashboard').classList.add('hidden');
        
        // Setup login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
    }
    
    /**
     * Show admin dashboard
     */
    showDashboard() {
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');
        
        // Update username
        const usernameElement = document.getElementById('adminUsername');
        if (usernameElement && this.currentUser) {
            usernameElement.textContent = this.currentUser.username;
        }
    }
    
    /**
     * Handle login form submission
     */
    async handleLogin(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch('/api/login.php?action=login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok && result.authenticated) {
                this.currentUser = result.admin;
                this.csrfToken = result.csrf_token || '';
                this.showDashboard();
                this.initComponents();
                this.loadDashboard();
                this.startClock();
            } else {
                throw new Error(result.error || 'Ошибка входа');
            }
        } catch (error) {
            this.showError(error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
    
    /**
     * Initialize admin components
     */
    initComponents() {
        // Theme toggle
        const themeToggle = document.getElementById('adminThemeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                const isDark = document.body.classList.contains('dark-mode');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            });
        }
        
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        // Sidebar navigation
        const sidebarLinks = document.querySelectorAll('.sidebar-link');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.switchSection(section);
            });
        });
        
        // Initialize modals
        this.initModals();
        
        // Initialize event listeners
        this.initEventListeners();
    }
    
    /**
     * Switch between admin sections
     */
    switchSection(section) {
        // Update active sidebar link
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[data-section="${section}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // Hide all sections
        document.querySelectorAll('.admin-section').forEach(sec => {
            sec.classList.remove('active');
        });
        
        // Show target section
        const targetSection = document.getElementById(`${section}Section`);
        if (targetSection) {
            targetSection.classList.add('active');
            
            // Load section data
            switch (section) {
                case 'dashboard':
                    this.loadDashboard();
                    break;
                case 'orders':
                    this.loadOrders();
                    break;
                case 'payments':
                    this.loadPayments();
                    break;
                case 'stats':
                    this.loadStats();
                    break;
                case 'reviews':
                    this.loadReviews();
                    break;
                case 'settings':
                    this.loadSettings();
                    break;
            }
        }
    }
    
    /**
     * Initialize modals
     */
    initModals() {
        // Close modals on X click
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.remove('active');
            });
        });
        
        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        // Confirmation modal
        window.showConfirmation = (message, callback) => {
            const modal = document.getElementById('confirmationModal');
            const messageElement = document.getElementById('confirmationMessage');
            const confirmBtn = document.getElementById('confirmActionBtn');
            const cancelBtn = document.getElementById('cancelConfirmBtn');
            
            messageElement.textContent = message;
            
            // Remove old listeners
            const newConfirmBtn = confirmBtn.cloneNode(true);
            const newCancelBtn = cancelBtn.cloneNode(true);
            
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            
            // Add new listeners
            newConfirmBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                if (callback) callback(true);
            });
            
            newCancelBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                if (callback) callback(false);
            });
            
            modal.classList.add('active');
        };
    }
    
    /**
     * Initialize event listeners
     */
    initEventListeners() {
        // Orders filters
        document.getElementById('applyFilters')?.addEventListener('click', () => this.loadOrders());
        document.getElementById('resetFilters')?.addEventListener('click', () => this.resetFilters());
        document.getElementById('refreshOrders')?.addEventListener('click', () => this.loadOrders());
        document.getElementById('exportOrders')?.addEventListener('click', () => this.exportOrders());
        
        // Payments refresh
        document.getElementById('refreshPayments')?.addEventListener('click', () => this.loadPayments());
        
        // Stats filters
        document.getElementById('statsPeriod')?.addEventListener('change', (e) => {
            const customDateFields = document.querySelectorAll('.custom-date');
            if (e.target.value === 'custom') {
                customDateFields.forEach(field => field.classList.remove('hidden'));
            } else {
                customDateFields.forEach(field => field.classList.add('hidden'));
            }
        });
        
        document.getElementById('generateReport')?.addEventListener('click', () => this.generateReport());
        
        // Settings tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchSettingsTab(tab);
            });
        });
        
        // Settings forms
        document.getElementById('generalSettingsForm')?.addEventListener('submit', (e) => this.saveSettings(e, 'general'));
        document.getElementById('paymentSettingsForm')?.addEventListener('submit', (e) => this.saveSettings(e, 'payment'));
        document.getElementById('notificationSettingsForm')?.addEventListener('submit', (e) => this.saveSettings(e, 'notification'));
        document.getElementById('securitySettingsForm')?.addEventListener('submit', (e) => this.saveSettings(e, 'security'));
    }
    
    /**
     * Start clock in sidebar
     */
    startClock() {
        const updateClock = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('ru-RU');
            const timeElement = document.getElementById('currentTime');
            if (timeElement) {
                timeElement.textContent = timeString;
            }
        };
        
        updateClock();
        setInterval(updateClock, 1000);
    }
    
    /**
     * Load dashboard data
     */
    async loadDashboard() {
        try {
            // Load stats
            const statsResponse = await fetch('/api/stats.php?action=dashboard');
            const statsData = await statsResponse.json();
            
            if (statsResponse.ok) {
                this.updateDashboardStats(statsData);
                this.createCharts(statsData);
                this.updateActivityList(statsData.recent_orders || []);
            }
            
            // Load pending orders count
            this.updatePendingOrdersCount();
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.showError('Не удалось загрузить данные дашборда');
        }
    }
    
    /**
     * Update dashboard stats
     */
    updateDashboardStats(data) {
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;
        
        const stats = data.overview || {};
        
        const statsHTML = `
            <div class="stat-card">
                <h3>Заказов сегодня</h3>
                <div class="stat-value">${stats.today_orders || 0}</div>
                <div class="stat-change positive">
                    <i class="fas fa-arrow-up"></i>
                    12% с прошлого дня
                </div>
            </div>
            
            <div class="stat-card">
                <h3>Доход сегодня</h3>
                <div class="stat-value">${this.formatCurrency(stats.today_revenue || 0)}</div>
                <div class="stat-change positive">
                    <i class="fas fa-arrow-up"></i>
                    8% с прошлого дня
                </div>
            </div>
            
            <div class="stat-card">
                <h3>Всего заказов</h3>
                <div class="stat-value">${stats.total_orders || 0}</div>
                <div class="stat-change positive">
                    <i class="fas fa-arrow-up"></i>
                    24% за месяц
                </div>
            </div>
            
            <div class="stat-card">
                <h3>Общий доход</h3>
                <div class="stat-value">${this.formatCurrency(stats.total_revenue || 0)}</div>
                <div class="stat-change positive">
                    <i class="fas fa-arrow-up"></i>
                    18% за месяц
                </div>
            </div>
        `;
        
        statsGrid.innerHTML = statsHTML;
    }
    
    /**
     * Create charts
     */
    createCharts(data) {
        // Revenue chart
        const revenueCtx = document.getElementById('revenueChart')?.getContext('2d');
        if (revenueCtx && data.daily) {
            if (this.charts.revenue) {
                this.charts.revenue.destroy();
            }
            
            this.charts.revenue = new Chart(revenueCtx, {
                type: 'line',
                data: {
                    labels: data.daily.map(day => day.date),
                    datasets: [{
                        label: 'Доход (₽)',
                        data: data.daily.map(day => day.revenue),
                        borderColor: '#6c63ff',
                        backgroundColor: 'rgba(108, 99, 255, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
        
        // Services chart
        const servicesCtx = document.getElementById('servicesChart')?.getContext('2d');
        if (servicesCtx && data.services) {
            if (this.charts.services) {
                this.charts.services.destroy();
            }
            
            this.charts.services = new Chart(servicesCtx, {
                type: 'doughnut',
                data: {
                    labels: data.services.map(service => service.service_type),
                    datasets: [{
                        data: data.services.map(service => service.orders),
                        backgroundColor: [
                            '#6c63ff',
                            '#ff6584',
                            '#00d4ff',
                            '#00c9a7',
                            '#ffc107'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
    }
    
    /**
     * Update activity list
     */
    updateActivityList(activities) {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;
        
        if (!activities || activities.length === 0) {
            activityList.innerHTML = '<p class="text-center text-gray">Нет активностей</p>';
            return;
        }
        
        const activityHTML = activities.map(order => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-shopping-cart"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-title">Новый заказ #${order.order_number}</div>
                    <div class="activity-description">
                        ${order.service_type} • ${this.formatCurrency(order.amount)} ₽
                    </div>
                </div>
                <div class="activity-time">
                    ${this.formatTimeAgo(order.created_at)}
                </div>
            </div>
        `).join('');
        
        activityList.innerHTML = activityHTML;
    }
    
    /**
     * Update pending orders count
     */
    async updatePendingOrdersCount() {
        try {
            const response = await fetch('/api/orders.php?action=list&status=pending&per_page=1');
            const data = await response.json();
            
            if (response.ok) {
                const badge = document.getElementById('pendingOrdersCount');
                if (badge && data.pagination) {
                    badge.textContent = data.pagination.total;
                }
            }
        } catch (error) {
            console.error('Failed to load pending orders count:', error);
        }
    }
    
    /**
     * Load orders
     */
    async loadOrders(page = 1) {
        this.currentPage = page;
        
        try {
            // Build query string
            const params = new URLSearchParams({
                action: 'list',
                page: page,
                per_page: this.ordersPerPage
            });
            
            // Add filters
            const statusFilter = document.getElementById('orderStatusFilter')?.value;
            const serviceFilter = document.getElementById('orderServiceFilter')?.value;
            const dateFilter = document.getElementById('orderDateFilter')?.value;
            const searchFilter = document.getElementById('orderSearch')?.value;
            
            if (statusFilter) params.append('status', statusFilter);
            if (serviceFilter) params.append('service_type', serviceFilter);
            if (dateFilter) params.append('date_from', dateFilter);
            if (searchFilter) params.append('search', searchFilter);
            
            const response = await fetch(`/api/orders.php?${params}`);
            const data = await response.json();
            
            if (response.ok) {
                this.updateOrdersTable(data.orders || []);
                this.updateOrdersPagination(data.pagination);
            } else {
                throw new Error(data.error || 'Ошибка загрузки заказов');
            }
        } catch (error) {
            console.error('Failed to load orders:', error);
            this.showError('Не удалось загрузить заказы');
        }
    }
    
    /**
     * Update orders table
     */
    updateOrdersTable(orders) {
        const tableBody = document.getElementById('ordersTableBody');
        if (!tableBody) return;
        
        if (!orders || orders.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">Заказы не найдены</td>
                </tr>
            `;
            return;
        }
        
        const rows = orders.map(order => `
            <tr>
                <td>${order.id}</td>
                <td>
                    <strong>${order.order_number}</strong><br>
                    <small class="text-gray">${order.contact}</small>
                </td>
                <td>${this.getServiceName(order.service_type)}</td>
                <td>${this.formatCurrency(order.amount)} ₽</td>
                <td>
                    <span class="status-badge status-${order.status}">
                        ${this.getStatusName(order.status)}
                    </span>
                </td>
                <td>${this.formatDate(order.created_at)}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="adminPanel.viewOrder(${order.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="adminPanel.editOrder(${order.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = rows;
    }
    
    /**
     * Update orders pagination
     */
    updateOrdersPagination(pagination) {
        const paginationElement = document.getElementById('ordersPagination');
        if (!paginationElement) return;
        
        if (!pagination || pagination.pages <= 1) {
            paginationElement.innerHTML = '';
            return;
        }
        
        let html = '';
        
        // Previous button
        if (pagination.page > 1) {
            html += `<button onclick="adminPanel.loadOrders(${pagination.page - 1})">&laquo;</button>`;
        }
        
        // Page numbers
        for (let i = 1; i <= pagination.pages; i++) {
            if (i === 1 || i === pagination.pages || (i >= pagination.page - 2 && i <= pagination.page + 2)) {
                html += `<button 
                    class="${i === pagination.page ? 'active' : ''}"
                    onclick="adminPanel.loadOrders(${i})"
                >${i}</button>`;
            } else if (i === pagination.page - 3 || i === pagination.page + 3) {
                html += '<span>...</span>';
            }
        }
        
        // Next button
        if (pagination.page < pagination.pages) {
            html += `<button onclick="adminPanel.loadOrders(${pagination.page + 1})">&raquo;</button>`;
        }
        
        paginationElement.innerHTML = html;
    }
    
    /**
     * Reset filters
     */
    resetFilters() {
        document.getElementById('orderStatusFilter').value = '';
        document.getElementById('orderServiceFilter').value = '';
        document.getElementById('orderDateFilter').value = '';
        document.getElementById('orderSearch').value = '';
        this.loadOrders(1);
    }
    
    /**
     * Export orders
     */
    exportOrders() {
        // This would typically generate and download a CSV or Excel file
        alert('Экспорт в разработке');
    }
    
    /**
     * View order details
     */
    async viewOrder(orderId) {
        try {
            const response = await fetch(`/api/orders.php?action=get&id=${orderId}`);
            const data = await response.json();
            
            if (response.ok) {
                this.showOrderDetails(data.order);
            } else {
                throw new Error(data.error || 'Ошибка загрузки заказа');
            }
        } catch (error) {
            console.error('Failed to load order:', error);
            this.showError('Не удалось загрузить детали заказа');
        }
    }
    
    /**
     * Show order details modal
     */
    showOrderDetails(order) {
        this.currentOrderId = order.id;
        
        const modal = document.getElementById('orderDetailsModal');
        const orderNumber = document.getElementById('modalOrderNumber');
        const orderDetails = document.getElementById('orderDetailsContent');
        
        if (orderNumber) orderNumber.textContent = order.order_number;
        
        if (orderDetails) {
            orderDetails.innerHTML = `
                <div class="order-detail-group">
                    <div class="order-detail-label">Услуга</div>
                    <div class="order-detail-value">${this.getServiceName(order.service_type)}</div>
                </div>
                
                <div class="order-detail-group">
                    <div class="order-detail-label">Статус</div>
                    <div class="order-detail-value">
                        <span class="status-badge status-${order.status}">
                            ${this.getStatusName(order.status)}
                        </span>
                    </div>
                </div>
                
                <div class="order-detail-group">
                    <div class="order-detail-label">Сумма</div>
                    <div class="order-detail-value">${this.formatCurrency(order.amount)} ₽</div>
                </div>
                
                <div class="order-detail-group">
                    <div class="order-detail-label">Контакт</div>
                    <div class="order-detail-value">${order.contact} (${order.contact_type})</div>
                </div>
                
                <div class="order-detail-group">
                    <div class="order-detail-label">Регион</div>
                    <div class="order-detail-value">${order.region || 'Не указан'}</div>
                </div>
                
                <div class="order-detail-group">
                    <div class="order-detail-label">Дата создания</div>
                    <div class="order-detail-value">${this.formatDateTime(order.created_at)}</div>
                </div>
                
                <div class="order-detail-group">
                    <div class="order-detail-label">Последнее обновление</div>
                    <div class="order-detail-value">${this.formatDateTime(order.updated_at)}</div>
                </div>
                
                ${order.notes ? `
                <div class="order-detail-group full-width">
                    <div class="order-detail-label">Примечания</div>
                    <div class="order-detail-value">${order.notes}</div>
                </div>
                ` : ''}
            `;
        }
        
        modal.classList.add('active');
    }
    
    /**
     * Edit order
     */
    editOrder(orderId) {
        this.viewOrder(orderId);
        
        // Enable edit mode
        const editBtn = document.getElementById('editOrderBtn');
        const saveBtn = document.getElementById('saveOrderBtn');
        
        if (editBtn && saveBtn) {
            editBtn.style.display = 'none';
            saveBtn.style.display = 'inline-block';
        }
    }
    
    /**
     * Load payments
     */
    async loadPayments() {
        try {
            const response = await fetch('/api/payments.php?action=list');
            const data = await response.json();
            
            if (response.ok) {
                this.updatePaymentsTable(data.payments || []);
            } else {
                throw new Error(data.error || 'Ошибка загрузки платежей');
            }
        } catch (error) {
            console.error('Failed to load payments:', error);
            this.showError('Не удалось загрузить платежи');
        }
    }
    
    /**
     * Update payments table
     */
    updatePaymentsTable(payments) {
        const tableBody = document.getElementById('paymentsTableBody');
        if (!tableBody) return;
        
        if (!payments || payments.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">Платежи не найдены</td>
                </tr>
            `;
            return;
        }
        
        const rows = payments.map(payment => `
            <tr>
                <td>
                    <small class="text-gray">${payment.payment_id}</small>
                </td>
                <td>${payment.order_number}</td>
                <td>${this.formatCurrency(payment.amount)} ₽</td>
                <td>
                    <span class="status-badge status-${payment.status}">
                        ${payment.status}
                    </span>
                </td>
                <td>${this.formatDate(payment.created_at)}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="adminPanel.viewPayment('${payment.payment_id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = rows;
    }
    
    /**
     * View payment details
     */
    async viewPayment(paymentId) {
        try {
            const response = await fetch(`/api/payments.php?action=status&id=${paymentId}`);
            const data = await response.json();
            
            if (response.ok) {
                this.showPaymentDetails(data.payment);
            } else {
                throw new Error(data.error || 'Ошибка загрузки платежа');
            }
        } catch (error) {
            console.error('Failed to load payment:', error);
            this.showError('Не удалось загрузить детали платежа');
        }
    }
    
    /**
     * Show payment details modal
     */
    showPaymentDetails(payment) {
        const modal = document.getElementById('paymentDetailsModal');
        const paymentDetails = document.getElementById('paymentDetailsContent');
        
        if (paymentDetails) {
            paymentDetails.innerHTML = `
                <div class="order-detail-grid">
                    <div class="order-detail-group">
                        <div class="order-detail-label">ID платежа</div>
                        <div class="order-detail-value">${payment.payment_id}</div>
                    </div>
                    
                    <div class="order-detail-group">
                        <div class="order-detail-label">Статус</div>
                        <div class="order-detail-value">
                            <span class="status-badge status-${payment.status}">
                                ${payment.status}
                            </span>
                        </div>
                    </div>
                    
                    <div class="order-detail-group">
                        <div class="order-detail-label">Сумма</div>
                        <div class="order-detail-value">${this.formatCurrency(payment.amount)} ₽</div>
                    </div>
                    
                    <div class="order-detail-group">
                        <div class="order-detail-label">Заказ</div>
                        <div class="order-detail-value">${payment.order_number}</div>
                    </div>
                    
                    <div class="order-detail-group">
                        <div class="order-detail-label">Дата создания</div>
                        <div class="order-detail-value">${this.formatDateTime(payment.created_at)}</div>
                    </div>
                    
                    ${payment.confirmation_url ? `
                    <div class="order-detail-group full-width">
                        <div class="order-detail-label">Ссылка для оплаты</div>
                        <div class="order-detail-value">
                            <a href="${payment.confirmation_url}" target="_blank">
                                ${payment.confirmation_url}
                            </a>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        }
        
        modal.classList.add('active');
    }
    
    /**
     * Load statistics
     */
    async loadStats() {
        try {
            const response = await fetch('/api/stats.php?action=dashboard');
            const data = await response.json();
            
            if (response.ok) {
                this.updateStats(data);
            } else {
                throw new Error(data.error || 'Ошибка загрузки статистики');
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
            this.showError('Не удалось загрузить статистику');
        }
    }
    
    /**
     * Update statistics display
     */
    updateStats(data) {
        // Overall stats
        const overallStats = document.getElementById('overallStats');
        if (overallStats && data.overview) {
            const stats = data.overview;
            overallStats.innerHTML = `
                <div class="order-detail-grid">
                    <div class="order-detail-group">
                        <div class="order-detail-label">Всего заказов</div>
                        <div class="order-detail-value">${stats.total_orders || 0}</div>
                    </div>
                    
                    <div class="order-detail-group">
                        <div class="order-detail-label">Общий доход</div>
                        <div class="order-detail-value">${this.formatCurrency(stats.total_revenue || 0)} ₽</div>
                    </div>
                    
                    <div class="order-detail-group">
                        <div class="order-detail-label">Средний чек</div>
                        <div class="order-detail-value">${this.formatCurrency(stats.avg_order_value || 0)} ₽</div>
                    </div>
                    
                    <div class="order-detail-group">
                        <div class="order-detail-label">Уникальных клиентов</div>
                        <div class="order-detail-value">${stats.unique_customers || 0}</div>
                    </div>
                </div>
            `;
        }
        
        // Top services
        const topServices = document.getElementById('topServices');
        if (topServices && data.services) {
            const services = data.services.slice(0, 5);
            topServices.innerHTML = services.map(service => `
                <div class="activity-item">
                    <div class="activity-details">
                        <div class="activity-title">${this.getServiceName(service.service_type)}</div>
                        <div class="activity-description">
                            ${service.orders} заказов • ${this.formatCurrency(service.revenue)} ₽
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        // Top regions
        const topRegions = document.getElementById('topRegions');
        if (topRegions && data.regions) {
            const regions = data.regions.slice(0, 5);
            topRegions.innerHTML = regions.map(region => `
                <div class="activity-item">
                    <div class="activity-details">
                        <div class="activity-title">${region.region}</div>
                        <div class="activity-description">
                            ${region.orders} заказов • ${this.formatCurrency(region.revenue)} ₽
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        // Orders chart
        const ordersCtx = document.getElementById('ordersChart')?.getContext('2d');
        if (ordersCtx && data.daily) {
            if (this.charts.orders) {
                this.charts.orders.destroy();
            }
            
            this.charts.orders = new Chart(ordersCtx, {
                type: 'bar',
                data: {
                    labels: data.daily.map(day => day.date),
                    datasets: [{
                        label: 'Заказы',
                        data: data.daily.map(day => day.orders),
                        backgroundColor: '#6c63ff',
                        borderColor: '#6c63ff',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        }
    }
    
    /**
     * Generate report
     */
    generateReport() {
        const period = document.getElementById('statsPeriod').value;
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        
        // In a real app, this would generate and download a report
        alert(`Отчет за период: ${period} ${startDate && endDate ? `(${startDate} - ${endDate})` : ''}`);
    }
    
    /**
     * Load reviews
     */
    async loadReviews() {
        try {
            const response = await fetch('/api/reviews.php');
            const data = await response.json();
            
            if (response.ok) {
                this.updateReviewsList(data);
            } else {
                throw new Error(data.error || 'Ошибка загрузки отзывов');
            }
        } catch (error) {
            console.error('Failed to load reviews:', error);
            this.showError('Не удалось загрузить отзывы');
        }
    }
    
    /**
     * Update reviews list
     */
    updateReviewsList(reviews) {
        const reviewsList = document.getElementById('reviewsList');
        if (!reviewsList) return;
        
        if (!reviews || reviews.length === 0) {
            reviewsList.innerHTML = '<p class="text-center text-gray">Отзывы не найдены</p>';
            return;
        }
        
        const reviewsHTML = reviews.map(review => `
            <div class="review-admin-card">
                <div class="review-admin-header">
                    <div>
                        <strong>Заказ #${review.order_number}</strong>
                        <div class="review-rating">
                            ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                        </div>
                    </div>
                    <div class="review-admin-actions">
                        <button class="btn btn-sm btn-outline" onclick="adminPanel.approveReview(${review.id})">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="adminPanel.deleteReview(${review.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <p>${review.comment}</p>
                <small class="text-gray">${this.formatDateTime(review.created_at)}</small>
            </div>
        `).join('');
        
        reviewsList.innerHTML = reviewsHTML;
    }
    
    /**
     * Approve review
     */
    approveReview(reviewId) {
        showConfirmation('Одобрить этот отзыв?', (confirmed) => {
            if (confirmed) {
                // Implement approval logic
                console.log('Approving review:', reviewId);
            }
        });
    }
    
    /**
     * Delete review
     */
    deleteReview(reviewId) {
        showConfirmation('Удалить этот отзыв?', (confirmed) => {
            if (confirmed) {
                // Implement deletion logic
                console.log('Deleting review:', reviewId);
            }
        });
    }
    
    /**
     * Load settings
     */
    loadSettings() {
        // This would load settings from the server
        console.log('Loading settings...');
    }
    
    /**
     * Switch settings tab
     */
    switchSettingsTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeTab = document.getElementById(`${tab}Tab`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }
    
    /**
     * Save settings
     */
    async saveSettings(e, tab) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        try {
            const response = await fetch(`/api/settings.php?tab=${tab}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showSuccess('Настройки сохранены');
                if (result.csrf_token) {
                    this.csrfToken = result.csrf_token;
                }
            } else {
                throw new Error(result.error || 'Ошибка сохранения настроек');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showError('Не удалось сохранить настройки');
        }
    }
    
    /**
     * Handle logout
     */
    async handleLogout() {
        try {
            const response = await fetch('/api/logout.php', {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': this.csrfToken
                }
            });
            
            if (response.ok) {
                this.currentUser = null;
                this.showLogin();
            }
        } catch (error) {
            console.error('Logout failed:', error);
            this.showLogin();
        }
    }
    
    /**
     * Utility: Format currency
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU').format(amount);
    }
    
    /**
     * Utility: Format date
     */
    formatDate(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    }
    
    /**
     * Utility: Format date and time
     */
    formatDateTime(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU');
    }
    
    /**
     * Utility: Format time ago
     */
    formatTimeAgo(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'только что';
        if (diffMins < 60) return `${diffMins} мин назад`;
        if (diffHours < 24) return `${diffHours} ч назад`;
        if (diffDays === 1) return 'вчера';
        if (diffDays < 7) return `${diffDays} дн назад`;
        
        return this.formatDate(dateString);
    }
    
    /**
     * Utility: Get service name
     */
    getServiceName(serviceType) {
        const services = {
            'rank_boost': 'Повышение ранга',
            'wins_boost': 'Буст побед',
            'placement': 'Калибровка',
            'coaching': 'Коучинг',
            'custom': 'Индивидуальный'
        };
        
        return services[serviceType] || serviceType;
    }
    
    /**
     * Utility: Get status name
     */
    getStatusName(status) {
        const statuses = {
            'pending': 'Ожидание',
            'paid': 'Оплачен',
            'processing': 'В работе',
            'completed': 'Завершен',
            'cancelled': 'Отменен',
            'awaiting_payment': 'Ожидает оплаты',
            'payment_failed': 'Ошибка оплаты'
        };
        
        return statuses[status] || status;
    }
    
    /**
     * Utility: Show error message
     */
    showError(message) {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
            setTimeout(() => errorDiv.classList.add('hidden'), 5000);
        } else {
            alert(message);
        }
    }
    
    /**
     * Utility: Show success message
     */
    showSuccess(message) {
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--success);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: var(--border-radius-md);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => successDiv.remove(), 300);
        }, 3000);
    }
}

// Create global instance
const adminPanel = new AdminPanel();
window.adminPanel = adminPanel;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Theme initialization
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        const themeToggle = document.getElementById('adminThemeToggle');
        if (themeToggle) {
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }
});