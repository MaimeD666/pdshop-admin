let products = [];
let nextProductId = 1;
let syncingProducts = new Set();

function showNotification(message, type = '') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification';
    
    if (type) {
        notification.classList.add(type);
    }
    
    notification.classList.add('visible');
    
    setTimeout(() => {
        notification.classList.remove('visible');
    }, 3000);
}

function showSyncStatus(message = 'Синхронизация...', isVisible = true) {
    const syncStatus = document.getElementById('sync-status');
    const syncMessage = document.getElementById('sync-message');
    
    syncMessage.textContent = message;
    
    if (isVisible) {
        syncStatus.classList.add('visible');
    } else {
        syncStatus.classList.remove('visible');
    }
}

async function loadProducts() {
    showSyncStatus('Загрузка товаров...', true);
    
    try {
        const snapshot = await db.collection('products').get();
        products = [];
        
        snapshot.forEach(doc => {
            products.push({
                id: parseInt(doc.id),
                ...doc.data()
            });
        });
        
        nextProductId = products.length > 0 
            ? Math.max(...products.map(p => p.id), 0) + 1 
            : 1;
        
        renderProductsTable();
        showSyncStatus('', false);
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        showNotification('Ошибка загрузки товаров из базы данных', 'error');
        products = [];
        showSyncStatus('', false);
    }
}

async function saveProduct(product) {
    try {
        const productId = product.id.toString();
        syncingProducts.add(product.id);
        updateSyncingStatus();
        
        await db.collection('products').doc(productId).set(product);
        
        console.log('Товар успешно сохранен:', product);
        syncingProducts.delete(product.id);
        updateSyncingStatus();
        return true;
    } catch (error) {
        console.error('Ошибка сохранения товара:', error);
        showNotification('Ошибка сохранения товара в базу данных', 'error');
        syncingProducts.delete(product.id);
        updateSyncingStatus();
        return false;
    }
}

function updateSyncingStatus() {
    if (syncingProducts.size > 0) {
        showSyncStatus(`Синхронизация (${syncingProducts.size})...`, true);
    } else {
        showSyncStatus('', false);
    }
}

async function updateProductStock(productId, newStock) {
    const product = products.find(p => p.id === productId);
    if (!product) return false;
    
    const stockCell = document.querySelector(`.stock-cell[data-id="${productId}"]`);
    if (stockCell) {
        stockCell.classList.add('syncing');
    }
    
    syncingProducts.add(productId);
    updateSyncingStatus();
    
    product.stock = newStock;
    
    try {
        await db.collection('products').doc(productId.toString()).update({
            stock: newStock
        });
        
        console.log(`Количество товара ID ${productId} обновлено на ${newStock}`);
        
        if (stockCell) {
            stockCell.querySelector('.stock-value').textContent = newStock;
            stockCell.classList.remove('syncing');
        }
        
        syncingProducts.delete(productId);
        updateSyncingStatus();
        return true;
    } catch (error) {
        console.error('Ошибка обновления количества товара:', error);
        showNotification('Ошибка обновления количества', 'error');
        
        if (stockCell) {
            stockCell.classList.remove('syncing');
        }
        
        syncingProducts.delete(productId);
        updateSyncingStatus();
        return false;
    }
}

async function deleteProductFromDB(productId) {
    try {
        syncingProducts.add(productId);
        updateSyncingStatus();
        
        await db.collection('products').doc(productId.toString()).delete();
        
        console.log('Товар успешно удален:', productId);
        syncingProducts.delete(productId);
        updateSyncingStatus();
        return true;
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        showNotification('Ошибка удаления товара из базы данных', 'error');
        syncingProducts.delete(productId);
        updateSyncingStatus();
        return false;
    }
}

function renderProductsTable() {
    const tbody = document.getElementById('products-list');
    tbody.innerHTML = '';
    
    if (products.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="7" style="text-align: center; padding: 30px;">
                <i class="fas fa-box-open" style="font-size: 48px; color: #ddd; margin-bottom: 10px;"></i>
                <p>Товары не найдены</p>
            </td>
        `;
        tbody.appendChild(tr);
        return;
    }
    
    products.forEach(product => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${product.id}</td>
            <td class="product-image-cell">
                <img src="${product.image}" alt="${product.title}" onerror="this.src='images/placeholder.png'">
            </td>
            <td>${product.title}</td>
            <td>${product.price} ₽</td>
            <td>${getCategoryName(product.category)}</td>
            <td>
                <div class="stock-cell" data-id="${product.id}">
                    <div class="stock-controls">
                        <button class="stock-btn stock-decrease" data-id="${product.id}">-</button>
                        <span class="stock-value">${product.stock}</span>
                        <button class="stock-btn stock-increase" data-id="${product.id}">+</button>
                    </div>
                </div>
            </td>
            <td class="actions-cell">
                <button class="edit-button" data-id="${product.id}"><i class="fas fa-edit"></i> Изменить</button>
                <button class="delete-button" data-id="${product.id}"><i class="fas fa-trash"></i> Удалить</button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    document.querySelectorAll('.stock-decrease').forEach(button => {
        button.addEventListener('click', function() {
            const productId = parseInt(this.getAttribute('data-id'));
            const product = products.find(p => p.id === productId);
            if (product && product.stock > 0) {
                updateProductStock(productId, product.stock - 1);
            }
        });
    });
    
    document.querySelectorAll('.stock-increase').forEach(button => {
        button.addEventListener('click', function() {
            const productId = parseInt(this.getAttribute('data-id'));
            const product = products.find(p => p.id === productId);
            if (product) {
                updateProductStock(productId, product.stock + 1);
            }
        });
    });
    
    document.querySelectorAll('.edit-button').forEach(button => {
        button.addEventListener('click', function() {
            const productId = parseInt(this.getAttribute('data-id'));
            editProduct(productId);
        });
    });
    
    document.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', function() {
            const productId = parseInt(this.getAttribute('data-id'));
            deleteProduct(productId);
        });
    });
}

function getCategoryName(categoryCode) {
    const categories = {
        'pods': 'Поды',
        'disposable': 'Одноразки',
        'liquid': 'Жидкости'
    };
    
    return categories[categoryCode] || categoryCode;
}

function showAddProductForm() {
    const modal = document.getElementById('product-form-modal');
    const formTitle = document.getElementById('product-form-title');
    const form = document.getElementById('product-form');
    const imagePreview = document.getElementById('image-preview');
    
    form.reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-image-path').value = 'images/placeholder.png';
    imagePreview.innerHTML = '';
    
    formTitle.innerHTML = '<i class="fas fa-plus"></i> Добавить товар';
    modal.style.display = 'block';
}

function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const modal = document.getElementById('product-form-modal');
    const formTitle = document.getElementById('product-form-title');
    const imagePreview = document.getElementById('image-preview');
    
    formTitle.innerHTML = '<i class="fas fa-edit"></i> Редактировать товар';
    
    document.getElementById('product-id').value = product.id;
    document.getElementById('product-title').value = product.title;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-stock').value = product.stock;
    document.getElementById('product-image-path').value = product.image;
    
    imagePreview.innerHTML = `<img src="${product.image}" alt="${product.title}" onerror="this.src='images/placeholder.png'">`;
    
    modal.style.display = 'block';
}

async function deleteProduct(productId) {
    if (confirm('Вы уверены, что хотите удалить этот товар?')) {
        const success = await deleteProductFromDB(productId);
        
        if (success) {
            products = products.filter(p => p.id !== productId);
            renderProductsTable();
            showNotification('Товар успешно удален', 'success');
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const adminPanel = document.getElementById('admin-panel');
    const productFormModal = document.getElementById('product-form-modal');
    
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            loginForm.style.display = 'none';
            adminPanel.style.display = 'block';
            loadProducts();
            showNotification('Вы вошли в систему', 'success');
        } else {
            loginForm.style.display = 'block';
            adminPanel.style.display = 'none';
        }
    });
    
    document.getElementById('login-button').addEventListener('click', function() {
        const email = document.getElementById('email-input').value;
        const password = document.getElementById('password-input').value;
        
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                showNotification('Добро пожаловать в админ-панель!', 'success');
            })
            .catch((error) => {
                showNotification('Ошибка входа: ' + error.message, 'error');
            });
    });
    
    document.getElementById('password-input').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            document.getElementById('login-button').click();
        }
    });
    
    document.getElementById('logout-button').addEventListener('click', function() {
        firebase.auth().signOut().then(() => {
            showNotification('Вы вышли из системы', 'success');
        }).catch((error) => {
            showNotification('Ошибка при выходе: ' + error.message, 'error');
        });
    });
    
    document.getElementById('add-product-button').addEventListener('click', showAddProductForm);
    
    document.getElementById('export-products-button').addEventListener('click', function() {
        const dataStr = JSON.stringify(products, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'products.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        showNotification('Экспорт успешно выполнен', 'success');
    });
    
    document.getElementById('import-products-button').addEventListener('click', function() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        
        fileInput.addEventListener('change', async function(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            showSyncStatus('Импорт товаров...', true);
            
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const importedProducts = JSON.parse(e.target.result);
                    
                    if (Array.isArray(importedProducts) && importedProducts.length > 0) {
                        for (const product of importedProducts) {
                            await saveProduct(product);
                        }
                        
                        await loadProducts();
                        showNotification('Товары успешно импортированы', 'success');
                    } else {
                        showNotification('Некорректный формат файла', 'error');
                    }
                    
                    showSyncStatus('', false);
                } catch (error) {
                    console.error('Ошибка импорта:', error);
                    showNotification('Ошибка при импорте: некорректный файл JSON', 'error');
                    showSyncStatus('', false);
                }
            };
            
            reader.readAsText(file);
        });
        
        fileInput.click();
    });
    
    document.querySelectorAll('.close-modal, .close-form-button').forEach(element => {
        element.addEventListener('click', function() {
            productFormModal.style.display = 'none';
        });
    });
    
    window.addEventListener('click', function(event) {
        if (event.target === productFormModal) {
            productFormModal.style.display = 'none';
        }
    });
    
    document.getElementById('product-image-upload').addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const imagePreview = document.getElementById('image-preview');
            imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            
            const productId = document.getElementById('product-id').value || nextProductId;
            const fileName = `product${productId}.jpg`;
            const filePath = `images/${fileName}`;
            
            document.getElementById('product-image-path').value = filePath;
            
            showNotification(`Не забудьте загрузить изображение на GitHub: ${filePath}`, 'warning');
        };
        
        reader.readAsDataURL(file);
    });
    
    document.getElementById('product-form').addEventListener('submit', async function(event) {
        event.preventDefault();
        
        showSyncStatus('Сохранение товара...', true);
        
        const productId = document.getElementById('product-id').value;
        const title = document.getElementById('product-title').value;
        const price = parseInt(document.getElementById('product-price').value);
        const category = document.getElementById('product-category').value;
        const stock = parseInt(document.getElementById('product-stock').value);
        const imagePath = document.getElementById('product-image-path').value;
        
        let product = {
            title,
            price,
            category,
            stock,
            image: imagePath
        };
        
        if (productId) {
            product.id = parseInt(productId);
        } else {
            product.id = nextProductId++;
        }
        
        const success = await saveProduct(product);
        
        if (success) {
            const index = products.findIndex(p => p.id === product.id);
            if (index !== -1) {
                products[index] = product;
                showNotification('Товар успешно обновлен', 'success');
            } else {
                products.push(product);
                showNotification('Товар успешно добавлен', 'success');
            }
            
            renderProductsTable();
            productFormModal.style.display = 'none';
        }
        
        showSyncStatus('', false);
    });
});