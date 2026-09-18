// Estado de la aplicación
let state = {
    vallas: { enRuta: 0, dejadas: 0, recogidas: 0 },
    bombonas: { enRuta: 0, dejadas: 0, recogidas: 0 },
    maletas: { enRuta: 0, dejadas: 0, recogidas: 0 },
    acciones: [] // Guarda { id, item, accion, lat, lng, timestamp }
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
        if (confirm('¿Estás seguro de que quieres iniciar un nuevo recorrido? Se borrarán los datos actuales.')) {
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
                acciones: parsed.acciones || []
            };
        } else {
            state = parsed;
        }
    }
}

function guardarEstado() {
    localStorage.setItem('appConteoState', JSON.stringify(state));
}

function actualizarUI() {
    const items = ['vallas', 'bombonas', 'maletas'];
    items.forEach(item => {
        document.getElementById(`count-${item}-enruta`).innerText = state[item].enRuta;
        document.getElementById(`count-${item}-dejadas`).innerText = state[item].dejadas;
        document.getElementById(`count-${item}-recogidas`).innerText = state[item].recogidas;
    });
}

function reiniciarRecorrido() {
    state = {
        vallas: { enRuta: 0, dejadas: 0, recogidas: 0 },
        bombonas: { enRuta: 0, dejadas: 0, recogidas: 0 },
        maletas: { enRuta: 0, dejadas: 0, recogidas: 0 },
        acciones: []
    };
    guardarEstado();
    actualizarUI();
    
    // Limpiar marcadores del mapa
    markers.forEach(m => map.removeLayer(m.marker || m));
    markers = [];
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
            // Buscar todos los elementos "dejar" de este tipo
            let dejados = state.acciones.filter(a => a.item === item && a.accion === 'dejar');
            if (dejados.length > 0) {
                // Encontrar el más cercano a la ubicación actual
                let masCercano = dejados[0];
                let menorDistancia = Infinity;
                
                dejados.forEach(a => {
                    let dx = a.lat - currentLocation.lat;
                    let dy = a.lng - currentLocation.lng;
                    let distancia = Math.sqrt(dx*dx + dy*dy);
                    if (distancia < menorDistancia) {
                        menorDistancia = distancia;
                        masCercano = a;
                    }
                });

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
    
    // Crear un icono simple coloreado usando HTML/CSS
    const icon = L.divIcon({
        className: 'custom-icon',
        html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });

    const timeString = new Date(accion.timestamp).toLocaleTimeString();
    
    const marker = L.marker([accion.lat, accion.lng], {icon: icon})
        .addTo(map)
        .bindPopup(`<b>${label} ${accion.item}</b><br>Hora: ${timeString}`);
        
    markers.push({ marker: marker, accionId: accion.id, accion: accion });
}
