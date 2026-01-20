document.addEventListener("DOMContentLoaded", () => {
    const URL_SHEET = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ1xHdBybUQWfEzNDnZu4RoO4YR_hjaabNsacy3vLj2A_U4goBzfgI7xuVEyAep-U47wx4uMSjbojb/pub?gid=43250812&single=true&output=csv'; 
    
    cargarTema();
    actualizarfecha();
    cargarProductos(URL_SHEET);
    cargarFavoritos(); 
});

let inventarioGlobal = [];
let favoritos = []; 

async function cargarProductos(url) {
    const contenedor = document.getElementById('contenedor-productos');
    try {
        const respuesta = await fetch(url);
        const texto = await respuesta.text();
        inventarioGlobal = parsearCSV(texto);
        renderizarProductos(inventarioGlobal);
        activarFiltros();
        activarBuscador();
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

function crearTarjetaHTML(prod) {
    let media = '';
    let extra = '';
    let claseOculta = '';

    if (prod.tipo === 'video') {
        const videoId = prod.imagen.includes('v=') ? prod.imagen.split('v=')[1].split('&')[0] : prod.imagen.split('/').pop();
        media = `<iframe class="card-img" loading="lazy" src="https://www.youtube.com/embed/${videoId}" title="${prod.titulo}" frameborder="0" allowfullscreen></iframe>`;
    } else if (prod.tipo === 'addon') {
        media = `<img loading="lazy" src="${prod.imagen}" alt="${prod.titulo}" class="card-img zoom-img" onclick="abrirModal(this, '${prod.titulo}', '${prod.precio}', '${prod.categoria}')">`;
        claseOculta = 'oculto'; 
        extra = `<button class="descarga-btn" onclick="window.location.href='${prod.link_extra}'">Descargar</button>`;
    } else {
        media = `<img loading="lazy" src="${prod.imagen}" alt="${prod.titulo}" class="card-img zoom-img" onclick="abrirModal(this, '${prod.titulo}', '${prod.precio}', '${prod.categoria}')">`;
    }

    let precioFinal = prod.precio;
    if (prod.precio && prod.precio.toString().toUpperCase() !== 'GRATIS') {
        let numero = parseFloat(prod.precio.toString().replace(/[$,]/g, ''));
        if (!isNaN(numero)) precioFinal = '$' + numero.toLocaleString('es-AR', { minimumFractionDigits: 0 });
    }

    let badgeHTML = '';
    if (prod.estado) {
        const estado = prod.estado.toLowerCase().trim();
        if(estado === 'oferta') badgeHTML = '<span class="badge oferta">¡OFERTA!</span>';
        if(estado === 'nuevo') badgeHTML = '<span class="badge nuevo">NUEVO</span>';
        if(estado === 'agotado') badgeHTML = '<span class="badge agotado">SIN STOCK</span>';
        if(estado === 'escaso') badgeHTML = '<span class="badge escaso">POCA CANTIDAD</span>';
    }

    const esFavorito = favoritos.includes(prod.titulo);
    const corazon = esFavorito ? '❤️' : '🤍';
    const btnFav = `<button class="fav-btn" onclick="toggleFavorito('${prod.titulo}', this)">${corazon}</button>`;
    const textoBusqueda = `${prod.titulo} ${prod.categoria}`.toLowerCase();

    return `
        <div class="product-card mostrar ${claseOculta}" data-categoria="${prod.categoria}" data-titulo="${prod.titulo}" data-search="${textoBusqueda}">
            ${badgeHTML}
            ${btnFav}
            ${media}
            <div class="card-body">
                <h3 class="card-title">${prod.titulo}</h3>
                <div class="card-price">${precioFinal}</div>
                ${extra}
            </div>
        </div>
    `;
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
}

function activarFiltros() {
    const botones = document.querySelectorAll('.btn-filter');
    const tarjetas = document.querySelectorAll('.product-card');
    const inputBuscador = document.getElementById('buscador');

    botones.forEach(btn => {
        btn.addEventListener('click', (e) => {
            inputBuscador.value = ''; 
            botones.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            const categoriaSeleccionada = e.target.getAttribute('onclick').match(/'([^']+)'/)[1];

            tarjetas.forEach(card => {
                const cardCat = card.getAttribute('data-categoria');
                const cardTitulo = card.getAttribute('data-titulo');
                let mostrar = false;

                if (categoriaSeleccionada === 'todos') {
                    if (cardCat !== 'addons') mostrar = true;
                } else if (categoriaSeleccionada === 'favoritos') {
                    if (favoritos.includes(cardTitulo)) mostrar = true;
                } else {
                    if (cardCat === categoriaSeleccionada) mostrar = true;
                }

                if (mostrar) {
                    card.classList.remove('oculto');
                    card.classList.add('mostrar');
                } else {
                    card.classList.add('oculto');
                    card.classList.remove('mostrar');
                }
            });
        });
    });
}

let modalDataActual = {};

function abrirModal(elementoImg, titulo, precio, categoria) {
    const modal = document.getElementById("image-modal");
    const modalImg = document.getElementById("img-full");
    const captionText = document.getElementById("caption");
    
    modalDataActual = { titulo, precio };

    modal.style.display = "flex";
    
    setTimeout(() => { modal.classList.add('activo'); }, 10);

    modalImg.src = elementoImg.src;
    
    captionText.innerHTML = `
        <h3 style="margin: 10px 0; color: white;">${titulo}</h3>
        <p style="color: #7c3aed; font-size: 1.1em; font-weight: bold; margin: 0 0 15px 0;">${precio}</p>
        
        <button id="btn-share" class="action-btn share-btn" onclick="compartirProducto(event)" style="margin: 0 auto;">
            🔗 Compartir con amigos
        </button>
    `;
    
    document.body.style.overflow = "hidden";
}

function compartirProducto(e) {
    e.stopPropagation();
    
    if (navigator.share) {
        navigator.share({
            title: 'Memorie Studio',
            text: `Mira este producto: ${modalDataActual.titulo} - ${modalDataActual.precio}`,
            url: window.location.href
        })
        .then(() => console.log('Compartido con éxito'))
        .catch((error) => console.log('Error compartiendo', error));
    } else {
        alert("Tu navegador no soporta compartir nativamente. ¡Haz una captura!");
    }
}

function cerrarModal() {
    const modal = document.getElementById("image-modal");
    modal.classList.remove('activo');
    setTimeout(() => { 
        modal.style.display = "none"; 
        document.body.style.overflow = "auto";
    }, 300);
}

function activarBuscador() {
    const input = document.getElementById('buscador');
    const tarjetas = document.querySelectorAll('.product-card');
    const botones = document.querySelectorAll('.btn-filter');

    input.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase();
        
        if (termino !== '') botones.forEach(btn => btn.classList.remove('active'));
        else botones[0].classList.add('active');

        tarjetas.forEach(card => {
            const dataSearch = card.getAttribute('data-search');
            if (termino === '') {
                const cat = card.getAttribute('data-categoria');
                if (cat !== 'addons') {
                    card.classList.remove('oculto');
                    card.classList.add('mostrar');
                } else {
                    card.classList.add('oculto');
                }
            } else {
                if (dataSearch.includes(termino)) {
                    card.classList.remove('oculto');
                    card.classList.add('mostrar');
                } else {
                    card.classList.add('oculto');
                }
            }
        });
    });
}

function cargarTema() {
    const botonTema = document.getElementById('theme-toggle');
    const body = document.body;
    if (localStorage.getItem('modo') === 'oscuro') body.classList.add('dark-mode');
    
    if (botonTema) {
        botonTema.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            localStorage.setItem('modo', body.classList.contains('dark-mode') ? 'oscuro' : 'claro');
        });
    }
}

function parsearCSV(texto) {
    const lineas = texto.split('\n').filter(l => l.trim() !== '');
    const headers = lineas[0].split(',').map(h => h.trim());
    return lineas.slice(1).map(linea => {
        const valores = linea.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
        let obj = {};
        headers.forEach((h, i) => { obj[h] = valores[i] || ''; });
        return obj;
    });
}

function actualizarfecha() {
    const fecha = document.getElementById('fecha');
    if (fecha) fecha.textContent = new Date().getFullYear();
}

const btnTop = document.getElementById("btn-top");
window.onscroll = function() {
    if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
        btnTop.style.display = "block";
    } else {
        btnTop.style.display = "none";
    }
};
btnTop.addEventListener('click', () => { window.scrollTo(0, 0); });