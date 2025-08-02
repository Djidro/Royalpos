// Offline detection and handling
function updateOnlineStatus() {
    const statusElement = document.createElement('div');
    statusElement.id = 'network-status';
    statusElement.style.position = 'fixed';
    statusElement.style.bottom = '10px';
    statusElement.style.right = '10px';
    statusElement.style.padding = '8px 15px';
    statusElement.style.borderRadius = '20px';
    statusElement.style.fontSize = '14px';
    statusElement.style.zIndex = '1000';
    
    if (navigator.onLine) {
        statusElement.textContent = 'Online';
        statusElement.style.backgroundColor = '#2ecc71';
        statusElement.style.color = 'white';
    } else {
        statusElement.textContent = 'Offline';
        statusElement.style.backgroundColor = '#e74c3c';
        statusElement.style.color = 'white';
    }
    
    // Remove existing status if it exists
    const existingStatus = document.getElementById('network-status');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    document.body.appendChild(statusElement);
    
    // Auto-hide after 3 seconds if online
    if (navigator.onLine) {
        setTimeout(() => {
            statusElement.style.opacity = '0';
            setTimeout(() => statusElement.remove(), 500);
        }, 3000);
    }
}

// Add event listeners for online/offline status
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Initial check
updateOnlineStatus();
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the app
    initApp();
});

function initApp() {
    // Tab switching functionality
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Initialize all tabs
    initPOSTab();
    initReceiptsTab();
    initSummaryTab();
    initStockTab();
    initShiftTab();
    initExpensesTab();

    // Check if there's an active shift
    checkActiveShift();

    // Load low stock alerts
    checkLowStock();
}

function switchTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Deactivate all tab buttons
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.classList.remove('active');
    });

    // Activate the selected tab
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');

    // Refresh the tab content if needed
    switch(tabId) {
        case 'pos':
            loadProducts();
            updateCartDisplay();
            break;
        case 'receipts':
            loadReceipts();
            break;
        case 'summary':
            loadSummary();
            break;
        case 'stock':
            loadStockItems();
            checkLowStock();
            break;
        case 'shift':
            updateShiftDisplay();
            break;
        case 'expenses':
            loadExpenses();
            break;
    }
}

// POS Tab Functions
function initPOSTab() {
    // Load products
    loadProducts();

    // Set up checkout button
    document.getElementById('checkout-btn').addEventListener('click', checkout);
}

function loadProducts() {
    const productsGrid = document.getElementById('products-grid');
    productsGrid.innerHTML = '';

    const products = getProducts();
    
    if (products.length === 0) {
        productsGrid.innerHTML = '<p class="no-products">No products available. Add some in the Stock tab.</p>';
        return;
    }
    
    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        
        // Handle unlimited stock display
        const stockDisplay = product.quantity === 'unlimited' ? 'Unlimited' : product.quantity;
        const stockClass = product.quantity !== 'unlimited' && product.quantity < 5 ? 'low-stock' : '';
        const lowStockWarning = product.quantity !== 'unlimited' && product.quantity < 5 ? '(Low Stock!)' : '';
        
        productCard.innerHTML = `
            <h3>${product.name}</h3>
            <p>${product.price} RWF</p>
            <p class="stock-info ${stockClass}">Stock: ${stockDisplay} ${lowStockWarning}</p>
        `;
        
        productCard.addEventListener('click', () => addToCart(product.id));
        productsGrid.appendChild(productCard);
    });
}

function addToCart(productId) {
    const activeShift = getActiveShift();
    if (!activeShift) {
        alert('Please start a shift before making sales!');
        return;
    }

    const products = getProducts();
    const product = products.find(p => p.id === productId);
    
    // Check if product exists and has stock (unless unlimited)
    if (!product || (product.quantity !== 'unlimited' && product.quantity <= 0)) {
        alert('This item is out of stock!');
        return;
    }

    let cart = getCart();
    const existingItem = cart.find(item => item.productId === productId);

    if (existingItem) {
        // Only check stock if not unlimited
        if (product.quantity !== 'unlimited' && existingItem.quantity >= product.quantity) {
            alert('Not enough stock available!');
            return;
        }
        existingItem.quantity += 1;
    } else {
        cart.push({
            productId: productId,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }

    saveCart(cart);
    updateCartDisplay();
}

function getCart() {
    const cart = localStorage.getItem('bakeryPosCart');
    return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
    localStorage.setItem('bakeryPosCart', JSON.stringify(cart));
}

function updateCartDisplay() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalElement = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    const cart = getCart();
    const products = getProducts();

    cartItemsContainer.innerHTML = '';

    let total = 0;

    cart.forEach(item => {
        const product = products.find(p => p.id == item.productId);
        if (!product) return;

        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        const cartItemElement = document.createElement('div');
        cartItemElement.className = 'cart-item';
        cartItemElement.innerHTML = `
            <div>
                <h4>${item.name}</h4>
                <p>${item.price} RWF × ${item.quantity} = ${itemTotal} RWF</p>
            </div>
            <div class="cart-item-controls">
                <button class="decrease-btn" data-id="${item.productId}"><i class="fas fa-minus"></i></button>
                <span>${item.quantity}</span>
                <button class="increase-btn" data-id="${item.productId}"><i class="fas fa-plus"></i></button>
                <button class="remove-btn" data-id="${item.productId}"><i class="fas fa-times"></i></button>
            </div>
        `;

        cartItemsContainer.appendChild(cartItemElement);
    });

    // Update event listeners
    document.querySelectorAll('.decrease-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = parseInt(e.currentTarget.getAttribute('data-id'));
            updateCartItemQuantity(productId, -1);
        });
    });

    document.querySelectorAll('.increase-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = parseInt(e.currentTarget.getAttribute('data-id'));
            updateCartItemQuantity(productId, 1);
        });
    });

    document.querySelectorAll('.remove-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = parseInt(e.currentTarget.getAttribute('data-id'));
            removeFromCart(productId);
        });
    });

    cartTotalElement.textContent = total;
    checkoutBtn.disabled = cart.length === 0 || !getActiveShift();
}

function updateCartItemQuantity(productId, change) {
    let cart = getCart();
    const itemIndex = cart.findIndex(item => item.productId === productId);
    
    if (itemIndex !== -1) {
        const newQuantity = cart[itemIndex].quantity + change;
        
        if (newQuantity <= 0) {
            cart.splice(itemIndex, 1);
        } else {
            // Check stock availability (only if not unlimited)
            const products = getProducts();
            const product = products.find(p => p.id === productId);
            
            if (product && product.quantity !== 'unlimited' && newQuantity > product.quantity) {
                alert('Not enough stock available!');
                return;
            }
            
            cart[itemIndex].quantity = newQuantity;
        }
        
        saveCart(cart);
        updateCartDisplay();
    }
}

function removeFromCart(productId) {
    const cart = getCart();
    const item = cart.find(item => item.productId === productId);
    
    if (!item) return;
    
    if (confirm(`Are you sure you want to remove ${item.name} from the cart?`)) {
        const updatedCart = cart.filter(item => item.productId !== productId);
        saveCart(updatedCart);
        updateCartDisplay();
        
        // Show a brief notification
        const notification = document.createElement('div');
        notification.className = 'cart-notification';
        notification.textContent = `${item.name} removed from cart`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }
}

function checkout() {
    const activeShift = getActiveShift();
    if (!activeShift) {
        alert('Please start a shift before making sales!');
        return;
    }

    const cart = getCart();
    if (cart.length === 0) {
        alert('Cart is empty!');
        return;
    }

    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    const products = getProducts();
    
    // Check stock availability (skip unlimited items)
    for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (product && product.quantity !== 'unlimited' && product.quantity < item.quantity) {
            alert(`Not enough stock for ${item.name}!`);
            return;
        }
    }

    // Process the sale
    const sale = {
        id: Date.now(),
        date: new Date().toISOString(),
        items: cart.map(item => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        })),
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        paymentMethod: paymentMethod,
        shiftId: activeShift.id,
        refunded: false
    };

    // Update stock (skip unlimited items)
    cart.forEach(item => {
        const productIndex = products.findIndex(p => p.id === item.productId);
        if (productIndex !== -1 && products[productIndex].quantity !== 'unlimited') {
            products[productIndex].quantity -= item.quantity;
        }
    });

    // Save updated products
    saveProducts(products);

    // Record the sale
    const sales = getSales();
    sales.push(sale);
    saveSales(sales);

    // Record for current shift
    activeShift.sales.push(sale.id);
    activeShift.total += sale.total;
    if (paymentMethod === 'cash') {
        activeShift.cashTotal += sale.total;
    } else {
        activeShift.momoTotal += sale.total;
    }
    saveActiveShift(activeShift);

    // Clear the cart
    saveCart([]);
    updateCartDisplay();

    // Show receipt
    showReceipt(sale);

    // Reload products to update stock display
    loadProducts();
    
    // Check for low stock
    checkLowStock();
}

// Receipt Tab Functions
function initReceiptsTab() {
    // Set up date filter
    document.getElementById('filter-receipts-btn').addEventListener('click', loadReceipts);
    
    // Set today's date as default filter
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('receipt-date-filter').value = today;

    // Add refund button to receipt modal
    document.getElementById('receipt-modal').addEventListener('click', function(e) {
        if (e.target.id === 'refund-receipt-btn') {
            const receiptId = parseInt(e.target.getAttribute('data-id'));
            processRefund(receiptId);
        }
    });
}

function processRefund(receiptId) {
    if (!confirm('Are you sure you want to process a refund for this receipt?')) return;
    
    const activeShift = getActiveShift();
    if (!activeShift) {
        alert('Please start a shift before processing refunds!');
        return;
    }
    
    const sales = getSales();
    const receiptIndex = sales.findIndex(s => s.id === receiptId);
    
    if (receiptIndex === -1) {
        alert('Receipt not found!');
        return;
    }
    
    const receipt = sales[receiptIndex];
    
    if (receipt.refunded) {
        alert('This receipt has already been refunded!');
        return;
    }
    
    // Mark as refunded
    receipt.refunded = true;
    receipt.refundDate = new Date().toISOString();
    receipt.refundShiftId = activeShift.id;
    
    // Update stock
    const products = getProducts();
    receipt.items.forEach(item => {
        const productIndex = products.findIndex(p => p.id === item.productId);
        if (productIndex !== -1) {
            products[productIndex].quantity += item.quantity;
        }
    });
    
    // Update shift totals
    if (receipt.paymentMethod === 'cash') {
        activeShift.cashTotal -= receipt.total;
    } else {
        activeShift.momoTotal -= receipt.total;
    }
    activeShift.total -= receipt.total;
    
    // Remove from shift sales if it exists
    const shiftSaleIndex = activeShift.sales.indexOf(receiptId);
    if (shiftSaleIndex !== -1) {
        activeShift.sales.splice(shiftSaleIndex, 1);
    }
    
    // Add to refunds
    if (!activeShift.refunds) activeShift.refunds = [];
    activeShift.refunds.push(receiptId);
    
    // Save all changes
    saveProducts(products);
    saveSales(sales);
    saveActiveShift(activeShift);
    
    // Update displays
    loadReceipts();
    loadProducts();
    updateShiftDisplay();
    checkLowStock();
    
    alert('Refund processed successfully!');
    document.getElementById('receipt-modal').style.display = 'none';
}

function loadReceipts() {
    const receiptsList = document.getElementById('receipts-list');
    receiptsList.innerHTML = '';

    const dateFilter = document.getElementById('receipt-date-filter').value;
    const sales = getSales();

    // Filter sales by date if filter is set
    const filteredSales = dateFilter 
        ? sales.filter(sale => sale.date.split('T')[0] === dateFilter)
        : sales;

    if (filteredSales.length === 0) {
        receiptsList.innerHTML = '<p class="no-receipts">No receipts found for this date.</p>';
        return;
    }

    // Display receipts in reverse chronological order
    filteredSales.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(sale => {
        const receiptItem = document.createElement('div');
        receiptItem.className = `receipt-item ${sale.refunded ? 'refunded' : ''}`;
        receiptItem.innerHTML = `
            <h3>Receipt #${sale.id} ${sale.refunded ? '(Refunded)' : ''}</h3>
            <p><i class="far fa-clock"></i> ${new Date(sale.date).toLocaleString()}</p>
            <p><i class="fas fa-money-bill-wave"></i> ${sale.total} RWF (${sale.paymentMethod.toUpperCase()})</p>
            <p><i class="fas fa-boxes"></i> ${sale.items.reduce((sum, item) => sum + item.quantity, 0)} items</p>
        `;
        
        receiptItem.addEventListener('click', () => showReceipt(sale));
        receiptsList.appendChild(receiptItem);
    });
}

function showReceipt(sale) {
    const modal = document.getElementById('receipt-modal');
    const receiptContent = document.getElementById('receipt-content');
    
    // Format receipt content
    let itemsHtml = '';
    sale.items.forEach(item => {
        itemsHtml += `
            <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${item.price} RWF</td>
                <td>${item.price * item.quantity} RWF</td>
            </tr>
        `;
    });

    receiptContent.innerHTML = `
        <h2><i class="fas fa-receipt"></i> Receipt #${sale.id}</h2>
        <p><i class="far fa-clock"></i> ${new Date(sale.date).toLocaleString()}</p>
        <p><i class="fas fa-money-bill-wave"></i> Payment Method: ${sale.paymentMethod.toUpperCase()}</p>
        <p><i class="fas fa-user-clock"></i> Shift ID: ${sale.shiftId || 'N/A'}</p>
        <table class="summary-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" style="text-align: right;"><strong>Grand Total:</strong></td>
                    <td><strong>${sale.total} RWF</strong></td>
                </tr>
            </tfoot>
        </table>
    `;

    // Add refund button if not already refunded
    if (!sale.refunded) {
        receiptContent.innerHTML += `
            <button id="refund-receipt-btn" class="btn btn-danger" data-id="${sale.id}" style="margin-top: 20px;">
                <i class="fas fa-undo"></i> Process Refund
            </button>
        `;
    } else {
        receiptContent.innerHTML += `
            <div class="alert alert-warning" style="margin-top: 20px;">
                <i class="fas fa-exclamation-triangle"></i> This receipt was refunded on ${new Date(sale.refundDate).toLocaleString()}
                ${sale.refundShiftId ? `(Shift ID: ${sale.refundShiftId})` : ''}
            </div>
        `;
    }

    // Set up copy receipt button
    document.getElementById('copy-receipt-btn').onclick = function() {
        const receiptText = `Receipt #${sale.id}\nDate: ${new Date(sale.date).toLocaleString()}\nPayment Method: ${sale.paymentMethod.toUpperCase()}\nShift ID: ${sale.shiftId || 'N/A'}\n\nItems:\n${
            sale.items.map(item => `${item.name} - ${item.quantity} × ${item.price} RWF = ${item.price * item.quantity} RWF`).join('\n')
        }\n\nGrand Total: ${sale.total} RWF`;
        
        navigator.clipboard.writeText(receiptText).then(() => {
            alert('Receipt copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy receipt: ', err);
            alert('Failed to copy receipt. Please try again.');
        });
    };

    modal.style.display = 'block';
}

// Close modal when clicking the X
document.querySelector('.close').addEventListener('click', function() {
    document.getElementById('receipt-modal').style.display = 'none';
});

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('receipt-modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

// Summary Tab Functions
function initSummaryTab() {
    // Set up date range filter
    document.getElementById('filter-summary-btn').addEventListener('click', loadSummary);
    
    // Set default date range (today)
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('start-date').value = today;
    document.getElementById('end-date').value = today;
    
    // Set up WhatsApp summary button
    document.getElementById('whatsapp-summary-btn').addEventListener('click', sendWhatsAppDateSummary);
}

function loadSummary() {
    const summaryContent = document.getElementById('summary-content');
    summaryContent.innerHTML = '';

    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const sales = getSales();

    // Filter sales by date range and exclude refunded sales
    const filteredSales = sales.filter(sale => {
        if (sale.refunded) return false;
        const saleDate = sale.date.split('T')[0];
        return (!startDate || saleDate >= startDate) && (!endDate || saleDate <= endDate);
    });

    if (filteredSales.length === 0) {
        summaryContent.innerHTML = '<p class="no-summary">No sales found for this date range.</p>';
        return;
    }

    // Calculate summary data (excluding refunded sales)
    const cashTotal = filteredSales
        .filter(sale => sale.paymentMethod === 'cash')
        .reduce((sum, sale) => sum + sale.total, 0);

    const momoTotal = filteredSales
        .filter(sale => sale.paymentMethod === 'momo')
        .reduce((sum, sale) => sum + sale.total, 0);

    const grandTotal = cashTotal + momoTotal;
    const transactionCount = filteredSales.length;

    // Calculate item breakdown
    const itemBreakdown = {};
    filteredSales.forEach(sale => {
        sale.items.forEach(item => {
            if (!itemBreakdown[item.name]) {
                itemBreakdown[item.name] = {
                    quantity: 0,
                    total: 0,
                    price: item.price
                };
            }
            itemBreakdown[item.name].quantity += item.quantity;
            itemBreakdown[item.name].total += item.quantity * item.price;
        });
    });

    // Format item breakdown table with current stock levels
    const products = getProducts();
    let itemsHtml = '';
    for (const [name, data] of Object.entries(itemBreakdown)) {
        const product = products.find(p => p.name === name);
        const remainingStock = product ? product.quantity : 'N/A';
        
        itemsHtml += `
            <tr>
                <td>${name}</td>
                <td>${data.quantity}</td>
                <td>${remainingStock}</td>
                <td>${data.price} RWF</td>
                <td>${data.total} RWF</td>
            </tr>
        `;
    }

    // Display summary with enhanced item breakdown
    summaryContent.innerHTML = `
        <div class="summary-item">
            <h3><i class="fas fa-chart-pie"></i> Sales Summary</h3>
            <p><i class="far fa-calendar-alt"></i> Date Range: ${startDate || 'No start date'} to ${endDate || 'No end date'}</p>
            <p><i class="fas fa-exchange-alt"></i> Total Transactions: ${transactionCount}</p>
            <p><i class="fas fa-money-bill-wave"></i> Cash Total: ${cashTotal} RWF</p>
            <p><i class="fas fa-mobile-alt"></i> MoMo Total: ${momoTotal} RWF</p>
            <p><i class="fas fa-coins"></i> Grand Total: ${grandTotal} RWF</p>
        </div>
        
        <div class="summary-item">
            <h3><i class="fas fa-box-open"></i> Daily Item Breakdown</h3>
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Quantity Sold</th>
                        <th>Stock Left</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
        </div>
        
        <div class="summary-item">
            <h3><i class="fas fa-calendar-day"></i> Daily Sales</h3>
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Transactions</th>
                        <th>Cash</th>
                        <th>MoMo</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${getDailySalesBreakdown(startDate, endDate).map(day => `
                        <tr>
                            <td>${day.date}</td>
                            <td>${day.transactions}</td>
                            <td>${day.cash} RWF</td>
                            <td>${day.momo} RWF</td>
                            <td>${day.total} RWF</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function sendWhatsAppDateSummary() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const sales = getSales().filter(sale => {
        if (sale.refunded) return false;
        const saleDate = sale.date.split('T')[0];
        return (!startDate || saleDate >= startDate) && (!endDate || saleDate <= endDate);
    });

    if (sales.length === 0) {
        alert('No sales found for this date range!');
        return;
    }

    // Calculate totals
    const cashTotal = sales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
    const momoTotal = sales.filter(s => s.paymentMethod === 'momo').reduce((sum, s) => sum + s.total, 0);
    const grandTotal = cashTotal + momoTotal;

    // Calculate item breakdown
    const itemBreakdown = {};
    sales.forEach(sale => {
        sale.items.forEach(item => {
            if (!itemBreakdown[item.name]) {
                itemBreakdown[item.name] = 0;
            }
            itemBreakdown[item.name] += item.quantity;
        });
    });

    // Sort items by quantity sold (top 5)
    const sortedItems = Object.entries(itemBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // Format WhatsApp message
    let message = `📅 POS Date Range Summary\n\n`;
    message += `📆 Date Range: ${startDate} to ${endDate}\n\n`;
    
    // Sales Overview
    message += `💰 *Sales Overview*\n`;
    message += `• Total Cash: ${cashTotal} RWF\n`;
    message += `• Total MoMo: ${momoTotal} RWF\n`;
    message += `• Grand Total: ${grandTotal} RWF\n\n`;
    
    // Top 5 Items
    message += `🏆 *Top 5 Items*\n`;
    sortedItems.forEach(([name, quantity], index) => {
        message += `${index + 1}. ${name}: ${quantity} sold\n`;
    });
    message += `\n`;
    
    // All Items
    message += `🛒 *All Items Sold*\n`;
    Object.entries(itemBreakdown).forEach(([name, quantity]) => {
        const product = getProducts().find(p => p.name === name);
        message += `• ${name}\n`;
        message += `   - Sold: ${quantity}\n`;
        if (product && product.quantity !== 'unlimited') {
            message += `   - Stock Left: ${product.quantity}\n`;
        }
    });

    // Handle offline case
    if (!navigator.onLine) {
        if (confirm('You are offline. Copy to clipboard instead?')) {
            navigator.clipboard.writeText(message)
                .then(() => alert('Report copied! Paste into WhatsApp when online.'))
                .catch(() => alert('Failed to copy.'));
        }
        return;
    }

    // Open WhatsApp
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
}

function getDailySalesBreakdown(startDate, endDate) {
    const sales = getSales().filter(sale => !sale.refunded);
    const dailySales = {};
    
    sales.forEach(sale => {
        const saleDate = sale.date.split('T')[0];
        
        // Skip if outside date range
        if ((startDate && saleDate < startDate) || (endDate && saleDate > endDate)) {
            return;
        }
        
        if (!dailySales[saleDate]) {
            dailySales[saleDate] = {
                date: saleDate,
                transactions: 0,
                cash: 0,
                momo: 0,
                total: 0
            };
        }
        
        dailySales[saleDate].transactions += 1;
        dailySales[saleDate].total += sale.total;
        
        if (sale.paymentMethod === 'cash') {
            dailySales[saleDate].cash += sale.total;
        } else {
            dailySales[saleDate].momo += sale.total;
        }
    });
    
    // Convert to array and sort by date
    return Object.values(dailySales).sort((a, b) => a.date.localeCompare(b.date));
}

// Stock Management Tab Functions
function initStockTab() {
    // Set up add item button
    document.getElementById('add-item-btn').addEventListener('click', addStockItem);
    
    // Load stock items
    loadStockItems();
}

function loadStockItems() {
    const stockItemsContainer = document.getElementById('stock-items');
    stockItemsContainer.innerHTML = '';

    const products = getProducts();
    
    if (products.length === 0) {
        stockItemsContainer.innerHTML = '<p class="no-items">No items in stock. Add some items to get started.</p>';
        return;
    }

    products.forEach(product => {
        const stockItem = document.createElement('div');
        stockItem.className = 'stock-item';
        
        // Handle unlimited stock display
        const stockDisplay = product.quantity === 'unlimited' ? 'Unlimited' : product.quantity;
        const stockClass = product.quantity !== 'unlimited' && product.quantity < 5 ? 'low-stock' : '';
        const lowStockWarning = product.quantity !== 'unlimited' && product.quantity < 5 ? '(Low)' : '';
        
        stockItem.innerHTML = `
            <span>${product.name}</span>
            <span>${product.price} RWF</span>
            <span class="${stockClass}">${stockDisplay} ${lowStockWarning}</span>
            <button class="edit-btn" data-id="${product.id}"><i class="fas fa-edit"></i> Edit</button>
            <button class="delete-btn" data-id="${product.id}"><i class="fas fa-trash"></i> Delete</button>
        `;
        
        stockItemsContainer.appendChild(stockItem);
    });

    // Add event listeners to edit and delete buttons
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = e.target.closest('button').getAttribute('data-id');
            editStockItem(productId);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = e.target.closest('button').getAttribute('data-id');
            deleteStockItem(productId);
        });
    });
}

function checkLowStock() {
    const lowStockAlerts = document.getElementById('low-stock-alerts');
    lowStockAlerts.innerHTML = '';
    
    const products = getProducts();
    const lowStockItems = products.filter(p => p.quantity !== 'unlimited' && p.quantity < 5);
    
    if (lowStockItems.length === 0) {
        return;
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-warning';
    
    if (lowStockItems.length === 1) {
        alertDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Low stock alert: ${lowStockItems[0].name} has only ${lowStockItems[0].quantity} left!`;
    } else {
        const itemsList = lowStockItems.map(item => `${item.name} (${item.quantity})`).join(', ');
        alertDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Low stock alert for ${lowStockItems.length} items: ${itemsList}`;
    }
    
    lowStockAlerts.appendChild(alertDiv);
}

function addStockItem() {
    const nameInput = document.getElementById('item-name');
    const priceInput = document.getElementById('item-price');
    const quantityInput = document.getElementById('item-quantity');
    
    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value);
    let quantity = quantityInput.value.trim().toLowerCase(); // Changed to accept text
    
    // Handle unlimited stock case
    const isUnlimited = quantity === 'unlimited';
    
    if (!name || isNaN(price)) {
        alert('Please fill in all fields with valid values!');
        return;
    }

    if (price <= 0) {
        alert('Price must be a positive number!');
        return;
    }

    // Convert quantity to number if not unlimited
    if (!isUnlimited) {
        quantity = parseInt(quantity);
        if (isNaN(quantity)) {
            alert('Quantity must be a number or "unlimited"!');
            return;
        }
        if (quantity <= 0) {
            alert('Quantity must be positive or "unlimited"!');
            return;
        }
    }

    const products = getProducts();
    
    // Check if item already exists
    const existingItem = products.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existingItem) {
        if (confirm('Item already exists. Do you want to update it instead?')) {
            existingItem.price = price;
            existingItem.quantity = isUnlimited ? 'unlimited' : quantity;
            saveProducts(products);
            loadStockItems();
            checkLowStock();
            
            // Clear inputs
            nameInput.value = '';
            priceInput.value = '';
            quantityInput.value = '';
            return;
        } else {
            return;
        }
    }

    // Add new item
    products.push({
        id: Date.now(),
        name: name,
        price: price,
        quantity: isUnlimited ? 'unlimited' : quantity
    });

    saveProducts(products);
    loadStockItems();
    checkLowStock();
    
    // Clear inputs
    nameInput.value = '';
    priceInput.value = '';
    quantityInput.value = '';
}

function editStockItem(productId) {
    const products = getProducts();
    const product = products.find(p => p.id === parseInt(productId));
    
    if (!product) return;

    const newName = prompt('Enter new name:', product.name);
    if (newName === null) return;
    
    const newPrice = parseFloat(prompt('Enter new price:', product.price));
    if (isNaN(newPrice)) {
        alert('Price must be a number!');
        return;
    }
    if (newPrice <= 0) {
        alert('Price must be positive!');
        return;
    }
    
    let newQuantity = prompt('Enter new quantity (or "unlimited"):', 
                           product.quantity === 'unlimited' ? 'unlimited' : product.quantity);
    if (newQuantity === null) return;
    
    newQuantity = newQuantity.trim().toLowerCase();
    const isUnlimited = newQuantity === 'unlimited';
    
    if (!isUnlimited) {
        newQuantity = parseInt(newQuantity);
        if (isNaN(newQuantity)) {
            alert('Quantity must be a number or "unlimited"!');
            return;
        }
        if (newQuantity < 0) {
            alert('Quantity must be positive or "unlimited"!');
            return;
        }
    }

    product.name = newName;
    product.price = newPrice;
    product.quantity = isUnlimited ? 'unlimited' : newQuantity;

    saveProducts(products);
    loadStockItems();
    loadProducts(); // Update POS display
    checkLowStock();
}

function deleteStockItem(productId) {
    if (!confirm('Are you sure you want to delete this item? This cannot be undone.')) return;

    const products = getProducts();
    const updatedProducts = products.filter(p => p.id !== parseInt(productId));
    
    saveProducts(updatedProducts);
    loadStockItems();
    loadProducts(); // Update POS display
    checkLowStock();
}

function getProducts() {
    const products = localStorage.getItem('bakeryPosProducts');
    return products ? JSON.parse(products) : [];
}

function saveProducts(products) {
    localStorage.setItem('bakeryPosProducts', JSON.stringify(products));
}

// Shift Management Tab Functions
function initShiftTab() {
    // Set up shift buttons
    document.getElementById('start-shift-btn').addEventListener('click', startShift);
    document.getElementById('end-shift-btn').addEventListener('click', endShift);
    document.getElementById('send-whatsapp-btn').addEventListener('click', sendWhatsAppSummary);
}

function checkActiveShift() {
    const activeShift = getActiveShift();
    const shiftStatus = document.getElementById('shift-status');
    const startBtn = document.getElementById('start-shift-btn');
    const endBtn = document.getElementById('end-shift-btn');
    const checkoutBtn = document.getElementById('checkout-btn');
    const shiftAlert = document.getElementById('shift-closed-alert');
    
    if (activeShift) {
        shiftStatus.className = 'shift-status shift-on';
        shiftStatus.innerHTML = `<i class="fas fa-user-clock"></i> Shift: Active (Started ${new Date(activeShift.startTime).toLocaleTimeString()})`;
        startBtn.disabled = true;
        endBtn.disabled = false;
        checkoutBtn.disabled = getCart().length === 0;
        shiftAlert.style.display = 'none';
    } else {
        shiftStatus.className = 'shift-status shift-off';
        shiftStatus.innerHTML = '<i class="fas fa-user-clock"></i> Shift: Not Started';
        startBtn.disabled = false;
        endBtn.disabled = true;
        checkoutBtn.disabled = true;
        if (getCart().length > 0) {
            shiftAlert.style.display = 'block';
        }
    }
}

function startShift() {
    const cashierName = prompt("Enter cashier name:", "") || "Cashier";
    const startingCash = parseFloat(prompt("Starting cash amount:", "0")) || 0;

    const activeShift = {
        id: Date.now(),
        startTime: new Date().toISOString(),
        endTime: null,
        sales: [],
        cashTotal: 0,
        momoTotal: 0,
        total: 0,
        Cashier: cashierName,
        startingCash: startingCash
    };

    saveActiveShift(activeShift);
    checkActiveShift();
    updateShiftDisplay();
    
    // Show notification
    alert(`Shift #${activeShift.id} started at ${new Date(activeShift.startTime).toLocaleTimeString()}\nCashier: ${activeShift.Cashier}`);
}

function endShift() {
    const activeShift = getActiveShift();
    if (!activeShift) return;

    if (getCart().length > 0) {
        if (!confirm('You have items in the cart. Are you sure you want to end the shift?')) {
            return;
        }
    }

    activeShift.endTime = new Date().toISOString();
    saveActiveShift(activeShift);

    // Save to shift history
    const shiftHistory = getShiftHistory();
    shiftHistory.push(activeShift);
    saveShiftHistory(shiftHistory);

    // Clear active shift
    localStorage.removeItem('bakeryPosActiveShift');

    checkActiveShift();
    updateShiftDisplay();
    
    // Show WhatsApp button
    document.getElementById('whatsapp-section').style.display = 'block';
    
    // Show notification
    alert(`Shift #${activeShift.id} ended at ${new Date(activeShift.endTime).toLocaleTimeString()}\nTotal Sales: ${activeShift.total} RWF`);
}

function updateShiftDisplay() {
    const shiftSummary = document.getElementById('shift-summary');
    const activeShift = getActiveShift();
    const shiftHistory = getShiftHistory();

    // Always show shift history section
    shiftSummary.innerHTML = '<h3><i class="fas fa-history"></i> Shift History</h3>';
    
    if (shiftHistory.length > 0) {
        // Add filter controls
        shiftSummary.innerHTML += `
            <div class="shift-filters">
                <input type="date" id="shift-start-date" placeholder="Start date">
                <input type="date" id="shift-end-date" placeholder="End date">
                <input type="text" id="shift-cashier-filter" placeholder="Filter by cashier">
                <button id="apply-shift-filters" class="btn-small">Filter</button>
                <button id="clear-shift-filters" class="btn-small">Clear</button>
            </div>
            <div class="shift-history-container">
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Cashier</th>
                            <th>Duration</th>
                            <th>Total</th>
                            <th>Transactions</th>
                            <th>Refunds</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="shift-history-body">
                        <!-- Will be populated by JavaScript -->
                    </tbody>
                </table>
                <div class="pagination-controls">
                    <button id="prev-shift-page" class="btn-small">Previous</button>
                    <span id="shift-page-info">Page 1 of X</span>
                    <button id="next-shift-page" class="btn-small">Next</button>
                </div>
            </div>
        `;
        
        // Load first page of shifts
        loadShiftHistoryPage(1);
        
        // Add event listeners
        document.getElementById('apply-shift-filters').addEventListener('click', () => {
            loadShiftHistoryPage(1);
        });
        
        document.getElementById('clear-shift-filters').addEventListener('click', () => {
            document.getElementById('shift-start-date').value = '';
            document.getElementById('shift-end-date').value = '';
            document.getElementById('shift-cashier-filter').value = '';
            loadShiftHistoryPage(1);
        });
        
        document.getElementById('prev-shift-page').addEventListener('click', () => {
            const currentPage = parseInt(document.getElementById('shift-page-info').textContent.match(/Page (\d+)/)[1]);
            if (currentPage > 1) {
                loadShiftHistoryPage(currentPage - 1);
            }
        });
        
        document.getElementById('next-shift-page').addEventListener('click', () => {
            const currentPage = parseInt(document.getElementById('shift-page-info').textContent.match(/Page (\d+)/)[1]);
            const totalPages = parseInt(document.getElementById('shift-page-info').textContent.match(/of (\d+)/)[1]);
            if (currentPage < totalPages) {
                loadShiftHistoryPage(currentPage + 1);
            }
        });
    } else {
        shiftSummary.innerHTML += '<p class="no-shift">No shift history found.</p>';
    }

    // Add current shift summary above history if shift is active
    if (activeShift) {
        const sales = getSales().filter(sale => activeShift.sales.includes(sale.id));
        const products = getProducts();
        
        // Calculate item breakdown
        const itemBreakdown = {};
        sales.forEach(sale => {
            sale.items.forEach(item => {
                if (!itemBreakdown[item.name]) {
                    itemBreakdown[item.name] = {
                        quantity: 0,
                        total: 0
                    };
                }
                itemBreakdown[item.name].quantity += item.quantity;
                itemBreakdown[item.name].total += item.quantity * item.price;
            });
        });

        // Calculate total expenses
        const expenses = getExpensesForShift(activeShift.id);
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

        // Format item breakdown table
        let itemsHtml = '';
        for (const [name, data] of Object.entries(itemBreakdown)) {
            const product = products.find(p => p.name === name);
            const remainingStock = product ? product.quantity : 'N/A';
            
            itemsHtml += `
                <tr>
                    <td>${name}</td>
                    <td>${data.quantity}</td>
                    <td>${remainingStock}</td>
                    <td>${data.total} RWF</td>
                </tr>
            `;
        }

        // Insert current shift summary at the top
        shiftSummary.insertAdjacentHTML('afterbegin', `
            <div class="current-shift-summary">
                <h3><i class="fas fa-clipboard-list"></i> Current Shift</h3>
                <p><i class="fas fa-id-badge"></i> Shift ID: ${activeShift.id}</p>
                <p><i class="fas fa-user"></i> Cashier: ${activeShift.Cashier || 'Cashier'}</p>
                <p><i class="fas fa-play"></i> Started: ${new Date(activeShift.startTime).toLocaleString()}</p>
                <p><i class="fas fa-coins"></i> Total Sales: ${activeShift.total} RWF</p>
                <p><i class="fas fa-money-bill-wave"></i> Cash: ${activeShift.cashTotal} RWF</p>
                <p><i class="fas fa-mobile-alt"></i> MoMo: ${activeShift.momoTotal} RWF</p>
                <p><i class="fas fa-exchange-alt"></i> Transactions: ${activeShift.sales.length}</p>
                <p><i class="fas fa-wallet"></i> Starting Cash: ${activeShift.startingCash || 0} RWF</p>
                <p><i class="fas fa-undo"></i> Refunds: ${activeShift.refunds ? activeShift.refunds.length : 0}</p>
                <p><i class="fas fa-receipt"></i> Expenses: ${totalExpenses} RWF</p>
                <p><i class="fas fa-calculator"></i> Net Cash: ${(activeShift.startingCash || 0) + activeShift.cashTotal - totalExpenses} RWF</p>
                
                <h4><i class="fas fa-box-open"></i> Item Breakdown</h4>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Quantity Sold</th>
                            <th>Stock Left</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
            </div>
        `);
    }
}

function viewShiftDetails(shiftId) {
    const shiftHistory = getShiftHistory();
    const shift = shiftHistory.find(s => s.id === parseInt(shiftId));
    
    if (!shift) return;
    
    const sales = getSales().filter(sale => shift.sales.includes(sale.id));
    const products = getProducts();
    const expenses = getExpensesForShift(shift.id);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Calculate item breakdown
    const itemBreakdown = {};
    sales.forEach(sale => {
        sale.items.forEach(item => {
            if (!itemBreakdown[item.name]) {
                itemBreakdown[item.name] = {
                    quantity: 0,
                    total: 0,
                    price: item.price
                };
            }
            itemBreakdown[item.name].quantity += item.quantity;
            itemBreakdown[item.name].total += item.quantity * item.price;
        });
    });

    // Format details
    let detailsHtml = `
        <h3><i class="fas fa-clipboard-list"></i> Shift Details #${shift.id}</h3>
        <p><i class="fas fa-user"></i> Cashier: ${shift.Cashier || 'Cashier'}</p>
        <p><i class="fas fa-play"></i> Started: ${new Date(shift.startTime).toLocaleString()}</p>
        <p><i class="fas fa-stop"></i> Ended: ${shift.endTime ? new Date(shift.endTime).toLocaleString() : 'Still active'}</p>
        <p><i class="fas fa-clock"></i> Duration: ${shift.endTime ? formatDuration(shift.startTime, shift.endTime) : 'Ongoing'}</p>
        <p><i class="fas fa-coins"></i> Total Sales: ${shift.total} RWF</p>
        <p><i class="fas fa-money-bill-wave"></i> Cash: ${shift.cashTotal} RWF</p>
        <p><i class="fas fa-mobile-alt"></i> MoMo: ${shift.momoTotal} RWF</p>
        <p><i class="fas fa-exchange-alt"></i> Transactions: ${shift.sales.length}</p>
        ${shift.startingCash ? `<p><i class="fas fa-wallet"></i> Starting Cash: ${shift.startingCash} RWF</p>` : ''}
        <p><i class="fas fa-undo"></i> Refunds: ${shift.refunds ? shift.refunds.length : 0}</p>
        <p><i class="fas fa-receipt"></i> Expenses: ${totalExpenses} RWF</p>
        <p><i class="fas fa-calculator"></i> Net Cash: ${(shift.startingCash || 0) + shift.cashTotal - totalExpenses} RWF</p>
        
        <h4><i class="fas fa-box-open"></i> Item Breakdown</h4>
        <table class="summary-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Quantity Sold</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(itemBreakdown).map(([name, data]) => `
                    <tr>
                        <td>${name}</td>
                        <td>${data.quantity}</td>
                        <td>${data.price} RWF</td>
                        <td>${data.total} RWF</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        ${expenses.length > 0 ? `
        <h4><i class="fas fa-receipt"></i> Expense Details</h4>
        <table class="summary-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Amount</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
                ${expenses.map(expense => `
                    <tr>
                        <td>${expense.name}</td>
                        <td>${expense.amount} RWF</td>
                        <td>${expense.notes || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}
        
        <div class="shift-detail-actions">
            <button id="whatsapp-shift-btn" class="btn">
                <i class="fab fa-whatsapp"></i> Send to WhatsApp
            </button>
            <button id="close-details-btn" class="btn">
                <i class="fas fa-arrow-left"></i> Back
            </button>
        </div>
    `;

    // Create a modal for details
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            ${detailsHtml}
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    // Add WhatsApp button functionality
    modal.querySelector('#whatsapp-shift-btn').addEventListener('click', () => {
        generateWhatsAppShiftSummary(shift, itemBreakdown, products, expenses);
    });
    
    // Add close handlers
    const closeModal = () => modal.remove();
    
    modal.querySelector('.close').addEventListener('click', closeModal);
    modal.querySelector('#close-details-btn').addEventListener('click', closeModal);
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
}

function sendWhatsAppSummary() {
    const lastShift = getShiftHistory()[getShiftHistory().length - 1];
    if (!lastShift) {
        alert('No shift history found!');
        return;
    }

    // Calculate duration
    const duration = formatDuration(lastShift.startTime, lastShift.endTime);
    
    // Get sales data
    const sales = getSales().filter(sale => lastShift.sales.includes(sale.id));
    const products = getProducts();
    
    // Calculate item breakdown with price and total
    const itemBreakdown = {};
    sales.forEach(sale => {
        sale.items.forEach(item => {
            if (!itemBreakdown[item.name]) {
                itemBreakdown[item.name] = {
                    quantity: 0,
                    price: item.price,
                    total: 0
                };
            }
            itemBreakdown[item.name].quantity += item.quantity;
            itemBreakdown[item.name].total += item.quantity * item.price;
        });
    });

    // Sort items by quantity sold
    const sortedItems = Object.entries(itemBreakdown)
        .sort((a, b) => b[1].quantity - a[1].quantity);

    // Get expenses
    const expenses = getExpensesForShift(lastShift.id);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Calculate cash to deposit
    const cashToDeposit = (lastShift.startingCash || 0) + lastShift.cashTotal - totalExpenses;

    // Format WhatsApp message
    let message = `*Shift Summary*\n\n`;
    
    // Header Info
    message += `*Date:* ${new Date(lastShift.startTime).toISOString().split('T')[0]}\n`;
    message += `*Cashier:* ${lastShift.Cashier || 'Cashier'}\n\n`;
    
    // Sales Overview
    message += `*Total Sales:* ${lastShift.total} RWF\n`;
    message += `- Cash: ${lastShift.cashTotal} RWF\n`;
    message += `- MoMo: ${lastShift.momoTotal} RWF\n`;
    message += `*Transactions:* ${lastShift.sales.length}\n\n`;
    
    // Expenses with notes - only show notes here, no additional notes section
    message += `*Expenses:* ${totalExpenses} RWF\n`;
    expenses.forEach(expense => {
        message += `- ${expense.name}: ${expense.amount} RWF`;
        if (expense.notes) {
            message += `\n  ${expense.notes}`;
        }
        message += `\n`;
    });
    message += `\n`;
    
    // Cash to deposit
    message += `*Cash to deposit (after expenses):* ${cashToDeposit} RWF\n\n`;

    // Footer
    message += `_Report generated on ${new Date().toLocaleString()}_`;

    // Handle offline case
    if (!navigator.onLine) {
        if (confirm('You are offline. Copy to clipboard instead?')) {
            navigator.clipboard.writeText(message)
                .then(() => alert('Report copied! Paste into WhatsApp when online.'))
                .catch(() => alert('Failed to copy.'));
        }
        return;
    }

    // Open WhatsApp
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
}
// Update the sendWhatsAppSummary function to include notes
function sendWhatsAppSummary() {
    const lastShift = getShiftHistory()[getShiftHistory().length - 1];
    if (!lastShift) {
        alert('No shift history found!');
        return;
    }

    // Calculate duration
    const duration = formatDuration(lastShift.startTime, lastShift.endTime);
    
    // Get sales data
    const sales = getSales().filter(sale => lastShift.sales.includes(sale.id));
    const products = getProducts();
    
    // Calculate item breakdown with price and total
    const itemBreakdown = {};
    sales.forEach(sale => {
        sale.items.forEach(item => {
            if (!itemBreakdown[item.name]) {
                itemBreakdown[item.name] = {
                    quantity: 0,
                    price: item.price,
                    total: 0
                };
            }
            itemBreakdown[item.name].quantity += item.quantity;
            itemBreakdown[item.name].total += item.quantity * item.price;
        });
    });

    // Sort items by quantity sold (top 5)
    const sortedItems = Object.entries(itemBreakdown)
        .sort((a, b) => b[1].quantity - a[1].quantity);

    // Get expenses
    const expenses = getExpensesForShift(lastShift.id);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Calculate cash to deposit
    const cashToDeposit = (lastShift.startingCash || 0) + lastShift.cashTotal - totalExpenses;

    // Format WhatsApp message
    let message = `*Shift Summary*\n\n`;
    
    // Header Info
    message += `*Date:* ${new Date(lastShift.startTime).toISOString().split('T')[0]}\n`;
    message += `*Cashier:* ${lastShift.Cashier || 'Cashier'}\n`;
    message += `*Start Time:* ${new Date(lastShift.startTime).toTimeString().split(' ')[0]}\n`;
    message += `*End Time:* ${new Date(lastShift.endTime).toTimeString().split(' ')[0]}\n`;
    message += `*Duration:* ${duration}\n\n`;
    
    // Sales Overview
    message += `*Starting Cash:* ${lastShift.startingCash || 0} RWF\n`;
    message += `- � Cash: ${lastShift.cashTotal} RWF\n`;
    message += `- � MoMo: ${lastShift.momoTotal} RWF\n`;
    message += `*Total Sales:* ${lastShift.total} RWF\n`;
    message += `*Transactions:* ${lastShift.sales.length}\n`;
    message += `*Refunds:* ${lastShift.refunds ? lastShift.refunds.length : 0}\n`;
    message += `*Expenses:* ${totalExpenses} RWF\n\n`;
    
    // Top 5 Sellers
    message += `� *Top 5 Sellers*\n`;
    sortedItems.slice(0, 5).forEach(([name, data], index) => {
        message += `${index + 1}. ${name} : ${data.quantity} sold\n`;
    });
    message += `\n`;
    
    // All Items Sold
    message += `� *All Items Sold*\n\n`;
    sortedItems.forEach(([name, data]) => {
        const product = products.find(p => p.name === name);
        message += `➤ ${name}\n`;
        message += `   - Sold: ${data.quantity}\n`;
        message += `   - Price: ${data.price} RWF\n`;
        message += `   - Total: ${data.total} RWF\n`;
        if (product && product.quantity !== 'unlimited') {
            message += `   - Stock Left: ${product.quantity}\n`;
        }
        message += `\n`;
    });

    // Expense Details
    if (expenses.length > 0) {
        message += `� *Expense Details*\n`;
        expenses.forEach(expense => {
            message += `- ${expense.name}: ${expense.amount} RWF\n`;
            if (expense.notes) {
                message += `  Note: ${expense.notes}\n`;
            }
        });
        message += `\n`;
    }

    // Include all notes (both from expenses and note-only entries)
   
    // Cash to deposit
    message += `� *Cash to deposit (after expenses):* ${cashToDeposit} RWF\n\n`;

    // Footer
    message += `_Report generated on ${new Date().toLocaleDateString()}, ${new Date().toLocaleTimeString()}_`;

    // Handle offline case
    if (!navigator.onLine) {
        if (confirm('You are offline. Copy to clipboard instead?')) {
            navigator.clipboard.writeText(message)
                .then(() => alert('Report copied! Paste into WhatsApp when online.'))
                .catch(() => alert('Failed to copy.'));
        }
        return;
    }

    // Open WhatsApp
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
}

// ======================
// EXPENSES TAB FUNCTIONS
// ======================

function initExpensesTab() {
    // Set up add expense button
    document.getElementById('add-expense-btn').addEventListener('click', addExpenseHandler);
    
    // Load expenses when tab is shown
    document.querySelector('.tab-btn[data-tab="expenses"]').addEventListener('click', loadExpenses);
}

function addExpenseHandler() {
    const activeShift = getActiveShift();
    if (!activeShift) {
        alert('Please start a shift before recording expenses!');
        return;
    }

    const name = document.getElementById('expense-name').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
    const notes = document.getElementById('expense-notes').value.trim();
    
    // Check if this is a note-only entry (only notes field has content)
    const isNoteOnly = notes && (!name && amount === 0);
    
    if (isNoteOnly) {
        // For note-only entries, we'll use a default name and 0 amount
        addExpense("Note", 0, notes, true);
    } else {
        // Regular expense - validate required fields
        if (!name) {
            alert('Please enter a name for the expense!');
            return;
        }
        if (amount <= 0) {
            alert('Amount must be greater than 0 for regular expenses!');
            return;
        }
        addExpense(name, amount, notes, false);
    }
    
    loadExpenses();
    
    // Clear inputs
    document.getElementById('expense-name').value = '';
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-notes').value = '';
}

function loadExpenses() {
    const expensesList = document.getElementById('expenses-list');
    expensesList.innerHTML = '';
    
    const activeShift = getActiveShift();
    let expenses = [];
    
    if (activeShift) {
        // Only show expenses for the current active shift
        expenses = getExpensesForShift(activeShift.id);
    } else {
        // If no active shift, show a message
        expensesList.innerHTML = '<p class="no-expenses">No active shift - expenses can only be recorded during an active shift.</p>';
        return;
    }
    
    // Sort by date (newest first)
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (expenses.length === 0) {
        expensesList.innerHTML = '<p class="no-expenses">No expenses recorded for this shift yet.</p>';
        return;
    }
    
    // Calculate totals for this shift only
    const totalExpenses = expenses
        .filter(expense => !expense.noteOnly)
        .reduce((sum, expense) => sum + expense.amount, 0);
    
    const totalNotes = expenses
        .filter(expense => expense.noteOnly)
        .length;
    
    // Add summary header
    expensesList.innerHTML = `
        <div class="expenses-summary">
            <div class="expenses-total">
                <span>Total Expenses for Shift #${activeShift.id}:</span>
                <span>${totalExpenses} RWF</span>
            </div>
            <div class="notes-total">
                <span>Notes:</span>
                <span>${totalNotes}</span>
            </div>
        </div>
    `;
    
    expenses.forEach(expense => {
        const expenseItem = document.createElement('div');
        expenseItem.className = `expense-item ${expense.noteOnly ? 'note-only' : ''}`;
        
        if (expense.noteOnly) {
            // Display note-only entries differently
            expenseItem.innerHTML = `
                <div class="expense-info">
                    <p class="expense-date">${formatDateTime(expense.date)}</p>
                    <p class="expense-notes">${expense.notes}</p>
                </div>
                <button class="delete-expense-btn" data-id="${expense.id}">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        } else {
            // Regular expense display
            expenseItem.innerHTML = `
                <div class="expense-info">
                    <h4>${expense.name || 'No description'}</h4>
                    <p class="expense-date">${formatDateTime(expense.date)}</p>
                    ${expense.notes ? `<p class="expense-notes">${expense.notes}</p>` : ''}
                </div>
                <div class="expense-amount-section">
                    <span class="expense-amount">-${expense.amount} RWF</span>
                    <button class="delete-expense-btn" data-id="${expense.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }
        
        expensesList.appendChild(expenseItem);
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-expense-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const expenseId = parseInt(e.currentTarget.getAttribute('data-id'));
            if (confirm('Are you sure you want to delete this entry?')) {
                deleteExpense(expenseId);
                loadExpenses();
            }
        });
    });
}

// ======================
// EXPENSE DATA FUNCTIONS
// ======================

function getExpenses() {
    const expenses = localStorage.getItem('bakeryPosExpenses');
    return expenses ? JSON.parse(expenses) : [];
}

function saveExpenses(expenses) {
    localStorage.setItem('bakeryPosExpenses', JSON.stringify(expenses));
}

function addExpense(name = "", amount = 0, notes = '', noteOnly = false) {
    const expenses = getExpenses();
    const activeShift = getActiveShift();
    
    if (!activeShift) {
        alert('Cannot add expense - no active shift!');
        return null;
    }
    
    const expense = {
        id: Date.now(),
        name: noteOnly ? "Note" : name,
        amount: noteOnly ? 0 : amount,
        notes: notes,
        date: new Date().toISOString(),
        shiftId: activeShift.id,
        noteOnly: noteOnly
    };
    
    expenses.push(expense);
    saveExpenses(expenses);
    
    // Only add to shift totals if it's a regular expense
    if (!noteOnly) {
        if (!activeShift.expenses) activeShift.expenses = [];
        activeShift.expenses.push(expense.id);
        saveActiveShift(activeShift);
    }
    
    return expense;
}

function deleteExpense(expenseId) {
    const expenses = getExpenses();
    const expenseToDelete = expenses.find(e => e.id === expenseId);
    const updatedExpenses = expenses.filter(expense => expense.id !== expenseId);
    
    saveExpenses(updatedExpenses);
    
    // Remove from active shift if it exists and is a regular expense
    if (expenseToDelete && !expenseToDelete.noteOnly) {
        const activeShift = getActiveShift();
        if (activeShift && activeShift.expenses) {
            const expenseIndex = activeShift.expenses.indexOf(expenseId);
            if (expenseIndex !== -1) {
                activeShift.expenses.splice(expenseIndex, 1);
                saveActiveShift(activeShift);
            }
        }
    }
}

function getExpensesForShift(shiftId) {
    const expenses = getExpenses();
    return expenses.filter(expense => expense.shiftId === shiftId);
}

// Update the shift end function to prevent modifying previous shift expenses
function endShift() {
    const activeShift = getActiveShift();
    if (!activeShift) return;

    if (getCart().length > 0) {
        if (!confirm('You have items in the cart. Are you sure you want to end the shift?')) {
            return;
        }
    }

    // Finalize the shift data
    activeShift.endTime = new Date().toISOString();
    
    // Save to shift history
    const shiftHistory = getShiftHistory();
    shiftHistory.push(activeShift);
    saveShiftHistory(shiftHistory);

    // Clear active shift
    localStorage.removeItem('bakeryPosActiveShift');

    checkActiveShift();
    updateShiftDisplay();
    
    // Show WhatsApp button
    document.getElementById('whatsapp-section').style.display = 'block';
    
    // Show notification
    alert(`Shift #${activeShift.id} ended at ${new Date(activeShift.endTime).toLocaleTimeString()}\nTotal Sales: ${activeShift.total} RWF`);
}
// ======================
// HELPER FUNCTIONS
// ======================

function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString([], {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Helper function to format duration
function formatDuration(start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate - startDate;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
}

function getActiveShift() {
    const activeShift = localStorage.getItem('bakeryPosActiveShift');
    return activeShift ? JSON.parse(activeShift) : null;
}

function saveActiveShift(shift) {
    localStorage.setItem('bakeryPosActiveShift', JSON.stringify(shift));
}

function getShiftHistory() {
    const history = localStorage.getItem('bakeryPosShiftHistory');
    return history ? JSON.parse(history) : [];
}

function saveShiftHistory(history) {
    // Add additional details to each shift record
    const enhancedHistory = history.map(shift => {
        return {
            ...shift,
            date: shift.startTime.split('T')[0],
            duration: formatDuration(shift.startTime, shift.endTime),
            operatorName: shift.Cashier || 'Cashier'
        };
    });
    localStorage.setItem('bakeryPosShiftHistory', JSON.stringify(enhancedHistory));
}

// Sales Data Functions
function getSales() {
    const sales = localStorage.getItem('bakeryPosSales');
    return sales ? JSON.parse(sales) : [];
}

function saveSales(sales) {
    localStorage.setItem('bakeryPosSales', JSON.stringify(sales));
}

// Initialize with sample data if empty
function initializeSampleData() {
    if (localStorage.getItem('bakeryPosInitialized')) return;

    const sampleProducts = [
        { id: 1, name: "Bread", price: 1000, quantity: 20 },
        { id: 2, name: "Croissant", price: 1500, quantity: 15 },
        { id: 3, name: "Cake", price: 5000, quantity: 5 },
        { id: 4, name: "Donut", price: 800, quantity: 30 },
        { id: 5, name: "Cookie", price: 300, quantity: 50 }
    ];

    saveProducts(sampleProducts);
    localStorage.setItem('bakeryPosInitialized', 'true');
}

function loadShiftHistoryPage(pageNumber) {
    const shiftsPerPage = 10;
    const shiftHistory = getShiftHistory();
    
    // Apply filters
    const startDateFilter = document.getElementById('shift-start-date').value;
    const endDateFilter = document.getElementById('shift-end-date').value;
    const cashierFilter = document.getElementById('shift-cashier-filter').value.toLowerCase();
    
    let filteredShifts = [...shiftHistory].reverse(); // Show newest first
    
    if (startDateFilter) {
        filteredShifts = filteredShifts.filter(shift => shift.date >= startDateFilter);
    }
    
    if (endDateFilter) {
        filteredShifts = filteredShifts.filter(shift => shift.date <= endDateFilter);
    }
    
    if (cashierFilter) {
        filteredShifts = filteredShifts.filter(shift => 
            shift.Cashier && shift.Cashier.toLowerCase().includes(cashierFilter)
        );
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredShifts.length / shiftsPerPage);
    const startIndex = (pageNumber - 1) * shiftsPerPage;
    const endIndex = Math.min(startIndex + shiftsPerPage, filteredShifts.length);
    const pageShifts = filteredShifts.slice(startIndex, endIndex);
    
    // Update table
    const tbody = document.getElementById('shift-history-body');
    tbody.innerHTML = '';
    
    pageShifts.forEach(shift => {
        const row = document.createElement('tr');
        row.className = 'shift-row';
        row.setAttribute('data-id', shift.id);
        row.innerHTML = `
            <td>${shift.date}</td>
            <td>${shift.Cashier || 'Cashier'}</td>
            <td>${shift.duration}</td>
            <td>${shift.total} RWF</td>
            <td>${shift.sales ? shift.sales.length : 0}</td>
            <td>${shift.refunds ? shift.refunds.length : 0}</td>
            <td><button class="btn-small view-shift-btn" data-id="${shift.id}">View</button></td>
        `;
        tbody.appendChild(row);
    });
    
    // Update pagination info
    document.getElementById('shift-page-info').textContent = `Page ${pageNumber} of ${totalPages}`;
    
    // Disable/enable pagination buttons
    document.getElementById('prev-shift-page').disabled = pageNumber <= 1;
    document.getElementById('next-shift-page').disabled = pageNumber >= totalPages;
    
    // Add click handler for view buttons
    document.querySelectorAll('.view-shift-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const shiftId = button.getAttribute('data-id');
            viewShiftDetails(shiftId);
        });
    });
}

// Call initialization
initializeSampleData();