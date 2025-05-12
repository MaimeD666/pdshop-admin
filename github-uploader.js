async function uploadImageToGitHub(imageFile, imageName) {
    const modal = document.getElementById('product-form-modal');
    const form = document.getElementById('product-form');
    
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
        });
    }
    
    document.getElementById('github-token').value = localStorage.getItem('github_token') || '';
    document.getElementById('github-owner').value = localStorage.getItem('github_owner') || '';
    document.getElementById('github-repo').value = localStorage.getItem('github_repo') || '';
    document.getElementById('github-branch').value = localStorage.getItem('github_branch') || 'main';
    
    modal.style.display = 'block';
}

function updateProductImageUploadHandler() {
    const imageUpload = document.getElementById('product-image-upload');
    if (!imageUpload) return;
    
    const oldHandler = imageUpload.onchange;
    imageUpload.onchange = null;
    
    imageUpload.addEventListener('change', async function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const imagePreview = document.getElementById('image-preview');
            imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
        
        const productId = document.getElementById('product-id').value || nextProductId;
        const fileExt = file.name.split('.').pop();
        const fileName = `product${productId}.${fileExt}`;
        
        const uploadButton = document.createElement('button');
        uploadButton.type = 'button';
        uploadButton.className = 'primary-button';
        uploadButton.style.marginTop = '10px';
        uploadButton.innerHTML = '<i class="fab fa-github"></i> Загрузить в GitHub';
        
        const imagePreview = document.getElementById('image-preview');
        
        const oldButton = imagePreview.querySelector('button');
        if (oldButton) {
            imagePreview.removeChild(oldButton);
        }
        
        imagePreview.appendChild(uploadButton);
        
        uploadButton.addEventListener('click', async function() {
            const filePath = await uploadImageToGitHub(file, fileName);
            if (filePath) {
                document.getElementById('product-image-path').value = filePath;
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        addGitHubSettings();
        updateProductImageUploadHandler();
    }, 1000);
});