async function uploadImageToGitHub(imageFile, imageName) {
    const githubToken = localStorage.getItem('github_token');
    if (!githubToken) {
        const token = prompt(
            'Для загрузки изображений в GitHub, введите персональный токен доступа.\n' +
            'Токен должен иметь права на запись в репозиторий.\n' +
            'Он будет сохранен только в локальном хранилище вашего браузера.'
        );
        
        if (!token) {
            showNotification('Загрузка отменена: токен не предоставлен', 'error');
            return null;
        }
        
        localStorage.setItem('github_token', token);
    }
    
    let repoOwner = localStorage.getItem('github_owner');
    let repoName = localStorage.getItem('github_repo');
    let repoBranch = localStorage.getItem('github_branch') || 'main';
    
    if (!repoOwner || !repoName) {
        repoOwner = prompt('Введите имя владельца репозитория (например, "username"):');
        repoName = prompt('Введите название репозитория (например, "my-shop"):');
        repoBranch = prompt('Введите название ветки (по умолчанию "main"):', 'main');
        
        if (!repoOwner || !repoName) {
            showNotification('Загрузка отменена: данные репозитория не предоставлены', 'error');
            return null;
        }
        
        localStorage.setItem('github_owner', repoOwner);
        localStorage.setItem('github_repo', repoName);
        localStorage.setItem('github_branch', repoBranch);
    }
    
    showSyncStatus('Загрузка изображения в GitHub...', true);
    
    try {
        const base64Data = await readFileAsBase64(imageFile);
        const content = base64Data.split(',')[1];
        
        const filePath = `images/${imageName}`;
        
        let shaLatestCommit;
        try {
            const branchResponse = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/branches/${repoBranch}`, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!branchResponse.ok) {
                throw new Error(`Ошибка при получении информации о ветке: ${branchResponse.statusText}`);
            }
            
            const branchData = await branchResponse.json();
            shaLatestCommit = branchData.commit.sha;
        } catch (error) {
            showNotification(`Ошибка при получении информации о ветке: ${error.message}`, 'error');
            showSyncStatus('', false);
            return null;
        }
        
        let fileSha = null;
        try {
            const fileResponse = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${repoBranch}`, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (fileResponse.ok) {
                const fileData = await fileResponse.json();
                fileSha = fileData.sha;
            }
        } catch (error) {
            console.log('Файл не существует, будет создан новый');
        }
        
        const uploadData = {
            message: `Добавлено изображение товара: ${imageName}`,
            content: content,
            branch: repoBranch
        };
        
        if (fileSha) {
            uploadData.sha = fileSha;
        }
        
        const uploadResponse = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(uploadData)
        });
        
        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(`Ошибка загрузки: ${errorData.message}`);
        }
        
        const responseData = await uploadResponse.json();
        
        showNotification('Изображение успешно загружено в GitHub', 'success');
        showSyncStatus('', false);
        
        return filePath;
    } catch (error) {
        console.error('Ошибка загрузки в GitHub:', error);
        showNotification(`Ошибка загрузки в GitHub: ${error.message}`, 'error');
        showSyncStatus('', false);
        return null;
    }
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function clearGitHubCredentials() {
    if (confirm('Вы уверены, что хотите удалить сохраненные данные GitHub?')) {
        localStorage.removeItem('github_token');
        localStorage.removeItem('github_owner');
        localStorage.removeItem('github_repo');
        localStorage.removeItem('github_branch');
        showNotification('Данные GitHub успешно удалены', 'success');
    }
}

function addGitHubSettings() {
    const adminActions = document.querySelector('.admin-actions');
    if (!adminActions) return;
    
    const settingsButton = document.createElement('button');
    settingsButton.className = 'secondary-button';
    settingsButton.innerHTML = '<i class="fab fa-github"></i> Настройки GitHub';
    settingsButton.addEventListener('click', showGitHubSettings);
    
    adminActions.appendChild(settingsButton);
}

function showGitHubSettings() {
    let modal = document.getElementById('github-settings-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'github-settings-modal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fab fa-github"></i> Настройки GitHub</h2>
                    <span class="close-modal">&times;</span>
                </div>
                <form id="github-settings-form">
                    <div class="form-group">
                        <label for="github-token">Персональный токен доступа</label>
                        <input type="password" id="github-token" placeholder="ghp_...">
                        <small>Токен должен иметь права на запись в репозиторий</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="github-owner">Владелец репозитория</label>
                        <input type="text" id="github-owner" placeholder="username">
                    </div>
                    
                    <div class="form-group">
                        <label for="github-repo">Название репозитория</label>
                        <input type="text" id="github-repo" placeholder="repository-name">
                    </div>
                    
                    <div class="form-group">
                        <label for="github-branch">Ветка (по умолчанию main)</label>
                        <input type="text" id="github-branch" placeholder="main">
                    </div>
                    
                    <div class="form-buttons">
                        <button type="button" class="secondary-button close-form-button">Отмена</button>
                        <button type="submit" class="primary-button">Сохранить</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.close-modal').addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
        modal.querySelector('.close-form-button').addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        document.getElementById('github-settings-form').addEventListener('submit', function(event) {
            event.preventDefault();
            
            const token = document.getElementById('github-token').value;
            const owner = document.getElementById('github-owner').value;
            const repo = document.getElementById('github-repo').value;
            const branch = document.getElementById('github-branch').value || 'main';
            
            if (token) localStorage.setItem('github_token', token);
            if (owner) localStorage.setItem('github_owner', owner);
            if (repo) localStorage.setItem('github_repo', repo);
            if (branch) localStorage.setItem('github_branch', branch);
            
            showNotification('Настройки GitHub сохранены', 'success');
            modal.style.display = 'none';
            
            verifyGitHubToken();
        });
    }
    
    document.getElementById('github-token').value = localStorage.getItem('github_token') || '';
    document.getElementById('github-owner').value = localStorage.getItem('github_owner') || '';
    document.getElementById('github-repo').value = localStorage.getItem('github_repo') || '';
    document.getElementById('github-branch').value = localStorage.getItem('github_branch') || 'main';
    
    modal.style.display = 'block';
}

function verifyGitHubToken() {
    const token = localStorage.getItem('github_token');
    const owner = localStorage.getItem('github_owner');
    const repo = localStorage.getItem('github_repo');
    
    if (!token || !owner || !repo) {
        return false;
    }
    
    fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    }).then(response => {
        if (response.ok) {
            showNotification('Подключение к GitHub успешно проверено', 'success');
        } else {
            showNotification('Ошибка подключения к GitHub, проверьте настройки', 'error');
        }
    }).catch(error => {
        showNotification('Ошибка сети при подключении к GitHub', 'error');
    });
    
    return true;
}

function updateProductImageUploadHandler() {
    console.log('Инициализация обработчика изображений...');
    
    document.getElementById('product-form-modal').addEventListener('shown', function() {
        initImageUploader();
    });
    
    const checkInterval = setInterval(function() {
        const modal = document.getElementById('product-form-modal');
        if (modal && modal.style.display === 'block' && !modal._uploaderInitialized) {
            console.log('Модальное окно отображается, инициализируем загрузчик');
            initImageUploader();
            modal._uploaderInitialized = true;
        }
    }, 500);
    
    initImageUploader();
}

function initImageUploader() {
    console.log('Инициализация загрузчика изображений...');
    const imageUpload = document.getElementById('product-image-upload');
    if (!imageUpload) {
        console.log('Элемент загрузки изображения не найден');
        return;
    }
    
    if (document.querySelector('.github-upload-container')) {
        return;
    }
    
    const uploadContainer = document.createElement('div');
    uploadContainer.className = 'github-upload-container';
    uploadContainer.style.marginTop = '10px';
    uploadContainer.style.backgroundColor = '#f6f8fa';
    uploadContainer.style.border = '1px solid #e1e4e8';
    uploadContainer.style.borderRadius = '6px';
    uploadContainer.style.padding = '12px';
    uploadContainer.style.marginBottom = '15px';
    uploadContainer.innerHTML = '<p style="margin-top:0;margin-bottom:8px;color:#24292e;"><strong>Загрузка в GitHub:</strong></p>';
    
    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.className = 'primary-button';
    uploadBtn.innerHTML = '<i class="fab fa-github"></i> Загрузить в GitHub';
    uploadBtn.style.marginBottom = '10px';
    uploadBtn.disabled = imageUpload.files.length === 0;
    
    uploadContainer.appendChild(uploadBtn);
    
    const imagePath = document.getElementById('product-image-path');
    if (imagePath && imagePath.parentNode) {
        imagePath.parentNode.insertBefore(uploadContainer, imagePath);
    }
    
    imageUpload.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) {
            uploadBtn.disabled = true;
            return;
        }
        
        uploadBtn.disabled = false;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const imagePreview = document.getElementById('image-preview');
            if (imagePreview) {
                imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            }
        };
        reader.readAsDataURL(file);
    });
    
    uploadBtn.addEventListener('click', async function() {
        const file = imageUpload.files[0];
        if (!file) {
            showNotification('Выберите файл для загрузки', 'error');
            return;
        }
        
        const productId = document.getElementById('product-id').value || nextProductId;
        const fileExt = file.name.split('.').pop();
        const fileName = `product${productId}.${fileExt}`;
        
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
        
        const filePath = await uploadImageToGitHub(file, fileName);
        
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fab fa-github"></i> Загрузить в GitHub';
        
        if (filePath) {
            document.getElementById('product-image-path').value = filePath;
        }
    });
    
    console.log('Инициализация загрузчика завершена');
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализируем GitHub интеграцию...');
    
    setTimeout(function() {
        addGitHubSettings();
        updateProductImageUploadHandler();
    }, 1000);
    
    const addProductBtn = document.getElementById('add-product-button');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', function() {
            setTimeout(function() {
                initImageUploader();
            }, 500);
        });
    }
    
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('edit-button') || 
            event.target.closest('.edit-button')) {
            setTimeout(function() {
                initImageUploader();
            }, 500);
        }
    });
});