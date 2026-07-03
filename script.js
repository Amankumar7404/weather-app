/**
 * Skyline — Weather App
 * Fetches current conditions from OpenWeatherMap and renders a
 * glassmorphic, time-of-day-aware interface.
 */

const CONFIG = {
  apiKey: "55bfbc6e65f360f7483e2689690e0d32", // <-- paste your OpenWeatherMap API key here
  baseUrl: "https://api.openweathermap.org/data/2.5/weather",
  units: "metric",
  recentLimit: 5,
  storageKey: "skyline_recent_cities",
};

// ---- DOM references -------------------------------------------------
const els = {
  form: document.getElementById("searchForm"),
  input: document.getElementById("cityInput"),
  sky: document.getElementById("sky"),

  emptyState: document.getElementById("emptyState"),
  loadingState: document.getElementById("loadingState"),
  errorState: document.getElementById("errorState"),
  weatherState: document.getElementById("weatherState"),

  errorTitle: document.getElementById("errorTitle"),
  errorDetail: document.getElementById("errorDetail"),

  cityName: document.getElementById("cityName"),
  cityMeta: document.getElementById("cityMeta"),
  weatherEmoji: document.getElementById("weatherEmoji"),
  temp: document.getElementById("temp"),
  description: document.getElementById("description"),
  feelsLike: document.getElementById("feelsLike"),

  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  pressure: document.getElementById("pressure"),
  visibility: document.getElementById("visibility"),
  sunrise: document.getElementById("sunrise"),
  sunset: document.getElementById("sunset"),

  recentRow: document.getElementById("recentRow"),
  suggestionChips: document.getElementById("suggestionChips"),
};

// ---- View state machine ----------------------------------------------
// Only one of these sections is visible at a time.
function setView(view) {
  const sections = {
    empty: els.emptyState,
    loading: els.loadingState,
    error: els.errorState,
    weather: els.weatherState,
  };
  Object.entries(sections).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== view);
  });
}

// ---- Weather icon → emoji mapping -------------------------------------
function iconFor(code) {
  const map = {
    "01": "☀️",
    "02": "⛅",
    "03": "☁️",
    "04": "☁️",
    "09": "🌧️",
    10: "🌦️",
    11: "⛈️",
    13: "❄️",
    50: "🌫️",
  };
  return map[code.slice(0, 2)] || "🌡️";
}

// ---- Sky theme driven by real conditions + time of day ----------------
function applySkyTheme(data) {
  const { sunrise, sunset } = data.sys;
  const now = data.dt;
  const isNight = now < sunrise || now > sunset;
  const mainCondition = data.weather[0].main.toLowerCase();

  els.sky.className = "sky"; // reset

  if (isNight) {
    els.sky.classList.add("sky--night");
  } else if (now > sunset - 2400) {
    // within ~40 min of sunset
    els.sky.classList.add("sky--sunset");
  } else if (
    mainCondition.includes("cloud") ||
    mainCondition.includes("rain") ||
    mainCondition.includes("mist")
  ) {
    els.sky.classList.add("sky--cloudy");
  } else {
    els.sky.classList.add("sky--day");
  }
}

function formatTime(unixSeconds, timezoneOffsetSeconds) {
  const date = new Date((unixSeconds + timezoneOffsetSeconds) * 1000);
  let hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

// ---- Render weather data into the DOM ---------------------------------
function renderWeather(data) {
  applySkyTheme(data);

  els.cityName.textContent = `${data.name}, ${data.sys.country}`;
  els.cityMeta.textContent = data.weather[0].main;

  els.weatherEmoji.textContent = iconFor(data.weather[0].icon);
  els.temp.textContent = `${Math.round(data.main.temp)}°`;
  els.description.textContent = data.weather[0].description;
  els.feelsLike.textContent = `Feels like ${Math.round(data.main.feels_like)}°`;

  els.humidity.textContent = `${data.main.humidity}%`;
  els.wind.textContent = `${data.wind.speed} m/s`;
  els.pressure.textContent = `${data.main.pressure} hPa`;
  els.visibility.textContent = `${(data.visibility / 1000).toFixed(1)} km`;
  els.sunrise.textContent = formatTime(data.sys.sunrise, data.timezone);
  els.sunset.textContent = formatTime(data.sys.sunset, data.timezone);

  setView("weather");
}

// ---- Error presentation -------------------------------------------------
function renderError(status) {
  const messages = {
    401: {
      title: "API key not active yet",
      detail:
        "New OpenWeatherMap keys can take up to a couple of hours to activate. Try again shortly.",
    },
    404: {
      title: "City not found",
      detail: "Double-check the spelling, or try a nearby larger city.",
    },
    network: {
      title: "Connection issue",
      detail: "Check your internet connection and try again.",
    },
    default: {
      title: "Something went wrong",
      detail: "Please try again in a moment.",
    },
  };

  const { title, detail } = messages[status] || messages.default;
  els.errorTitle.textContent = title;
  els.errorDetail.textContent = detail;
  setView("error");
}

// ---- Fetch weather --------------------------------------------------
async function fetchWeather(city) {
  setView("loading");

  try {
    const url = `${CONFIG.baseUrl}?q=${encodeURIComponent(city)}&appid=${CONFIG.apiKey}&units=${CONFIG.units}`;
    const response = await fetch(url);

    if (!response.ok) {
      renderError(
        response.status === 401
          ? 401
          : response.status === 404
            ? 404
            : "default",
      );
      return;
    }

    const data = await response.json();
    renderWeather(data);
    saveRecentCity(data.name);
  } catch (err) {
    renderError("network");
  }
}

// ---- Recent searches (localStorage) ----------------------------------
function getRecentCities() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.storageKey)) || [];
  } catch {
    return [];
  }
}

function saveRecentCity(city) {
  let cities = getRecentCities().filter(
    (c) => c.toLowerCase() !== city.toLowerCase(),
  );
  cities.unshift(city);
  cities = cities.slice(0, CONFIG.recentLimit);
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(cities));
  renderRecentChips();
}

function renderRecentChips() {
  const cities = getRecentCities();

  els.recentRow.innerHTML = "";
  cities.forEach((city) => {
    const span = document.createElement("span");
    span.textContent = city;
    span.addEventListener("click", () => fetchWeather(city));
    els.recentRow.appendChild(span);
  });

  // Also populate suggestion chips on the empty state
  els.suggestionChips.innerHTML = "";
  const suggestions = cities.length
    ? cities
    : ["Delhi", "Mumbai", "Karnal", "Bengaluru"];
  suggestions.slice(0, 4).forEach((city) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.type = "button";
    btn.textContent = city;
    btn.addEventListener("click", () => fetchWeather(city));
    els.suggestionChips.appendChild(btn);
  });
}

// ---- Event wiring -----------------------------------------------------
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = els.input.value.trim();
  if (!city) return;
  fetchWeather(city);
});

// ---- Init -----------------------------------------------------------
renderRecentChips();
setView("empty");
