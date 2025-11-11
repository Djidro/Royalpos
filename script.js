/* script.js - COMPLETE Bakery POS with Perfect PocketBase Integration */

// ==================== POCKETBASE CONFIGURATION ====================
let pb;
let POCKETBASE_URL = '';
let USE_POCKETBASE = false;

function configurePocketBase() {
    const isGitHubPages = window.location.hostname.includes('github.io');
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
        POCKETBASE_URL = 'http://127.0.0.1:8090';
        USE_POCKETBASE = true;
        console.log('Running locally - PocketBase enabled');
    } else if (isGitHubPages) {
        USE_POCKETBASE = false;
        console.log('Running on GitHub Pages - PocketBase disabled');
    }
    
    if (USE_POCKETBASE && typeof PocketBase !== 'undefined') {
        try {
            pb = new PocketBase(POCKETBASE_URL);
            console.log('PocketBase initialized successfully');
        } catch (error) {
            console.warn('PocketBase initialization failed:', error);
            USE_POCKETBASE = false;
        }
    }
}

// PocketBase Collection Names (Match your exact collections)
const PB_PRODUCTS = 'products';
const PB_SALES = 'Receipt';
const PB_EXPENSES = 'expenses';

// ==================== LOCAL STORAGE HELPERS ====================
const LS_PRODUCTS = 'bakeryPosProducts';
const LS_SALES = 'bakeryPosSales';
const LS_ACTIVE_SHIFT = 'bakeryPosActiveShift';
const LS_SHIFT_HISTORY = 'bakeryPosShiftHistory';
const LS_EXPENSES = 'bakeryPosExpenses';
const LS_CART = 'bakeryPosCart';

function safeParse(key) {
    try { 
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : []; 
    } catch (e) { 
        console.warn('Parse error for', key, e);
        return []; 
    }
}

function safeSave(key, value) {
    try { 
        localStorage.setItem(key, JSON.stringify(value)); 
    } catch (e) { 
        console.error('Save error', key, e); 
    }
}

// ==================== NETWORK STATUS ====================
function showNetworkStatus() {
    const existing = document.getElementById('network-status');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'network-status';
    el.style.cssText = 'position:fixed;bottom:10px;right:10px;padding:8px 15px;border-radius:20px;font-size:14px;z-index:10000;box-shadow:0 2px 6px rgba(0,0,0,0.15);color:white;font-weight:bold;';
    
    if (navigator.onLine) {
        if (USE_POCKETBASE) {
            el.textContent = '🟢 Online (PocketBase)';
            el.style.backgroundColor = '#22c55e';
        } else {
            el.textContent = '🔵 Online (Local Storage)';
            el.style.backgroundColor = '#3b82f6';
        }
    } else {
        el.textContent = '🔴 Offline (Local Storage)';
        el.style.backgroundColor = '#ef4444';
    }

    document.body.appendChild(el);

    if (navigator.onLine) {
        setTimeout(() => { 
            el.style.opacity = '0';
            setTimeout(() => {
                if (el.parentNode) el.remove();
            }, 400);
        }, 3000);
    }
}

// ==================== PRODUCTS MANAGEMENT ====================
function getProducts() {
    return safeParse(LS_PRODUCTS);
}

function saveProducts(products) {
    safeSave(LS_PRODUCTS, products);
}

function loadDemoData() {
    if (window.location.hostname.includes('github.io')) {
        const products = getProducts();
        if (products.length === 0) {
            const demoProducts = [
                { id: 'demo1', name: 'Croissant', price: 5, quantity: 20 },
                { id: 'demo2', name: 'Baguette', price: 3, quantity: 15 },
                { id: 'demo3', name: 'Chocolate Cake', price: 12, quantity: 8 },
                { id: 'demo4', name: 'Coffee', price: 2, quantity: 'unlimited' },
                { id: 'demo5', name: 'Sandwich', price: 8, quantity: 10 }
            ];
            saveProducts(demoProducts);
            console.log('Demo products loaded for GitHub Pages');
        }
    }
}

async function syncProductsFromPocketbase() {
    if (!navigator.onLine || !USE_POCKETBASE || !pb) {
        return getProducts();
    }
    
    try {
        const records = await pb.collection(PB_PRODUCTS).getFullList({ 
            sort: '-created' 
        });
        
        const normalized = records.map(r => ({
            id: r.id,
            name: r.name || '',
            price: parseFloat(r.price) || 0,
            quantity: (r.quantity === 'unlimited' || r.quantity === 'Unlimited') ? 'unlimited' : (parseInt(r.quantity) || 0)
        }));
        
        saveProducts(normalized);
        return normalized;
    } catch (err) {
        console.warn('PocketBase products fetch failed:', err);
        return getProducts();
    }
}

async function loadProducts() {
    const container = document.getElementById('products-grid');
    if (!container) return;

    let products = [];
    try {
        products = await syncProductsFromPocketbase();
    } catch (e) {
        products = getProducts();
    }

    container.innerHTML = '';
    
    if (products.length === 0) {
        container.innerHTML = '<p class="no-products">No products available. Add some in the Stock tab.</p>';
        return;
    }

    products.forEach(p => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        const stockDisplay = p.quantity === 'unlimited' ? 'Unlimited' : p.quantity;
        const lowStockClass = (p.quantity !== 'unlimited' && p.quantity < 5) ? 'low-stock' : '';
        
        productCard.innerHTML = `
            <h4>${escapeHtml(p.name)}</h4>
            <p class="price">${p.price} RWF</p>
            <p class="stock ${lowStockClass}">Stock: ${stockDisplay}${lowStockClass ? ' (Low)' : ''}</p>
        `;
        
        productCard.addEventListener('click', () => addToCart(p));
        container.appendChild(productCard);
    });
}

// ==================== CART MANAGEMENT ====================
function getCart() { 
    return safeParse(LS_CART); 
}

function saveCart(cart) { 
    safeSave(LS_CART, cart); 
}

function addToCart(product) {
    if (!product) {
        alert('Product not found!');
        return;
    }

    const products = getProducts();
    const prod = products.find(p => p.id === product.id);
    
    if (prod && prod.quantity !== 'unlimited' && prod.quantity <= 0) {
        alert('This product is out of stock!');
        return;
    }

    let cart = getCart();
    let item = cart.find(i => i.id === product.id);
    
    if (item) {
        if (prod && prod.quantity !== 'unlimited' && item.quantity >= prod.quantity) {
            alert('Not enough stock available!');
            return;
        }
        item.quantity += 1;
    } else {
        cart.push({ 
            id: product.id, 
            name: product.name, 
            price: product.price, 
            quantity: 1 
        });
    }
    
    saveCart(cart);
    updateCartDisplay();
}

function updateCartItemQty(id, diff) {
    let cart = getCart();
    const item = cart.find(i => i.id === id);
    if (!item) return;
    
    item.quantity += diff;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== id);
    }
    
    saveCart(cart);
    updateCartDisplay();
}

function removeFromCart(id) {
    const cart = getCart().filter(i => i.id !== id);
    saveCart(cart);
    updateCartDisplay();
}

function updateCartDisplay() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    
    if (!container || !totalEl) return;

    const cart = getCart();
    container.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        container.innerHTML = '<p class="empty-cart">Cart is empty</p>';
        if (checkoutBtn) checkoutBtn.disabled = true;
        totalEl.textContent = '0 RWF';
        return;
    }

    cart.forEach(item => {
        const itemTotal = (item.price || 0) * (item.quantity || 0);
        total += itemTotal;
        
        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML = `
            <span class="cart-item-name">${escapeHtml(item.name)}</span>
            <div class="cart-item-quantity">
                <button class="quantity-btn decrease" data-id="${item.id}">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn increase" data-id="${item.id}">+</button>
            </div>
            <span class="cart-item-total">${itemTotal} RWF</span>
            <button class="remove-btn" data-id="${item.id}">×</button>
        `;
        container.appendChild(row);
    });

    totalEl.textContent = `${total.toFixed(2)} RWF`;
    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0 || !getActiveShift();

    setTimeout(() => {
        document.querySelectorAll('.decrease').forEach(btn => {
            btn.onclick = () => updateCartItemQty(btn.getAttribute('data-id'), -1);
        });
        document.querySelectorAll('.increase').forEach(btn => {
            btn.onclick = () => updateCartItemQty(btn.getAttribute('data-id'), 1);
        });
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.onclick = () => removeFromCart(btn.getAttribute('data-id'));
        });
    }, 50);
}

// ==================== POCKETBASE SALES SYNC ====================
async function syncSalesToPocketbase(sale) {
    if (!navigator.onLine || !USE_POCKETBASE || !pb) {
        console.log('PocketBase save skipped - using local storage');
        return;
    }
    
    try {
        const receiptData = {
            items: sale.items,
            total: sale.total,
            payment_method: sale.paymentMethod,
            time: sale.date,
            shift_id: sale.shiftId
        };
        
        await pb.collection(PB_SALES).create(receiptData);
        console.log('✅ Receipt saved to PocketBase');
    } catch (error) {
        console.error('❌ Failed to save receipt to PocketBase:', error);
        if (error.data && error.data.data) {
            console.error('Field errors:', error.data.data);
        }
    }
}

async function syncReceiptsFromPocketbase() {
    if (!navigator.onLine || !USE_POCKETBASE || !pb) {
        return [];
    }
    
    try {
        const records = await pb.collection(PB_SALES).getFullList({ 
            sort: '-created' 
        });
        
        const pbSales = records.map(r => ({
            id: r.id,
            date: r.time || r.created,
            items: r.items || [],
            total: r.total || 0,
            paymentMethod: r.payment_method || 'unknown',
            shiftId: r.shift_id || null
        }));
        
        return pbSales;
    } catch (err) {
        console.warn('PocketBase receipts fetch failed:', err);
        return [];
    }
}

// ==================== CHECKOUT PROCESS ====================
async function checkout() {
    const activeShift = getActiveShift();
    if (!activeShift) {
        alert('Please start a shift before making sales!');
        return;
    }

    const cart = getCart();
    if (!cart || cart.length === 0) {
        alert('Cart is empty!');
        return;
    }

    const paymentElem = document.querySelector('input[name="payment"]:checked');
    if (!paymentElem) {
        alert('Please select a payment method!');
        return;
    }
    
    const paymentMethod = paymentElem.value;

    const products = getProducts();
    for (const item of cart) {
        const p = products.find(pp => pp.id === item.id);
        if (p && p.quantity !== 'unlimited' && p.quantity < item.quantity) {
            alert(`Not enough stock for ${p.name}`);
            return;
        }
    }

    const sale = {
        id: 'sale_' + Date.now(),
        date: new Date().toISOString(),
        items: cart.map(i => ({ 
            productId: i.id, 
            name: i.name, 
            price: i.price, 
            quantity: i.quantity 
        })),
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        paymentMethod: paymentMethod,
        shiftId: activeShift.id
    };

    try {
        if (navigator.onLine && USE_POCKETBASE && pb) {
            console.log('🔄 Syncing with PocketBase...');
            
            for (const item of sale.items) {
                try {
                    const pbProduct = await pb.collection(PB_PRODUCTS).getOne(item.productId);
                    if (pbProduct.quantity !== 'unlimited') {
                        const newQty = parseInt(pbProduct.quantity) - item.quantity;
                        if (newQty < 0) throw new Error(`Not enough stock for ${pbProduct.name}`);
                        await pb.collection(PB_PRODUCTS).update(pbProduct.id, { 
                            quantity: newQty 
                        });
                        console.log(`✅ Updated stock for ${pbProduct.name}`);
                    }
                } catch (error) {
                    console.warn('Failed to update product stock in PocketBase:', error);
                }
            }

            await syncSalesToPocketbase(sale);
        }
    } catch (error) {
        console.warn('PocketBase checkout sync failed:', error);
    }

    const localProducts = getProducts();
    sale.items.forEach(item => {
        const product = localProducts.find(p => p.id === item.productId);
        if (product && product.quantity !== 'unlimited') {
            product.quantity -= item.quantity;
            if (product.quantity < 0) product.quantity = 0;
        }
    });
    saveProducts(localProducts);

    const sales = getSales();
    sales.push(sale);
    saveSales(sales);

    let shift = getActiveShift();
    if (!shift.sales) shift.sales = [];
    shift.sales.push(sale.id);
    shift.total = (shift.total || 0) + sale.total;
    
    if (sale.paymentMethod === 'cash') {
        shift.cashTotal = (shift.cashTotal || 0) + sale.total;
    } else {
        shift.momoTotal = (shift.momoTotal || 0) + sale.total;
    }
    
    saveActiveShift(shift);

    saveCart([]);
    updateCartDisplay();
    loadProducts();
    checkLowStock();
    loadReceipts();
    updateShiftDisplay();
    showReceipt(sale);
    
    alert('✅ Sale completed successfully!');
}

// ==================== SALES / RECEIPTS MANAGEMENT ====================
function getSales() { 
    return safeParse(LS_SALES); 
}

function saveSales(sales) { 
    safeSave(LS_SALES, sales); 
}

function loadReceipts() {
    const receiptsList = document.getElementById('receipts-list');
    if (!receiptsList) return;

    const dateFilterInput = document.getElementById('receipt-date-filter');
    const filterDate = dateFilterInput ? dateFilterInput.value : '';
    
    let sales = getSales();

    if (navigator.onLine && USE_POCKETBASE && pb) {
        syncReceiptsFromPocketbase()
            .then(pbSales => {
                const localSales = getSales();
                const mergedSales = [...localSales];
                
                pbSales.forEach(pbSale => {
                    if (!mergedSales.some(ls => ls.id === pbSale.id)) {
                        mergedSales.push(pbSale);
                    }
                });
                
                saveSales(mergedSales);
                renderReceiptsList(mergedSales, filterDate);
            })
            .catch(err => {
                console.warn('Failed to sync receipts from PocketBase', err);
                renderReceiptsList(sales, filterDate);
            });
    } else {
        renderReceiptsList(sales, filterDate);
    }
}

function renderReceiptsList(sales, filterDate) {
    const receiptsList = document.getElementById('receipts-list');
    if (!receiptsList) return;
    
    receiptsList.innerHTML = '';

    const filtered = filterDate ? 
        sales.filter(s => s.date && s.date.split('T')[0] === filterDate) : 
        sales;

    if (filtered.length === 0) {
        receiptsList.innerHTML = '<p class="no-receipts">No receipts found</p>';
        return;
    }

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    filtered.forEach(sale => {
        const receiptItem = document.createElement('div');
        receiptItem.className = 'receipt-item';
        const itemsCount = sale.items ? sale.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
        
        receiptItem.innerHTML = `
            <div class="receipt-header">
                <span class="receipt-id">Receipt #${sale.id ? sale.id.slice(-6) : 'N/A'}</span>
                <span class="receipt-date">${sale.date ? new Date(sale.date).toLocaleDateString() : 'Unknown date'}</span>
            </div>
            <div class="receipt-details">
                <span class="receipt-total">${sale.total || 0} RWF</span>
                <span class="receipt-payment">${(sale.paymentMethod || 'unknown').toUpperCase()}</span>
                <span class="receipt-items">${itemsCount} items</span>
            </div>
        `;
        
        receiptItem.addEventListener('click', () => showReceipt(sale));
        receiptsList.appendChild(receiptItem);
    });
}

function showReceipt(sale) {
    const modal = document.getElementById('receipt-modal');
    const content = document.getElementById('receipt-content');
    
    if (!modal || !content) return;

    let itemsHtml = '';
    if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
            itemsHtml += `
                <tr>
                    <td>${escapeHtml(item.name || 'Unknown')}</td>
                    <td>${item.quantity || 0}</td>
                    <td>${item.price || 0} RWF</td>
                    <td>${(item.price || 0) * (item.quantity || 0)} RWF</td>
                </tr>
            `;
        });
    } else {
        itemsHtml = '<tr><td colspan="4">No items</td></tr>';
    }

    content.innerHTML = `
        <h2>Receipt #${sale.id ? sale.id.slice(-6) : 'N/A'}</h2>
        <p>${sale.date ? new Date(sale.date).toLocaleString() : 'Unknown date'}</p>
        <table class="receipt-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
                <tr>
                    <td colspan="3" style="text-align:right"><strong>Grand Total</strong></td>
                    <td><strong>${sale.total || 0} RWF</strong></td>
                </tr>
            </tfoot>
        </table>
        <div class="receipt-actions">
            <p><strong>Payment Method:</strong> ${(sale.paymentMethod || 'unknown').toUpperCase()}</p>
            <button id="copy-receipt-btn" class="btn">Copy Receipt</button>
        </div>
    `;

    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.onclick = () => modal.style.display = 'none';
    }

    const copyBtn = document.getElementById('copy-receipt-btn');
    if (copyBtn) {
        copyBtn.onclick = () => {
            const receiptText = `Receipt #${sale.id ? sale.id.slice(-6) : 'N/A'}\nDate: ${sale.date ? new Date(sale.date).toLocaleString() : 'Unknown date'}\n\n` +
                (sale.items ? sale.items.map(item => 
                    `${item.name || 'Unknown'} - ${item.quantity || 0} × ${item.price || 0} RWF = ${(item.price || 0) * (item.quantity || 0)} RWF`
                ).join('\n') : 'No items') +
                `\n\nTotal: ${sale.total || 0} RWF\nPayment: ${(sale.paymentMethod || 'unknown').toUpperCase()}`;
            
            navigator.clipboard.writeText(receiptText)
                .then(() => alert('Receipt copied to clipboard'))
                .catch(() => alert('Failed to copy receipt'));
        };
    }

    modal.style.display = 'block';
}

// ==================== SUMMARY TAB ====================
function loadSummary() {
    const container = document.getElementById('summary-content');
    if (!container) return;
    
    container.innerHTML = '';

    const startDateElem = document.getElementById('start-date');
    const endDateElem = document.getElementById('end-date');
    const startDate = startDateElem ? startDateElem.value : '';
    const endDate = endDateElem ? endDateElem.value : '';
    
    const sales = getSales();
    const filtered = sales.filter(s => {
        if (!s.date) return false;
        const saleDate = s.date.split('T')[0];
        return (!startDate || saleDate >= startDate) && (!endDate || saleDate <= endDate);
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="no-summary">No sales found for the selected period</p>';
        return;
    }

    const cashTotal = filtered
        .filter(s => s.paymentMethod === 'cash')
        .reduce((sum, sale) => sum + (sale.total || 0), 0);
        
    const momoTotal = filtered
        .filter(s => s.paymentMethod === 'momo')
        .reduce((sum, sale) => sum + (sale.total || 0), 0);
        
    const grandTotal = cashTotal + momoTotal;
    const transactionCount = filtered.length;

    const itemBreakdown = {};
    filtered.forEach(sale => {
        if (sale.items) {
            sale.items.forEach(item => {
                if (!itemBreakdown[item.name]) {
                    itemBreakdown[item.name] = {
                        quantity: 0,
                        price: item.price || 0,
                        total: 0
                    };
                }
                itemBreakdown[item.name].quantity += item.quantity || 0;
                itemBreakdown[item.name].total += (item.price || 0) * (item.quantity || 0);
            });
        }
    });

    let itemsHtml = '';
    Object.entries(itemBreakdown).forEach(([name, data]) => {
        itemsHtml += `
            <tr>
                <td>${escapeHtml(name)}</td>
                <td>${data.quantity}</td>
                <td>${data.price} RWF</td>
                <td>${data.total} RWF</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div class="summary-card">
            <h3>Sales Summary</h3>
            <div class="summary-row">
                <span>Date Range:</span>
                <span>${startDate || 'Start'} to ${endDate || 'End'}</span>
            </div>
            <div class="summary-row">
                <span>Total Transactions:</span>
                <span>${transactionCount}</span>
            </div>
            <div class="summary-row">
                <span>Cash Sales:</span>
                <span>${cashTotal.toFixed(2)} RWF</span>
            </div>
            <div class="summary-row">
                <span>MoMo Sales:</span>
                <span>${momoTotal.toFixed(2)} RWF</span>
            </div>
            <div class="summary-row">
                <span><strong>Grand Total:</strong></span>
                <span><strong>${grandTotal.toFixed(2)} RWF</strong></span>
            </div>
        </div>

        <div class="summary-card">
            <h3>Item Breakdown</h3>
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Quantity Sold</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>
        </div>
    `;
}

// ==================== STOCK MANAGEMENT ====================
function loadStockItems() {
    const container = document.getElementById('stock-items');
    if (!container) return;
    
    const products = getProducts();
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = '<p>No items in stock</p>';
        return;
    }

    products.forEach(product => {
        const stockItem = document.createElement('div');
        stockItem.className = 'stock-item';
        const stockDisplay = product.quantity === 'unlimited' ? 'Unlimited' : product.quantity;
        const lowStockClass = (product.quantity !== 'unlimited' && product.quantity < 5) ? 'low-stock' : '';
        
        stockItem.innerHTML = `
            <div class="stock-item-info">
                <div class="stock-item-name">${escapeHtml(product.name)}</div>
                <div class="stock-item-details">
                    <span>Price: ${product.price} RWF</span>
                    <span class="${lowStockClass}">Stock: ${stockDisplay}</span>
                </div>
            </div>
            <div class="stock-item-actions">
                <button class="edit-btn" data-id="${product.id}">Edit</button>
                <button class="delete-btn" data-id="${product.id}">Delete</button>
            </div>
        `;
        
        container.appendChild(stockItem);
    });

    setTimeout(() => {
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => editStockItem(e.currentTarget.getAttribute('data-id')));
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => deleteStockItem(e.currentTarget.getAttribute('data-id')));
        });
    }, 50);
}

async function addStockItem() {
    const nameInput = document.getElementById('item-name');
    const priceInput = document.getElementById('item-price');
    const quantityInput = document.getElementById('item-quantity');
    
    if (!nameInput || !priceInput || !quantityInput) return;

    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value);
    let quantity = quantityInput.value.trim();

    if (!name) {
        alert('Please enter a product name');
        return;
    }
    
    if (isNaN(price) || price < 0) {
        alert('Please enter a valid price');
        return;
    }

    if (quantity.toLowerCase() === 'unlimited') {
        quantity = 'unlimited';
    } else {
        quantity = parseInt(quantity);
        if (isNaN(quantity) || quantity < 0) {
            alert('Quantity must be a positive number or "unlimited"');
            return;
        }
    }

    const products = getProducts();
    const existingIndex = products.findIndex(p => p.name.toLowerCase() === name.toLowerCase());

    if (existingIndex !== -1) {
        if (!confirm('Product already exists. Update it?')) return;
        
        products[existingIndex].price = price;
        products[existingIndex].quantity = quantity;
        
        if (navigator.onLine && USE_POCKETBASE && pb) {
            try {
                await pb.collection(PB_PRODUCTS).update(products[existingIndex].id, {
                    name: products[existingIndex].name,
                    price: products[existingIndex].price,
                    quantity: products[existingIndex].quantity
                });
                console.log('✅ Product updated in PocketBase');
            } catch (error) {
                console.error('❌ Failed to update product in PocketBase:', error);
            }
        }
    } else {
        const newProduct = {
            id: 'prod_' + Date.now(),
            name: name,
            price: price,
            quantity: quantity
        };
        products.push(newProduct);

        if (navigator.onLine && USE_POCKETBASE && pb) {
            try {
                const result = await pb.collection(PB_PRODUCTS).create({
                    name: newProduct.name,
                    price: newProduct.price,
                    quantity: newProduct.quantity
                });
                newProduct.id = result.id;
                console.log('✅ Product created in PocketBase');
            } catch (error) {
                console.error('❌ Failed to create product in PocketBase:', error);
            }
        }
    }

    saveProducts(products);
    loadStockItems();
    loadProducts();
    checkLowStock();

    nameInput.value = '';
    priceInput.value = '';
    quantityInput.value = '';
}

async function editStockItem(productId) {
    const products = getProducts();
    const product = products.find(p => p.id === productId);
    
    if (!product) {
        alert('Product not found');
        return;
    }

    const newName = prompt('Enter new name:', product.name);
    if (newName === null) return;

    const newPrice = parseFloat(prompt('Enter new price:', product.price));
    if (isNaN(newPrice)) {
        alert('Invalid price');
        return;
    }

    let newQuantity = prompt('Enter new quantity (number or "unlimited"):', 
        product.quantity === 'unlimited' ? 'unlimited' : product.quantity);
    
    if (newQuantity === null) return;

    if (newQuantity.toLowerCase() === 'unlimited') {
        newQuantity = 'unlimited';
    } else {
        newQuantity = parseInt(newQuantity);
        if (isNaN(newQuantity) || newQuantity < 0) {
            alert('Invalid quantity');
            return;
        }
    }

    product.name = newName;
    product.price = newPrice;
    product.quantity = newQuantity;

    if (navigator.onLine && USE_POCKETBASE && pb) {
        try {
            await pb.collection(PB_PRODUCTS).update(productId, {
                name: newName,
                price: newPrice,
                quantity: newQuantity
            });
            console.log('✅ Product updated in PocketBase');
        } catch (error) {
            console.error('❌ Failed to update product in PocketBase:', error);
        }
    }

    saveProducts(products);
    loadStockItems();
    loadProducts();
    checkLowStock();
}

async function deleteStockItem(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const products = getProducts().filter(p => p.id !== productId);
    saveProducts(products);

    if (navigator.onLine && USE_POCKETBASE && pb) {
        try {
            await pb.collection(PB_PRODUCTS).delete(productId);
            console.log('✅ Product deleted from PocketBase');
        } catch (error) {
            console.error('❌ Failed to delete product from PocketBase:', error);
        }
    }

    loadStockItems();
    loadProducts();
    checkLowStock();
}

// ==================== SHIFT MANAGEMENT ====================
function getActiveShift() {
    const shifts = safeParse(LS_ACTIVE_SHIFT);
    return shifts.length > 0 ? shifts[0] : null;
}

function saveActiveShift(shift) {
    safeSave(LS_ACTIVE_SHIFT, shift ? [shift] : []);
}

function getShiftHistory() {
    return safeParse(LS_SHIFT_HISTORY);
}

function saveShiftHistory(history) {
    safeSave(LS_SHIFT_HISTORY, history);
}

function startShift() {
    const cashier = prompt('Enter cashier name:', 'Cashier') || 'Cashier';
    const startingCash = parseFloat(prompt('Enter starting cash amount:', '0')) || 0;

    const shift = {
        id: 'shift_' + Date.now(),
        startTime: new Date().toISOString(),
        endTime: null,
        cashier: cashier,
        startingCash: startingCash,
        sales: [],
        refunds: [],
        expenses: [],
        cashTotal: 0,
        momoTotal: 0,
        total: 0
    };

    saveActiveShift(shift);
    updateShiftDisplay();
    alert(`Shift #${shift.id.slice(-6)} started`);
}

function endShift() {
    const activeShift = getActiveShift();
    if (!activeShift) {
        alert('No active shift to end');
        return;
    }

    if (getCart().length > 0 && !confirm('There are items in the cart. End shift anyway?')) {
        return;
    }

    activeShift.endTime = new Date().toISOString();

    const history = getShiftHistory();
    history.push(activeShift);
    saveShiftHistory(history);

    saveActiveShift(null);
    updateShiftDisplay();

    const summary = `
        Shift #${activeShift.id.slice(-6)} ended
        Cashier: ${activeShift.cashier}
        Duration: ${formatDuration(activeShift.startTime, activeShift.endTime)}
        Total Sales: ${activeShift.total} RWF
        Cash Sales: ${activeShift.cashTotal} RWF
        MoMo Sales: ${activeShift.momoTotal} RWF
        Starting Cash: ${activeShift.startingCash} RWF
    `;
    
    alert(summary);
}

function updateShiftDisplay() {
    const shiftStatus = document.getElementById('shift-status');
    const startBtn = document.getElementById('start-shift-btn');
    const endBtn = document.getElementById('end-shift-btn');
    const shiftSummary = document.getElementById('shift-summary');
    const checkoutBtn = document.getElementById('checkout-btn');

    const activeShift = getActiveShift();

    if (shiftStatus) {
        if (activeShift) {
            shiftStatus.className = 'shift-status shift-on';
            shiftStatus.textContent = `Shift: ON (${activeShift.cashier})`;
        } else {
            shiftStatus.className = 'shift-status shift-off';
            shiftStatus.textContent = 'Shift: OFF';
        }
    }

    if (startBtn) startBtn.disabled = !!activeShift;
    if (endBtn) endBtn.disabled = !activeShift;
    if (checkoutBtn) checkoutBtn.disabled = !activeShift || getCart().length === 0;

    if (shiftSummary) {
        if (activeShift) {
            shiftSummary.innerHTML = `
                <h3>Current Shift</h3>
                <div class="shift-info">
                    <p><strong>Cashier:</strong> ${activeShift.cashier}</p>
                    <p><strong>Started:</strong> ${new Date(activeShift.startTime).toLocaleString()}</p>
                    <p><strong>Total Sales:</strong> ${activeShift.total} RWF</p>
                    <p><strong>Cash Sales:</strong> ${activeShift.cashTotal} RWF</p>
                    <p><strong>MoMo Sales:</strong> ${activeShift.momoTotal} RWF</p>
                </div>
            `;
        } else {
            const history = getShiftHistory();
            if (history.length > 0) {
                const lastShift = history[history.length - 1];
                shiftSummary.innerHTML = `
                    <h3>Last Shift</h3>
                    <div class="shift-info">
                        <p><strong>Cashier:</strong> ${lastShift.cashier}</p>
                        <p><strong>Duration:</strong> ${formatDuration(lastShift.startTime, lastShift.endTime)}</p>
                        <p><strong>Total Sales:</strong> ${lastShift.total} RWF</p>
                    </div>
                `;
            } else {
                shiftSummary.innerHTML = '<p>No shift history</p>';
            }
        }
    }
}

function formatDuration(start, end) {
    if (!start || !end) return 'Unknown';
    
    const startTime = new Date(start);
    const endTime = new Date(end);
    const duration = endTime - startTime;
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
}

// ==================== EXPENSES MANAGEMENT ====================
function getExpenses() {
    return safeParse(LS_EXPENSES);
}

function saveExpenses(expenses) {
    safeSave(LS_EXPENSES, expenses);
}

function addExpense() {
    const activeShift = getActiveShift();
    if (!activeShift) {
        alert('Please start a shift before adding expenses');
        return;
    }

    const nameInput = document.getElementById('expense-name');
    const amountInput = document.getElementById('expense-amount');
    const notesInput = document.getElementById('expense-notes');

    if (!nameInput || !amountInput || !notesInput) return;

    const name = nameInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const notes = notesInput.value.trim();

    const isNoteOnly = !name && amount === 0 && notes;

    if (isNoteOnly) {
        const expense = {
            id: 'exp_' + Date.now(),
            name: 'Note',
            amount: 0,
            notes: notes,
            date: new Date().toISOString(),
            shiftId: activeShift.id,
            noteOnly: true
        };

        const expenses = getExpenses();
        expenses.push(expense);
        saveExpenses(expenses);
    } else {
        if (!name) {
            alert('Please enter an expense name');
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        const expense = {
            id: 'exp_' + Date.now(),
            name: name,
            amount: amount,
            notes: notes,
            date: new Date().toISOString(),
            shiftId: activeShift.id,
            noteOnly: false
        };

        const expenses = getExpenses();
        expenses.push(expense);
        saveExpenses(expenses);

        if (!activeShift.expenses) activeShift.expenses = [];
        activeShift.expenses.push(expense.id);
        saveActiveShift(activeShift);
    }

    nameInput.value = '';
    amountInput.value = '';
    notesInput.value = '';
    loadExpenses();
}

function loadExpenses() {
    const container = document.getElementById('expenses-list');
    if (!container) return;

    const activeShift = getActiveShift();
    if (!activeShift) {
        container.innerHTML = '<p>Start a shift to record expenses</p>';
        return;
    }

    const expenses = getExpenses()
        .filter(exp => exp.shiftId === activeShift.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (expenses.length === 0) {
        container.innerHTML = '<p>No expenses recorded for this shift</p>';
        return;
    }

    container.innerHTML = expenses.map(exp => `
        <div class="expense-item ${exp.noteOnly ? 'note-only' : ''}">
            <div class="expense-header">
                <span class="expense-name">${escapeHtml(exp.name)}</span>
                ${!exp.noteOnly ? `<span class="expense-amount">${exp.amount} RWF</span>` : ''}
            </div>
            ${exp.notes ? `<div class="expense-notes">${escapeHtml(exp.notes)}</div>` : ''}
            <div class="expense-date">${new Date(exp.date).toLocaleString()}</div>
            <button class="delete-expense" data-id="${exp.id}">Delete</button>
        </div>
    `).join('');

    setTimeout(() => {
        document.querySelectorAll('.delete-expense').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const expenseId = e.currentTarget.getAttribute('data-id');
                if (confirm('Delete this expense/note?')) {
                    deleteExpense(expenseId);
                }
            });
        });
    }, 50);
}

function deleteExpense(expenseId) {
    const expenses = getExpenses().filter(exp => exp.id !== expenseId);
    saveExpenses(expenses);

    const activeShift = getActiveShift();
    if (activeShift && activeShift.expenses) {
        activeShift.expenses = activeShift.expenses.filter(id => id !== expenseId);
        saveActiveShift(activeShift);
    }

    loadExpenses();
}

// ==================== UTILITY FUNCTIONS ====================
function checkLowStock() {
    const products = getProducts();
    const lowStockItems = products.filter(p => 
        p.quantity !== 'unlimited' && p.quantity < 5
    );

    if (lowStockItems.length > 0) {
        console.warn('Low stock items:', lowStockItems);
    }
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== TAB MANAGEMENT ====================
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            switch(tabId) {
                case 'stock-tab':
                    loadStockItems();
                    break;
                case 'receipts-tab':
                    loadReceipts();
                    break;
                case 'summary-tab':
                    break;
                case 'shift-tab':
                    updateShiftDisplay();
                    break;
                case 'expenses-tab':
                    loadExpenses();
                    break;
            }
        });
    });
}

function setupEventListeners() {
    document.getElementById('checkout-btn').addEventListener('click', checkout);
    document.getElementById('add-item-btn').addEventListener('click', addStockItem);
    document.getElementById('load-receipts-btn').addEventListener('click', loadReceipts);
    document.getElementById('load-summary-btn').addEventListener('click', loadSummary);
    document.getElementById('start-shift-btn').addEventListener('click', startShift);
    document.getElementById('end-shift-btn').addEventListener('click', endShift);
    document.getElementById('add-expense-btn').addEventListener('click', addExpense);

    const modal = document.getElementById('receipt-modal');
    const closeBtn = document.querySelector('.close');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function loadInitialData() {
    const today = new Date().toISOString().split('T')[0];
    ['receipt-date-filter', 'start-date', 'end-date'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = today;
    });

    loadProducts();
    updateCartDisplay();
    loadReceipts();
    loadStockItems();
    updateShiftDisplay();
    loadExpenses();
    showNetworkStatus();

    window.addEventListener('online', showNetworkStatus);
    window.addEventListener('offline', showNetworkStatus);
}

// ==================== APPLICATION INITIALIZATION ====================
function initializeApp() {
    console.log('🚀 Initializing Bakery POS System...');
    
    configurePocketBase();
    loadDemoData();
    setupTabs();
    setupEventListeners();
    loadInitialData();

    console.log('✅ Bakery POS system initialized successfully');
    console.log('📊 PocketBase Status:', USE_POCKETBASE ? 'Connected' : 'Disabled');
    console.log('🌐 Environment:', window.location.hostname.includes('github.io') ? 'GitHub Pages' : 'Local');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}