// Enhanced Multi-Device Sync for Royal Bakes POS
class SimpleSync {
    constructor() {
        this.syncInterval = null;
        this.isSyncing = false;
        this.setupSync();
    }

    setupSync() {
        try {
            this.addSyncButtons();
            this.setupAutoSync();
            this.setupEventListeners();
        } catch (error) {
            console.error('Sync setup failed:', error);
        }
    }

    setupAutoSync() {
        // Clear existing interval
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // Auto-refresh every 2 minutes
        this.syncInterval = setInterval(() => {
            if (!this.isSyncing) {
                this.refreshData();
            }
        }, 120000);
    }

    addSyncButtons() {
        // Add to admin panel
        this.addAdminSyncSection();
        
        // Add floating sync button
        this.addFloatingSyncButton();
    }

    addAdminSyncSection() {
        const adminContainer = document.querySelector('.admin-container');
        if (!adminContainer) {
            console.warn('Admin container not found');
            return;
        }

        if (!document.getElementById('sync-section')) {
            const syncHTML = `
                <div class="admin-section" id="sync-section">
                    <h2><i class="fas fa-sync-alt"></i> Multi-Device Sync</h2>
                    <p>Share data across all POS devices</p>
                    
                    <div id="sync-status" style="display: none; padding: 8px; margin: 10px 0; border-radius: 4px; text-align: center;"></div>
                    
                    <div style="display: grid; gap: 10px; margin: 15px 0;">
                        <button onclick="simpleSync.exportData()" class="admin-btn" style="background: #27ae60;" id="export-btn">
                            <i class="fas fa-download"></i> Export Data
                        </button>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="file" id="import-file" accept=".json" style="display: none;">
                            <button onclick="simpleSync.triggerImport()" class="admin-btn" style="background: #e67e22;" id="import-btn">
                                <i class="fas fa-upload"></i> Import Data
                            </button>
                            <small>Select exported JSON file</small>
                        </div>
                        <button onclick="simpleSync.forceRefresh()" class="admin-btn" style="background: #3498db;">
                            <i class="fas fa-redo"></i> Manual Refresh
                        </button>
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
                    
                    <div style="margin-top: 15px; font-size: 12px; color: #666;">
                        <i class="fas fa-info-circle"></i> Auto-refresh every 2 minutes
                    </div>
                </div>
            `;
            adminContainer.insertAdjacentHTML('afterbegin', syncHTML);
        }
    }

    addFloatingSyncButton() {
        if (!document.getElementById('pos-sync-btn')) {
            const syncBtn = document.createElement('button');
            syncBtn.id = 'pos-sync-btn';
            syncBtn.className = 'btn';
            syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            syncBtn.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; padding: 8px 12px; font-size: 12px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;';
            syncBtn.title = 'Export Data';
            syncBtn.onclick = () => this.exportData();
            document.body.appendChild(syncBtn);
        }
    }

    setupEventListeners() {
        const importFile = document.getElementById('import-file');
        if (importFile) {
            importFile.addEventListener('change', (event) => this.importData(event));
        }
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('sync-status');
        if (!statusEl) return;

        const colors = {
            info: '#3498db',
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12'
        };

        statusEl.style.display = 'block';
        statusEl.style.background = colors[type] || colors.info;
        statusEl.style.color = 'white';
        statusEl.textContent = message;

        // Auto-hide after 5 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    }

    setSyncing(state) {
        this.isSyncing = state;
        const exportBtn = document.getElementById('export-btn');
        const importBtn = document.getElementById('import-btn');
        const syncBtn = document.getElementById('pos-sync-btn');

        [exportBtn, importBtn, syncBtn].forEach(btn => {
            if (btn) {
                btn.disabled = state;
                btn.style.opacity = state ? '0.6' : '1';
            }
        });

        if (state) {
            this.showStatus('Syncing in progress...', 'info');
        }
    }

    triggerImport() {
        const importFile = document.getElementById('import-file');
        if (importFile) {
            importFile.click();
        }
    }

    exportData() {
        if (this.isSyncing) {
            this.showStatus('Please wait, another sync in progress', 'warning');
            return;
        }

        try {
            this.setSyncing(true);
            
            const data = {
                products: this.getProducts(),
                adminMessage: localStorage.getItem('bakeryPosAdminMessage') || '',
                sales: this.getSales(),
                shifts: this.getShiftHistory(),
                expenses: this.getExpenses(),
                exportDate: new Date().toISOString(),
                device: navigator.userAgent.substring(0, 100),
                version: '1.1'
            };

            // Validate data
            if (!this.validateExportData(data)) {
                throw new Error('Invalid data structure');
            }
            
            const dataStr = JSON.stringify(data, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            
            // Check blob size (rough estimate)
            if (dataStr.length > 10 * 1024 * 1024) { // 10MB
                this.showStatus('Warning: Large dataset exported', 'warning');
            }
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `royal-bakes-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showStatus('Data exported successfully!', 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            this.showStatus(`Export failed: ${error.message}`, 'error');
        } finally {
            this.setSyncing(false);
        }
    }

    importData(event) {
        if (this.isSyncing) {
            this.showStatus('Please wait, another sync in progress', 'warning');
            event.target.value = '';
            return;
        }

        const file = event.target.files[0];
        if (!file) return;

        // Validate file size (max 20MB)
        if (file.size > 20 * 1024 * 1024) {
            this.showStatus('File too large (max 20MB)', 'error');
            event.target.value = '';
            return;
        }

        // Validate file type
        if (!file.name.endsWith('.json')) {
            this.showStatus('Please select a JSON file', 'error');
            event.target.value = '';
            return;
        }

        this.setSyncing(true);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!this.validateImportData(data)) {
                    throw new Error('Invalid or corrupted data file');
                }

                // Confirm import for large datasets
                if (data.products && data.products.length > 100) {
                    if (!confirm(`This will import ${data.products.length} products. Continue?`)) {
                        this.setSyncing(false);
                        event.target.value = '';
                        return;
                    }
                }

                this.saveImportedData(data);
                this.showStatus('Data imported successfully! Reloading...', 'success');
                
                setTimeout(() => {
                    location.reload();
                }, 1500);
                
            } catch (error) {
                console.error('Import error:', error);
                this.showStatus(`Import failed: ${error.message}`, 'error');
                this.setSyncing(false);
            }
        };

        reader.onerror = () => {
            this.showStatus('Error reading file', 'error');
            this.setSyncing(false);
            event.target.value = '';
        };

        reader.readAsText(file);
    }

    validateExportData(data) {
        return data && 
               data.products && 
               Array.isArray(data.products) &&
               data.version &&
               data.exportDate;
    }

    validateImportData(data) {
        if (!data || typeof data !== 'object') return false;
        if (!data.products || !Array.isArray(data.products)) return false;
        if (!data.version) return false;
        
        // Basic schema validation for products
        if (data.products.length > 0) {
            const sampleProduct = data.products[0];
            if (!sampleProduct.hasOwnProperty('name') || !sampleProduct.hasOwnProperty('price')) {
                return false;
            }
        }
        
        return true;
    }

    saveImportedData(data) {
        // Save all data components
        this.saveProducts(data.products || []);
        localStorage.setItem('bakeryPosAdminMessage', data.adminMessage || '');
        
        if (data.sales) this.saveSales(data.sales);
        if (data.shifts) this.saveShiftHistory(data.shifts);
        if (data.expenses) this.saveExpenses(data.expenses);
        
        // Update last sync timestamp
        localStorage.setItem('bakeryPosLastSync', new Date().toISOString());
    }

    refreshData() {
        try {
            if (typeof loadProducts === 'function') loadProducts();
            if (typeof displayAdminMessage === 'function') displayAdminMessage();
            
            // Update last refresh time
            const now = new Date().toLocaleTimeString();
            console.log(`Data refreshed at ${now}`);
        } catch (error) {
            console.error('Refresh error:', error);
        }
    }

    forceRefresh() {
        this.showStatus('Manual refresh started...', 'info');
        this.refreshData();
        setTimeout(() => {
            this.showStatus('Refresh completed', 'success');
        }, 1000);
    }

    // Data access methods with fallbacks
    getProducts() { 
        try {
            return typeof getProducts === 'function' ? getProducts() : JSON.parse(localStorage.getItem('bakeryPosProducts') || '[]');
        } catch (error) {
            console.error('Error getting products:', error);
            return [];
        }
    }
    
    getSales() { 
        try {
            return typeof getSales === 'function' ? getSales() : JSON.parse(localStorage.getItem('bakeryPosSales') || '[]');
        } catch (error) {
            console.error('Error getting sales:', error);
            return [];
        }
    }
    
    getShiftHistory() { 
        try {
            return typeof getShiftHistory === 'function' ? getShiftHistory() : JSON.parse(localStorage.getItem('bakeryPosShiftHistory') || '[]');
        } catch (error) {
            console.error('Error getting shifts:', error);
            return [];
        }
    }
    
    getExpenses() { 
        try {
            return typeof getExpenses === 'function' ? getExpenses() : JSON.parse(localStorage.getItem('bakeryPosExpenses') || '[]');
        } catch (error) {
            console.error('Error getting expenses:', error);
            return [];
        }
    }

    saveProducts(products) { 
        try {
            if (typeof saveProducts === 'function') {
                saveProducts(products);
            } else {
                localStorage.setItem('bakeryPosProducts', JSON.stringify(products));
            }
        } catch (error) {
            console.error('Error saving products:', error);
            throw error;
        }
    }
    
    saveSales(sales) { 
        try {
            if (typeof saveSales === 'function') {
                saveSales(sales);
            } else {
                localStorage.setItem('bakeryPosSales', JSON.stringify(sales));
            }
        } catch (error) {
            console.error('Error saving sales:', error);
            throw error;
        }
    }
    
    saveShiftHistory(shifts) { 
        try {
            if (typeof saveShiftHistory === 'function') {
                saveShiftHistory(shifts);
            } else {
                localStorage.setItem('bakeryPosShiftHistory', JSON.stringify(shifts));
            }
        } catch (error) {
            console.error('Error saving shifts:', error);
            throw error;
        }
    }
    
    saveExpenses(expenses) { 
        try {
            if (typeof saveExpenses === 'function') {
                saveExpenses(expenses);
            } else {
                localStorage.setItem('bakeryPosExpenses', JSON.stringify(expenses));
            }
        } catch (error) {
            console.error('Error saving expenses:', error);
            throw error;
        }
    }

    // Cleanup method
    destroy() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        const syncBtn = document.getElementById('pos-sync-btn');
        if (syncBtn) syncBtn.remove();
        
        console.log('SimpleSync destroyed');
    }
}

// Initialize sync system
const simpleSync = new SimpleSync();

// Make available globally
window.simpleSync = simpleSync;

console.log('Royal Bakes Sync System loaded');