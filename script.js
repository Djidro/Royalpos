// ===========================================
// 1. INITIALIZATION & STATE
// ===========================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    if (getStored('products').length === 0) seedData();
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(i => i.value = today);

    checkShiftStatus();
    loadProducts();
    updateCartUI();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    const navBtn = document.querySelector(`.nav-btn[onclick="switchTab('${tabId}')"]`);
    if(navBtn) navBtn.classList.add('active');

    if (tabId === 'pos') loadProducts();
    if (tabId === 'receipts') loadReceipts();
    if (tabId === 'stock') loadStock();
    if (tabId === 'shift') updateShiftUI();
    if (tabId === 'expenses') loadExpenses();
}

// ===========================================
// 2. IMAGE EXPORT
// ===========================================
function exportElementAsImage(elementId, fileName) {
    const element = document.getElementById(elementId);
    if (!element) return alert("Element not found!");

    if (typeof html2canvas === 'undefined') {
        alert("Error: html2canvas library missing. Please ensure 'html2canvas.min.js' is in the same folder.");
        return;
    }

    window.scrollTo(0, 0);
    const btn = document.activeElement;
    const prevText = btn.innerHTML;
    // UPDATED: Using a simple text indicator instead of FontAwesome icon
    btn.innerHTML = '🔄 Saving...'; 
    btn.disabled = true;

    html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `${fileName}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL("image/png");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        btn.innerHTML = prevText;
        btn.disabled = false;
    }).catch(err => {
        alert("Export Error: " + err.message);
        btn.innerHTML = prevText;
        btn.disabled = false;
    });
}

// ===========================================
// 3. WHATSAPP & REPORT GENERATION (UPDATED)
// ===========================================
function sendWhatsApp(text) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function getDuration(start, end) {
    if(!end) return "Ongoing";
    const diff = new Date(end) - new Date(start);
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
}

function getShiftData(shift) {
    // 1. Get Expenses
    const expenses = getExpenses(shift.id);
    const totalExp = expenses.reduce((sum, e) => sum + e.amount, 0);

    // 2. Aggregate Sales Items
    const sales = getStored('sales').filter(s => s.shiftId === shift.id && !s.refunded);
    const itemMap = {};
    
    sales.forEach(sale => {
        sale.items.forEach(item => {
            if(!itemMap[item.id]) {
                itemMap[item.id] = { 
                    name: item.name, 
                    price: item.price, 
                    sold: 0, 
                    total: 0 
                };
            }
            itemMap[item.id].sold += item.cartQty;
            itemMap[item.id].total += (item.price * item.cartQty);
        });
    });

    const allItems = Object.values(itemMap);
    
    // Sort by sold count for Top 5
    const top5 = [...allItems].sort((a,b) => b.sold - a.sold).slice(0, 5);

    // Get current stock levels
    const products = getStored('products');
    allItems.forEach(i => {
        const p = products.find(prod => prod.name === i.name);
        // Use the actual qty from products if found, otherwise '?'
        i.stockLeft = p ? p.qty : '?'; 
    });

    const netCash = (shift.startingCash || 0) + shift.cashSales - totalExp;
    const refundsCount = getStored('sales').filter(s => s.shiftId === shift.id && s.refunded).length;

    return {
        expenses, totalExp, allItems, top5, netCash, refundsCount
    };
}

function generateShiftReportText(shift) {
    const data = getShiftData(shift);
    const startT = new Date(shift.startTime);
    const endT = shift.endTime ? new Date(shift.endTime) : null;
    
    let txt = `*Shift Summary*\n\n`;
    txt += `*Date:* ${startT.toISOString().split('T')[0]}\n`;
    txt += `*Cashier:* ${shift.cashier}\n`;
    txt += `*Start Time:* ${startT.toLocaleTimeString()}\n`;
    txt += `*End Time:* ${endT ? endT.toLocaleTimeString() : 'Ongoing'}\n`;
    txt += `*Duration:* ${getDuration(shift.startTime, shift.endTime)}\n\n`;
    
    txt += `*Starting Cash:* ${formatMoney(shift.startingCash || 0)}\n`;
    txt += `- 💵 Cash: ${formatMoney(shift.cashSales)}\n`; // EMOJI UPDATE
    txt += `- 📱 MoMo: ${formatMoney(shift.momoSales)}\n`; // EMOJI UPDATE
    txt += `*Total Sales:* ${formatMoney(shift.totalSales)}\n`;
    txt += `*Transactions:* ${getStored('sales').filter(s => s.shiftId === shift.id && !s.refunded).length}\n`;
    txt += `*Refunds:* ${data.refundsCount}\n`;
    txt += `*Expenses:* ${formatMoney(data.totalExp)}\n\n`;

    // EMOJI UPDATE
    txt += `📈 *Top 5 Sellers*\n`; 
    data.top5.forEach((item, idx) => {
        txt += `${idx+1}. ${item.name} : ${item.sold} sold\n`;
    });
    
    // EMOJI UPDATE
    txt += `\n📦 *All Items Sold*\n`; 
    data.allItems.forEach(item => {
        txt += `\n➤ ${item.name}\n`;
        txt += `   - Sold: ${item.sold}\n`;
        txt += `   - Price: ${formatMoney(item.price)}\n`;
        txt += `   - Total: ${formatMoney(item.total)}\n`;
        if(item.stockLeft !== 'unlimited') txt += `   - Stock Left: ${item.stockLeft}\n`;
    });

    // EMOJI UPDATE
    txt += `\n🧾 *Expense Details*\n`; 
    data.expenses.forEach(e => {
        txt += `- ${e.desc}: ${formatMoney(e.amount)}\n`;
    });

    // EMOJI UPDATE
    txt += `\n💰 *Cash to deposit (after expenses):* ${formatMoney(data.netCash)}\n`; 
    txt += `\n_Report generated on ${new Date().toLocaleString()}_`;
    
    return txt;
}

function shareShiftWhatsApp() {
    const shift = getActiveShift() || getLastShift();
    if (!shift) return alert("No shift data.");
    sendWhatsApp(generateShiftReportText(shift));
}

function shareSummaryWhatsApp() {
    const start = document.getElementById('summary-start').value;
    const end = document.getElementById('summary-end').value;
    const sales = filterSales(start, end);
    if(sales.length === 0) return alert("No sales.");

    const total = sales.reduce((s, x) => s + x.total, 0);
    const cash = sales.filter(s => s.method === 'cash').reduce((s, x) => s + x.total, 0);
    
    let txt = `*ROYAL BAKES SUMMARY*\n📅 ${start} to ${end}\n\n`; // EMOJI UPDATE
    txt += `*Total Revenue:* ${formatMoney(total)}\n`;
    txt += `💵 Cash: ${formatMoney(cash)}\n`;
    txt += `📱 MoMo: ${formatMoney(total-cash)}\n`;
    txt += `📝 Transactions: ${sales.length}`; // EMOJI UPDATE
    
    sendWhatsApp(txt);
}

// ===========================================
// 4. POS LOGIC
// ===========================================
function loadProducts() {
    const grid = document.getElementById('products-grid');
    const products = getStored('products');
    grid.innerHTML = '';
    
    if (products.length === 0) {
        grid.innerHTML = '<p>No products. Go to Stock tab (📦).</p>'; return;
    }

    products.forEach(p => {
        const div = document.createElement('div');
        const isLow = p.qty !== 'unlimited' && parseInt(p.qty) < 5;
        div.className = `product-card ${isLow ? 'low-stock' : ''}`;
        div.innerHTML = `<h4>${p.name}</h4><div class="price">${formatMoney(p.price)}</div><div class="stock">${p.qty}</div>`;
        div.onclick = () => addToCart(p);
        grid.appendChild(div);
    });
}

function addToCart(product) {
    if (!getActiveShift()) return alert("Start Shift first!");
    if (product.qty !== 'unlimited' && parseInt(product.qty) <= 0) return alert("Out of Stock!");

    let cart = getStored('cart');
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
        if (product.qty !== 'unlimited' && existing.cartQty >= parseInt(product.qty)) return alert("Stock Limit!");
        existing.cartQty++;
    } else {
        cart.push({ ...product, cartQty: 1 });
    }
    setStored('cart', cart);
    updateCartUI();
}

function updateCartUI() {
    const cart = getStored('cart');
    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        total += item.price * item.cartQty;
        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `<div><strong>${item.name}</strong><br><small>${item.price} x ${item.cartQty}</small></div>
            <div class="cart-controls"><button onclick="modCart(${index}, -1)">-</button><span>${item.cartQty}</span><button onclick="modCart(${index}, 1)">+</button></div>`;
        container.appendChild(el);
    });

    document.getElementById('cart-total-display').innerText = formatMoney(total);
    const btn = document.getElementById('checkout-btn');
    btn.disabled = cart.length === 0;
    btn.innerHTML = `Checkout (${formatMoney(total)})`;
}

function modCart(index, change) {
    let cart = getStored('cart');
    cart[index].cartQty += change;
    if (cart[index].cartQty <= 0) cart.splice(index, 1);
    setStored('cart', cart);
    updateCartUI();
}

function clearCart() {
    if(confirm("Clear cart?")) { setStored('cart', []); updateCartUI(); }
}

function processCheckout() {
    const shift = getActiveShift();
    if (!shift) return;

    const cart = getStored('cart');
    const total = cart.reduce((sum, i) => sum + (i.price * i.cartQty), 0);
    const method = document.querySelector('input[name="payment"]:checked').value;

    const sale = {
        id: Date.now(),
        date: new Date().toISOString(),
        items: cart,
        total: total,
        method: method,
        shiftId: shift.id,
        refunded: false
    };

    const products = getStored('products');
    cart.forEach(cItem => {
        const pIndex = products.findIndex(p => p.id === cItem.id);
        if (pIndex > -1 && products[pIndex].qty !== 'unlimited') {
            products[pIndex].qty = parseInt(products[pIndex].qty) - cItem.cartQty;
        }
    });

    shift.totalSales += total;
    if (method === 'cash') shift.cashSales += total; else shift.momoSales += total;

    const sales = getStored('sales');
    sales.push(sale);
    setStored('sales', sales);
    setStored('products', products);
    setStored('active_shift', shift);
    setStored('cart', []);

    updateCartUI();
    loadProducts();
    updateShiftUI();
    showModalReceipt(sale);
}

// ===========================================
// 5. SHIFT MANAGEMENT
// ===========================================
function startShift() {
    const cashier = prompt("Cashier Name:");
    if (!cashier) return;
    const cash = parseFloat(prompt("Starting Cash:", "0")) || 0;

    const shift = {
        id: Date.now(),
        cashier,
        startingCash: cash,
        startTime: new Date().toISOString(),
        endTime: null,
        totalSales: 0,
        cashSales: 0,
        momoSales: 0
    };

    setStored('active_shift', shift);
    checkShiftStatus();
    updateShiftUI();
}

function endShift() {
    if (!confirm("End Shift?")) return;
    const shift = getActiveShift();
    shift.endTime = new Date().toISOString();
    const history = getStored('shift_history');
    history.push(shift);
    setStored('shift_history', history);
    localStorage.removeItem('bakery_active_shift');
    checkShiftStatus();
    updateShiftUI();
    switchTab('shift');
}

function updateShiftUI() {
    const active = getActiveShift();
    const history = getStored('shift_history');
    const displayShift = active || (history.length > 0 ? history[history.length - 1] : null);
    
    const container = document.getElementById('shift-report-content');
    const actions = document.getElementById('shift-actions');

    if (!displayShift) {
        container.innerHTML = '<p class="placeholder-text">No shift history.</p>';
        actions.style.display = 'none';
        return;
    }

    actions.style.display = 'flex';
    const data = getShiftData(displayShift);

    let html = `<div style="text-align:center; margin-bottom:10px; border-bottom:1px solid #000; padding-bottom:10px;">
        <h3>*Shift Summary*</h3>
        <p><strong>Date:</strong> ${new Date(displayShift.startTime).toLocaleDateString()}</p>
        <p><strong>Cashier:</strong> ${displayShift.cashier}</p>
        <p><strong>Start:</strong> ${new Date(displayShift.startTime).toLocaleTimeString()} <strong>End:</strong> ${displayShift.endTime ? new Date(displayShift.endTime).toLocaleTimeString() : 'Ongoing'}</p>
        <p><strong>Duration:</strong> ${getDuration(displayShift.startTime, displayShift.endTime)}</p>
    </div>`;

    html += `<div class="report-section">
        <div class="report-line"><span>*Starting Cash:*</span> <span>${formatMoney(displayShift.startingCash||0)}</span></div>
        <div class="report-line"><span>- 💵 Cash:</span> <span>${formatMoney(displayShift.cashSales)}</span></div>
        <div class="report-line"><span>- 📱 MoMo:</span> <span>${formatMoney(displayShift.momoSales)}</span></div>
        <div class="report-line"><span>*Total Sales:*</span> <span>${formatMoney(displayShift.totalSales)}</span></div>
        <div class="report-line"><span>*Transactions:*</span> <span>${getStored('sales').filter(s=>s.shiftId===displayShift.id && !s.refunded).length}</span></div>
        <div class="report-line"><span>*Refunds:*</span> <span>${data.refundsCount}</span></div>
        <div class="report-line"><span>*Expenses:*</span> <span>${formatMoney(data.totalExp)}</span></div>
    </div>`;

    html += `<div class="report-section">
        <span class="report-title">📈 *Top 5 Sellers*</span>`;
    data.top5.forEach((i, idx) => {
        html += `<div>${idx+1}. ${i.name} : ${i.sold} sold</div>`;
    });
    html += `</div>`;

    html += `<div class="report-section">
        <span class="report-title">📦 *All Items Sold*</span>`;
    data.allItems.forEach(i => {
        html += `<div class="item-detail-block">
            <div class="item-name-header">➤ ${i.name}</div>
            <div class="sub-detail">- Sold: ${i.sold}</div>
            <div class="sub-detail">- Price: ${formatMoney(i.price)}</div>
            <div class="sub-detail">- Total: ${formatMoney(i.total)}</div>
            ${i.stockLeft !== 'unlimited' ? `<div class="sub-detail">- Stock Left: ${i.stockLeft}</div>` : ''}
        </div>`;
    });
    html += `</div>`;

    html += `<div class="report-section">
        <span class="report-title">🧾 *Expense Details*</span>`;
    data.expenses.forEach(e => {
        html += `<div>- ${e.desc}: ${formatMoney(e.amount)}</div>`;
    });
    html += `</div>`;

    html += `<div style="font-weight:bold; font-size:1.1em; margin-top:10px;">💰 *Cash to deposit:* ${formatMoney(data.netCash)}</div>`;
    html += `<div style="font-style:italic; font-size:0.8em; margin-top:20px; text-align:center">Report generated on ${new Date().toLocaleString()}</div>`;

    container.innerHTML = html;
}

// ===========================================
// 6. STORAGE, HELPERS, MODALS
// ===========================================
const DB_PREFIX = 'bakery_';
function getStored(key) { return JSON.parse(localStorage.getItem(DB_PREFIX + key) || '[]'); }
function setStored(key, data) { localStorage.setItem(DB_PREFIX + key, JSON.stringify(data)); }
function getActiveShift() { const d = localStorage.getItem(DB_PREFIX + 'active_shift'); return d ? JSON.parse(d) : null; }
function getLastShift() { const h = getStored('shift_history'); return h.length ? h[h.length - 1] : null; }
function checkShiftStatus() {
    const shift = getActiveShift();
    const badge = document.getElementById('shift-status-badge');
    const startBtn = document.getElementById('btn-start-shift');
    const endBtn = document.getElementById('btn-end-shift');
    if (shift) {
        badge.className = 'badge badge-on'; badge.innerText = `Shift: ${shift.cashier}`;
        startBtn.disabled = true; endBtn.disabled = false;
    } else {
        badge.className = 'badge badge-off'; badge.innerText = 'Shift Closed';
        startBtn.disabled = false; endBtn.disabled = true;
    }
}
function filterSales(start, end) {
    return getStored('sales').filter(s => {
        const d = s.date.split('T')[0];
        return (!start || d >= start) && (!end || d <= end);
    });
}
function addExpense() {
    const shift = getActiveShift();
    if (!shift) return alert("Start Shift first");
    const desc = document.getElementById('expense-desc').value;
    const amt = parseFloat(document.getElementById('expense-amt').value);
    if (!desc || !amt) return;
    const exp = { id: Date.now(), shiftId: shift.id, desc, amount: amt };
    const exps = getStored('expenses');
    exps.push(exp);
    setStored('expenses', exps);
    loadExpenses();
    document.getElementById('expense-desc').value = '';
    document.getElementById('expense-amt').value = '';
}
function loadExpenses() {
    const list = document.getElementById('expenses-list'); list.innerHTML = '';
    const shift = getActiveShift();
    if (!shift) { list.innerHTML = '<p class="placeholder-text">No active shift for expenses.</p>'; return; }
    getExpenses(shift.id).forEach(e => {
        const d = document.createElement('div'); d.className = 'list-item';
        d.innerHTML = `<span>${e.desc}</span> <span style="color:red">-${formatMoney(e.amount)}</span>`;
        list.appendChild(d);
    });
}
function getExpenses(shiftId) { return getStored('expenses').filter(e => e.shiftId === shiftId); }
function showModalReceipt(sale) {
    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    const refundBtn = document.getElementById('btn-refund');
    let html = `<p><strong>Order #${sale.id.toString().slice(-6)}</strong></p><p>${new Date(sale.date).toLocaleString()}</p><hr>`;
    sale.items.forEach(i => { html += `<div style="display:flex;justify-content:space-between"><span>${i.name} x${i.cartQty}</span><span>${formatMoney(i.price*i.cartQty)}</span></div>`; });
    html += `<hr><h3 style="text-align:right">Total: ${formatMoney(sale.total)}</h3><p>Payment: ${sale.method.toUpperCase()}</p>`;
    if (sale.refunded) html += `<h3 style="color:red;text-align:center">REFUNDED</h3>`;
    body.innerHTML = html;
    if (getActiveShift() && !sale.refunded) {
        refundBtn.style.display = 'block';
        refundBtn.onclick = () => { if (confirm("Refund?")) processRefund(sale); };
    } else { refundBtn.style.display = 'none'; }
    modal.style.display = 'block';
}
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }
function processRefund(sale) {
    sale.refunded = true;
    const sales = getStored('sales');
    const idx = sales.findIndex(s => s.id === sale.id);
    if(idx !== -1) sales[idx] = sale;
    setStored('sales', sales);
    const products = getStored('products');
    sale.items.forEach(i => {
        const pIdx = products.findIndex(p => p.id === i.id);
        if(pIdx !== -1 && products[pIdx].qty !== 'unlimited') products[pIdx].qty = parseInt(products[pIdx].qty) + i.cartQty;
    });
    setStored('products', products);
    const shift = getActiveShift();
    shift.totalSales -= sale.total;
    if(sale.method === 'cash') shift.cashSales -= sale.total; else shift.momoSales -= sale.total;
    setStored('active_shift', shift);
    closeModal(); loadReceipts(); loadProducts(); updateShiftUI();
}
function loadReceipts() {
    const list = document.getElementById('receipts-list');
    const date = document.getElementById('receipt-date').value;
    list.innerHTML = '';
    filterSales(date, date).reverse().forEach(s => {
        const div = document.createElement('div'); div.className = 'list-item'; div.style.cursor = 'pointer';
        div.innerHTML = `<div><strong>${new Date(s.date).toLocaleTimeString()}</strong> ${s.refunded ? '<span style="color:red">(REFUND)</span>' : ''}</div><strong>${formatMoney(s.total)}</strong>`;
        div.onclick = () => showModalReceipt(s); list.appendChild(div);
    });
}
function loadStock() {
    const list = document.getElementById('stock-list'); list.innerHTML = '';
    getStored('products').forEach(p => {
        const div = document.createElement('div'); div.className = 'list-item';
        div.innerHTML = `<span>${p.name} (${p.qty})</span><div><span style="margin-right:10px">${formatMoney(p.price)}</span><button onclick="deleteProduct(${p.id})" class="btn-xs btn-danger">🗑️</button></div>`; // EMOJI UPDATE
        list.appendChild(div);
    });
}
function addStockItem() {
    const name = document.getElementById('stock-name').value;
    const price = parseFloat(document.getElementById('stock-price').value);
    const qty = document.getElementById('stock-qty').value;
    if(!name || !price) return;
    const products = getStored('products');
    products.push({ id: Date.now(), name, price, qty: qty.toLowerCase() === 'unlimited' ? 'unlimited' : parseInt(qty) });
    setStored('products', products);
    loadStock();
    document.getElementById('stock-name').value = ''; document.getElementById('stock-price').value = '';
}
window.deleteProduct = function(id) { if(confirm("Delete item?")) { setStored('products', getStored('products').filter(x => x.id !== id)); loadStock(); }};
function generateSummary() {
    const start = document.getElementById('summary-start').value;
    const end = document.getElementById('summary-end').value;
    const sales = filterSales(start, end);
    const container = document.getElementById('summary-content');
    if (sales.length === 0) { container.innerHTML = '<p class="placeholder-text">No sales found.</p>'; return; }
    let total = 0, cash = 0, momo = 0; const itemMap = {};
    sales.forEach(s => {
        if (s.refunded) return;
        total += s.total; if (s.method === 'cash') cash += s.total; else momo += s.total;
        s.items.forEach(i => {
            if (!itemMap[i.name]) itemMap[i.name] = { qty: 0, val: 0 };
            itemMap[i.name].qty += i.cartQty; itemMap[i.name].val += (i.price * i.cartQty);
        });
    });
    const itemRows = Object.keys(itemMap).map(k => `<tr><td>${k}</td><td>${itemMap[k].qty}</td><td>${formatMoney(itemMap[k].val)}</td></tr>`).join('');
    container.innerHTML = `<h3 style="text-align:center">SALES SUMMARY</h3><p style="text-align:center">${start} to ${end}</p><table class="report-table"><tr><th>Metric</th><th>Value</th></tr><tr><td>Total Revenue</td><td>${formatMoney(total)}</td></tr><tr><td>Cash</td><td>${formatMoney(cash)}</td></tr><tr><td>MoMo</td><td>${formatMoney(momo)}</td></tr><tr><td>Txns</td><td>${sales.length}</td></tr></table><h4>Top Items</h4><table class="report-table"><tr><th>Item</th><th>Qty</th><th>Val</th></tr>${itemRows}</table>`;
}
function formatMoney(n) { return n.toLocaleString() + ' RWF'; }
function seedData() {
    setStored('products', [{ id: 1, name: "Amandazi", price: 200, qty: 50 }, { id: 2, name: "Capati", price: 250, qty: "unlimited" }, { id: 3, name: "Indazi ya magi", price: 400, qty: 20 }, { id: 4, name: "Ibijumba", price: 100, qty: 30 }, { id: 5, name: "Tea Small", price: 200, qty: "unlimited" }]);
}
