// Estado de la aplicación
let state = {
    vallas: 0,
    bombonas: 0,
    maletas: 0,
    acciones: [] // Guarda { item, accion, lat, lng, timestamp }
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
        state = JSON.parse(savedState);
    }
}

function guardarEstado() {
    localStorage.setItem('appConteoState', JSON.stringify(state));
}

function actualizarUI() {
    document.getElementById('count-vallas').innerText = state.vallas;
    document.getElementById('count-bombonas').innerText = state.bombonas;
    document.getElementById('count-maletas').innerText = state.maletas;
}

function reiniciarRecorrido() {
    state = {
        vallas: 0,
        bombonas: 0,
        maletas: 0,
        acciones: []
    };
    guardarEstado();
    actualizarUI();
    
    // Limpiar marcadores del mapa
    markers.forEach(marker => map.removeLayer(marker));
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

    // Lógica matemática
    if (accionType === 'dejar') {
        state[item]++;
    } else if (accionType === 'recoger') {
        if (state[item] > 0) {
            state[item]--;
        } else {
            alert(`No puedes recoger ${item} porque el contador está en 0.`);
            return;
        }
    }

    const nuevaAccion = {
        item: item,
        accion: accionType,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        timestamp: new Date().toISOString()
    };

    state.acciones.push(nuevaAccion);
    guardarEstado();
    actualizarUI();
    agregarMarcadorAlMapa(nuevaAccion);
    
    // Centrar mapa en la nueva acción
    map.setView([currentLocation.lat, currentLocation.lng], 16);
}

function agregarMarcadorAlMapa(accion) {
    let color = accion.accion === 'dejar' ? 'green' : 'orange';
    let label = accion.accion === 'dejar' ? 'Dejó' : 'Recogió';
    
    // Crear un icono simple coloreado usando HTML/CSS
    const icon = L.divIcon({
        className: 'custom-icon',
        html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    const timeString = new Date(accion.timestamp).toLocaleTimeString();
    
    const marker = L.marker([accion.lat, accion.lng], {icon: icon})
        .addTo(map)
        .bindPopup(`<b>${label} ${accion.item}</b><br>Hora: ${timeString}`);
        
    markers.push(marker);
}
