document.addEventListener("DOMContentLoaded", () => {
    const URL_SHEET = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ1xHdBybUQWfEzNDnZu4RoO4YR_hjaabNsacy3vLj2A_U4goBzfgI7xuVEyAep-U47wx4uMSjbojb/pub?gid=43250812&single=true&output=csv'; 
    
    cargarTema();
    actualizarfecha();
    cargarProductos(URL_SHEET);
    cargarFavoritos(); 
});

let inventarioGlobal = [];
let favoritos = []; 

let estadoFiltros = {
    texto: '',
    categoria: 'todos',
    precioMax: null 
};

async function cargarProductos(url) {
    const contenedor = document.getElementById('contenedor-productos');
    try {
        const respuesta = await fetch(url);
        const texto = await respuesta.text();
        inventarioGlobal = parsearCSV(texto);
        renderizarProductos(inventarioGlobal);
        iniciarListeners(); 
        verificarProductoCompartido();
    } catch (error) {
        console.error("Error:", error);
        contenedor.innerHTML = '<p style="text-align:center;">Error al cargar.</p>';
    }
}

function renderizarProductos(lista) {
    const contenedor = document.getElementById('contenedor-productos');
    const htmlString = lista.map(prod => crearTarjetaHTML(prod)).join('');
    contenedor.innerHTML = htmlString;
}

function parsearPrecio(precioStr) {
    if (!precioStr) return 0;
    
    let limpio = precioStr.toString().replace('$', '').trim();
    if (limpio.toUpperCase() === 'GRATIS') return 0;

    if (limpio.includes(',')) {
        limpio = limpio.replace(/,/g, ''); 
    } 
    else if (limpio.split('.').length > 2) {
        limpio = limpio.replace(/\./g, ''); 
    }
    
    let numero = parseFloat(limpio);
    return isNaN(numero) ? 0 : numero;
}

function crearTarjetaHTML(prod) {
    let media = '';
    let extra = '';
    let claseOculta = '';

    let precioNumerico = parsearPrecio(prod.precio);
    let precioVisible = prod.precio; 

    if (precioNumerico > 0) {
        precioVisible = '$' + precioNumerico.toLocaleString('es-AR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }

    let descripcion = prod.descripcion ? prod.descripcion.replace(/^"|"$/g, '') : '';

    if (prod.tipo === 'video') {
        const videoId = prod.imagen.includes('v=') ? prod.imagen.split('v=')[1].split('&')[0] : prod.imagen.split('/').pop();
        media = `<iframe class="card-img" loading="lazy" src="https://www.youtube.com/embed/${videoId}" title="${prod.titulo}" frameborder="0" allowfullscreen></iframe>`;
    } else if (prod.tipo === 'addon') {
        media = `<img loading="lazy" src="${prod.imagen}" alt="${prod.titulo}" class="card-img zoom-img" onclick="abrirModal(this, '${prod.titulo.replace(/'/g, "\\'")}', '${precioVisible}', '${prod.categoria}', \`${descripcion}\`)">`;
        claseOculta = 'oculto'; 
        extra = `<button class="descarga-btn" onclick="window.location.href='${prod.link_extra}'">Descargar</button>`;
    } else {
        media = `<img loading="lazy" src="${prod.imagen}" alt="${prod.titulo}" class="card-img zoom-img" onclick="abrirModal(this, '${prod.titulo.replace(/'/g, "\\'")}', '${precioVisible}', '${prod.categoria}', \`${descripcion}\`)">`;
    }

    let badgeHTML = '';
    if (prod.estado) {
        const estado = prod.estado.toLowerCase().trim();
        if(estado === 'oferta') badgeHTML = '<span class="badge oferta">¡OFERTA!</span>';
        if(estado === 'nuevo') badgeHTML = '<span class="badge nuevo">NUEVO</span>';
        if(estado === 'agotado') badgeHTML = '<span class="badge agotado">SIN STOCK</span>';
        if(estado === 'escaso') badgeHTML = '<span class="badge escaso">POCO STOCK</span>';
    }

    const esFavorito = favoritos.includes(prod.titulo);
    const corazon = esFavorito ? '❤️' : '🤍';
    const btnFav = `<button class="fav-btn" onclick="toggleFavorito('${prod.titulo}', this)">${corazon}</button>`;
    const textoBusqueda = `${prod.titulo} ${prod.categoria}`.toLowerCase();

    return `
        <div class="product-card mostrar ${claseOculta}" 
             data-categoria="${prod.categoria}" 
             data-titulo="${prod.titulo}" 
             data-search="${textoBusqueda}"
             data-precio="${precioNumerico}">
            ${badgeHTML}
            ${btnFav}
            ${media}
            <div class="card-body">
                <h3 class="card-title">${prod.titulo}</h3>
                <div class="card-price">${precioVisible}</div>
                ${extra}
            </div>
        </div>
    `;
}

function iniciarListeners() {
    const inputBuscador = document.getElementById('buscador');
    const inputPrecio = document.getElementById('filtro-precio');
    const botones = document.querySelectorAll('.btn-filter');

    inputBuscador.addEventListener('input', (e) => {
        estadoFiltros.texto = e.target.value.toLowerCase();
        if(estadoFiltros.texto !== '') {
            estadoFiltros.categoria = 'todos';
            botones.forEach(b => b.classList.remove('active'));
            botones[0].classList.add('active'); 
        }
        aplicarFiltrosGlobales();
    });

    inputPrecio.addEventListener('input', (e) => {
        const valor = e.target.value;
        if (valor === '') {
            estadoFiltros.precioMax = null; 
        } else {
            estadoFiltros.precioMax = parseFloat(valor);
        }
        aplicarFiltrosGlobales();
    });

    botones.forEach(btn => {
        btn.addEventListener('click', (e) => {
            inputBuscador.value = '';
            estadoFiltros.texto = '';
            
            botones.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            const cat = e.target.getAttribute('onclick').match(/'([^']+)'/)[1];
            estadoFiltros.categoria = cat;
            aplicarFiltrosGlobales();
        });
    });
}

function aplicarFiltrosGlobales() {
    const tarjetas = document.querySelectorAll('.product-card');

    tarjetas.forEach(card => {
        const cardCat = card.getAttribute('data-categoria');
        const cardTitulo = card.getAttribute('data-titulo');
        const cardSearch = card.getAttribute('data-search');
        const cardPrecio = parseFloat(card.getAttribute('data-precio'));

        let pasaCategoria = false;
        let pasaTexto = false;
        let pasaPrecio = false;

        if (estadoFiltros.categoria === 'todos') {
            if (cardCat !== 'addons') pasaCategoria = true;
        } else if (estadoFiltros.categoria === 'favoritos') {
            if (favoritos.includes(cardTitulo)) pasaCategoria = true;
        } else {
            if (cardCat === estadoFiltros.categoria) pasaCategoria = true;
        }

        if (estadoFiltros.texto === '' || cardSearch.includes(estadoFiltros.texto)) {
            pasaTexto = true;
        }

        if (estadoFiltros.precioMax === null || cardPrecio <= estadoFiltros.precioMax) {
            pasaPrecio = true;
        }

        if (pasaCategoria && pasaTexto && pasaPrecio) {
            card.classList.remove('oculto');
            card.classList.add('mostrar');
        } else {
            card.classList.add('oculto');
            card.classList.remove('mostrar');
        }
    });
}

function cargarFavoritos() {
    const guardados = localStorage.getItem('misFavoritos');
    if (guardados) favoritos = JSON.parse(guardados);
}

function toggleFavorito(titulo, btn) {
    if (favoritos.includes(titulo)) {
        favoritos = favoritos.filter(f => f !== titulo);
        btn.innerHTML = '🤍';
    } else {
        favoritos.push(titulo);
        btn.innerHTML = '❤️';
        btn.style.transform = "scale(1.3)";
        setTimeout(() => btn.style.transform = "scale(1)", 200);
    }
    localStorage.setItem('misFavoritos', JSON.stringify(favoritos));
    if(estadoFiltros.categoria === 'favoritos') aplicarFiltrosGlobales();
}

let modalDataActual = {}; 

function abrirModal(elementoImg, titulo, precio, categoria, descripcion) {
    const modal = document.getElementById("image-modal");
    const container = document.getElementById("modal-inner");
    
    modalDataActual = { titulo, precio };
    modal.style.display = "flex";
    setTimeout(() => { modal.classList.add('activo'); }, 10);
    document.body.style.overflow = "hidden";

    const btnCompartir = `
        <button id="btn-share" class="action-btn share-btn" onclick="compartirProducto(event)" style="margin-top:20px;">
            🔗 Compartir con amigos
        </button>
    `;

    if (descripcion && descripcion.trim() !== "") {
        container.className = "modal-inner-content layout-split";
        container.innerHTML = `
            <img src="${elementoImg.src}" alt="${titulo}">
            <div class="info-container">
                <div class="modal-title">${titulo}</div>
                <div class="modal-price">${precio}</div>
                <div class="modal-description">${descripcion}</div>
                ${btnCompartir}
            </div>
        `;
    } else {
        container.className = "modal-inner-content layout-simple";
        container.innerHTML = `
            <img src="${elementoImg.src}" alt="${titulo}">
            <div style="width: 100%; margin-top: 15px;">
                <h3 style="color: white; margin-bottom: 5px;">${titulo}</h3>
                <p style="color: var(--primary); font-weight: bold; font-size: 1.2rem;">${precio}</p>
            </div>
            ${btnCompartir}
        `;
    }
}

function compartirProducto(e) {
    e.stopPropagation();
    const baseUrl = window.location.origin + window.location.pathname;
    const linkProducto = `${baseUrl}?producto=${encodeURIComponent(modalDataActual.titulo)}`;
    const textoShare = `¡Mira este producto!\n\n${modalDataActual.titulo} - ${modalDataActual.precio}\n`;

    if (navigator.share) {
        navigator.share({ title: 'Memorie Studio', text: textoShare, url: linkProducto });
    } else {
        navigator.clipboard.writeText(textoShare + "\n" + linkProducto).then(() => alert("Link copiado!"));
    }
}

function cerrarModal() {
    const modal = document.getElementById("image-modal");
    modal.classList.remove('activo');
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => { 
        modal.style.display = "none"; 
        document.body.style.overflow = "auto";
    }, 300);
}

function verificarProductoCompartido() {
    const params = new URLSearchParams(window.location.search);
    const productoBuscado = params.get('producto');
    if (productoBuscado) {
        const prod = inventarioGlobal.find(p => p.titulo === productoBuscado);
        if (prod) {
            let precioNum = parsearPrecio(prod.precio);
            let precioVis = prod.precio;
            if (precioNum > 0) {
                precioVis = '$' + precioNum.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
            }
            abrirModal({ src: prod.imagen }, prod.titulo, precioVis, prod.categoria, prod.descripcion);
        }
    }
}

function cargarTema() {
    const botonTema = document.getElementById('theme-toggle');
    const body = document.body;
    if (localStorage.getItem('modo') === 'oscuro') body.classList.add('dark-mode');
    if (botonTema) botonTema.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        localStorage.setItem('modo', body.classList.contains('dark-mode') ? 'oscuro' : 'claro');
    });
}

function actualizarfecha() {
    const fecha = document.getElementById('fecha');
    if (fecha) fecha.textContent = new Date().getFullYear();
}

const btnTop = document.getElementById("btn-top");
window.onscroll = function() {
    if(btnTop) btnTop.style.display = (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) ? "block" : "none";
};
if(btnTop) btnTop.addEventListener('click', () => { window.scrollTo(0, 0); });

function parsearCSV(texto) {
    let arr = [];
    let quote = false;
    let col = 0, row = 0;

    for (let c = 0; c < texto.length; c++) {
        let cc = texto[c], nc = texto[c+1];

        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || '';

        if (cc == '"' && quote && nc == '"') {
             arr[row][col] += cc; ++c; continue;
        }
        if (cc == '"') {
             quote = !quote; continue;
        }
        if (cc == ',' && !quote) {
             ++col; continue;
        }
        if (cc == '\r' && nc == '\n' && !quote) {
             ++row; col = 0; ++c; continue;
        }
        if (cc == '\n' && !quote) {
             ++row; col = 0; continue;
        }
        if (cc == '\r' && !quote) {
             ++row; col = 0; continue;
        }

        arr[row][col] += cc;
    }

    const headers = arr[0].map(h => h.trim());
    return arr.slice(1).filter(r => r.length > 1).map(fila => {
        let obj = {};
        headers.forEach((h, i) => {
            obj[h] = fila[i] || '';
        });
        return obj;
    });
}
