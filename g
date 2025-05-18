// 🌍 Initialize the map
var map = L.map('map').setView([20, 0], 2);

// 🔑 Keys
const TOMTOM_KEY = '3euLkMeDTCctxXgtGib7A0DLyTgCCSgf';
const ORS_API_KEY = '5b3ce3597851110001cf6248875caa3075f6481693ac503c640a017e';

// 🗺️ TomTom base map
L.tileLayer(`https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`, {
  attribution: '&copy; TomTom',
  maxZoom: 22
}).addTo(map);

// 🚦 Live traffic overlay
L.tileLayer(`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`, {
  opacity: 0.6,
  attribution: '&copy; TomTom Traffic'
}).addTo(map);

// 📍 Store markers and route line
let markers = [];
let routeLine = null;

// 🔍 Synonyms for fuzzy filter
const synonyms = {
  "Accident": ["accident", "crash", "collision", "wreck"],
  "Traffic Jam": ["traffic jam", "congestion", "slow traffic", "jammed"],
  "Road Block": ["road block", "barricade", "closed road", "obstruction"],
  "Construction": ["construction", "road work", "repairs", "maintenance"]
};

// 🧠 Normalize type using description
function getNormalizedType(type, description) {
  description = description.toLowerCase();
  for (const [key, words] of Object.entries(synonyms)) {
    if (key.toLowerCase() === type.toLowerCase()) return key;
    if (words.some(word => description.includes(word))) return key;
  }
  return "Other";
}

// 🔄 Load and filter reports
function loadReports() {
  const selectedType = document.getElementById("filter-type").value;

  fetch('http://127.0.0.1:5000/reports')
    .then(res => res.json())
    .then(data => {
      // Clear old markers
      markers.forEach(m => map.removeLayer(m));
      markers = [];

      console.log('Fetched Data:', data);  // Debugging

      // Filter reports
      const filtered = selectedType === "all" ? data : data.filter(report => {
        return getNormalizedType(report.type, report.description) === selectedType;
      });

      console.log('Filtered Data:', filtered);  // Debugging

      // Add markers
      filtered.forEach(report => {
        const marker = L.marker([report.latitude, report.longitude])
          .addTo(map)
          .bindPopup(
            `<b>${getNormalizedType(report.type, report.description)}</b><br>${report.description}<br><i>${new Date(report.timestamp).toLocaleString()}</i>`
          );
        markers.push(marker);
      });

      // Check if there are markers
      if (markers.length === 0) {
        alert("No reports to display.");
      }

    })
    .catch(err => console.error("Error loading reports:", err));
}

// 📍 Geolocation Report Button
document.getElementById("report-btn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      promptAndSendReport(position.coords.latitude, position.coords.longitude);
    },
    error => {
      alert("Unable to retrieve location: " + error.message);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
});

// 🖱️ Map click to report
map.on("click", function (e) {
  promptAndSendReport(e.latlng.lat, e.latlng.lng);
});

// 📨 Send report
function promptAndSendReport(lat, lon) {
  const description = prompt("Describe the traffic issue:");
  if (!description) return;

  const type = document.getElementById("report-type").value;

  const data = {
    latitude: lat,
    longitude: lon,
    type: type,
    description: description,
    timestamp: new Date().toISOString()
  };

  fetch('http://127.0.0.1:5000/report', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
    .then(res => res.json())
    .then(res => {
      alert(res.message);
      loadReports();
    })
    .catch(err => {
      console.error("Error sending report:", err);
    });
}

// 🧭 Navigation setup
let navigationStart = null;
let navigationEnd = null;

map.on("contextmenu", function (e) {
  if (!navigationStart) {
    navigationStart = e.latlng;
    L.marker(navigationStart, {
      icon: L.icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/25/25694.png", iconSize: [25, 41] })
    }).addTo(map).bindPopup("Start Point").openPopup();
    alert("Start point set. Right-click again to set destination.");
  } else {
    navigationEnd = e.latlng;
    L.marker(navigationEnd, {
      icon: L.icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png", iconSize: [25, 41] })
    }).addTo(map).bindPopup("Destination").openPopup();
    getRoute(navigationStart, navigationEnd);
    navigationStart = null;
    navigationEnd = null;
  }
});

// 📍 Fetch route from ORS
function getRoute(startCoords, endCoords) {
  const url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
  const body = {
    coordinates: [
      [startCoords.lng, startCoords.lat],
      [endCoords.lng, endCoords.lat]
    ]
  };

  fetch(url, {
    method: "POST",
    headers: {
      "Authorization": ORS_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })
    .then(res => {
      if (!res.ok) throw new Error("ORS error");
      return res.json();
    })
    .then(data => {
      const coords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
      if (routeLine) map.removeLayer(routeLine);
      routeLine = L.polyline(coords, { color: "blue", weight: 5 }).addTo(map);
      map.fitBounds(routeLine.getBounds());
    })
    .catch(err => {
      console.error("Route error:", err);
      alert("Failed to fetch route.");
    });
}

// 🔁 Auto-refresh reports
loadReports();
setInterval(loadReports, 5000);
document.getElementById("filter-type").addEventListener("change", loadReports);
