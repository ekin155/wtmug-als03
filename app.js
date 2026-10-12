const API_BASE = "https://api.open-meteo.com/v1/forecast";
const GEO_BASE = "https://geocoding-api.open-meteo.com/v1/search";

const els = {
  cityInput: document.getElementById("city-input"),
  searchBtn: document.getElementById("search-btn"),
  locationBtn: document.getElementById("location-btn"),
  error: document.getElementById("error-msg"),
  loading: document.getElementById("loading"),
  current: document.getElementById("current-weather"),
  forecast: document.getElementById("forecast"),
  forecastList: document.getElementById("forecast-list"),
  cityName: document.getElementById("city-name"),
  currentTemp: document.getElementById("current-temp"),
  currentIcon: document.getElementById("current-icon"),
  currentDesc: document.getElementById("current-desc"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  offlineBanner: document.getElementById("offline-banner"),
};

// WMO hava durumu kodları -> Türkçe + emoji
const WEATHER_CODES = {
  0: ["Açık", "☀️"], 1: ["Az bulutlu", "🌤️"], 2: ["Parçalı bulutlu", "⛅"],
  3: ["Kapalı", "☁️"], 45: ["Sisli", "🌫️"], 48: ["Kırağılı sis", "🌫️"],
  51: ["Hafif çisenti", "🌦️"], 53: ["Çisenti", "🌦️"], 55: ["Yoğun çisenti", "🌧️"],
  61: ["Hafif yağmur", "🌦️"], 63: ["Yağmur", "🌧️"], 65: ["Şiddetli yağmur", "🌧️"],
  71: ["Hafif kar", "🌨️"], 73: ["Kar", "❄️"], 75: ["Yoğun kar", "❄️"],
  80: ["Sağanak", "🌦️"], 81: ["Sağanak", "🌧️"], 82: ["Şiddetli sağanak", "⛈️"],
  95: ["Gök gürültülü", "⛈️"], 96: ["Dolulu fırtına", "⛈️"], 99: ["Şiddetli fırtına", "⛈️"],
};

function getWeatherInfo(code) {
  return WEATHER_CODES[code] || ["Bilinmiyor", "❓"];
}

function showError(msg) {
  els.error.textContent = msg;
  els.error.classList.remove("hidden");
}
function clearError() {
  els.error.classList.add("hidden");
}
function setLoading(on) {
  els.loading.classList.toggle("hidden", !on);
}

// --- Şehir arama ---
async function searchCity(cityName) {
  clearError();
  setLoading(true);
  try {
    const url = `${GEO_BASE}?name=${encodeURIComponent(cityName)}&count=1&language=tr&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Geocoding hatası");
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      throw new Error(`"${cityName}" bulunamadı. Lütfen geçerli bir şehir adı girin.`);
    }

    const place = data.results[0];
    await fetchWeather(place.latitude, place.longitude, place.name);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

// --- Konum ile hava durumu ---
function getLocationWeather() {
  clearError();
  if (!navigator.geolocation) {
    showError("Tarayıcınız konum özelliğini desteklemiyor.");
    return;
  }
  setLoading(true);
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        await fetchWeather(pos.coords.latitude, pos.coords.longitude, "Konumum");
      } catch (err) {
        showError(err.message);
      } finally {
        setLoading(false);
      }
    },
    (err) => {
      setLoading(false);
      showError("Konum alınamadı: " + err.message);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// --- Hava durumu verisi ---
async function fetchWeather(lat, lon, cityName) {
  const url =
    `${API_BASE}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto&forecast_days=6`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Hava durumu verisi alınamadı.");
  const data = await res.json();

  renderCurrent(cityName, data.current);
  renderForecast(data.daily);

  // Çevrimdışı kullanım için önbelleğe kaydet
  const cacheData = { cityName, current: data.current, daily: data.daily, ts: Date.now() };
  localStorage.setItem("lastWeather", JSON.stringify(cacheData));
}

// --- Render ---
function renderCurrent(cityName, current) {
  const [desc, icon] = getWeatherInfo(current.weather_code);
  els.cityName.textContent = cityName;
  els.currentTemp.textContent = `${Math.round(current.temperature_2m)}°C`;
  els.currentIcon.textContent = icon;
  els.currentDesc.textContent = desc;
  els.humidity.textContent = current.relative_humidity_2m;
  els.wind.textContent = Math.round(current.wind_speed_10m);
  els.current.classList.remove("hidden");
}

function renderForecast(daily) {
  els.forecastList.innerHTML = "";
  const days = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

  // Bugünü atla, sonraki 5 günü göster
  for (let i = 1; i <= 5 && i < daily.time.length; i++) {
    const date = new Date(daily.time[i]);
    const dayName = days[date.getDay()];
    const [, icon] = getWeatherInfo(daily.weather_code[i]);

    const row = document.createElement("div");
    row.className = "forecast-item";
    row.innerHTML = `
      <span class="day">${dayName} ${date.getDate()}/${date.getMonth() + 1}</span>
      <span>${icon}</span>
      <span class="min">${Math.round(daily.temperature_2m_min[i])}°</span>
      <span class="max">${Math.round(daily.temperature_2m_max[i])}°C</span>
    `;
    els.forecastList.appendChild(row);
  }
  els.forecast.classList.remove("hidden");
}

// --- Çevrimdışı tespiti ---
function updateOnlineStatus() {
  if (navigator.onLine) {
    els.offlineBanner.classList.add("hidden");
  } else {
    els.offlineBanner.classList.remove("hidden");
    loadCachedWeather();
  }
}

function loadCachedWeather() {
  const cached = localStorage.getItem("lastWeather");
  if (!cached) return;
  try {
    const { cityName, current, daily } = JSON.parse(cached);
    renderCurrent(cityName + " (önbellek)", current);
    renderForecast(daily);
  } catch (_) {}
}

// --- Olaylar ---
els.searchBtn.addEventListener("click", () => {
  const val = els.cityInput.value.trim();
  if (!val) {
    showError("Lütfen bir şehir adı girin.");
    return;
  }
  searchCity(val);
});

els.cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.searchBtn.click();
});

els.locationBtn.addEventListener("click", getLocationWeather);

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

// --- Service Worker kaydı ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) =>
      console.warn("SW kayıt hatası:", err)
    );
  });
}

// Başlangıç
updateOnlineStatus();