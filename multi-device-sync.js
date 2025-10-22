// Simple Multi-Device Sync for Royal Bakes POS
class SimpleSync {
    constructor() {
        this.setupSync();
    }

    setupSync() {
        this.addSyncButtons();
        setInterval(() => {
            this.refreshData();
        }, 120000);
    }

    addSyncButtons() {
        const adminContainer = document.querySelector('.admin-container');
        if (adminContainer && !document.getElementById('sync-section')) {
            const syncHTML = `
                <div class="admin-section" id="sync-section">
                    <h2><i class="fas fa-sync-alt"></i> Multi-Device Sync</h2>
                    <p>Share data across all POS devices</p>
                    <div style="display: grid; gap: 10px; margin: 15px 0;">
                        <button onclick="simpleSync.exportData()" class="admin-btn" style="background: #27ae60;">
                            <i class="fas fa-download"></i> Export Data
                        </button>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="file" id="import-file" accept=".json" style="display: none;" onchange="simpleSync.importData(event)">
                            <button onclick="document.getElementById('import-file').click()" class="admin-btn" style="background: #e67e22;">
                                <i class="fas fa-upload"></i> Import Data
                            </button>
                            <small>Select exported JSON file</small>
                        </div>
                    </div>
                    <div style="padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <h4>How to Sync:</h4>
                        <ol style="text-align: left; margin-left: 20px;">
                            <li>On Device 1: Click "Export Data" to download file</li>
                            <li>On Device 2: Click "Import Data" and select the file</li>
                            <li>Data will be updated on Device 2</li>
                            <li>Repeat when you make changes</li>
                        </ol>
                    </div>
                </div>
            `;
            adminContainer.insertAdjacentHTML('afterbegin', syncHTML);
        }

        if (!document.getElementById('pos-sync-btn')) {
            const syncBtn = document.createElement('button');
            syncBtn.id = 'pos-sync-btn';
            syncBtn.className = 'btn';
            syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            syncBtn.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; padding: 8px 12px; font-size: 12px; background: #3498db;';
            syncBtn.onclick = () => this.exportData();
            document.body.appendChild(syncBtn);
        }
    }

    exportData() {
        const data = {
            products: this.getProducts(),
            adminMessage: localStorage.getItem('bakeryPosAdminMessage') || '',
            sales: this.getSales(),
            shifts: this.getShiftHistory(),
            expenses: this.getExpenses(),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `royal-bakes-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        alert('Data exported! Save this file and import on other devices.');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.products || !data.version) {
                    throw new Error('Invalid data file');
                }
                this.saveProducts(data.products);
                localStorage.setItem('bakeryPosAdminMessage', data.adminMessage || '');
                if (data.sales) this.saveSales(data.sales);
                if (data.shifts) this.saveShiftHistory(data.shifts);
                if (data.expenses) this.saveExpenses(data.expenses);
                event.target.value = '';
                alert('Data imported successfully! Page will reload.');
                setTimeout(() => location.reload(), 1000);
            } catch (error) {
                alert('Error importing data: ' + error.message);
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    }

    refreshData() {
        if (typeof loadProducts === 'function') loadProducts();
        if (typeof displayAdminMessage === 'function') displayAdminMessage();
    }

    getProducts() { return typeof getProducts === 'function' ? getProducts() : []; }
    getSales() { return typeof getSales === 'function' ? getSales() : []; }
    getShiftHistory() { return typeof getShiftHistory === 'function' ? getShiftHistory() : []; }
    getExpenses() { return typeof getExpenses === 'function' ? getExpenses() : []; }
    saveProducts(products) { 
        if (typeof saveProducts === 'function') saveProducts(products);
        else localStorage.setItem('bakeryPosProducts', JSON.stringify(products));
    }
    saveSales(sales) { 
        if (typeof saveSales === 'function') saveSales(sales);
        else localStorage.setItem('bakeryPosSales', JSON.stringify(sales));
    }
    saveShiftHistory(shifts) { 
        if (typeof saveShiftHistory === 'function') saveShiftHistory(shifts);
        else localStorage.setItem('bakeryPosShiftHistory', JSON.stringify(shifts));
    }
    saveExpenses(expenses) { 
        if (typeof saveExpenses === 'function') saveExpenses(expenses);
        else localStorage.setItem('bakeryPosExpenses', JSON.stringify(expenses));
    }
}

const simpleSync = new SimpleSync();