const ORS_API_KEY = '5b3ce3597851110001cf6248875caa3075f6481693ac503c640a017e'; // Replace with your ORS key
let routeLayer = null;
let routePoints = [];
let navMode = false; // Toggle for navigation mode

const startNavBtn = document.getElementById('start-nav-btn');
startNavBtn.addEventListener('click', () => {
  navMode = true;
  routePoints = [];
  alert('Navigation mode activated.\nClick on start point and then destination.');
});

// Listen to single-click on the map
map.on('click', function (e) {
  if (!navMode) return; // Only work in navigation mode

  if (routePoints.length < 2) {
    routePoints.push([e.latlng.lng, e.latlng.lat]);

    // Add marker to the map and label accordingly
    L.marker([e.latlng.lat, e.latlng.lng]).addTo(map)
      .bindPopup(routePoints.length === 1 ? 'Start Point' : 'Destination')
      .openPopup();

    // Once two points are added, fetch the route
    if (routePoints.length === 2) {
      fetchRoute(routePoints);
      navMode = false; // Auto-disable nav mode
    }
  }
});

// Double-click to clear the route and reset points
map.on('dblclick', () => {
  if (routeLayer) {
    map.removeLayer(routeLayer);
  }
  routePoints = [];
  alert('Route cleared. Please select new start and destination points.');
});

// Function to fetch and display the route
function fetchRoute(points) {
  fetch(`https://api.openrouteservice.org/v2/directions/driving-car/geojson`, {
    method: 'POST',
    headers: {
      'Authorization': ORS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      coordinates: points
    })
  })
    .then(res => res.json())
    .then(data => {
      // Remove previous route if any
      if (routeLayer) map.removeLayer(routeLayer);

      // Add new route as a geoJSON layer
      routeLayer = L.geoJSON(data, {
        style: { color: 'blue', weight: 4 }
      }).addTo(map);

      // Adjust map bounds to fit the route
      map.fitBounds(routeLayer.getBounds());
    })
    .catch(err => console.error('Routing error:', err));
}
