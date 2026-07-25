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

// --- 1. CONFIGURACIÓN (¡REEMPLAZA ESTO!) ---
const firebaseConfig = {
	apiKey: 'AIzaSyA1Rtz-0Hg89Z84Ln9-9VxXvySGvfDNcKQ',
	authDomain: 'misatajospro.firebaseapp.com',
	projectId: 'misatajospro',
	storageBucket: 'misatajospro.firebasestorage.app',
	messagingSenderId: '739840898298',
	appId: '1:739840898298:web:afd1bc727d4d75ca4c0543',
	measurementId: 'G-CM8V6M7XET',
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- VARIABLES GLOBALES ---
let groups = [];
let currentUser = null;

// Elementos DOM
const mainContainer = document.getElementById('main-container');
const btnLogin = document.getElementById('btnLogin');
const userInfo = document.getElementById('userInfo');
const userPhoto = document.getElementById('userPhoto');
const loginMessage = document.getElementById('loginMessage');
const btnAddGroup = document.getElementById('btnAddGroup');
const modal = document.getElementById('modal');

// Función para el sonido de clic (tipo iOS)


// --- 2. SISTEMA DE LOGIN ---

// Escuchar cambios de sesión (Si entra o sale)
onAuthStateChanged(auth, async (user) => {
	if (user) {
		// Usuario logueado
		currentUser = user;
		btnLogin.style.display = 'none';
		userInfo.style.display = 'flex';
		userPhoto.src = user.photoURL;
		btnAddGroup.style.display = 'block';
		loginMessage.style.display = 'none';

		console.log('Usuario conectado:', user.displayName);
		await loadDataFromCloud(); // Cargar datos de la nube
	} else {
		// Usuario desconectado
		currentUser = null;
		btnLogin.style.display = 'block';
		userInfo.style.display = 'none';
		btnAddGroup.style.display = 'none';
		loginMessage.style.display = 'block';
		mainContainer.innerHTML = ''; // Limpiar pantalla
		groups = [];
	}
});

// Botón Entrar
btnLogin.addEventListener('click', () => {
	signInWithPopup(auth, provider).catch((error) => {
		console.error('Error al entrar:', error);
	});
});

// Función Salir (Global para poder llamarla desde el HTML)
window.logout = () => {
	signOut(auth);
};

// --- 3. BASE DE DATOS (CLOUD) ---

// Cargar datos
async function loadDataFromCloud() {
	if (!currentUser) return;

	const docRef = doc(db, 'users', currentUser.uid);
	const docSnap = await getDoc(docRef);

	if (docSnap.exists()) {
		const data = docSnap.data();
		// Si el documento existe PERO el array de grupos está vacío
		if (!data.misGrupos || data.misGrupos.length === 0) {
			groups = [{ id: Date.now(), title: 'Nuevo Grupo', items: [] }];
			saveToCloud(); // Guardamos el grupo de cortesía
		} else {
			groups = data.misGrupos;
		}
	} else {
		// Si es un usuario primerizo que nunca ha entrado
		groups = [{ id: Date.now(), title: 'Bienvenido!', items: [] }];
		saveToCloud();
	}
	renderApp();
}

// Guardar datos (Esta función reemplaza al localStorage)
async function saveToCloud() {
	if (!currentUser) return;

	const docRef = doc(db, 'users', currentUser.uid);
	try {
		await setDoc(docRef, { misGrupos: groups });
		console.log('Guardado en la nube ☁️');
	} catch (e) {
		console.error('Error guardando: ', e);
	}
}

// --- 4. RENDERIZADO Y LÓGICA (CASI IGUAL QUE ANTES) ---

function renderApp() {
	mainContainer.innerHTML = '';

	groups.forEach((group) => {
		const section = document.createElement('div');
		section.className = 'group-section';
		section.setAttribute('data-group-id', group.id);

		// Aquí ponemos el título y los controles a la derecha
		section.innerHTML = `
            <div class="group-header">
                <input type="text" class="group-title" value="${group.title}" 
                       onchange="window.updateGroupTitle(${group.id}, this.value)">
                <div class="group-controls">
                    <button class="btn-group-action" onclick="window.handleAction(() => window.openModal(${group.id}))" title="Añadir Atajo">＋</button>
                    <button class="btn-group-action" onclick="window.handleAction(() => window.deleteGroup(${group.id}))" title="Borrar Grupo">🗑️</button>
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
	window.checkEditButton();
}

// Función para manejar acciones (sin sonido)
window.handleAction = (callback) => {
	callback();
};

function createCard(item) {
	const card = document.createElement('div');
	card.className = 'shortcut-card';
	card.setAttribute('data-id', item.id);
	card.setAttribute('data-name', item.name);
	card.setAttribute('data-url', item.url);

	const iconUrl = `https://www.google.com/s2/favicons?domain=${item.url}&sz=64`;

	card.innerHTML = `
        <img src="${iconUrl}" alt="icon" class="shortcut-icon" onerror="this.src='https://via.placeholder.com/64/000000/FFFFFF?text=?'">
        <span class="shortcut-name">${item.name}</span>
        <div class="card-actions">
            <button class="mini-btn btn-edit" onmousedown="event.stopPropagation()" onclick="window.prepareEdit(${item.id})">✏️</button>
            <button class="mini-btn btn-delete" onmousedown="event.stopPropagation()" onclick="window.deleteItem(${item.id})">✕</button>
        </div>
    `;

	// Lógica para click vs drag
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
		// Solo responder al clic izquierdo (button 0)
		if (!isDragging && e.button === 0 && e.target.tagName !== 'BUTTON') {
			window.open(item.url, '_blank');
		}
	});

	return card;
}

// --- 5. FUNCIONES GLOBALES (Window) ---

// Función auxiliar para guardar y pintar SIN leer el DOM (Para botones de Crear/Borrar)
function updateStateAndRender() {
	saveToCloud(); // Guarda el array 'groups' tal cual como está en memoria
	renderApp(); // Pinta la pantalla basada en ese array
}

window.createNewGroup = () => {
	// Agregamos el grupo a la memoria
	groups.push({ id: Date.now(), title: 'Nuevo Grupo', items: [] });
	// Guardamos y pintamos directo (sin leer el DOM viejo)
	updateStateAndRender();
};

window.deleteGroup = (id) => {
	if (confirm('¿Borrar grupo completo?')) {
		groups = groups.filter((g) => g.id !== id);
		updateStateAndRender();
	}
};

window.updateGroupTitle = (id, newTitle) => {
	const group = groups.find((g) => g.id === id);
	if (group) group.title = newTitle;
	// Aquí NO renderizamos para no perder el foco del input mientras escribes
	// Pero si detectamos cambio, guardamos silenciosamente en la nube
	saveToCloud();
};

// Esta función SOLO se usa para el Drag & Drop (Arrastrar y soltar)
window.saveAllState = (render = false) => {
	// Le damos un respiro al navegador para que el DOM se asiente
	setTimeout(() => {
		const sections = document.querySelectorAll('.group-section');
		const newGroupsState = [];

		sections.forEach((sec) => {
			const gId = Number(sec.getAttribute('data-group-id'));
			const titleInput = sec.querySelector('.group-title');
			const title = titleInput ? titleInput.value : 'Sin título';

			const items = [];
			// Buscamos los atajos que REALMENTE están dentro de este grid ahora
			sec.querySelectorAll('.shortcut-card').forEach((card) => {
				items.push({
					id: Number(card.getAttribute('data-id')),
					name: card.getAttribute('data-name'),
					url: card.getAttribute('data-url'),
				});
			});

			newGroupsState.push({ id: gId, title, items });
		});

		groups = newGroupsState;
		saveToCloud(); // Guardamos en Firebase

		if (render) renderApp();
	}, 50); // 50ms es imperceptible para el humano pero eterno para el PC
};

// --- MODAL Y CRUD DE ITEMS ---
window.openModal = (groupId) => {
	document.getElementById('shortcutId').value = '';
	document.getElementById('groupIdTarget').value = groupId;
	document.getElementById('shortcutName').value = '';
	document.getElementById('shortcutUrl').value = '';
	document.getElementById('modalTitle').innerText = 'Nuevo Atajo';
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

	if (!name || !url) return alert('Llena los datos parcero');
	if (!url.startsWith('http')) url = 'https://' + url;

	if (id) {
		// Editar existente
		groups.forEach((g) => {
			const idx = g.items.findIndex((i) => i.id == id);
			if (idx > -1) g.items[idx] = { id: Number(id), name, url };
		});
	} else {
		// Crear nuevo
		const group = groups.find((g) => g.id === gId);
		if (group) group.items.push({ id: Date.now(), name, url });
	}

	// CORRECCIÓN AQUÍ TAMBIÉN: Usar updateStateAndRender en vez de saveAllState
	updateStateAndRender();
	window.checkEditButton();
	window.closeModal();
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
		document.getElementById('modalTitle').innerText = 'Editar';
		modal.style.display = 'flex';
	}
};

window.deleteItem = (itemId) => {
	if (confirm('¿Chao atajo?')) {
		groups.forEach((g) => {
			g.items = g.items.filter((i) => i.id !== itemId);
		});
		updateStateAndRender();
		window.checkEditButton();
	}
};

// --- FUNCIÓN PARA EL MODO JIGGLE (VIBRACIÓN) ---
window.toggleEditMode = () => {
	document.body.classList.toggle('edit-mode');
	const btn = document.getElementById('btnEditMode');

	if (document.body.classList.contains('edit-mode')) {
		btn.innerText = '✅ Listo';
		btn.style.borderColor = 'var(--neon-purple)';
		btn.style.color = 'var(--neon-purple)';
	} else {
		btn.innerText = '✍️ Editar';
		btn.style.borderColor = 'var(--neon-blue)';
		btn.style.color = 'var(--neon-blue)';
	}
};

// --- FUNCIÓN PARA FILTRAR (BÚSQUEDA) ---
window.filterShortcuts = () => {
	const term = document.getElementById('searchInput').value.toLowerCase();
	const cards = document.querySelectorAll('.shortcut-card');

	cards.forEach((card) => {
		// Obtenemos el nombre que guardamos en el atributo data-name
		const name = card.getAttribute('data-name').toLowerCase();

		if (name.includes(term)) {
			card.style.display = 'flex'; // Se muestra
		} else {
			card.style.display = 'none'; // Se oculta
		}
	});
};
window.checkEditButton = () => {
	const btnEdit = document.getElementById('btnEditMode');
	if (!btnEdit) return;

	// Contamos si hay al menos un atajo en todos los grupos
	const hasShortcuts = groups.some(
		(group) => group.items && group.items.length > 0,
	);

	if (hasShortcuts) {
		btnEdit.style.display = 'block'; // O 'flex' según tu diseño
	} else {
		btnEdit.style.display = 'none';
		// Si el modo edición estaba activo y borraste el último atajo, lo apagamos
		document.body.classList.remove('edit-mode');
		btnEdit.innerText = '✍️ Editar';
		btnEdit.style.borderColor = 'var(--neon-blue)';
	}
};
