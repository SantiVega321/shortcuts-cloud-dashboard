// --- IMPORTAR LIBRERÍAS DE FIREBASE ---
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import {
	getAuth,
	signInWithPopup,
	GoogleAuthProvider,
	signOut,
	onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import {
	getFirestore,
	doc,
	getDoc,
	setDoc,
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// --- 1. CONFIGURACIÓN ---
const firebaseConfig = {
	apiKey: 'AIzaSyA1Rtz-0Hg89Z84Ln9-9VxXvySGvfDNcKQ',
	authDomain: 'misatajospro.firebaseapp.com',
	projectId: 'misatajospro',
	storageBucket: 'misatajospro.firebasestorage.app',
	messagingSenderId: '739840898298',
	appId: '1:739840898298:web:afd1bc727d4d75ca4c0543',
	measurementId: 'G-CM8V6M7XET',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- VARIABLES GLOBALES ---
let groups = [];
let currentUser = null;
let vaultCheckData = null; // Stores the encrypted 'VAULT_OK' string
let pendingVaultCallback = null;

// Elementos DOM
const mainContainer = document.getElementById('main-container');
const btnLogin = document.getElementById('btnLogin');
const userInfo = document.getElementById('userInfo');
const userPhoto = document.getElementById('userPhoto');
const loginMessage = document.getElementById('loginMessage');
const btnAddGroup = document.getElementById('btnAddGroup');
const btnVaultConfig = document.getElementById('btnVaultConfig');
const modal = document.getElementById('modal');
const vaultModal = document.getElementById('vaultModal');
const credentialsModal = document.getElementById('credentialsModal');
const iconPreview = document.getElementById('shortcutIconPreview');
const iconFile = document.getElementById('shortcutIconFile');
const iconBase64 = document.getElementById('shortcutIconBase64');
const btnRemoveIcon = document.getElementById('btnRemoveIcon');
const defaultIcon = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%231e293b'/><text x='50%' y='50%' font-size='32' fill='%23ffffff' text-anchor='middle' dy='.3em'>+</text></svg>";

// --- 1.5 LOGICA DE SUBIDA DE ICONO ---
iconPreview.addEventListener('click', () => {
    iconFile.click();
});

btnRemoveIcon.addEventListener('click', (e) => {
    e.preventDefault();
    iconBase64.value = '';
    iconPreview.src = defaultIcon;
    btnRemoveIcon.style.display = 'none';
    iconFile.value = '';
});

iconFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 128;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/webp', 0.8);
            
            iconBase64.value = dataUrl;
            iconPreview.src = dataUrl;
            btnRemoveIcon.style.display = 'block';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// --- 2. SISTEMA DE LOGIN ---
onAuthStateChanged(auth, async (user) => {
	if (user) {
		currentUser = user;
		btnLogin.style.display = 'none';
		userInfo.style.display = 'flex';
		userPhoto.src = user.photoURL;
		btnAddGroup.style.display = 'block';
		btnVaultConfig.style.display = 'block';
		loginMessage.style.display = 'none';
		console.log('User connected:', user.displayName);
		await loadDataFromCloud();
		
		// Prompt Vault on initial login if not already in session
		if (!sessionStorage.getItem('vaultPIN')) {
		    openVaultModal();
		}
	} else {
		currentUser = null;
		btnLogin.style.display = 'block';
		userInfo.style.display = 'none';
		btnAddGroup.style.display = 'none';
		btnVaultConfig.style.display = 'none';
		document.getElementById('btnEditMode').style.display = 'none';
		loginMessage.style.display = 'block';
		mainContainer.innerHTML = '';
		groups = [];
		sessionStorage.removeItem('vaultPIN');
	}
});

btnLogin.addEventListener('click', () => {
	signInWithPopup(auth, provider).catch((error) => {
		console.error('Login error:', error);
	});
});

window.logout = () => {
	signOut(auth);
};

// --- 3. BASE DE DATOS (CLOUD) ---
async function loadDataFromCloud() {
	if (!currentUser) return;
	const docRef = doc(db, 'users', currentUser.uid);
	const docSnap = await getDoc(docRef);

	if (docSnap.exists()) {
		const data = docSnap.data();
		vaultCheckData = data.vaultCheck || null;
		if (!data.misGrupos || data.misGrupos.length === 0) {
			groups = [{ id: Date.now(), title: 'New Group', items: [] }];
			saveToCloud(); // Guardamos el grupo de cortesía
		} else {
			groups = data.misGrupos;
		}
	} else {
		groups = [{ id: Date.now(), title: 'Welcome!', items: [] }];
		saveToCloud();
	}
	renderApp();
}

async function saveToCloud() {
	if (!currentUser) return;
	const docRef = doc(db, 'users', currentUser.uid);
	try {
		await setDoc(docRef, { misGrupos: groups, vaultCheck: vaultCheckData });
		console.log('Saved to cloud ☁️');
	} catch (e) {
		console.error('Error saving: ', e);
	}
}

// --- 4. VAULT (GESTIÓN DE CONTRASEÑAS) ---
window.openVaultConfig = () => {
    if (sessionStorage.getItem('vaultPIN')) {
        document.getElementById('newVaultPinInput').value = '';
        document.getElementById('changePinModal').style.display = 'flex';
        document.getElementById('newVaultPinInput').focus();
    } else {
        openVaultModal();
    }
};

window.submitNewVaultPin = () => {
    const oldPin = sessionStorage.getItem('vaultPIN');
    const newPin = document.getElementById('newVaultPinInput').value;
    
    if (newPin.length < 4) {
        alert('PIN must be at least 4 digits.');
        return;
    }
    if (newPin === oldPin) {
        alert('New PIN cannot be the same as the old one.');
        return;
    }
    
    // 1. Re-encrypt the vault check string
    vaultCheckData = CryptoJS.AES.encrypt('VAULT_OK', newPin).toString();
    
    // 2. Re-encrypt all items
    groups.forEach(g => {
        g.items.forEach(item => {
            if (item.encUser || item.encPass) {
                try {
                    let decUser = item.encUser ? CryptoJS.AES.decrypt(item.encUser, oldPin).toString(CryptoJS.enc.Utf8) : null;
                    let decPass = item.encPass ? CryptoJS.AES.decrypt(item.encPass, oldPin).toString(CryptoJS.enc.Utf8) : null;
                    
                    if (decUser) item.encUser = CryptoJS.AES.encrypt(decUser, newPin).toString();
                    if (decPass) item.encPass = CryptoJS.AES.encrypt(decPass, newPin).toString();
                } catch(e) {
                    console.error("Failed to re-encrypt item during PIN change", item);
                }
            }
        });
    });
    
    // 3. Update session and save
    sessionStorage.setItem('vaultPIN', newPin);
    document.getElementById('changePinModal').style.display = 'none';
    saveToCloud(); 
    alert('Vault PIN changed successfully! All your passwords have been re-encrypted with the new PIN.');
};

window.openVaultModal = () => {
    const title = document.getElementById('vaultModalTitle');
    const desc = document.getElementById('vaultModalDesc');
    const btn = document.getElementById('btnVaultAction');
    const input = document.getElementById('vaultPinInput');
    
    input.value = '';
    
    if (vaultCheckData) {
        title.innerText = '🔐 Unlock Vault';
        desc.innerText = 'Enter your 4-6 digit PIN to unlock your passwords.';
        btn.innerText = 'Unlock';
    } else {
        title.innerText = '🛡️ Setup Vault';
        desc.innerText = 'Create a 4-6 digit PIN to protect your passwords. Do not forget it!';
        btn.innerText = 'Create PIN';
    }
    
    vaultModal.style.display = 'flex';
    input.focus();
};

window.dismissVault = () => {
    vaultModal.style.display = 'none';
    pendingVaultCallback = null;
};

window.submitVaultPin = () => {
    const pin = document.getElementById('vaultPinInput').value;
    if (pin.length < 4) {
        alert('PIN must be at least 4 digits.');
        return;
    }
    
    if (vaultCheckData) {
        // Unlock existing vault
        try {
            const bytes = CryptoJS.AES.decrypt(vaultCheckData, pin);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            if (decrypted === 'VAULT_OK') {
                sessionStorage.setItem('vaultPIN', pin);
                vaultModal.style.display = 'none';
                if (pendingVaultCallback) {
                    pendingVaultCallback(pin);
                    pendingVaultCallback = null;
                }
            } else {
                alert('Incorrect PIN!');
            }
        } catch (e) {
            alert('Incorrect PIN!');
        }
    } else {
        // Setup new vault
        vaultCheckData = CryptoJS.AES.encrypt('VAULT_OK', pin).toString();
        sessionStorage.setItem('vaultPIN', pin);
        saveToCloud(); // Save the vaultCheckData
        vaultModal.style.display = 'none';
        if (pendingVaultCallback) {
            pendingVaultCallback(pin);
            pendingVaultCallback = null;
        }
    }
};

window.resetVault = () => {
    if (confirm('🚨 WARNING: This will permanently DELETE all encrypted passwords from your shortcuts. Are you sure you want to reset your vault?')) {
        // Clear vault check
        vaultCheckData = null;
        sessionStorage.removeItem('vaultPIN');
        
        // Remove all encrypted credentials from all items
        groups.forEach(g => {
            g.items.forEach(item => {
                delete item.encUser;
                delete item.encPass;
            });
        });
        
        saveToCloud();
        alert('Vault has been reset. You can now create a new PIN.');
        openVaultModal();
    }
};

window.requireVault = (callback) => {
    const pin = sessionStorage.getItem('vaultPIN');
    if (pin) {
        callback(pin);
    } else {
        pendingVaultCallback = callback;
        openVaultModal();
    }
};

// --- 5. RENDERIZADO Y LÓGICA ---
function renderApp() {
	mainContainer.innerHTML = '';

	groups.forEach((group) => {
		const section = document.createElement('div');
		section.className = 'group-section';
		section.setAttribute('data-group-id', group.id);

		section.innerHTML = `
            <div class="group-header">
                <div style="display: flex; align-items: center; width: 100%;">
                    <span class="group-drag-handle" title="Drag Group">☰</span>
                    <input type="text" class="group-title" value="${group.title}" 
                           onchange="window.updateGroupTitle(${group.id}, this.value)">
                </div>
                <div class="group-controls">
                    <button class="btn-group-action" onclick="window.handleAction(() => window.openModal(${group.id}))" title="Add Shortcut">＋</button>
                    <button class="btn-group-action" onclick="window.handleAction(() => window.deleteGroup(${group.id}))" title="Delete Group">🗑️</button>
                </div>
            </div>
            <div class="group-content">
                <div class="group-grid" data-group-id="${group.id}"></div>
            </div>
        `;

		const grid = section.querySelector('.group-grid');

		group.items.forEach((item) => {
			const card = createCard(item);
			grid.appendChild(card);
		});

		mainContainer.appendChild(section);

		Sortable.create(grid, {
			group: 'shared',
			animation: 250,
			ghostClass: 'sortable-ghost',
			dragClass: 'sortable-drag',
			fallbackOnBody: true,
			swapThreshold: 0.65,
			emptyInsertThreshold: 50,
			onAdd: () => window.saveAllState(false),
			onUpdate: () => window.saveAllState(false),
			onRemove: () => window.saveAllState(false),
		});
	});
	
	// Make groups draggable
	Sortable.create(mainContainer, {
		animation: 250,
		handle: '.group-drag-handle',
		ghostClass: 'sortable-ghost-group',
		onUpdate: () => window.saveAllState(false)
	});
	
	window.checkEditButton();
}

window.handleAction = (callback) => {
	callback();
};

function createCard(item) {
	const card = document.createElement('div');
	card.className = 'shortcut-card';
	card.setAttribute('data-id', item.id);
	card.setAttribute('data-name', item.name);
	card.setAttribute('data-url', item.url);

	const finalIconUrl = item.iconUrl ? item.iconUrl : `https://www.google.com/s2/favicons?domain=${item.url}&sz=64`;

    // Add a visual indicator if it has credentials
    const hasCreds = (item.encUser || item.encPass) ? '<div style="position: absolute; top: 5px; left: 5px; font-size: 10px;" title="Has Credentials">🔐</div>' : '';

	card.innerHTML = `
        ${hasCreds}
        <img src="${finalIconUrl}" alt="icon" class="shortcut-icon" style="object-fit: cover;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'64\\' height=\\'64\\'><rect width=\\'64\\' height=\\'64\\' fill=\\'%231e293b\\'/><text x=\\'50%\\' y=\\'50%\\' font-size=\\'32\\' fill=\\'%23ffffff\\' text-anchor=\\'middle\\' dy=\\'.3em\\'>?</text></svg>'">
        <span class="shortcut-name">${item.name}</span>
        <div class="card-actions">
            <button class="mini-btn btn-edit" onmousedown="event.stopPropagation()" onclick="window.prepareEdit(${item.id})">✏️</button>
            <button class="mini-btn btn-delete" onmousedown="event.stopPropagation()" onclick="window.deleteItem(${item.id})">✕</button>
        </div>
    `;

	let isDragging = false;
	let startX, startY;
	
	card.addEventListener('mousedown', (e) => {
		isDragging = false;
		startX = e.clientX;
		startY = e.clientY;
	});
	
	card.addEventListener('mousemove', (e) => {
		if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) {
			isDragging = true;
		}
	});
	
	card.addEventListener('mouseup', (e) => {
		if (!isDragging && e.target.tagName !== 'BUTTON') {
		    if (e.button === 0) {
		        // Left click: open URL
			    window.open(item.url, '_blank');
			}
		}
	});
	
	// Right click logic for credentials
	card.addEventListener('contextmenu', (e) => {
	    if (isDragging || e.target.tagName === 'BUTTON') return;
	    e.preventDefault();
	    if (item.encUser || item.encPass) {
	        window.requireVault((pin) => {
	            showCredentials(item, pin);
	        });
	    } else {
	        // Optional: show native context menu or do nothing
	        // e.preventDefault() is already called.
	    }
	});

	return card;
}

window.showCredentials = (item, pin) => {
    try {
        const uBytes = item.encUser ? CryptoJS.AES.decrypt(item.encUser, pin) : null;
        const pBytes = item.encPass ? CryptoJS.AES.decrypt(item.encPass, pin) : null;
        
        document.getElementById('credUsername').value = uBytes ? uBytes.toString(CryptoJS.enc.Utf8) : '';
        document.getElementById('credPassword').value = pBytes ? pBytes.toString(CryptoJS.enc.Utf8) : '';
        document.getElementById('credPassword').type = 'password';
        
        credentialsModal.style.display = 'flex';
    } catch (e) {
        alert('Error decrypting credentials. Your vault PIN might be incorrect or data is corrupted.');
    }
};

window.closeCredentialsModal = () => {
    credentialsModal.style.display = 'none';
};

window.copyToClipboard = (elementId) => {
    const el = document.getElementById(elementId);
    el.select();
    el.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(el.value).then(() => {
        const oldBorder = el.style.borderColor;
        el.style.borderColor = '#22c55e';
        setTimeout(() => el.style.borderColor = oldBorder, 500);
    });
};

window.togglePasswordVisibility = (elementId) => {
    const el = document.getElementById(elementId);
    if (el.type === "password") {
        el.type = "text";
    } else {
        el.type = "password";
    }
};

// --- 6. FUNCIONES GLOBALES (Window) ---
function updateStateAndRender() {
	saveToCloud(); 
	renderApp(); 
}

window.createNewGroup = () => {
	groups.push({ id: Date.now(), title: 'New Group', items: [] });
	updateStateAndRender();
};

window.deleteGroup = (id) => {
	if (confirm('Delete entire group?')) {
		groups = groups.filter((g) => g.id !== id);
		updateStateAndRender();
	}
};

window.updateGroupTitle = (id, newTitle) => {
	const group = groups.find((g) => g.id === id);
	if (group) group.title = newTitle;
	saveToCloud();
};

window.saveAllState = (render = false) => {
	setTimeout(() => {
		const sections = document.querySelectorAll('.group-section');
		const newGroupsState = [];

		sections.forEach((sec) => {
			const gId = Number(sec.getAttribute('data-group-id'));
			const titleInput = sec.querySelector('.group-title');
			const title = titleInput ? titleInput.value : 'Untitled';

			const items = [];
			sec.querySelectorAll('.shortcut-card').forEach((card) => {
			    const cId = Number(card.getAttribute('data-id'));
			    // Preserve original item properties (like encrypted creds and custom icon)
			    let originalItem = null;
			    groups.forEach(g => {
			        const found = g.items.find(i => i.id === cId);
			        if (found) originalItem = found;
			    });
			    
			    const newItem = {
					id: cId,
					name: card.getAttribute('data-name'),
					url: card.getAttribute('data-url')
				};
				
				// Fix the undefined bug by only adding properties if they exist
				if (originalItem && originalItem.iconUrl) newItem.iconUrl = originalItem.iconUrl;
				if (originalItem && originalItem.encUser) newItem.encUser = originalItem.encUser;
				if (originalItem && originalItem.encPass) newItem.encPass = originalItem.encPass;
				
				items.push(newItem);
			});

			newGroupsState.push({ id: gId, title, items });
		});

		groups = newGroupsState;
		saveToCloud(); 

		if (render) renderApp();
	}, 50); 
};

// --- MODAL Y CRUD DE ITEMS ---
window.openModal = (groupId) => {
	document.getElementById('shortcutId').value = '';
	document.getElementById('groupIdTarget').value = groupId;
	document.getElementById('shortcutName').value = '';
	document.getElementById('shortcutUrl').value = '';
	document.getElementById('shortcutIconBase64').value = '';
	document.getElementById('shortcutIconPreview').src = defaultIcon;
	document.getElementById('btnRemoveIcon').style.display = 'none';
	document.getElementById('shortcutIconFile').value = '';
	document.getElementById('shortcutUser').value = '';
	document.getElementById('shortcutPass').value = '';
	document.getElementById('modalTitle').innerText = 'New Shortcut';
	modal.style.display = 'flex';
};

window.closeModal = () => {
	modal.style.display = 'none';
};

window.saveShortcut = () => {
	const id = document.getElementById('shortcutId').value;
	const gId = Number(document.getElementById('groupIdTarget').value);
	const name = document.getElementById('shortcutName').value;
	let url = document.getElementById('shortcutUrl').value;
	const iconUrl = document.getElementById('shortcutIconBase64').value;
	const user = document.getElementById('shortcutUser').value;
	const pass = document.getElementById('shortcutPass').value;

	if (!name || !url) return alert('Please fill in Name and URL');
	if (!url.startsWith('http')) url = 'https://' + url;

    const performSave = (pin) => {
        let encUser, encPass;
        if (pin && (user || pass)) {
            if (user) encUser = CryptoJS.AES.encrypt(user, pin).toString();
            if (pass) encPass = CryptoJS.AES.encrypt(pass, pin).toString();
        }

    	if (id) {
    		// Editar existente
    		groups.forEach((g) => {
    			const idx = g.items.findIndex((i) => i.id == id);
    			if (idx > -1) {
    			    // Build object cleanly to avoid undefined properties crashing Firebase
    			    const updatedItem = {
    			        id: Number(id),
    			        name,
    			        url
    			    };
    			    if (iconUrl) updatedItem.iconUrl = iconUrl;
    			    
    			    // If we provided new creds, update them.
    			    if (user || pass) {
    			        if (encUser) updatedItem.encUser = encUser;
    			        if (encPass) updatedItem.encPass = encPass;
    			    } else {
                        // If fields are empty, preserve old creds UNLESS vault is unlocked (intentional clear)
                        if (!sessionStorage.getItem('vaultPIN')) {
                            if (g.items[idx].encUser) updatedItem.encUser = g.items[idx].encUser;
                            if (g.items[idx].encPass) updatedItem.encPass = g.items[idx].encPass;
                        }
                    }
    			    
    			    g.items[idx] = updatedItem;
    			}
    		});
    	} else {
    		// Crear nuevo
    		const group = groups.find((g) => g.id === gId);
    		if (group) {
    		    const newItem = { id: Date.now(), name, url };
    		    if (iconUrl) newItem.iconUrl = iconUrl;
    		    if (encUser) newItem.encUser = encUser;
    		    if (encPass) newItem.encPass = encPass;
    		    
    		    group.items.push(newItem);
    		}
    	}

    	updateStateAndRender();
    	window.checkEditButton();
    	window.closeModal();
    };

    if (user || pass) {
        window.requireVault(performSave);
    } else {
        performSave(null);
    }
};

window.prepareEdit = (itemId) => {
	let item = null;
	groups.forEach((g) => {
		const found = g.items.find((i) => i.id === itemId);
		if (found) item = found;
	});
	if (item) {
		document.getElementById('shortcutId').value = item.id;
		document.getElementById('shortcutName').value = item.name;
		document.getElementById('shortcutUrl').value = item.url;
		
		if (item.iconUrl) {
		    document.getElementById('shortcutIconBase64').value = item.iconUrl;
		    document.getElementById('shortcutIconPreview').src = item.iconUrl;
		    document.getElementById('btnRemoveIcon').style.display = 'block';
		} else {
		    document.getElementById('shortcutIconBase64').value = '';
		    document.getElementById('shortcutIconPreview').src = defaultIcon;
		    document.getElementById('btnRemoveIcon').style.display = 'none';
		}
		
		const uInput = document.getElementById('shortcutUser');
		const pInput = document.getElementById('shortcutPass');
		uInput.value = '';
		pInput.value = '';
		
		document.getElementById('modalTitle').innerText = 'Edit Shortcut';
		
		const openEditModal = (pin) => {
		    if (pin && (item.encUser || item.encPass)) {
		        try {
		            if (item.encUser) uInput.value = CryptoJS.AES.decrypt(item.encUser, pin).toString(CryptoJS.enc.Utf8);
		            if (item.encPass) pInput.value = CryptoJS.AES.decrypt(item.encPass, pin).toString(CryptoJS.enc.Utf8);
		        } catch(e) {
		            console.error("Failed to decrypt for edit");
		        }
		    }
		    modal.style.display = 'flex';
		};
		
		if (item.encUser || item.encPass) {
		    window.requireVault(openEditModal);
		} else {
		    openEditModal(null);
		}
	}
};

window.deleteItem = (itemId) => {
	if (confirm('Delete shortcut?')) {
		groups.forEach((g) => {
			g.items = g.items.filter((i) => i.id !== itemId);
		});
		updateStateAndRender();
		window.checkEditButton();
	}
};

window.toggleEditMode = () => {
	document.body.classList.toggle('edit-mode');
	const btn = document.getElementById('btnEditMode');

	if (document.body.classList.contains('edit-mode')) {
		btn.innerText = '✅ Done';
		btn.style.borderColor = 'var(--neon-purple)';
		btn.style.color = 'var(--neon-purple)';
	} else {
		btn.innerText = '✍️ Edit';
		btn.style.borderColor = 'var(--neon-blue)';
		btn.style.color = 'var(--neon-blue)';
	}
};

window.filterShortcuts = () => {
	const term = document.getElementById('searchInput').value.toLowerCase();
	const cards = document.querySelectorAll('.shortcut-card');

	cards.forEach((card) => {
		const name = card.getAttribute('data-name').toLowerCase();

		if (name.includes(term)) {
			card.style.display = 'flex';
		} else {
			card.style.display = 'none';
		}
	});
};

window.checkEditButton = () => {
	const btnEdit = document.getElementById('btnEditMode');
	if (!btnEdit) return;

	const hasShortcuts = groups.some(
		(group) => group.items && group.items.length > 0,
	);

	if (hasShortcuts) {
		btnEdit.style.display = 'block'; 
	} else {
		btnEdit.style.display = 'none';
		document.body.classList.remove('edit-mode');
		btnEdit.innerText = '✍️ Edit';
		btnEdit.style.borderColor = 'var(--neon-blue)';
	}
};
