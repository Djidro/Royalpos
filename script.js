/* script.js - full POS logic with PocketBase + localStorage fallback
   Fields for product: { id, name, price, quantity } 
   Collections used in PocketBase: "products", "sales"
   Replace your current script.js with this file.
*/

const pb = new PocketBase("http://127.0.0.1:8090");

// -------------------- Online / Offline UI --------------------
function showNetworkStatus() {
    const existing = document.getElementById('network-status');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'network-status';
    el.style.position = 'fixed';
    el.style.bottom = '10px';
    el.style.right = '10px';
    el.style.padding = '8px 15px';
    el.style.borderRadius = '20px';
    el.style.fontSize = '14px';
    el.style.zIndex = '10000';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';

    if (navigator.onLine) {
        el.textContent = 'Online';
        el.style.backgroundColor = '#2ecc71';
        el.style.color = 'white';
    } else {
        el.textContent = 'Offline';
        el.style.backgroundColor = '#e74c3c';
        el.style.color = 'white';
    }

    document.body.appendChild(el);

    if (navigator.onLine) {
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 3000);
    }
}

window.addEventListener('online', showNetworkStatus);
window.addEventListener('offline', showNetworkStatus);
showNetworkStatus();

// -------------------- Local Storage helpers --------------------
function safeParse(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; }
}
function safeSave(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error('Save error', key, e); }
}

// Local keys
const LS_PRODUCTS = 'bakeryPosProducts';
const LS_SALES = 'bakeryPosSales';
const LS_ACTIVE_SHIFT = 'bakeryPosActiveShift';
const LS_SHIFT_HISTORY = 'bakeryPosShiftHistory';
const LS_EXPENSES = 'bakeryPosExpenses';
const LS_CART = 'bakeryPosCart';

// -------------------- Products (local + remote) --------------------
// getProducts returns array from local cache (synchronous)
function getProducts() {
    return safeParse(LS_PRODUCTS);
}
function saveProducts(products) {
    safeSave(LS_PRODUCTS, products);
}

// Try to pull products from PocketBase and update local cache
async function syncProductsFromPocketbase() {
    if (!navigator.onLine) return;
    try {
        const records = await pb.collection('products').getFullList({ sort: '-created' });
        // Normalize: ensure id, name, price, quantity
        const normalized = records.map(r => ({
            id: r.id || String(Date.now()) + Math.random(),
            name: r.name || '',
            price: parseFloat(r.price) || 0,
            quantity: (r.quantity === 'unlimited' || r.quantity === 'Unlimited') ? 'unlimited' : (Number.isFinite(parseFloat(r.quantity)) ? parseInt(r.quantity) : r.quantity)
        }));
        saveProducts(normalized);
        return normalized;
    } catch (err) {
        console.warn('PocketBase products fetch failed:', err);
        return getProducts();
    }
}

async function loadProducts() {
    const container = document.getElementById('products') || document.getElementById('products-grid');
    if (!container) return;

    // Try PocketBase, fallback to local
    let products = [];
    try {
        products = await syncProductsFromPocketbase();
    } catch (e) {
        products = getProducts();
    }

    // Render
    container.innerHTML = '';
    if (!products || products.length === 0) {
        container.innerHTML = '<p class="no-products">No products available. Add some in the Stock tab.</p>';
        return;
    }

    products.forEach(p => {
        const productCard = document.createElement('div');
        productCard.className = 'product-item product-card';
        const stockDisplay = p.quantity === 'unlimited' ? 'Unlimited' : p.quantity;
        const lowStockClass = (p.quantity !== 'unlimited' && p.quantity < 5) ? 'low-stock' : '';
        productCard.innerHTML = `
            <h3 class="product-name">${escapeHtml(p.name)}</h3>
            <p class="product-price">${p.price} RWF</p>
            <p class="product-stock ${lowStockClass}">Stock: ${stockDisplay}${lowStockClass ? ' (Low)' : ''}</p>
        `;
        productCard.addEventListener('click', () => addToCart(p));
        container.appendChild(productCard);
    });
}

// -------------------- Cart (local only, id ties to product.id) --------------------
function getCart() { return safeParse(LS_CART); }
function saveCart(cart) { safeSave(LS_CART, cart); }

function addToCart(product) {
    // product is an object (from PB or local)
    if (!product) return alert('Product not found!');
    // If shift required to be active: check elsewhere at checkout

    const products = getProducts();
    const prod = products.find(p => p.id === product.id);
    if (prod && prod.quantity !== 'unlimited' && prod.quantity <= 0) {
        return alert('This product is out of stock!');
    }

    let cart = getCart();
    let item = cart.find(i => i.id === product.id);
    if (item) {
        // check stock
        if (prod && prod.quantity !== 'unlimited' && item.quantity >= prod.quantity) {
            return alert('Not enough stock available!');
        }
        item.quantity += 1;
    } else {
        cart.push({ id: product.id, name: product.name, price: product.price, quantity: 1 });
    }
    saveCart(cart);
    updateCartDisplay();
}

function updateCartItemQty(id, diff) {
    let cart = getCart();
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.quantity += diff;
    if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);
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

    cart.forEach(i => {
        const itemTotal = (i.price || 0) * (i.quantity || 0);
        total += itemTotal;
        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML = `
            <div>
                <h4>${escapeHtml(i.name)}</h4>
                <p>${i.price} RWF × ${i.quantity} = ${itemTotal} RWF</p>
            </div>
            <div class="cart-item-controls">
                <button class="cart-decrease" data-id="${i.id}">-</button>
                <span>${i.quantity}</span>
                <button class="cart-increase" data-id="${i.id}">+</button>
                <button class="cart-remove" data-id="${i.id}">×</button>
            </div>
        `;
        container.appendChild(row);
    });

    totalEl.textContent = total.toFixed(2) + " RWF";

    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0 || !getActiveShift();

    // Attach handlers
    setTimeout(() => {
        document.querySelectorAll('.cart-decrease').forEach(btn => {
            btn.onclick = () => updateCartItemQty(btn.dataset.id, -1);
        });
        document.querySelectorAll('.cart-increase').forEach(btn => {
            btn.onclick = () => updateCartItemQty(btn.dataset.id, 1);
        });
        document.querySelectorAll('.cart-remove').forEach(btn => {
            btn.onclick = () => removeFromCart(btn.dataset.id);
        });
    }, 50);
}

// -------------------- Checkout + Sale recording --------------------
async function checkout() {
    const activeShift = getActiveShift();
    if (!activeShift) {
        return alert('Please start a shift before making sales!');
    }

    const cart = getCart();
    if (!cart || cart.length === 0) return alert('Cart is empty!');

    const paymentElem = document.querySelector('input[name="payment"]:checked');
    if (!paymentElem) return alert('Please select a payment method!');
    const paymentMethod = paymentElem.value;

    // Validate stock (based on local cache)
    const products = getProducts();
    for (const item of cart) {
        const p = products.find(pp => pp.id === item.id);
        if (p && p.quantity !== 'unlimited' && p.quantity < item.quantity) {
            return alert(`Not enough stock for ${p.name}`);
        }
    }

    // Build sale object
    const sale = {
        id: Date.now(),
        date: new Date().toISOString(),
        items: cart.map(i => ({ productId: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        total: cart.reduce((s, i) => s + (i.price * i.quantity), 0),
        paymentMethod,
        shiftId: activeShift.id,
        refunded: false
    };

    // Try to update in PocketBase (stock and record sale) when online
    try {
        if (navigator.onLine) {
            // Update stock for each product in PB
            for (const it of sale.items) {
                const pbProduct = await pb.collection('products').getOne(it.productId);
                let newQty = pbProduct.quantity;
                if (newQty !== 'unlimited') {
                    newQty = parseInt(newQty) - it.quantity;
                    if (newQty < 0) throw new Error(`PocketBase: Not enough stock for ${pbProduct.name}`);
                    await pb.collection('products').update(pbProduct.id, { quantity: newQty });
                }
            }

            // Create sale in PB (store minimal data): collection 'sales'
            await pb.collection('sales').create({
                items: sale.items,
                total: sale.total,
                payment_method: sale.paymentMethod,
                date: sale.date,
                shiftId: sale.shiftId
            });
        }
    } catch (err) {
        console.warn('PocketBase checkout sync failed:', err);
        // proceed — we will save locally as fallback
    }

    // Update local product cache and local sales
    const localProducts = getProducts();
    sale.items.forEach(it => {
        const idx = localProducts.findIndex(p => p.id === it.productId);
        if (idx !== -1) {
            if (localProducts[idx].quantity !== 'unlimited') {
                localProducts[idx].quantity -= it.quantity;
                if (localProducts[idx].quantity < 0) localProducts[idx].quantity = 0;
            }
        }
    });
    saveProducts(localProducts);

    // save sale locally
    const sales = getSales();
    sales.push(sale);
    saveSales(sales);

    // attach sale id to active shift and totals
    let shift = getActiveShift();
    if (!shift.sales) shift.sales = [];
    shift.sales.push(sale.id);
    shift.total = (shift.total || 0) + sale.total;
    if (sale.paymentMethod === 'cash') shift.cashTotal = (shift.cashTotal || 0) + sale.total;
    else shift.momoTotal = (shift.momoTotal || 0) + sale.total;
    saveActiveShift(shift);

    // Clear cart and refresh UI
    saveCart([]);
    updateCartDisplay();
    loadProducts();
    checkLowStock();
    loadReceipts(); // refresh receipts list
    updateShiftDisplay();
    showReceipt(sale);
    alert('Sale recorded successfully!');
}

// -------------------- Sales / Receipts --------------------
function getSales() { return safeParse(LS_SALES); }
function saveSales(sales) { safeSave(LS_SALES, sales); }

function loadReceipts() {
    const receiptsList = document.getElementById('receipts-list');
    if (!receiptsList) return;
    receiptsList.innerHTML = '';

    const dateFilterInput = document.getElementById('receipt-date-filter');
    const filterDate = dateFilterInput ? dateFilterInput.value : '';
    let sales = getSales();

    // If online, try to sync sales from PB into local
    if (navigator.onLine) {
        // best-effort; don't await (but try)
        pb.collection('sales').getFullList({ sort: '-created' })
            .then(records => {
                // convert to our local format if needed and merge
                const pbSales = records.map(r => ({
                    id: r.id || Date.now(),
                    date: r.date || r.created,
                    items: r.items || [],
                    total: r.total || 0,
                    paymentMethod: r.payment_method || 'unknown',
                    shiftId: r.shiftId || null,
                    refunded: r.refunded || false
                }));
                // merge non-duplicated
                const local = getSales();
                pbSales.forEach(ps => {
                    if (!local.some(ls => String(ls.id) === String(ps.id))) local.push(ps);
                });
                saveSales(local);
                // re-render
                renderReceiptsList(filterDate);
            }).catch(err => {
                console.warn('Failed to sync sales from PB', err);
                renderReceiptsList(filterDate);
            });
    } else {
        renderReceiptsList(filterDate);
    }
}

function renderReceiptsList(filterDate) {
    const receiptsList = document.getElementById('receipts-list');
    if (!receiptsList) return;
    receiptsList.innerHTML = '';

    const dateFilterInput = document.getElementById('receipt-date-filter');
    const filterDate = dateFilterInput ? dateFilterInput.value : '';

    let sales = getSales();
    let filtered = filterDate ? sales.filter(s => s.date.split('T')[0] === filterDate) : sales;
    if (!filtered || filtered.length === 0) {
        receiptsList.innerHTML = '<p class="no-receipts">No receipts found for this date.</p>';
        return;
    }

    filtered = filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
    filtered.forEach(sale => {
        const el = document.createElement('div');
        el.className = `receipt-item ${sale.refunded ? 'refunded' : ''}`;
        const itemsCount = (sale.items || []).reduce((sum,it) => sum + (it.quantity||0), 0);
        el.innerHTML = `
            <h3>Receipt #${sale.id} ${sale.refunded ? '(Refunded)' : ''}</h3>
            <p>${new Date(sale.date).toLocaleString()}</p>
            <p>${sale.total} RWF (${(sale.paymentMethod||'').toUpperCase()}) - ${itemsCount} items</p>
        `;
        el.addEventListener('click', () => showReceipt(sale));
        receiptsList.appendChild(el);
    });
}

function showReceipt(sale) {
    const modal = document.getElementById('receipt-modal');
    const content = document.getElementById('receipt-content');
    if (!modal || !content) return;

    let itemsHtml = '';
    sale.items.forEach(it => {
        itemsHtml += `<tr><td>${escapeHtml(it.name)}</td><td>${it.quantity}</td><td>${it.price} RWF</td><td>${it.price * it.quantity} RWF</td></tr>`;
    });

    content.innerHTML = `
        <h2>Receipt #${sale.id}</h2>
        <p>${new Date(sale.date).toLocaleString()}</p>
        <table class="summary-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot><tr><td colspan="3" style="text-align:right"><strong>Grand Total</strong></td><td><strong>${sale.total} RWF</strong></td></tr></tfoot>
        </table>
        <div style="margin-top:12px;">
            ${sale.refunded ? `<div class="alert alert-warning">Refunded on ${new Date(sale.refundDate).toLocaleString()}</div>` : `<button id="refund-receipt-btn" class="btn btn-danger" data-id="${sale.id}">Process Refund</button>`}
            <button id="copy-receipt-btn" class="btn">Copy Receipt</button>
        </div>
    `;
    // attach copy
    setTimeout(() => {
        const copyBtn = document.getElementById('copy-receipt-btn');
        if (copyBtn) copyBtn.onclick = () => {
            const text = `Receipt #${sale.id}\nDate: ${new Date(sale.date).toLocaleString()}\n\n` + sale.items.map(it => `${it.name} - ${it.quantity} × ${it.price} RWF = ${it.price * it.quantity} RWF`).join('\n') + `\n\nTotal: ${sale.total} RWF`;
            navigator.clipboard.writeText(text).then(()=>alert('Receipt copied to clipboard')).catch(()=>alert('Copy failed'));
        };
        const refundBtn = document.getElementById('refund-receipt-btn');
        if (refundBtn) refundBtn.onclick = () => processRefund(parseInt(refundBtn.dataset.id));
    },50);

    modal.style.display = 'block';
}

// Refund processing (local-only + attempt PB sync)
function processRefund(receiptId) {
    if (!confirm('Are you sure you want to refund this receipt?')) return;
    const sales = getSales();
    const idx = sales.findIndex(s => String(s.id) === String(receiptId));
    if (idx === -1) return alert('Receipt not found');

    const sale = sales[idx];
    if (sale.refunded) return alert('Already refunded');

    const activeShift = getActiveShift();
    if (!activeShift) return alert('Please start a shift to process refunds');

    // Mark refunded
    sale.refunded = true;
    sale.refundDate = new Date().toISOString();
    sale.refundShiftId = activeShift.id;

    // Adjust local stock
    const products = getProducts();
    sale.items.forEach(it => {
        const pidx = products.findIndex(p => p.id === it.productId);
        if (pidx !== -1) {
            if (products[pidx].quantity === 'unlimited') {
                // do nothing
            } else {
                products[pidx].quantity += it.quantity;
            }
        }
    });
    saveProducts(products);

    // Adjust shift totals
    if (sale.paymentMethod === 'cash') activeShift.cashTotal = (activeShift.cashTotal || 0) - sale.total;
    else activeShift.momoTotal = (activeShift.momoTotal || 0) - sale.total;
    activeShift.total = (activeShift.total || 0) - sale.total;

    // remove sale id from shift.sales
    if (activeShift.sales) {
        const si = activeShift.sales.indexOf(receiptId);
        if (si !== -1) activeShift.sales.splice(si,1);
    }
    if (!activeShift.refunds) activeShift.refunds = [];
    activeShift.refunds.push(receiptId);

    saveActiveShift(activeShift);
    saveSales(sales);

    // attempt PB update
    if (navigator.onLine) {
        // Try to update PB sale record (if exists) and restore stock in PB
        (async () => {
            try {
                // update sale record in PB if possible
                try {
                    const pbSale = await pb.collection('sales').getOne(String(receiptId));
                    if (pbSale) {
                        await pb.collection('sales').update(pbSale.id, { refunded: true, refundDate: sale.refundDate, refundShiftId: sale.refundShiftId });
                    }
                } catch(e) { /* probably not found or PB uses different id format */ }

                // restore stock for each item
                for (const it of sale.items) {
                    try {
                        const pbProd = await pb.collection('products').getOne(it.productId);
                        if (pbProd && pbProd.quantity !== 'unlimited') {
                            await pb.collection('products').update(pbProd.id, { quantity: parseInt(pbProd.quantity) + it.quantity });
                        }
                    } catch(e) {}
                }
            } catch(e) { console.warn('PB refund sync failed', e); }
        })();
    }

    // Refresh UI
    loadProducts();
    loadReceipts();
    updateShiftDisplay();
    checkLowStock();
    alert('Refund processed successfully!');
    const modal = document.getElementById('receipt-modal');
    if (modal) modal.style.display = 'none';
}

// -------------------- Summary (period) --------------------
function loadSummary() {
    const container = document.getElementById('summary-content');
    if (!container) return;
    container.innerHTML = '';

    const startDateElem = document.getElementById('start-date');
    const endDateElem = document.getElementById('end-date');
    const startDate = startDateElem ? startDateElem.value : '';
    const endDate = endDateElem ? endDateElem.value : '';
    const sales = getSales().filter(s => !s.refunded);

    const filtered = sales.filter(s => {
        const d = s.date.split('T')[0];
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="no-summary">No sales for this range.</p>';
        return;
    }

    const cashTotal = filtered.filter(s=>s.paymentMethod==='cash').reduce((a,b)=>a+b.total,0);
    const momoTotal = filtered.filter(s=>s.paymentMethod==='momo').reduce((a,b)=>a+b.total,0);
    const grandTotal = cashTotal + momoTotal;
    const transactionCount = filtered.length;

    // item breakdown
    const breakdown = {};
    filtered.forEach(sale => {
        (sale.items||[]).forEach(it => {
            if (!breakdown[it.name]) breakdown[it.name] = { quantity:0, price: it.price, total:0 };
            breakdown[it.name].quantity += it.quantity;
            breakdown[it.name].total += it.quantity * it.price;
        });
    });

    const products = getProducts();
    let itemsHtml = '';
    for (const [name,data] of Object.entries(breakdown)) {
        const prod = products.find(p => p.name === name);
        const remaining = prod ? prod.quantity : 'N/A';
        itemsHtml += `<tr><td>${escapeHtml(name)}</td><td>${data.quantity}</td><td>${remaining}</td><td>${data.price} RWF</td><td>${data.total} RWF</td></tr>`;
    }

    container.innerHTML = `
        <div class="summary-item">
            <h3>Sales Summary</h3>
            <p>Date range: ${startDate || 'N/A'} to ${endDate || 'N/A'}</p>
            <p>Total transactions: ${transactionCount}</p>
            <p>Cash: ${cashTotal} RWF</p>
            <p>MoMo: ${momoTotal} RWF</p>
            <p><strong>Grand Total: ${grandTotal} RWF</strong></p>
        </div>

        <div class="summary-item">
            <h3>Item Breakdown</h3>
            <table class="summary-table">
                <thead><tr><th>Item</th><th>Qty Sold</th><th>Stock Left</th><th>Unit Price</th><th>Total</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
        </div>
    `;
}

// -------------------- Stock management (local + PB sync) --------------------
function initStockTab() {
    const addBtn = document.getElementById('add-item-btn');
    if (addBtn) addBtn.addEventListener('click', addStockItem);
    loadStockItems();
}

function loadStockItems() {
    const container = document.getElementById('stock-items');
    if (!container) return;
    const products = getProducts();
    container.innerHTML = '';
    if (!products || products.length === 0) {
        container.innerHTML = '<p>No items in stock.</p>';
        return;
    }
    products.forEach(p => {
        const stockItem = document.createElement('div');
        stockItem.className = 'stock-item';
        const stockDisplay = p.quantity === 'unlimited' ? 'Unlimited' : p.quantity;
        const lowClass = (p.quantity !== 'unlimited' && p.quantity < 5) ? 'low-stock' : '';
        stockItem.innerHTML = `
            <span>${escapeHtml(p.name)}</span>
            <span>${p.price} RWF</span>
            <span class="${lowClass}">${stockDisplay}</span>
            <button class="edit-btn" data-id="${p.id}">Edit</button>
            <button class="delete-btn" data-id="${p.id}">Delete</button>
        `;
        container.appendChild(stockItem);
    });

    setTimeout(() => {
        document.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', e => editStockItem(e.currentTarget.dataset.id)));
        document.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', e => deleteStockItem(e.currentTarget.dataset.id)));
    }, 50);
}

function addStockItem() {
    const nameI = document.getElementById('item-name');
    const priceI = document.getElementById('item-price');
    const qtyI = document.getElementById('item-quantity');
    if (!nameI || !priceI || !qtyI) return alert('Missing input elements');

    const name = nameI.value.trim();
    const price = parseFloat(priceI.value);
    let quantity = qtyI.value.trim();

    if (!name || isNaN(price)) return alert('Please fill valid name and price');
    if (quantity.toLowerCase() === 'unlimited') quantity = 'unlimited';
    else {
        quantity = parseInt(quantity);
        if (isNaN(quantity) || quantity < 0) return alert('Quantity must be positive or "unlimited"');
    }

    const products = getProducts();
    const existing = products.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
        if (!confirm('Item exists — update it?')) return;
        existing.price = price;
        existing.quantity = quantity;
        saveProducts(products);
        // try PB update
        if (navigator.onLine) {
            try { pb.collection('products').update(existing.id, { name: existing.name, price: existing.price, quantity: existing.quantity }); } catch(e){/*ignore*/ }
        }
        loadStockItems(); loadProducts(); checkLowStock();
        nameI.value = priceI.value = qtyI.value = '';
        return;
    }

    const newItem = { id: String(Date.now()) + Math.random(), name, price, quantity };
    products.push(newItem);
    saveProducts(products);

    // Try to insert into PB (best-effort)
    if (navigator.onLine) {
        pb.collection('products').create({
            name: newItem.name,
            price: newItem.price,
            quantity: newItem.quantity
        }).then(res => {
            // if PB created with different id, update local mapping where name matches
            // we keep local id as string; future sync will fetch PB and normalize.
        }).catch(err => console.warn('Failed to create PB product', err));
    }

    loadStockItems();
    loadProducts();
    checkLowStock();
    nameI.value = priceI.value = qtyI.value = '';
}

function editStockItem(productId) {
    const products = getProducts();
    const idx = products.findIndex(p => String(p.id) === String(productId));
    if (idx === -1) return alert('Product not found');
    const product = products[idx];

    const newName = prompt('New name:', product.name);
    if (newName === null) return;
    const newPrice = parseFloat(prompt('New price:', product.price));
    if (isNaN(newPrice)) return alert('Price invalid');

    let newQty = prompt('New quantity (number or "unlimited"):', product.quantity === 'unlimited' ? 'unlimited' : product.quantity);
    if (newQty === null) return;
    if (newQty.toLowerCase && newQty.toLowerCase() === 'unlimited') newQty = 'unlimited';
    else {
        newQty = parseInt(newQty);
        if (isNaN(newQty) || newQty < 0) return alert('Quantity invalid');
    }

    product.name = newName;
    product.price = newPrice;
    product.quantity = newQty;
    saveProducts(products);

    if (navigator.onLine) {
        // best-effort update: try to find PB product by name or id
        (async () => {
            try {
                // if product.id looks like PB id (24-char) try update
                try { await pb.collection('products').update(product.id, { name: product.name, price: product.price, quantity: product.quantity }); }
                catch(e) {
                    // fallback: try to find by name then update
                    const found = await pb.collection('products').getFullList({ filter: `name = "${product.name}"`});
                    if (found && found.length) {
                        await pb.collection('products').update(found[0].id, { name: product.name, price: product.price, quantity: product.quantity });
                    }
                }
            } catch(e){}
        })();
    }

    loadStockItems(); loadProducts(); checkLowStock();
}

function deleteStockItem(productId) {
    if (!confirm('Delete this item?')) return;
    const products = getProducts().filter(p => String(p.id) !== String(productId));
    saveProducts(products);

    // best-effort PB deletion
    if (navigator.onLine) {
        pb.collection('products').delete(productId).catch(()=>{/* ignore */});
    }

    loadStockItems(); loadProducts(); checkLowStock();
}

// -------------------- Shift management --------------------
function initShiftTab() {
    const startBtn = document.getElementById('start-shift-btn');
    const endBtn = document.getElementById('end-shift-btn');
    if (startBtn) startBtn.addEventListener('click', startShift);
    if (endBtn) endBtn.addEventListener('click', endShift);
    checkActiveShift();
    updateShiftDisplay();
}

function getActiveShift() { try { return JSON.parse(localStorage.getItem(LS_ACTIVE_SHIFT)) || null; } catch(e){return null;} }
function saveActiveShift(shift) { safeSave(LS_ACTIVE_SHIFT, shift); }
function getShiftHistory() { return safeParse(LS_SHIFT_HISTORY); }
function saveShiftHistory(history) { safeSave(LS_SHIFT_HISTORY, history); }

function startShift() {
    const cashier = prompt('Cashier name:', 'Cashier') || 'Cashier';
    const startingCash = parseFloat(prompt('Starting cash:', '0')) || 0;
    const shift = { id: Date.now(), startTime: new Date().toISOString(), endTime: null, sales: [], cashTotal:0, momoTotal:0, total:0, cashier, startingCash };
    saveActiveShift(shift);
    checkActiveShift();
    updateShiftDisplay();
    alert(`Shift started: ${shift.id}`);
}

function endShift() {
    const active = getActiveShift();
    if (!active) return alert('No active shift');
    if (getCart().length > 0 && !confirm('Cart not empty. End shift anyway?')) return;

    active.endTime = new Date().toISOString();
    // store to history
    const history = getShiftHistory();
    history.push(active);
    saveShiftHistory(history);
    // remove active
    localStorage.removeItem(LS_ACTIVE_SHIFT);
    checkActiveShift();
    updateShiftDisplay();
    alert(`Shift ended: ${active.id}`);
}

function checkActiveShift() {
    const active = getActiveShift();
    const shiftStatus = document.getElementById('shift-status');
    const startBtn = document.getElementById('start-shift-btn');
    const endBtn = document.getElementById('end-shift-btn');
    const checkoutBtn = document.getElementById('checkout-btn');

    if (shiftStatus) {
        if (active) {
            shiftStatus.className = 'shift-status shift-on';
            shiftStatus.innerHTML = `<i class="fas fa-user-clock"></i> Active (Started ${new Date(active.startTime).toLocaleTimeString()})`;
        } else {
            shiftStatus.className = 'shift-status shift-off';
            shiftStatus.innerHTML = `<i class="fas fa-user-clock"></i> Not started`;
        }
    }
    if (startBtn) startBtn.disabled = !!active;
    if (endBtn) endBtn.disabled = !active;
    if (checkoutBtn) checkoutBtn.disabled = (getCart().length === 0) || !active;
}

function updateShiftDisplay() {
    const el = document.getElementById('shift-summary');
    if (!el) return;

    el.innerHTML = '<h3>Shift History</h3>';
    const history = getShiftHistory().slice().reverse();
    if (history.length === 0) { el.innerHTML += '<p>No shift history.</p>'; return; }

    history.forEach(shift => {
        const shiftEl = document.createElement('div');
        shiftEl.className = 'shift-item';
        shiftEl.innerHTML = `
            <strong>Shift #${shift.id}</strong> (${shift.cashier}) - ${new Date(shift.startTime).toLocaleString()} to ${shift.endTime ? new Date(shift.endTime).toLocaleTimeString() : 'ongoing'} - Total: ${shift.total} RWF
            <button class="view-shift" data-id="${shift.id}">View</button>
        `;
        el.appendChild(shiftEl);
    });

    setTimeout(() => {
        document.querySelectorAll('.view-shift').forEach(b => {
            b.addEventListener('click', e => viewShiftDetails(e.currentTarget.dataset.id));
        });
    }, 50);
}

function viewShiftDetails(shiftId) {
    const history = getShiftHistory();
    const shift = history.find(s => String(s.id) === String(shiftId));
    if (!shift) return alert('Shift not found');
    // show details in modal or alert
    const sales = getSales().filter(s => shift.sales.includes(s.id));
    let text = `Shift #${shift.id}\nCashier: ${shift.cashier}\nStart: ${new Date(shift.startTime).toLocaleString()}\nEnd: ${shift.endTime ? new Date(shift.endTime).toLocaleString() : 'ongoing'}\nTotal: ${shift.total} RWF\nTransactions: ${sales.length}\n\nItems:\n`;
    // breakdown
    const breakdown = {};
    sales.forEach(s => (s.items||[]).forEach(it => {
        if (!breakdown[it.name]) breakdown[it.name] = {quantity:0,total:0,price:it.price};
        breakdown[it.name].quantity += it.quantity;
        breakdown[it.name].total += it.quantity * it.price;
    }));
    for (const [name, d] of Object.entries(breakdown)) text += `${name}: ${d.quantity} sold, total ${d.total} RWF\n`;
    alert(text);
}

// -------------------- Expenses --------------------
function getExpenses() { return safeParse(LS_EXPENSES); }
function saveExpenses(expenses) { safeSave(LS_EXPENSES, expenses); }

function initExpensesTab() {
    const addBtn = document.getElementById('add-expense-btn');
    if (addBtn) addBtn.addEventListener('click', addExpenseHandler);
}

function addExpenseHandler() {
    const active = getActiveShift();
    if (!active) return alert('Start a shift first');

    const nameI = document.getElementById('expense-name');
    const amountI = document.getElementById('expense-amount');
    const notesI = document.getElementById('expense-notes');
    if (!nameI || !amountI || !notesI) return;

    const name = nameI.value.trim();
    const amount = parseFloat(amountI.value) || 0;
    const notes = notesI.value.trim();
    const isNoteOnly = notes && (!name && amount === 0);

    if (isNoteOnly) {
        addExpense('Note', 0, notes, true);
    } else {
        if (!name) return alert('Expense must have a name');
        if (amount <= 0) return alert('Amount must be > 0');
        addExpense(name, amount, notes, false);
    }

    nameI.value = amountI.value = notesI.value = '';
    loadExpenses();
}

function addExpense(name = '', amount = 0, notes = '', noteOnly = false) {
    const active = getActiveShift();
    if (!active) return null;
    const expenses = getExpenses();
    const e = { id: Date.now(), name: noteOnly ? 'Note' : name, amount: noteOnly ? 0 : amount, notes, date: new Date().toISOString(), shiftId: active.id, noteOnly };
    expenses.push(e);
    saveExpenses(expenses);
    if (!noteOnly) {
        if (!active.expenses) active.expenses = [];
        active.expenses.push(e.id);
        saveActiveShift(active);
    }
    return e;
}

function loadExpenses() {
    const el = document.getElementById('expenses-list');
    if (!el) return;
    const active = getActiveShift();
    if (!active) { el.innerHTML = '<p>Start a shift to record expenses.</p>'; return; }
    const expenses = getExpenses().filter(x => x.shiftId === active.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
    if (expenses.length === 0) { el.innerHTML = '<p>No expenses recorded.</p>'; return; }
    el.innerHTML = expenses.map(exp => `
        <div class="expense-item ${exp.noteOnly?'note-only':''}">
            <div>
                <strong>${escapeHtml(exp.name)}</strong>
                <div class="expense-date">${new Date(exp.date).toLocaleString()}</div>
                ${exp.notes?`<div class="expense-notes">${escapeHtml(exp.notes)}</div>`:''}
            </div>
            ${exp.noteOnly?`<button class="delete-expense" data-id="${exp.id}">Delete</button>`:`<div><span class="expense-amount">${exp.amount} RWF</span><button class="delete-expense" data-id="${exp.id}">Delete</button></div>`}
        </div>
    `).join('');
    setTimeout(()=>document.querySelectorAll('.delete-expense').forEach(b=>b.addEventListener('click', e=>{ const id = parseInt(e.currentTarget.dataset.id); if(confirm('Delete?')) { deleteExpense(id); loadExpenses(); }})),50);
}

function deleteExpense(id) {
    const expenses = getExpenses().filter(x => x.id !== id);
    saveExpenses(expenses);
    // remove from active shift if applicable
    const active = getActiveShift();
    if (active && active.expenses) {
        active.expenses = active.expenses.filter(eid => eid !== id);
        saveActiveShift(active);
    }
}

// -------------------- Utility & UI init --------------------
function checkLowStock() {
    const alerts = document.getElementById('low-stock-alerts');
    if (!alerts) return;
    alerts.innerHTML = '';
    const low = getProducts().filter(p => p.quantity !== 'unlimited' && p.quantity < 5);
    if (low.length === 0) return;
    const msg = low.length === 1 ? `${low[0].name} has only ${low[0].quantity} left` : `${low.length} items low: ${low.map(i=>i.name+'('+i.quantity+')').join(', ')}`;
    const div = document.createElement('div');
    div.className = 'alert alert-warning';
    div.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${msg}`;
    alerts.appendChild(div);
}

function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}

function formatDateTime(iso) {
    try { return new Date(iso).toLocaleString(); } catch(e) { return iso; }
}

// -------------------- Persistence helpers referenced earlier --------------------
function getProductsLocalOnly() { return getProducts(); } // alias if needed

// -------------------- Initialization --------------------
function initApp() {
    // DOM ready init functions
    initPOSTab();
    initReceiptsTab();
    initSummaryTab();
    initStockTab();
    initShiftTab();
    initExpensesTab();
    loadProducts();
    updateCartDisplay();
    loadReceipts();
    checkLowStock();
    // attach receipt modal close
    const closeBtns = document.querySelectorAll('.modal .close, .modal .btn-close');
    closeBtns.forEach(b => b.addEventListener('click', () => {
        const modal = document.querySelector('.modal');
        if (modal) modal.style.display = 'none';
    }));
}

function initPOSTab() {
    // checkout binding
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', checkout);
    // load cart on start
    updateCartDisplay();
}

// Receipts & summary init hooks
function initReceiptsTab() {
    const filterBtn = document.getElementById('filter-receipts-btn');
    if (filterBtn) filterBtn.addEventListener('click', () => loadReceipts());
    const dateFilter = document.getElementById('receipt-date-filter');
    if (dateFilter) dateFilter.value = new Date().toISOString().split('T')[0];
}

function initSummaryTab() {
    const filterBtn = document.getElementById('filter-summary-btn');
    if (filterBtn) filterBtn.addEventListener('click', loadSummary);
    const start = document.getElementById('start-date');
    const end = document.getElementById('end-date');
    const today = new Date().toISOString().split('T')[0];
    if (start) start.value = today;
    if (end) end.value = today;
}

// -------------------- On DOM ready --------------------
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    // hide receipt modal on outside click
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('receipt-modal');
        if (modal && e.target === modal) modal.style.display = 'none';
    });
    // initial sync attempt
    if (navigator.onLine) syncProductsFromPocketbase().then(()=>{ loadProducts(); loadReceipts(); });
});

// End of script.js
