// 🌍 Initialize the map
var map = L.map('map').setView([20, 0], 2);

// 📍 Autofocus on user's current location with maximum possible accuracy
let userMarker, accuracyCircle;

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    function (position) {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      console.log(`📡 High-Accuracy GPS: [${lat}, ${lon}] | ±${Math.round(accuracy)}m`);

      // Remove previous marker/circle if exists
      if (userMarker) map.removeLayer(userMarker);
      if (accuracyCircle) map.removeLayer(accuracyCircle);

      // Add new marker
      userMarker = L.marker([lat, lon]).addTo(map)
        .bindPopup(`📍 You are here<br>Accuracy: ±${Math.round(accuracy)} meters`)
        .openPopup();

      // Add accuracy circle
      accuracyCircle = L.circle([lat, lon], {
        radius: accuracy,
        color: 'blue',
        fillColor: '#3399ff',
        fillOpacity: 0.2
      }).addTo(map);

      // Zoom only once (optional)
      if (!map._zoom || map.getZoom() < 18) {
        map.setView([lat, lon], 20);
      }
    },
    function (error) {
      alert("⚠️ GPS Error: " + error.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 30000,       // wait longer for the most accurate reading
      maximumAge: 0         // no cached location
    }
  );
} else {
  alert("❌ Geolocation not supported by your browser.");
}


// 🗺️ TomTom base map (replace with your API key)
const TOMTOM_KEY = '3euLkMeDTCctxXgtGib7A0DLyTgCCSgf';

L.tileLayer(`https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`, 
  {
  attribution: '&copy; TomTom',
  maxZoom: 22
}).addTo(map);

// 🚦 Live traffic overlay (optional but cool!)
L.tileLayer(`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`, 
  {
  opacity: 0.6,
  attribution: '&copy; TomTom Traffic'
}).addTo(map);

// 📍 Store current markers
let markers = [];

// 🧠 Synonyms for filtering
const synonyms = {
  "Accident": ["accident", "crash", "collision", "wreck"],
  "Traffic Jam": ["traffic jam", "congestion", "slow traffic", "jammed"],
  "Road Block": ["road block", "barricade", "closed road", "obstruction"],
  "Construction": ["construction", "road work", "repairs", "maintenance"]
};

// 🧠 Get normalized type from description
function getNormalizedType(type, description) {
  description = description.toLowerCase();
  for (const [key, words] of Object.entries(synonyms)) {
    if (key === type) return key;
    if (words.some(w => description.includes(w))) {
      return key;
    }
  }
  return "Other";
}

// 🔄 Load and show filtered reports
function loadReports() {
  const selectedType = document.getElementById("filter-type").value;

  fetch('http://127.0.0.1:5000/reports')
    .then(res => res.json())
    .then(data => {
      markers.forEach(marker => map.removeLayer(marker));
      markers = [];

      const filteredData = selectedType === "all" ? data : data.filter(report => {
        const normalized = getNormalizedType(report.type, report.description);
        return normalized === selectedType;
      });

      filteredData.forEach(report => {
        const marker = L.marker([report.latitude, report.longitude])
          .addTo(map)
          .bindPopup(`<b>Type: ${getNormalizedType(report.type, report.description)}</b><br>${report.description}<br><i>${new Date(report.timestamp).toLocaleString()}</i>`);
        markers.push(marker);
      });
    })
    .catch(err => console.error('Error fetching reports:', err));
}

// 🕒 Auto-load reports
loadReports();
setInterval(loadReports, 5000);
document.getElementById("filter-type").addEventListener("change", loadReports);

// 📍 Report issue via button
document.getElementById('report-btn').addEventListener('click', function () {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (position) {
      promptAndSendReport(position.coords.latitude, position.coords.longitude);
    },
    function (error) {
      alert("Unable to retrieve your location: " + error.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
});

// 📍 Report via map click
map.on('click', function (e) {
  promptAndSendReport(e.latlng.lat, e.latlng.lng);
});

// 📨 Shared report logic
function promptAndSendReport(lat, lon) {
  const description = prompt("Describe the traffic issue at this location:");
  if (!description) return;

  const normalizedType = getNormalizedType("Other", description);

  const data = {
    latitude: lat,
    longitude: lon,
    description: description,
    type: normalizedType,
    timestamp: new Date().toISOString()
  };
  

  fetch('http://127.0.0.1:5000/report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
    .then(response => response.json())
    .then(res => {
      alert(res.message);
      loadReports();
    })
    .catch(error => console.error('Error submitting report:', error));
}


// 🚗 OpenRouteService Navigation Logic

const ORS_API_KEY = '5b3ce3597851110001cf6248875caa3075f6481693ac503c640a017e'; // Replace with your key
let routeLayer = null;
let routePoints = [];

map.on('click', function (e) {
  if (routePoints.length < 2) {
    routePoints.push([e.latlng.lng, e.latlng.lat]);

    L.marker([e.latlng.lat, e.latlng.lng]).addTo(map)
      .bindPopup(routePoints.length === 1 ? 'Start Point' : 'Destination')
      .openPopup();

    if (routePoints.length === 2) {
      fetch(`https://api.openrouteservice.org/v2/directions/driving-car/geojson`, {
        method: 'POST',
        headers: {
          'Authorization': ORS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          coordinates: routePoints
        })
      })
        .then(res => res.json())
        .then(data => {
          if (routeLayer) map.removeLayer(routeLayer);
          routeLayer = L.geoJSON(data, {
            style: { color: 'blue', weight: 4 }
          }).addTo(map);
          map.fitBounds(routeLayer.getBounds());
        })
        .catch(err => console.error('Routing error:', err));
    }
  }
});

map.on('dblclick', () => {
  if (routeLayer) map.removeLayer(routeLayer);
  routePoints = [];
});
