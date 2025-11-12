/*  Bakery-POS  |  PocketBase edition  |  ready-to-use  */
(function () {
'use strict';

/* ==================== 0.  CONFIG  ==================== */
const LS_PRODUCTS   = 'bakeryPosProducts';
const LS_SALES      = 'bakeryPosSales';
const LS_EXPENSES   = 'bakeryPosExpenses';
const LS_CART       = 'bakeryPosCart';
const LS_ACTIVE_SHIFT = 'bakeryPosActiveShift';
const LS_SHIFT_HISTORY= 'bakeryPosShiftHistory';

let pb;
let USE_POCKETBASE = false;
const PB_PRODUCTS  = 'products';
const PB_SALES     = 'sales';
const PB_EXPENSES  = 'expenses';
const PB_RECEIPTS  = 'Receipt';

function initPocketBase(){
    const isLocal = ['localhost','127.0.0.1'].includes(location.hostname);
    if (!isLocal) return;
    if (typeof PocketBase === 'undefined'){ console.warn('PocketBase UMD not found – localStorage mode'); return;}
    pb = new PocketBase('http://127.0.0.1:8090');
    USE_POCKETBASE = true;
    console.log('%cPocketBase ready','color:green;font-weight:bold');
}

/* ==================== 1.  HELPERS  ==================== */
const safeParse = k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
const safeSave  = (k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){console.error(e)}};
const escapeHtml = str=>str.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* ==================== 2.  PRODUCTS  ==================== */
async function pbSyncProducts(){
    if (!USE_POCKETBASE || !navigator.onLine) return safeParse(LS_PRODUCTS);
    try{const recs=await pb.collection(PB_PRODUCTS).getFullList({sort:'-created'}); const norm=recs.map(r=>({id:r.id,name:r.name||'',price:parseFloat(r.price)||0,quantity:(r.quantity==='unlimited'||r.quantity==='Unlimited')?'unlimited':(parseInt(r.quantity)||0)})); safeSave(LS_PRODUCTS,norm); return norm;}catch(e){console.warn('PB products sync',e); return safeParse(LS_PRODUCTS)}
}
async function pbCreateProduct(p){
    if (!USE_POCKETBASE||!navigator.onLine) return p;
    try{const r=await pb.collection(PB_PRODUCTS).create(p); return {...p,id:r.id}}catch(e){console.warn('PB create product',e); return p}
}
async function pbUpdateProduct(id,data){
    if (!USE_POCKETBASE||!navigator.onLine) return;
    try{await pb.collection(PB_PRODUCTS).update(id,data)}catch(e){console.warn('PB update product',e)}
}
async function pbDeleteProduct(id){
    if (!USE_POCKETBASE||!navigator.onLine) return;
    try{await pb.collection(PB_PRODUCTS).delete(id)}catch(e){console.warn('PB delete product',e)}
}
async function pbGetProductList(page=1,perPage=50,filter='',expand=''){
    if (!USE_POCKETBASE||!navigator.onLine) return {items:getProducts(),totalItems:getProducts().length};
    try{return await pb.collection(PB_PRODUCTS).getList(page,perPage,{filter,sort:'-created',expand})}catch(e){console.warn('PB getProductList',e); return {items:getProducts(),totalItems:getProducts().length}}
}
async function pbGetFirstProduct(filter='',expand=''){
    if (!USE_POCKETBASE||!navigator.onLine) return null;
    try{return await pb.collection(PB_PRODUCTS).getFirstListItem(filter,{expand})}catch(e){console.warn('PB getFirstProduct',e); return null}
}
let productsSub = null;
function subscribeProducts(){
    if (!USE_POCKETBASE||productsSub) return;
    productsSub = pb.collection(PB_PRODUCTS).subscribe('*',async e=>{console.log('PB realtime product',e.action,e.record); await pbSyncProducts(); loadProducts(); loadStockItems();});
}
window.addEventListener('beforeunload',()=>{if(productsSub) pb.collection(PB_PRODUCTS).unsubscribe(productsSub)});

/* ==================== 3.  SALES  ==================== */
async function pbSaveSale(sale){
    if (!USE_POCKETBASE||!navigator.onLine) return;
    try{await pb.collection(PB_SALES).create({items:sale.items,total:sale.total,payment_method:sale.paymentMethod,time:sale.date,shift_id:sale.shiftId})}catch(e){console.warn('PB save sale',e)}
}
async function pbLoadSales(){
    if (!USE_POCKETBASE||!navigator.onLine) return [];
    try{const recs=await pb.collection(PB_SALES).getFullList({sort:'-created'}); return recs.map(r=>({id:r.id,date:r.time||r.created,items:r.items||[],total:r.total||0,paymentMethod:r.payment_method||'unknown',shiftId:r.shift_id||null}))}catch(e){console.warn('PB load sales',e); return []}
}
async function pbGetSaleList(page=1,perPage=50,filter='',expand=''){
    if (!USE_POCKETBASE||!navigator.onLine) return {items:getSales(),totalItems:getSales().length};
    try{return await pb.collection(PB_SALES).getList(page,perPage,{filter,sort:'-created',expand})}catch(e){console.warn('PB getSaleList',e); return {items:getSales(),totalItems:getSales().length}}
}
async function pbGetFirstSale(filter='',expand=''){
    if (!USE_POCKETBASE||!navigator.onLine) return null;
    try{return await pb.collection(PB_SALES).getFirstListItem(filter,{expand})}catch(e){console.warn('PB getFirstSale',e); return null}
}

/* ==================== 4.  EXPENSES  ==================== */
async function pbSaveExpense(ex){
    if (!USE_POCKETBASE||!navigator.onLine) return;
    try{await pb.collection(PB_EXPENSES).create(ex)}catch(e){console.warn('PB save expense',e)}
}
async function pbLoadExpenses(){
    if (!USE_POCKETBASE||!navigator.onLine) return [];
    try{const recs=await pb.collection(PB_EXPENSES).getFullList({sort:'-created'}); return recs.map(r=>({id:r.id,name:r.name||'',amount:parseFloat(r.amount)||0,notes:r.notes||'',date:r.created}))}catch(e){console.warn('PB load expenses',e); return []}
}
async function pbGetExpenseList(page=1,perPage=50,filter='',expand=''){
    if (!USE_POCKETBASE||!navigator.onLine) return {items:getExpenses(),totalItems:getExpenses().length};
    try{return await pb.collection(PB_EXPENSES).getList(page,perPage,{filter,sort:'-created',expand})}catch(e){console.warn('PB getExpenseList',e); return {items:getExpenses(),totalItems:getExpenses().length}}
}
async function pbGetFirstExpense(filter='',expand=''){
    if (!USE_POCKETBASE||!navigator.onLine) return null;
    try{return await pb.collection(PB_EXPENSES).getFirstListItem(filter,{expand})}catch(e){console.warn('PB getFirstExpense',e); return null}
}

/* ==================== 5.  RECEIPTS  ==================== */
async function pbSaveReceipt(receipt){
    if (!USE_POCKETBASE||!navigator.onLine) return;
    try{await pb.collection(PB_RECEIPTS).create(receipt)}catch(e){console.warn('PB save receipt',e)}
}
async function pbLoadReceipts(){
    if (!USE_POCKETBASE||!navigator.onLine) return [];
    try{const recs=await pb.collection(PB_RECEIPTS).getFullList({sort:'-created'}); return recs.map(r=>({id:r.id,date:r.created,items:r.items||[],total:r.total||0,paymentMethod:r.payment_method||'unknown',shiftId:r.shift_id||null}))}catch(e){console.warn('PB load receipts',e); return []}
}
async function pbGetReceiptList(page=1,perPage=50,filter='',expand=''){
    if (!USE_POCKETBASE||!navigator.onLine) return {items:getSales(),totalItems:getSales().length};
    try{return await pb.collection(PB_RECEIPTS).getList(page,perPage,{filter,sort:'-created',expand})}catch(e){console.warn('PB getReceiptList',e); return {items:getSales(),totalItems:getSales().length}}
}
async function pbGetFirstReceipt(filter='',expand=''){
    if (!USE_POCKETBASE||!navigator.onLine) return null;
    try{return await pb.collection(PB_RECEIPTS).getFirstListItem(filter,{expand})}catch(e){console.warn('PB getFirstReceipt',e); return null}
}

/* ==================== 6.  PRODUCTS UI  ==================== */
function getProducts(){return safeParse(LS_PRODUCTS)}
function saveProducts(p){safeSave(LS_PRODUCTS,p)}
async function loadProducts(){
    const grid=document.getElementById('products-grid'); if(!grid)return;
    const prods=await pbSyncProducts();
    grid.innerHTML='';
    if(!prods.length){grid.innerHTML='<p class="no-products">No products – add some in Stock tab</p>';return}
    prods.forEach(p=>{
        const card=document.createElement('div'); card.className='product-card';
        const stock=p.quantity==='unlimited'?'Unlimited':p.quantity;
        const low=(p.quantity!=='unlimited'&&p.quantity<5)?'low-stock':'';
        card.innerHTML=`<h4>${escapeHtml(p.name)}</h4><p class="price">${p.price} RWF</p><p class="stock ${low}">Stock: ${stock}${low?' (Low)':''}</p>`;
        card.onclick=()=>addToCart(p); grid.appendChild(card);
    });
}

/* ==================== 7.  CART  ==================== */
function getCart(){return safeParse(LS_CART)}
function saveCart(c){safeSave(LS_CART,c)}
function addToCart(p){
    const prods=getProducts();
    const prod=prods.find(x=>x.id===p.id);
    if(prod&&prod.quantity!=='unlimited'&&prod.quantity<=0){alert('Out of stock');return}
    let cart=getCart();
    const item=cart.find(i=>i.id===p.id);
    if(item){
        if(prod&&prod.quantity!=='unlimited'&&item.quantity>=prod.quantity){alert('Not enough stock');return}
        item.quantity++;
    }else cart.push({id:p.id,name:p.name,price:p.price,quantity:1});
    saveCart(cart); updateCartDisplay();
}
function updateCartDisplay(){
    const cont=document.getElementById('cart-items'),totalEl=document.getElementById('cart-total'),btn=document.getElementById('checkout-btn');
    if(!cont||!totalEl)return;
    const cart=getCart(); cont.innerHTML=''; let tot=0;
    if(!cart.length){cont.innerHTML='<p class="empty-cart">Cart is empty</p>'; if(btn)btn.disabled=true; totalEl.textContent='0 RWF';return}
    cart.forEach(it=>{const sub=it.price*it.quantity; tot+=sub;
        const row=document.createElement('div'); row.className='cart-item';
        row.innerHTML=`<span class="cart-item-name">${escapeHtml(it.name)}</span><div class="cart-item-quantity"><button class="quantity-btn decrease" data-id="${it.id}">-</button><span>${it.quantity}</span><button class="quantity-btn increase" data-id="${it.id}">+</button></div><span class="cart-item-total">${sub} RWF</span><button class="remove-btn" data-id="${it.id}">×</button>`;
        cont.appendChild(row);
    });
    totalEl.textContent=`${tot.toFixed(2)} RWF`; if(btn)btn.disabled=false;
    cont.querySelectorAll('.decrease').forEach(b=>b.onclick=()=>{let c=getCart(); const i=c.find(x=>x.id===b.dataset.id); if(i){i.quantity--; if(i.quantity<=0)c=c.filter(x=>x.id!==b.dataset.id); saveCart(c); updateCartDisplay()}});
    cont.querySelectorAll('.increase').forEach(b=>b.onclick=()=>{let c=getCart(); const i=c.find(x=>x.id===b.dataset.id); if(i){const p=getProducts().find(x=>x.id===i.id); if(p&&p.quantity!=='unlimited'&&i.quantity>=p.quantity){alert('Not enough stock');return} i.quantity++; saveCart(c); updateCartDisplay()}});
    cont.querySelectorAll('.remove-btn').forEach(b=>b.onclick=()=>{saveCart(getCart().filter(x=>x.id!==b.dataset.id)); updateCartDisplay()});
}

/* ==================== 8.  CHECKOUT  ==================== */
async function checkout(){
    const shift=getActiveShift(); if(!shift){alert('Start a shift first');return}
    const cart=getCart(); if(!cart.length){alert('Cart is empty');return}
    const pay=document.querySelector('input[name="payment"]:checked')?.value; if(!pay){alert('Pick payment method');return}
    const prods=getProducts();
    for(const it of cart){const p=prods.find(x=>x.id===it.id); if(p&&p.quantity!=='unlimited'&&p.quantity<it.quantity){alert(`Not enough stock for ${p.name}`);return}}
    const sale={id:'sale_'+Date.now(),date:new Date().toISOString(),items:cart.map(i=>({productId:i.id,name:i.name,price:i.price,quantity:i.quantity})),total:cart.reduce((s,i)=>s+i.price*i.quantity,0),paymentMethod:pay,shiftId:shift.id};
    if(USE_POCKETBASE&&navigator.onLine){
        for(const it of sale.items){const p=prods.find(x=>x.id===it.productId); if(p&&p.quantity!=='unlimited'){const nq=p.quantity-it.quantity; await pbUpdateProduct(p.id,{quantity:nq}); p.quantity=nq}}
        await pbSaveSale(sale);
    }
    cart.forEach(it=>{const p=prods.find(x=>x.id===it.id); if(p&&p.quantity!=='unlimited')p.quantity-=it.quantity});
    saveProducts(prods); const sales=getSales(); sales.push(sale); saveSales(sales);
    shift.sales?shift.sales.push(sale.id):shift.sales=[sale.id]; shift.total=(shift.total||0)+sale.total; pay==='cash'?shift.cashTotal=(shift.cashTotal||0)+sale.total:shift.momoTotal=(shift.momoTotal||0)+sale.total;
    saveActiveShift(shift); saveCart([]); updateCartDisplay(); loadProducts(); loadReceipts(); updateShiftDisplay(); showReceipt(sale);
    alert('✅ Sale completed');
}

/* ==================== 9.  SALES / RECEIPTS UI  ==================== */
function getSales(){return safeParse(LS_SALES)} function saveSales(s){safeSave(LS_SALES,s)}
async function loadReceipts(){
    const list=document.getElementById('receipts-list'); if(!list)return;
    const filter=document.getElementById('receipt-date-filter')?.value;
    let sales=getSales();
    if(USE_POCKETBASE&&navigator.onLine){const pbSales=await pbLoadSales(); const merged=[...sales]; pbSales.forEach(ps=>{if(!merged.some(ls=>ls.id===ps.id))merged.push(ps)}); saveSales(merged); sales=merged}
    list.innerHTML='';
    const filt=filter?sales.filter(s=>s.date?.split('T')[0]===filter):sales;
    if(!filt.length){list.innerHTML='<p class="no-receipts">No receipts</p>';return}
    filt.sort((a,b)=>new Date(b.date)-new Date(a.date));
    filt.forEach(s=>{
        const div=document.createElement('div'); div.className='receipt-item';
        const cnt=s.items?.reduce((a,it)=>a+it.quantity,0)||0;
        div.innerHTML=`<div class="receipt-header"><span class="receipt-id">#${s.id.slice(-6)}</span><span class="receipt-date">${new Date(s.date).toLocaleString()}</span></div><div class="receipt-details"><span class="receipt-total">${s.total} RWF</span><span class="receipt-payment">${s.paymentMethod?.toUpperCase()}</span><span class="receipt-items">${cnt} items</span></div>`;
        div.onclick=()=>showReceipt(s); list.appendChild(div);
    });
}
function showReceipt(sale){
    const modal=document.getElementById('receipt-modal'),content=document.getElementById('receipt-content'); if(!modal||!content)return;
    let rows=''; if(sale.items?.length){sale.items.forEach(it=>{rows+=`<tr><td>${escapeHtml(it.name)}</td><td>${it.quantity}</td><td>${it.price} RWF</td><td>${it.price*it.quantity} RWF</td></tr>`});}else rows='<tr><td colspan="4">No items</td></tr>';
    content.innerHTML=`<h2>Receipt #${sale.id.slice(-6)}</h2><p>${new Date(sale.date).toLocaleString()}</p><table class="receipt-table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3" style="text-align:right"><strong>Grand Total</strong></td><td><strong>${sale.total} RWF</strong></td></tr></tfoot></table><div class="receipt-actions"><p><strong>Payment Method:</strong> ${sale.paymentMethod?.toUpperCase()}</p><button id="copy-receipt-btn" class="btn">Copy Receipt</button></div>`;
    document.querySelector('.close').onclick=()=>modal.style.display='none';
    document.getElementById('copy-receipt-btn').onclick=()=>{const t=`Receipt #${sale.id.slice(-6)}\nDate: ${new Date(sale.date).toLocaleString()}\n\n${sale.items.map(i=>`${i.name} - ${i.quantity} × ${i.price} RWF = ${i.price*i.quantity} RWF`).join('\n')}\n\nTotal: ${sale.total} RWF\nPayment: ${sale.paymentMethod?.toUpperCase()}`; navigator.clipboard.writeText(t).then(()=>alert('Receipt copied')).catch(()=>alert('Copy failed'));};
    modal.style.display='block';
}

/* ==================== 10.  EXPENSES UI  ==================== */
function getExpenses(){return safeParse(LS_EXPENSES)} function saveExpenses(e){safeSave(LS_EXPENSES,e)}
async function loadExpenses(){
    const list=document.getElementById('expenses-list'); if(!list)return;
    let ex=getExpenses();
    if(USE_POCKETBASE&&navigator.onLine){const pbEx=await pbLoadExpenses(); const merged=[...ex]; pbEx.forEach(pe=>{if(!merged.some(le=>le.id===pe.id))merged.push(pe)}); saveExpenses(merged); ex=merged}
    list.innerHTML=''; if(!ex.length){list.innerHTML='<p>No expenses</p>';return}
    ex.sort((a,b)=>new Date(b.date)-new Date(a.date));
    ex.forEach(x=>{
        const div=document.createElement('div'); div.className='expense-item'+(x.amount?'':' note-only');
        div.innerHTML=`<div class="expense-header"><span class="expense-name">${x.name||'Note'}</span>${x.amount?`<span class="expense-amount">${x.amount} RWF</span>`:''}</div>${x.notes?`<div class="expense-notes">${escapeHtml(x.notes)}</div>`:''}<div class="expense-date">${new Date(x.date).toLocaleString()}</div><button class="delete-expense" data-id="${x.id}">Delete</button>`;
        list.appendChild(div);
    });
    list.querySelectorAll('.delete-expense').forEach(b=>b.onclick=async()=>{const id=b.dataset.id; let ex=getExpenses().filter(x=>x.id!==id); saveExpenses(ex); if(USE_POCKETBASE&&navigator.onLine)try{await pb.collection(PB_EXPENSES).delete(id)}catch(e){} loadExpenses();});
}
async function addExpense(){
    const name=document.getElementById('expense-name').value.trim();
    const amount=parseFloat(document.getElementById('expense-amount').value)||0;
    const notes=document.getElementById('expense-notes').value.trim();
    if(!name&&!notes){alert('Enter name or note');return}
    const ex={id:'exp_'+Date.now(),name:name||'Note',amount:amount,notes:notes,date:new Date().toISOString()};
    const all=[...getExpenses(),ex]; saveExpenses(all);
    if(USE_POCKETBASE&&navigator.onLine)await pbSaveExpense(ex);
    loadExpenses(); ['expense-name','expense-amount','expense-notes'].forEach(id=>document.getElementById(id).value='');
}

/* ==================== 11.  SHIFT  ==================== */
function getActiveShift(){const s=safeParse(LS_ACTIVE_SHIFT); return s.length?s[0]:null}
function saveActiveShift(sh){safeSave(LS_ACTIVE_SHIFT,sh?[sh]:[])}
function getShiftHistory(){return safeParse(LS_SHIFT_HISTORY)}
function saveShiftHistory(h){safeSave(LS_SHIFT_HISTORY,h)}
function startShift(){
    const cashier=prompt('Cashier name:','Cashier')||'Cashier';
    const cash=parseFloat(prompt('Starting cash:','0'))||0;
    const shift={id:'shift_'+Date.now(),startTime:new Date().toISOString(),endTime:null,cashier,cashTotal:0,momoTotal:0,total:0,startingCash:cash,sales:[],refunds:[],expenses:[]};
    saveActiveShift(shift); updateShiftDisplay(); alert(`Shift #${shift.id.slice(-6)} started`);
}
function endShift(){
    const sh=getActiveShift(); if(!sh){alert('No active shift');return}
    if(getCart().length&&!confirm('Cart not empty. End anyway?'))return;
    sh.endTime=new Date().toISOString();
    const hist=getShiftHistory(); hist.push(sh); saveShiftHistory(hist); saveActiveShift(null);
    updateShiftDisplay();
    alert(`Shift ended\nCashier: ${sh.cashier}\nTotal: ${sh.total} RWF\nCash: ${sh.cashTotal} RWF\nMoMo: ${sh.momoTotal} RWF`);
}
function updateShiftDisplay(){
    const status=document.getElementById('shift-status'),start=document.getElementById('start-shift-btn'),end=document.getElementById('end-shift-btn'),summary=document.getElementById('shift-summary');
    if(!status)return;
    const sh=getActiveShift();
    if(sh){
        status.textContent=`Shift ON (#${sh.id.slice(-6)})`; status.className='shift-status shift-on';
        if(start)start.style.display='none'; if(end)end.style.display='inline-block';
        if(summary)summary.innerHTML=`<div class="shift-info"><p><strong>Cashier:</strong> ${sh.cashier}</p><p><strong>Started:</strong> ${new Date(sh.startTime).toLocaleString()}</p><p><strong>Sales:</strong> ${sh.sales.length} | <strong>Total:</strong> ${sh.total} RWF</p><p><strong>Cash:</strong> ${sh.cashTotal} RWF | <strong>MoMo:</strong> ${sh.momoTotal} RWF</p></div>`;
        const btn=document.getElementById('checkout-btn'); if(btn)btn.disabled=false;
    }else{
        status.textContent='Shift: OFF'; status.className='shift-status shift-off';
        if(start)start.style.display='inline-block'; if(end)end.style.display='none';
        if(summary)summary.innerHTML='';
        const btn=document.getElementById('checkout-btn'); if(btn)btn.disabled=true;
    }
}

/* ==================== 12.  SUMMARY  ==================== */
function loadSummary(){
    const cont=document.getElementById('summary-content'); if(!cont)return;
    const start=document.getElementById('start-date')?.value;
    const end=document.getElementById('end-date')?.value;
    let sales=getSales();
    const filt=sales.filter(s=>{const d=s.date?.split('T')[0]; return(!start||d>=start)&&(!end||d<=end)});
    cont.innerHTML='';
    if(!filt.length){cont.innerHTML='<p class="no-summary">No sales for period</p>';return}
    const cash=filt.filter(s=>s.paymentMethod==='cash').reduce((a,s)=>a+s.total,0);
    const momo=filt.filter(s=>s.paymentMethod==='momo').reduce((a,s)=>a+s.total,0);
    const grand=cash+momo;
    const breakdown={};
    filt.forEach(s=>s.items?.forEach(i=>{breakdown[i.name]=(breakdown[i.name]||{q:0,p:i.price,t:0}); breakdown[i.name].q+=i.quantity; breakdown[i.name].t+=i.price*i.quantity}));
    let rows=''; for(const[name,d] of Object.entries(breakdown)) rows+=`<tr><td>${escapeHtml(name)}</td><td>${d.q}</td><td>${d.p} RWF</td><td>${d.t} RWF</td></tr>`;
    cont.innerHTML=`<div class="summary-card"><h3>Sales Summary</h3><div class="summary-row"><span>Date range:</span><span>${start||'Start'} to ${end||'End'}</span></div><div class="summary-row"><span>Transactions:</span><span>${filt.length}</span></div><div class="summary-row"><span>Cash sales:</span><span>${cash.toFixed(2)} RWF</span></div><div class="summary-row"><span>MoMo sales:</span><span>${momo.toFixed(2)} RWF</span></div><div class="summary-row"><span><strong>Grand total:</strong></span><span><strong>${grand.toFixed(2)} RWF</strong></span></div></div><div class="summary-card"><h3>Item breakdown</h3><table class="summary-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ==================== 13.  STOCK UI  ==================== */
function loadStockItems(){
    const cont=document.getElementById('stock-items'); if(!cont)return;
    const prods=getProducts(); cont.innerHTML='';
    if(!prods.length){cont.innerHTML='<p>No items in stock</p>';return}
    prods.forEach(p=>{
        const div=document.createElement('div'); div.className='stock-item';
        const stock=p.quantity==='unlimited'?'Unlimited':p.quantity;
        const low=(p.quantity!=='unlimited'&&p.quantity<5)?'low-stock':'';
        div.innerHTML=`<div class="stock-item-info"><div class="stock-item-name">${escapeHtml(p.name)}</div><div class="stock-item-details"><span>Price: ${p.price} RWF</span><span class="${low}">Stock: ${stock}</span></div></div><div class="stock-item-actions"><button class="edit-btn" data-id="${p.id}">Edit</button><button class="delete-btn" data-id="${p.id}">Delete</button></div>`;
        cont.appendChild(div);
    });
    cont.querySelectorAll('.edit-btn').forEach(b=>b.onclick=()=>editStockItem(b.dataset.id));
    cont.querySelectorAll('.delete-btn').forEach(b=>b.onclick=()=>deleteStockItem(b.dataset.id));
}
async function editStockItem(id){
    const prods=getProducts(),p=prods.find(x=>x.id===id); if(!p){alert('Not found');return}
    const name=prompt('Name:',p.name); if(name===null)return;
    const price=parseFloat(prompt('Price:',p.price)); if(isNaN(price)){alert('Invalid price');return}
    let qty=prompt('Qty (number/unlimited):',p.quantity==='unlimited'?'unlimited':p.quantity); if(qty===null)return;
    qty=qty.toLowerCase()==='unlimited'?'unlimited':parseInt(qty); if(qty!=='unlimited'&&(isNaN(qty)||qty<0)){alert('Invalid qty');return}
    p.name=name; p.price=price; p.quantity=qty; await pbUpdateProduct(id,{name,price,quantity:qty});
    saveProducts(prods); loadStockItems(); loadProducts(); checkLowStock();
}
async function deleteStockItem(id){
    if(!confirm('Delete product?'))return; const prods=getProducts().filter(x=>x.id!==id); saveProducts(prods); await pbDeleteProduct(id); loadStockItems(); loadProducts(); checkLowStock();
}

/* ==================== 14.  LOW-STOCK WARN  ==================== */
function checkLowStock(){
    const low=getProducts().filter(p=>p.quantity!=='unlimited'&&p.quantity<5);
    if(low.length) console.warn('Low stock',low.map(x=>x.name));
}

/* ==================== 15.  INIT  ==================== */
document.addEventListener('DOMContentLoaded',()=>{
    initPocketBase();
    showNetworkStatus();
    loadProducts();
    updateCartDisplay();
    updateShiftDisplay();
    checkLowStock();
    subscribeProducts();
    bindEvents();
});

/* ==================== 16.  GLOBAL ERROR GUARD (delete after test) ==
window.addEventListener('error',e=>{console.error('💥 GLOBAL CRASH',e.message);alert('JS crash: '+e.message)});
window.addEventListener('unhandledrejection',e=>{console.error('💥 PROMISE CRASH',e.reason);alert('Promise crash: '+e.reason)});
====================================================================== */

function bindEvents(){
    document.querySelectorAll('.tab-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
            btn.classList.add('active'); document.getElementById(btn.dataset.tab).classList.add('active');
            if(btn.dataset.tab==='receipts-tab')loadReceipts();
            if(btn.dataset.tab==='expenses-tab')loadExpenses();
            if(btn.dataset.tab==='summary-tab')loadSummary();
            if(btn.dataset.tab==='stock-tab')loadStockItems();
            if(btn.dataset.tab==='shift-tab')updateShiftDisplay();
        });
    });
    document.getElementById('checkout-btn')?.addEventListener('click',checkout);
    document.getElementById('add-item-btn')?.addEventListener('click',addStockItem);
    document.getElementById('add-expense-btn')?.addEventListener('click',addExpense);
    document.getElementById('start-shift-btn')?.addEventListener('click',startShift);
    document.getElementById('end-shift-btn')?.addEventListener('click',endShift);
    document.getElementById('load-receipts-btn')?.addEventListener('click',loadReceipts);
    document.getElementById('load-summary-btn')?.addEventListener('click',loadSummary);
    document.querySelector('.close')?.addEventListener('click',()=>document.getElementById('receipt-modal').style.display='none');
    window.onclick=e=>{if(e.target.id==='receipt-modal')e.target.style.display='none'};
}

function showNetworkStatus(){
    const existing=document.getElementById('network-status');
    if(existing)existing.remove();
    const d=document.createElement('div'); d.id='network-status';
    d.style.cssText='position:fixed;bottom:10px;right:10px;padding:6px 12px;border-radius:20px;font-size:13px;font-weight:bold;color:#fff;z-index:9999;box-shadow:0 2px 6px rgba(0,0,0,.15)';
    if(!navigator.onLine){d.textContent='🔴 Offline';d.style.background='#ef4444';document.body.appendChild(d);return}
    if(USE_POCKETBASE){d.textContent='🟢 PocketBase';d.style.background='#22c55e'}else{d.textContent='🔵 Local Storage';d.style.background='#3b82f6'}
    document.body.appendChild(d); setTimeout(()=>d.style.opacity='0',2500);
}

})();   // <- end of async-IIFE
