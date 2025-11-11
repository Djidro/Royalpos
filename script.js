// -------------------------------------------------------------
// PocketBase connection
// -------------------------------------------------------------
const pb = new PocketBase("http://127.0.0.1:8090");

// -------------------------------------------------------------
// Online/Offline network indicator
// -------------------------------------------------------------
function updateOnlineStatus() {
    const el = document.createElement('div');
    el.id = 'network-status';
    el.style.position = 'fixed';
    el.style.bottom = '10px';
    el.style.right = '10px';
    el.style.padding = '8px 15px';
    el.style.borderRadius = '20px';
    el.style.fontSize = '14px';
    el.style.zIndex = '1000';

    if (navigator.onLine) {
        el.textContent = 'Online';
        el.style.backgroundColor = '#2ecc71';
        el.style.color = 'white';
    } else {
        el.textContent = 'Offline';
        el.style.backgroundColor = '#e74c3c';
        el.style.color = 'white';
    }

    const existing = document.getElementById('network-status');
    if (existing) existing.remove();
    document.body.appendChild(el);

    if (navigator.onLine) {
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 3000);
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// -------------------------------------------------------------
// PRODUCTS TAB - Load products live from PocketBase
// -------------------------------------------------------------
async function loadProducts() {
    const container = document.getElementById('products');
    if (!container) return;

    try {
        const products = await pb.collection('products').getFullList({ sort: '-created' });
        container.innerHTML = '';

        products.forEach(p => {
            const div = document.createElement('div');
            div.classList.add('product-item');
            div.innerHTML = `
                <h3>${p.name}</h3>
                <p>Price: ${p.price} RWF</p>
                <p>Stock: ${p.quantity}</p>
            `;
            div.addEventListener('click', () => addToCart(p));
            container.appendChild(div);
        });

    } catch (err) {
        console.error(err);
        alert("⚠️ Cannot load products. Make sure PocketBase is running.");
    }
}

// -------------------------------------------------------------
// CART (Local storage only, does NOT sync)
// -------------------------------------------------------------
function getCart() {
    return JSON.parse(localStorage.getItem('bakeryPosCart') || '[]');
}
function saveCart(cart) {
    localStorage.setItem('bakeryPosCart', JSON.stringify(cart));
}

function addToCart(product) {
    let cart = getCart();
    const item = cart.find(i => i.id === product.id);

    if (item) item.quantity++;
    else cart.push({ id: product.id, name: product.name, price: product.price, quantity: 1 });

    saveCart(cart);
    updateCartDisplay();
}

function updateCartDisplay() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');

    const cart = getCart();
    let total = 0;
    container.innerHTML = '';

    cart.forEach(i => {
        const itemTotal = i.price * i.quantity;
        total += itemTotal;

        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML = `
            <div>
                <h4>${i.name}</h4>
                <p>${i.price} RWF × ${i.quantity} = ${itemTotal} RWF</p>
            </div>
            <div class="cart-item-controls">
                <button onclick="updateCartQty('${i.id}', -1)">-</button>
                <button onclick="updateCartQty('${i.id}', 1)">+</button>
                <button onclick="removeFromCart('${i.id}')">×</button>
            </div>
        `;
        container.appendChild(row);
    });

    totalEl.textContent = total + " RWF";
    checkoutBtn.disabled = cart.length === 0;
}

function updateCartQty(id, diff) {
    let cart = getCart();
    const item = cart.find(i => i.id === id);
    if (!item) return;

    item.quantity += diff;
    if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);

    saveCart(cart);
    updateCartDisplay();
}

function removeFromCart(id) {
    let cart = getCart().filter(i => i.id !== id);
    saveCart(cart);
    updateCartDisplay();
}

// -------------------------------------------------------------
// CHECKOUT: Sync sale + update stock in PocketBase
// -------------------------------------------------------------
async function checkout() {
    const cart = getCart();
    if (cart.length === 0) return alert("Cart is empty");

    const payOption = document.querySelector('input[name="payment"]:checked');
    if (!payOption) return alert("Select payment method");

    const paymentMethod = payOption.value;

    try {
        // Update stock in PB
        for (const item of cart) {
            const product = await pb.collection('products').getOne(item.id);

            if (product.quantity < item.quantity)
                return alert(`Not enough stock for ${product.name}`);

            await pb.collection('products').update(item.id, {
                quantity: product.quantity - item.quantity
            });
        }

        // Save sale
        await pb.collection('sales').create({
            items: cart,
            total: cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
            payment_method: paymentMethod,
            date: new Date().toISOString()
        });

        saveCart([]);
        updateCartDisplay();
        loadProducts();
        alert("✅ Sale completed successfully");

    } catch (err) {
        console.error(err);
        alert("⚠️ Checkout failed. PocketBase offline?");
    }
}

// -------------------------------------------------------------
// RECEIPTS TAB - Load sales records from PB
// -------------------------------------------------------------
async function loadReceipts() {
    const container = document.getElementById('receipts-list');

    try {
        const receipts = await pb.collection('sales').getFullList({ sort: '-created' });
        container.innerHTML = '';

        receipts.forEach(r => {
            const div = document.createElement('div');
            div.classList.add('receipt-item');
            div.innerHTML = `
                <p><strong>Date:</strong> ${new Date(r.date).toLocaleString()}</p>
                <p><strong>Total:</strong> ${r.total} RWF</p>
                <p><strong>Payment:</strong> ${r.payment_method}</p>
            `;
            container.appendChild(div);
        });

    } catch (err) {
        console.error(err);
        alert("⚠️ Cannot load receipts. PB offline?");
    }
}

// -------------------------------------------------------------
// Initialize UI
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    updateCartDisplay();
    loadReceipts();
});
