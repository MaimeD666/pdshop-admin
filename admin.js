let products = [];
let nextProductId = 1;
let syncingProducts = new Set();
let reviews = [];

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

async function loadReviews() {
    showSyncStatus('Загрузка отзывов...', true);
    
    try {
        const snapshot = await db.collection('reviews').orderBy('date', 'desc').get();
        reviews = [];
        
        snapshot.forEach(doc => {
            reviews.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        renderReviewsTable();
        showSyncStatus('', false);
    } catch (error) {
        console.error('Ошибка загрузки отзывов:', error);
        showNotification('Ошибка загрузки отзывов из базы данных', 'error');
        reviews = [];
        showSyncStatus('', false);
    }
}

function renderReviewsTable() {
    const tbody = document.getElementById('reviews-list');
    
    tbody.innerHTML = '';
    
    if (reviews.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="6" style="text-align: center; padding: 30px;">
                <i class="fas fa-comments" style="font-size: 48px; color: #ddd; margin-bottom: 10px;"></i>
                <p>Отзывы не найдены</p>
            </td>
        `;
        tbody.appendChild(tr);
        return;
    }
    
    reviews.forEach(review => {
        const tr = document.createElement('tr');
        
        let dateStr = 'Нет даты';
        if (review.date) {
            const date = review.date.toDate ? review.date.toDate() : new Date(review.date);
            dateStr = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
        }
        
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += i <= review.rating ? '★' : '☆';
        }
        
        tr.innerHTML = `
            <td>${review.id}</td>
            <td>${review.userName || 'Неизвестный пользователь'}</td>
            <td>${dateStr}</td>
            <td><div class="review-rating">${stars}</div></td>
            <td class="review-text-cell">${review.text || ''}</td>
            <td>
                <button class="delete-review-button" data-id="${review.id}">
                    <i class="fas fa-trash"></i> Удалить
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    document.querySelectorAll('.delete-review-button').forEach(button => {
        button.addEventListener('click', function() {
            const reviewId = this.getAttribute('data-id');
            showDeleteConfirmation(reviewId);
        });
    });
}

function showDeleteConfirmation(reviewId) {
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    
    dialog.innerHTML = `
        <div class="confirm-dialog-content">
            <h3>Подтверждение удаления</h3>
            <p>Вы уверены, что хотите удалить этот отзыв? Это действие нельзя отменить.</p>
            <div class="confirm-dialog-buttons">
                <button class="secondary-button cancel-button">Отмена</button>
                <button class="primary-button confirm-button" style="background-color: #f44336;">Удалить</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector('.cancel-button').addEventListener('click', function() {
        document.body.removeChild(dialog);
    });
    
    dialog.querySelector('.confirm-button').addEventListener('click', function() {
        deleteReview(reviewId);
        document.body.removeChild(dialog);
    });
}

async function deleteReview(reviewId) {
    try {
        showSyncStatus('Удаление отзыва...', true);
        
        await db.collection('reviews').doc(reviewId).delete();
        
        reviews = reviews.filter(review => review.id !== reviewId);
        renderReviewsTable();
        
        showNotification('Отзыв успешно удален', 'success');
        showSyncStatus('', false);
    } catch (error) {
        console.error('Ошибка удаления отзыва:', error);
        showNotification('Ошибка удаления отзыва: ' + error.message, 'error');
        showSyncStatus('', false);
    }
}

async function saveProduct(product) {
    try {
        const productId = product.id.toString();
        syncingProducts.add(product.id);
        updateSyncingStatus();
        
        await db.collection('products').doc(productId).set(product);
        
        syncingProducts.delete(product.id);
        updateSyncingStatus();
        return true;
    } catch (error) {
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
        
        if (stockCell) {
            stockCell.querySelector('.stock-value').textContent = newStock;
            stockCell.classList.remove('syncing');
        }
        
        syncingProducts.delete(productId);
        updateSyncingStatus();
        return true;
    } catch (error) {
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
        
        syncingProducts.delete(productId);
        updateSyncingStatus();
        return true;
    } catch (error) {
        showNotification('Ошибка удаления товара из базы данных', 'error');
        syncingProducts.delete(productId);
        updateSyncingStatus();
        return false;
    }
}

function renderProductsTable() {
    const tbody = document.getElementById('products-list');
    const productCards = document.getElementById('products-cards');
    
    tbody.innerHTML = '';
    productCards.innerHTML = '';
    
    if (products.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="7" style="text-align: center; padding: 30px;">
                <i class="fas fa-box-open" style="font-size: 48px; color: #ddd; margin-bottom: 10px;"></i>
                <p>Товары не найдены</p>
            </td>
        `;
        tbody.appendChild(tr);
        
        const emptyCard = document.createElement('div');
        emptyCard.className = 'empty-product-card';
        emptyCard.innerHTML = `
            <i class="fas fa-box-open"></i>
            <p>Товары не найдены</p>
        `;
        productCards.appendChild(emptyCard);
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
        
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="card-header">
                <img src="${product.image}" alt="${product.title}" onerror="this.src='images/placeholder.png'">
                <div class="card-title">
                    <h3>${product.title}</h3>
                    <span class="card-id">ID: ${product.id}</span>
                </div>
            </div>
            <div class="card-details">
                <div class="card-info">
                    <div class="card-price">${product.price} ₽</div>
                    <div class="card-category">${getCategoryName(product.category)}</div>
                </div>
                <div class="card-stock" data-id="${product.id}">
                    <button class="stock-btn stock-decrease" data-id="${product.id}">-</button>
                    <span class="stock-value">${product.stock}</span>
                    <button class="stock-btn stock-increase" data-id="${product.id}">+</button>
                </div>
            </div>
            <div class="card-actions">
                <button class="edit-button" data-id="${product.id}"><i class="fas fa-edit"></i> Изменить</button>
                <button class="delete-button" data-id="${product.id}"><i class="fas fa-trash"></i> Удалить</button>
            </div>
        `;
        
        productCards.appendChild(card);
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

function toggleView(view) {
    const tableView = document.getElementById('table-view');
    const cardsView = document.getElementById('cards-view');
    const tableBtn = document.getElementById('table-view-btn');
    const cardsBtn = document.getElementById('cards-view-btn');
    
    if (view === 'table') {
        tableView.style.display = 'block';
        cardsView.style.display = 'none';
        tableBtn.classList.add('active');
        cardsBtn.classList.remove('active');
        localStorage.setItem('viewMode', 'table');
    } else {
        tableView.style.display = 'none';
        cardsView.style.display = 'block';
        cardsBtn.classList.add('active');
        tableBtn.classList.remove('active');
        localStorage.setItem('viewMode', 'cards');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const adminPanel = document.getElementById('admin-panel');
    const productFormModal = document.getElementById('product-form-modal');
    const logoutButton = document.getElementById('logout-button');
    
    logoutButton.style.display = 'none';
    
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            loginForm.style.display = 'none';
            adminPanel.style.display = 'block';
            logoutButton.style.display = 'block';
            loadProducts();
            showNotification('Вы вошли в систему', 'success');
            
            const savedViewMode = localStorage.getItem('viewMode') || 'table';
            toggleView(savedViewMode);
        } else {
            loginForm.style.display = 'block';
            adminPanel.style.display = 'none';
            logoutButton.style.display = 'none';
        }
    });
    
    document.getElementById('products-tab-btn').addEventListener('click', function() {
        document.getElementById('products-tab-btn').classList.add('active');
        document.getElementById('reviews-tab-btn').classList.remove('active');
        document.getElementById('products-tab').classList.add('active');
        document.getElementById('reviews-tab').classList.remove('active');
    });
    
    document.getElementById('reviews-tab-btn').addEventListener('click', function() {
        document.getElementById('reviews-tab-btn').classList.add('active');
        document.getElementById('products-tab-btn').classList.remove('active');
        document.getElementById('reviews-tab').classList.add('active');
        document.getElementById('products-tab').classList.remove('active');
        loadReviews();
    });
    
    document.getElementById('login-button').addEventListener('click', function() {
        const email = document.getElementById('email-input').value;
        const password = document.getElementById('password-input').value;
        
        firebase.auth().signInWithEmailAndPassword(email, password)
            .catch((error) => {
                showNotification('Ошибка входа: ' + error.message, 'error');
            });
    });
    
    document.getElementById('password-input').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            document.getElementById('login-button').click();
        }
    });
    
    logoutButton.addEventListener('click', function() {
        firebase.auth().signOut().catch((error) => {
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
    
    document.getElementById('table-view-btn').addEventListener('click', function() {
        toggleView('table');
    });
    
    document.getElementById('cards-view-btn').addEventListener('click', function() {
        toggleView('cards');
    });
});
