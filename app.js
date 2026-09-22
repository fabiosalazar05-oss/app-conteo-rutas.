// Estado de la aplicación
let state = {
    vallas: { enRuta: 0, dejadas: 0, recogidas: 0 },
    bombonas: { enRuta: 0, dejadas: 0, recogidas: 0 },
    maletas: { enRuta: 0, dejadas: 0, recogidas: 0 },
    acciones: [], // Guarda { id, item, accion, lat, lng, timestamp }
    historial: [] // Guarda las rutas terminadas
};

let map;
let markers = [];
let currentLocation = null;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    cargarEstado();
    actualizarUI();
    inicializarMapa();
    
    document.getElementById('btn-nuevo-recorrido').addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres terminar la ruta actual y guardarla en el historial? El mapa se limpiará para un nuevo recorrido.')) {
            reiniciarRecorrido();
        }
    });
});

function cargarEstado() {
    const savedState = localStorage.getItem('appConteoState');
    if (savedState) {
        let parsed = JSON.parse(savedState);
        // Migración de formato antiguo a nuevo si es necesario
        if (typeof parsed.vallas === 'number') {
            state = {
                vallas: { enRuta: parsed.vallas, dejadas: parsed.vallas, recogidas: 0 },
                bombonas: { enRuta: parsed.bombonas, dejadas: parsed.bombonas, recogidas: 0 },
                maletas: { enRuta: parsed.maletas, dejadas: parsed.maletas, recogidas: 0 },
                acciones: parsed.acciones || [],
                historial: []
            };
        } else {
            state = parsed;
            if (!state.historial) state.historial = [];
        }
    }
}

function guardarEstado() {
    localStorage.setItem('appConteoState', JSON.stringify(state));
    
    // Mostrar indicador de autoguardado
    const indicator = document.getElementById('save-indicator');
    if (indicator) {
        indicator.style.opacity = '1';
        setTimeout(() => {
            indicator.style.opacity = '0';
        }, 2000);
    }
}

function actualizarUI() {
    const items = ['vallas', 'bombonas', 'maletas'];
    items.forEach(item => {
        let elEnRuta = document.getElementById(`count-${item}-enruta`);
        let elDejadas = document.getElementById(`count-${item}-dejadas`);
        let elRecogidas = document.getElementById(`count-${item}-recogidas`);
        
        if (elEnRuta) elEnRuta.innerText = state[item].enRuta;
        if (elDejadas) elDejadas.innerText = state[item].dejadas;
        if (elRecogidas) elRecogidas.innerText = state[item].recogidas;
    });
}

async function reiniciarRecorrido() {
    // Verificar si hay algo que guardar
    if (state.vallas.dejadas === 0 && state.bombonas.dejadas === 0 && state.maletas.dejadas === 0) {
        limpiarYReiniciar();
        return;
    }

    // Cambiar texto de botón temporalmente
    const btn = document.getElementById('btn-nuevo-recorrido');
    const textoOriginal = btn.innerText;
    btn.innerText = "Tomando foto...";
    btn.disabled = true;

    try {
        // Tomar foto del mapa
        const mapElement = document.getElementById('map');
        const canvas = await html2canvas(mapElement, { 
            useCORS: true,
            allowTaint: false,
            scale: 1 // escala 1 para no hacer la imagen demasiado pesada
        });
        
        // Comprimir imagen a JPEG 60% calidad para que quepa en localStorage
        const imagenBase64 = canvas.toDataURL('image/jpeg', 0.6);

        // Guardar la ruta actual en el historial
        const fecha = new Date().toLocaleString();
        const resumen = {
            fecha: fecha,
            vallas: { ...state.vallas },
            bombonas: { ...state.bombonas },
            maletas: { ...state.maletas },
            foto: imagenBase64
        };
        
        state.historial.unshift(resumen);
        
        // Mantener solo los últimos 20 historiales para no llenar la memoria
        if (state.historial.length > 20) {
            state.historial.pop();
        }

    } catch (e) {
        console.error("Error tomando la foto:", e);
        alert("Hubo un error tomando la foto del mapa, pero los datos se guardarán igual.");
        
        const fecha = new Date().toLocaleString();
        const resumen = {
            fecha: fecha,
            vallas: { ...state.vallas },
            bombonas: { ...state.bombonas },
            maletas: { ...state.maletas },
            foto: null
        };
        state.historial.unshift(resumen);
    }

    btn.innerText = textoOriginal;
    btn.disabled = false;
    
    limpiarYReiniciar();
}

function limpiarYReiniciar() {
    // 2. Reiniciar contadores
    state.vallas = { enRuta: 0, dejadas: 0, recogidas: 0 };
    state.bombonas = { enRuta: 0, dejadas: 0, recogidas: 0 };
    state.maletas = { enRuta: 0, dejadas: 0, recogidas: 0 };
    state.acciones = [];
    
    guardarEstado();
    actualizarUI();
    
    // Limpiar marcadores del mapa
    markers.forEach(m => map.removeLayer(m.marker || m));
    markers = [];
}

// === Lógica del Historial ===
function abrirHistorial() {
    document.getElementById('modal-historial').style.display = 'flex';
    renderizarHistorial();
}

function cerrarHistorial() {
    document.getElementById('modal-historial').style.display = 'none';
}

function renderizarHistorial() {
    const lista = document.getElementById('historial-lista');
    lista.innerHTML = '';
    
    if (state.historial.length === 0) {
        lista.innerHTML = '<p style="text-align:center; color:#6b7280; margin-top: 20px;">Aún no hay rutas guardadas.</p>';
        return;
    }
    
    state.historial.forEach((ruta, index) => {
        const div = document.createElement('div');
        div.className = 'historial-card';
        
        let imgHTML = '';
        if (ruta.foto) {
            imgHTML = `<img src="${ruta.foto}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 12px; border: 1px solid #e5e7eb;">`;
        }
        
        div.innerHTML = `
            <div class="historial-fecha">Ruta: ${ruta.fecha}</div>
            ${imgHTML}
            <div class="historial-detalle">
                <b>Vallas:</b> ${ruta.vallas.dejadas} dejadas, ${ruta.vallas.recogidas} recogidas<br>
                <b>Bombonas:</b> ${ruta.bombonas.dejadas} dejadas, ${ruta.bombonas.recogidas} recogidas<br>
                <b>Maletas:</b> ${ruta.maletas.dejadas} dejadas, ${ruta.maletas.recogidas} recogidas
            </div>
            <button class="btn-share" onclick="compartirReporte(${index})">
                📲 Compartir por WhatsApp
            </button>
        `;
        lista.appendChild(div);
    });
}

function compartirReporte(index) {
    const ruta = state.historial[index];
    const texto = `📍 *REPORTE DE RUTA*\n📅 Fecha: ${ruta.fecha}\n\n🚧 *Vallas:*\n- Dejadas: ${ruta.vallas.dejadas}\n- Recogidas: ${ruta.vallas.recogidas}\n\n🛢️ *Bombonas:*\n- Dejadas: ${ruta.bombonas.dejadas}\n- Recogidas: ${ruta.bombonas.recogidas}\n\n🧳 *Maletas:*\n- Dejadas: ${ruta.maletas.dejadas}\n- Recogidas: ${ruta.maletas.recogidas}\n\n_Reporte generado desde App de Conteo._`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Reporte de Ruta',
            text: texto
        }).catch(err => console.error('Error compartiendo:', err));
    } else {
        // Fallback para navegadores antiguos o computadoras
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
        window.open(url, '_blank');
    }
}


function inicializarMapa() {
    // Inicializar mapa centrado en un punto por defecto (Cali, Colombia)
    map = L.map('map').setView([3.4516, -76.5320], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Intentar obtener la ubicación real del usuario
    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                // Centrar el mapa en la primera carga si no hay acciones previas
                if (state.acciones.length === 0 && markers.length === 0) {
                    map.setView([currentLocation.lat, currentLocation.lng], 16);
                }
            },
            (error) => {
                console.error("Error obteniendo ubicación:", error);
            },
            { enableHighAccuracy: true }
        );
    } else {
        alert("Tu navegador no soporta geolocalización");
    }

    // Dibujar marcadores guardados
    state.acciones.forEach(accion => {
        agregarMarcadorAlMapa(accion);
    });
}

function registrarAccion(item, accionType) {
    if (!currentLocation) {
        alert("Aún no tenemos tu ubicación GPS. Asegúrate de tener el GPS activado y dar permisos al navegador.");
        return;
    }

    if (accionType === 'dejar') {
        state[item].enRuta++;
        state[item].dejadas++;
        const nuevaAccion = {
            id: Date.now() + Math.random(),
            item: item,
            accion: 'dejar',
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            timestamp: new Date().toISOString()
        };
        state.acciones.push(nuevaAccion);
        agregarMarcadorAlMapa(nuevaAccion);
    } else if (accionType === 'recoger') {
        if (state[item].enRuta > 0) {
            let dejados = state.acciones.filter(a => a.item === item && a.accion === 'dejar');
            if (dejados.length > 0) {
                let masCercano = dejados[0];
                let menorDistancia = Infinity;
                
                let currentLatLng = L.latLng(currentLocation.lat, currentLocation.lng);
                
                dejados.forEach(a => {
                    let aLatLng = L.latLng(a.lat, a.lng);
                    // Leaflet distanceTo devuelve la distancia en metros
                    let distancia = currentLatLng.distanceTo(aLatLng);
                    if (distancia < menorDistancia) {
                        menorDistancia = distancia;
                        masCercano = a;
                    }
                });
                
                // Radio permitido en metros
                const MAX_DISTANCIA_METROS = 4;

                if (menorDistancia > MAX_DISTANCIA_METROS) {
                    alert(`Estás a ${Math.round(menorDistancia)} metros del elemento más cercano. Debes acercarte a menos de ${MAX_DISTANCIA_METROS} metros para recogerlo.`);
                    return;
                }

                // Eliminarlo del estado de acciones del mapa
                state.acciones = state.acciones.filter(a => a.id !== masCercano.id && a !== masCercano);
                
                // Eliminar el marcador visualmente
                let indexMarcador = markers.findIndex(m => m.accionId === masCercano.id || (m.accion === masCercano));
                if (indexMarcador !== -1) {
                    map.removeLayer(markers[indexMarcador].marker || markers[indexMarcador]);
                    markers.splice(indexMarcador, 1);
                }

                state[item].enRuta--;
                state[item].recogidas++;
            }
        } else {
            alert(`No puedes recoger ${item} porque no hay ninguna en ruta.`);
            return;
        }
    }

    guardarEstado();
    actualizarUI();
    
    // Centrar mapa en la ubicación actual
    map.setView([currentLocation.lat, currentLocation.lng], 16);
}

function agregarMarcadorAlMapa(accion) {
    // Si la acción no tiene ID (de un estado anterior), se lo asignamos
    if (!accion.id) {
        accion.id = Date.now() + Math.random();
    }
    
    // Solo mostramos marcadores de lo que se ha "dejado"
    if (accion.accion !== 'dejar') return;

    // Asignar un color distinto dependiendo del tipo de elemento
    let color = '#27ae60'; // Verde por defecto
    if (accion.item === 'vallas') {
        color = '#3498db'; // Azul para vallas
    } else if (accion.item === 'bombonas') {
        color = '#e74c3c'; // Rojo para bombonas
    } else if (accion.item === 'maletas') {
        color = '#9b59b6'; // Morado para maletas
    }
    
    let label = 'Dejó';
    
    // Crear un icono usando HTML con el borde de color
    const icon = L.divIcon({
        className: 'custom-icon',
        html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.6);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });

    const timeString = new Date(accion.timestamp).toLocaleTimeString();
    const latStr = accion.lat.toFixed(5);
    const lngStr = accion.lng.toFixed(5);
    
    const marker = L.marker([accion.lat, accion.lng], {icon: icon})
        .addTo(map)
        .bindPopup(`<b>${label} ${accion.item}</b><br>Hora: ${timeString}<br>Coord: ${latStr}, ${lngStr}`);
        
    markers.push({ marker: marker, accionId: accion.id, accion: accion });
}
