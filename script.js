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

    // Check if there's an active shift
    checkActiveShift();

    // Load low stock alerts
    checkLowStock();
}

// [Rest of your existing script.js content remains the same, except for the product card HTML in loadProducts()]

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
        
        const stockClass = product.quantity < 5 ? 'low-stock' : '';
        
        productCard.innerHTML = `
            <h3>${product.name}</h3>
            <p>${product.price} RWF</p>
            <p class="stock-info ${stockClass}">Stock: ${product.quantity} ${product.quantity < 5 ? '(Low Stock!)' : ''}</p>
        `;
        
        productCard.addEventListener('click', () => addToCart(product.id));
        productsGrid.appendChild(productCard);
    });
}

// [Keep all other functions exactly the same as in your original script.js]

// Update the initializeSampleData function to remove image references
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

// Call initialization
initializeSampleData();
