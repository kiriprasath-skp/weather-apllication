(function(){
  "use strict";
  var GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
  var FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
  var FALLBACK = { name: "Coimbatore, India", latitude: 11.0168, longitude: 76.9558 };

  var state = { unit: localStorage.getItem('cs_unit') || 'C', lastData: null, timeTimer: null };

  /* ---------- WMO weather code → icon key + label ---------- */
  var CODES = {
    0:["sun","Clear sky"],1:["sun","Mainly clear"],2:["cloud-sun","Partly cloudy"],3:["cloud","Overcast"],
    45:["fog","Fog"],48:["fog","Rime fog"],
    51:["drizzle","Light drizzle"],53:["drizzle","Drizzle"],55:["drizzle","Dense drizzle"],
    56:["drizzle","Freezing drizzle"],57:["drizzle","Freezing drizzle"],
    61:["rain","Slight rain"],63:["rain","Rain"],65:["rain","Heavy rain"],66:["rain","Freezing rain"],67:["rain","Heavy freezing rain"],
    71:["snow","Slight snow"],73:["snow","Snow"],75:["snow","Heavy snow"],77:["snow","Snow grains"],
    80:["rain","Rain showers"],81:["rain","Rain showers"],82:["rain","Violent showers"],
    85:["snow","Snow showers"],86:["snow","Heavy snow showers"],
    95:["storm","Thunderstorm"],96:["storm","Thunderstorm, hail"],99:["storm","Severe thunderstorm"]
  };
  function weatherInfo(code, isDay){
    var e = CODES[code] || ["cloud","Unknown"];
    var icon = e[0];
    if (icon === "sun" && !isDay) icon = "moon";
    if (icon === "cloud-sun" && !isDay) icon = "cloud-moon";
    return { icon: icon, label: e[1] };
  }

  var SW = 'stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  var ICONS = {
    sun:'<circle cx="12" cy="12" r="4.2" stroke="var(--coral)" '+SW+'/><g stroke="var(--coral)" '+SW+'><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></g>',
    moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.4 6.4 0 0 0 10.5 10.5Z" stroke="var(--cyan)" '+SW+' fill="var(--cyan)" fill-opacity=".15"/>',
    'cloud-sun':'<circle cx="8" cy="8" r="3" stroke="var(--coral)" '+SW+'/><path d="M7 20a3.6 3.6 0 0 1 .4-7.2A5 5 0 0 1 17 13a3 3 0 0 1-.6 6Z" stroke="currentColor" '+SW+'/>',
    'cloud-moon':'<path d="M15.5 4.8A4.4 4.4 0 1 0 11 10a3.6 3.6 0 0 0 4.5-5.2Z" stroke="var(--cyan)" '+SW+'/><path d="M7 20a3.6 3.6 0 0 1 .4-7.2A5 5 0 0 1 17 13a3 3 0 0 1-.6 6Z" stroke="currentColor" '+SW+'/>',
    cloud:'<path d="M6.5 19a4 4 0 0 1 .4-8 5.6 5.6 0 0 1 11-1.4A3.4 3.4 0 0 1 17.3 16" stroke="currentColor" '+SW+'/><path d="M6.5 19h10.8" stroke="currentColor" '+SW+'/>',
    fog:'<path d="M5 9h14M3 13h18M5 17h14M7 21h10" stroke="currentColor" '+SW+'/>',
    drizzle:'<path d="M6.5 13a4 4 0 0 1 .4-8 5.6 5.6 0 0 1 11-1.4A3.4 3.4 0 0 1 17.3 10" stroke="currentColor" '+SW+'/><g stroke="var(--cyan)" '+SW+'><path d="M8 17v2M12 17v2M16 17v2"/></g>',
    rain:'<path d="M6.5 12a4 4 0 0 1 .4-8 5.6 5.6 0 0 1 11-1.4A3.4 3.4 0 0 1 17.3 9" stroke="currentColor" '+SW+'/><g stroke="var(--cyan)" '+SW+'><path d="M7.5 16.5 6 20M12.5 16.5 11 20M17.5 16.5 16 20"/></g>',
    snow:'<path d="M6.5 12a4 4 0 0 1 .4-8 5.6 5.6 0 0 1 11-1.4A3.4 3.4 0 0 1 17.3 9" stroke="currentColor" '+SW+'/><g stroke="currentColor" '+SW+'><path d="M8 17v4M6 19h4M15 17v4M13 19h4"/></g>',
    storm:'<path d="M6.5 11a4 4 0 0 1 .4-8 5.6 5.6 0 0 1 11-1.4A3.4 3.4 0 0 1 17.3 8" stroke="currentColor" '+SW+'/><path d="M13 12l-3.5 5h3L11 21l5-6.5h-3z" fill="var(--coral)" stroke="none"/>'
  };
  function iconSVG(key, size){
    size = size || 28;
    return '<svg viewBox="0 0 24 24" width="'+size+'" height="'+size+'">'+(ICONS[key]||ICONS.cloud)+'</svg>';
  }

  /* ---------- unit + colour helpers ---------- */
  function toF(c){ return c*9/5+32; }
  function fmtTemp(c){ return Math.round(state.unit === 'F' ? toF(c) : c); }
  // Map a Celsius reading to a dial colour — always computed in Celsius so the
  // colour stays meaningful regardless of which unit is displayed.
  function tempColor(c){
    if (c < 5) return '#4FA8FF';
    if (c < 15) return '#4FD1C5';
    if (c < 25) return '#8BD450';
    if (c < 32) return '#FFC145';
    return '#FF6B4A';
  }
  function dirCompass(deg){
    var d = ["N","NE","E","SE","S","SW","W","NW"];
    return d[Math.round(deg/45) % 8];
  }

  function setLoading(on){
    document.getElementById('loading').hidden = !on;
    if (on){ document.getElementById('errorBox').hidden = true; document.getElementById('weatherView').hidden = true; }
  }
  function setError(msg){
    document.getElementById('loading').hidden = true;
    document.getElementById('weatherView').hidden = true;
    var box = document.getElementById('errorBox');
    box.hidden = false; box.textContent = msg;
  }

  /* ---------- recent searches (localStorage) ---------- */
  function loadRecents(){ try { return JSON.parse(localStorage.getItem('cs_recents')||'[]'); } catch(e){ return []; } }
  function saveRecent(place){
    if (!place.short) return;
    var list = loadRecents().filter(function(p){ return p.short !== place.short; });
    list.unshift(place);
    localStorage.setItem('cs_recents', JSON.stringify(list.slice(0,5)));
    renderRecents();
  }
  function renderRecents(){
    var list = loadRecents();
    var line = document.getElementById('recentLine');
    if (!list.length){ line.textContent = ''; return; }
    line.innerHTML = 'Recent: ' + list.map(function(p,i){
      return '<a data-i="'+i+'">'+p.short+'</a>';
    }).join(' &middot; ');
    Array.prototype.forEach.call(line.querySelectorAll('a'), function(a){
      a.addEventListener('click', function(){ loadLocation(list[+a.dataset.i]); });
    });
  }

  /* ---------- API calls ---------- */
  function geocode(query){
    var url = GEOCODE_URL + "?name=" + encodeURIComponent(query) + "&count=1&language=en&format=json";
    return fetch(url).then(function(r){ if(!r.ok) throw new Error("Lookup failed"); return r.json(); })
      .then(function(data){
        if (!data.results || !data.results.length) throw new Error("No city found — check the spelling and try again.");
        var r = data.results[0];
        var parts = [r.name, r.admin1, r.country].filter(Boolean);
        return { name: parts.join(", "), short: r.name, latitude: r.latitude, longitude: r.longitude };
      });
  }
  function fetchForecast(lat, lon){
    var params = [
      "latitude="+lat, "longitude="+lon,
      "current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl",
      "hourly=temperature_2m,weather_code,precipitation_probability,uv_index",
      "daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset",
      "timezone=auto","forecast_days=7"
    ].join("&");
    return fetch(FORECAST_URL+"?"+params).then(function(r){
      if(!r.ok) throw new Error("Could not reach the weather service. Try again shortly.");
      return r.json();
    });
  }

  /* ---------- gauge + chart renderers ---------- */
  var GAUGE_R = 80, GAUGE_C = 2*Math.PI*GAUGE_R;
  function setGauge(tempC){
    var pct = Math.max(0, Math.min(1, (tempC - (-10)) / (45 - (-10))));
    var el = document.getElementById('gaugeFill');
    el.setAttribute('stroke-dasharray', GAUGE_C);
    el.setAttribute('stroke-dashoffset', GAUGE_C * (1-pct));
    el.setAttribute('stroke', tempColor(tempC));
  }
  function setLinearGauge(id, label, value, unit, pct, sub){
    var el = document.getElementById(id);
    pct = Math.max(0, Math.min(100, pct));
    el.innerHTML =
      '<div class="lg-head"><span>'+label+'</span><b>'+value+unit+'</b></div>'+
      '<div class="lg-track"><div class="lg-fill" style="width:'+pct+'%;background:var(--cyan)"></div>'+
      '<div class="lg-marker" style="left:'+pct+'%"></div></div>'+
      '<div class="lg-sub">'+sub+'</div>';
  }
  function buildPolyline(values, w, h, pad){
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var range = (max-min) || 1;
    var step = (w - pad*2) / (values.length-1);
    return values.map(function(v,i){
      var x = pad + i*step;
      var y = pad + (h - pad*2) * (1 - (v-min)/range);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
  }

  /* ---------- main render ---------- */
  function render(place, data){
    state.lastData = { place: place, data: data };
    var cur = data.current;
    var info = weatherInfo(cur.weather_code, cur.is_day === 1);

    document.getElementById('locName').textContent = place.name;
    document.getElementById('tempBig').textContent = fmtTemp(cur.temperature_2m);
    document.getElementById('gaugeIcon').innerHTML = iconSVG(info.icon, 30);
    document.getElementById('conditionText').textContent = info.label;
    document.getElementById('feelsLike').textContent = fmtTemp(cur.apparent_temperature);
    setGauge(cur.temperature_2m);

    if (state.timeTimer) clearInterval(state.timeTimer);
    function tick(){
      document.getElementById('dateLine').textContent = new Date().toLocaleDateString(undefined,{timeZone:data.timezone,weekday:'long',day:'2-digit',month:'short'}) +
        ' · ' + new Date().toLocaleTimeString(undefined,{timeZone:data.timezone,hour:'numeric',minute:'2-digit'});
    }
    tick(); state.timeTimer = setInterval(tick, 30000);

    setLinearGauge('gHumidity', 'Humidity', cur.relative_humidity_2m, '%', cur.relative_humidity_2m,
      cur.relative_humidity_2m <= 60 ? 'Comfortable level' : 'Feels humid');

    var uvNow = (data.hourly.uv_index && data.hourly.uv_index[0]!=null) ? data.hourly.uv_index[0] : 0;
    setLinearGauge('gUv', 'UV Index', uvNow.toFixed(1), '', (uvNow/11)*100,
      uvNow < 3 ? 'Low exposure' : uvNow < 6 ? 'Moderate — wear sunscreen' : 'High — limit midday sun');

    var pr = cur.pressure_msl;
    setLinearGauge('gPressure', 'Pressure', Math.round(pr), ' hPa', ((pr-980)/(1040-980))*100,
      pr < 1009 ? 'Low pressure system' : pr > 1021 ? 'High pressure, settled' : 'Near average');

    document.getElementById('windDir').textContent = dirCompass(cur.wind_direction_10m) + ' (' + Math.round(cur.wind_direction_10m) + '°)';
    document.getElementById('windSpeed').textContent = Math.round(cur.wind_speed_10m);
    document.getElementById('needle').setAttribute('transform', 'rotate(' + cur.wind_direction_10m + ',50,50)');

    // hourly line chart, next 24h from "now"
    var now = new Date();
    var startIdx = data.hourly.time.findIndex(function(t){ return new Date(t) >= now; });
    if (startIdx < 0) startIdx = 0;
    var hrs = [];
    for (var i = startIdx; i < startIdx+24 && i < data.hourly.time.length; i++) hrs.push(i);
    var temps = hrs.map(function(i){ return state.unit==='F' ? toF(data.hourly.temperature_2m[i]) : data.hourly.temperature_2m[i]; });
    var pts = buildPolyline(temps, 720, 160, 18);
    var svg = document.getElementById('hourlySvg');
    var areaPts = pts.join(' ') + ' ' + (18 + (720-36)) + ',150 18,150';
    svg.innerHTML =
      '<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">'+
        '<stop offset="0%" stop-color="var(--coral)" stop-opacity="0.35"/>'+
        '<stop offset="100%" stop-color="var(--coral)" stop-opacity="0"/>'+
      '</linearGradient></defs>'+
      '<polygon points="'+areaPts+'" fill="url(#areaGrad)"></polygon>'+
      '<polyline points="'+pts.join(' ')+'" fill="none" stroke="var(--coral)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></polyline>';
    var labelsWrap = document.getElementById('hourlyLabels');
    labelsWrap.innerHTML = '';
    hrs.forEach(function(idx, pos){
      if (pos % 3 !== 0 && pos !== hrs.length-1) return;
      var span = document.createElement('span');
      span.textContent = pos === 0 ? 'Now' : new Date(data.hourly.time[idx]).toLocaleTimeString(undefined,{hour:'numeric'});
      labelsWrap.appendChild(span);
    });

    // 7-day outlook
    document.getElementById('dailyTz').textContent = data.timezone.replace('_',' ');
    var dwrap = document.getElementById('dailyList');
    dwrap.innerHTML = '';
    var d = data.daily;
    var gMin = Math.min.apply(null, d.temperature_2m_min), gMax = Math.max.apply(null, d.temperature_2m_max);
    var span = (gMax-gMin) || 1;
    for (var j = 0; j < d.time.length; j++){
      var di = weatherInfo(d.weather_code[j], true);
      var lo = d.temperature_2m_min[j], hiT = d.temperature_2m_max[j];
      var left = ((lo-gMin)/span)*100, width = Math.max(((hiT-lo)/span)*100, 6);
      var dname = j===0 ? "Today" : new Date(d.time[j]+"T00:00:00").toLocaleDateString(undefined,{weekday:'short'});
      var row = document.createElement('div');
      row.className = 'day-row';
      row.innerHTML = '<span class="dname">'+dname+'</span>'+iconSVG(di.icon,20)+
        '<span class="range-track"><span class="range-fill" style="left:'+left+'%;width:'+width+'%"></span></span>'+
        '<span class="hilo">'+fmtTemp(hiT)+'°<span class="lo">'+fmtTemp(lo)+'°</span></span>';
      dwrap.appendChild(row);
    }

    document.getElementById('loading').hidden = true;
    document.getElementById('errorBox').hidden = true;
    document.getElementById('weatherView').hidden = false;
  }

  function loadLocation(place){
    setLoading(true);
    fetchForecast(place.latitude, place.longitude).then(function(data){
      render(place, data);
      saveRecent(place);
    }).catch(function(err){ setError(err.message || "Something went wrong loading the forecast."); });
  }

  /* ---------- events ---------- */
  document.getElementById('searchForm').addEventListener('submit', function(e){
    e.preventDefault();
    var q = document.getElementById('cityInput').value.trim();
    if (!q) return;
    setLoading(true);
    geocode(q).then(loadLocation).catch(function(err){ setError(err.message || "City not found."); });
  });

  document.getElementById('geoBtn').addEventListener('click', function(){
    if (!navigator.geolocation){ setError("Your browser doesn't support location lookup."); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(function(pos){
      loadLocation({ name:"Current location", short:null, latitude:pos.coords.latitude, longitude:pos.coords.longitude });
    }, function(){ setError("Location access was denied. Search for a city instead."); }, { timeout: 8000 });
  });

  document.getElementById('unitSwitch').addEventListener('click', function(e){
    var btn = e.target.closest('button[data-unit]');
    if (!btn) return;
    state.unit = btn.getAttribute('data-unit');
    localStorage.setItem('cs_unit', state.unit);
    Array.prototype.forEach.call(document.querySelectorAll('#unitSwitch button'), function(b){
      b.classList.toggle('active', b === btn);
    });
    if (state.lastData) render(state.lastData.place, state.lastData.data);
  });

  /* ---------- init ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('#unitSwitch button'), function(b){
    b.classList.toggle('active', b.getAttribute('data-unit') === state.unit);
  });
  renderRecents();

  var recents = loadRecents();
  if (recents.length){
    loadLocation(recents[0]);
  } else if (navigator.geolocation){
    setLoading(true);
    navigator.geolocation.getCurrentPosition(function(pos){
      loadLocation({ name:"Current location", short:null, latitude:pos.coords.latitude, longitude:pos.coords.longitude });
    }, function(){ loadLocation(FALLBACK); }, { timeout: 6000 });
  } else {
    loadLocation(FALLBACK);
  }
})();
