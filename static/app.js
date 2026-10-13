const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { view: 'dashboard', charts: {}, filters: {}, stagedUpload: null, transformDraft: null, transformTab: 'data', transformSearch: '', masterRows: [], masterColumns: [], durationRows: [], durationColumns: [], masterPreview: null, transformRows: [], transformColumns: [], transformSheets: [], transformSheetRows: {}, activeTransformSheet: '', activeSheetMenu: '', selectedTransformRows: new Set(), selectedTransformCells: new Set(), selectedTransformHeaders: new Set(), transformSelectionAnchor: null, transformHeaderSelectionAnchor: null, isSelectingTransformCells: false, isSelectingTransformHeaders: false, transformUndoStack: [], transformCellSnapshot: null, dashboardRenderId: 0, dashboardSearchTimer: null, reports: { search: '', status: 'all', page: 1, pageSize: 10, records: [], openStatusId: '', filterOpen: false, selectedDeleteIds: new Set(), noteTimers: {} }, archives: { year: 'all', title: 'all', type: 'all', search: '', page: 1, pageSize: 20, selectedIds: new Set() } };

const money = new Intl.NumberFormat('id-ID');
const decimalNumber = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const chartGreen = '#007A3D';
const chartRed = '#EF4444';
const chartGrid = 'rgba(15, 118, 64, .12)';
const chartText = '#14523A';
const STATUS_COLORS = { 'Belum Dimulai': '#D8DEE5', 'Aktif': '#EF4444', 'Berakhir': '#007A3D' };
const TYPE_CHART_COLORS = ['#007A3D', '#07934D', '#12A85C', '#37B66B', '#EF4444', '#F87171', '#FCA5A5', '#E5E7EB'];
const MASTER_FORMULA_SHEET = 'Master Data Karyawan';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function setButtonLoading(button, loading = true) {
  if (!button) return;
  button.toggleAttribute('disabled', Boolean(loading));
  button.setAttribute('aria-busy', loading ? 'true' : 'false');
}

function showScreenLoading(label = 'Memproses data...') {
  const root = $('#loading-root');
  if (!root) return;
  root.classList.remove('hidden');
  root.innerHTML = `<div class="app-loading-card"><span class="screen-donut-loader"></span><div>${escapeHtml(label)}</div></div>`;
}

function hideScreenLoading() {
  const root = $('#loading-root');
  if (!root) return;
  root.classList.add('hidden');
  root.innerHTML = '';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withMinimumLoader(label, task, minimumMs = 3000) {
  showScreenLoading(label);
  try {
    return await Promise.all([task(), delay(minimumMs)]).then(([result]) => result);
  } finally {
    hideScreenLoading();
  }
}

function icon(name, className = 'ui-icon') {
  const attrs = `class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>',
    transform: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.4-9.4z"></path>',
    archive: '<path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"></path><path d="M3 8l2-5h14l2 5"></path><path d="M10 12h4"></path>',
    filter: '<path d="M3 5h18l-7 8v5l-4 2v-7L3 5z"></path>',
    search: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>',
    clipboard: '<rect x="8" y="4" width="8" height="4" rx="1"></rect><path d="M16 6h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"></path><path d="M8 12h8"></path><path d="M8 16h8"></path>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="9.5" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>',
    repeat: '<path d="M3 12a9 9 0 0 1 15.3-6.36L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-15.3 6.36L3 16"></path><path d="M3 21v-5h5"></path>',
    clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M17 8l-5-5-5 5"></path><path d="M12 3v12"></path>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path>',
    check: '<path d="M20 6L9 17l-5-5"></path>',
    table: '<path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z"></path><path d="M3 10h18"></path><path d="M9 3v18"></path>',
    plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
    edit: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>',
    trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><path d="M17 21v-8H7v8"></path><path d="M7 3v5h8"></path>',
    more: '<circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>'
  };
  return `<svg ${attrs}>${paths[name] || paths.file}</svg>`;
}
async function api(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error('Koneksi ke server gagal. Pastikan Flask masih berjalan, lalu coba lagi.');
  }

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = { message: text ? text.slice(0, 500) : 'Response server tidak valid.' };
  }
  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || 'Request gagal.');
    error.data = data;
    throw error;
  }
  return data;
}

function showAppShell() {
  $('#app-shell')?.classList.remove('hidden');
  $('#mobile-shellbar')?.classList.remove('hidden');
}

function setView(view) {
  state.view = view;
  $$('.view').forEach(el => el.classList.add('hidden'));
  $(`#view-${view}`).classList.remove('hidden');
  $$('.nav').forEach(btn => btn.classList.toggle('active', btn.dataset.nav === view));
  closeMobileSidebar();
  if (view === 'dashboard') renderDashboard();
  if (view === 'transform') renderTransform();
  if (view === 'reports') renderReports();
  if (view === 'archive') renderArchive();
}

function openMobileSidebar() {
  document.body.classList.add('mobile-sidebar-open');
  $('#mobile-menu-toggle')?.setAttribute('aria-expanded', 'true');
}

function closeMobileSidebar() {
  document.body.classList.remove('mobile-sidebar-open');
  $('#mobile-menu-toggle')?.setAttribute('aria-expanded', 'false');
}

function bindMobileSidebar() {
  $('#mobile-menu-toggle')?.addEventListener('click', event => {
    event.stopPropagation();
    if (document.body.classList.contains('mobile-sidebar-open')) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  });
  $('#mobile-sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMobileSidebar();
  });
}

function optionHtml(items, selected = 'all', label = 'Semua') {
  return [`<option value="all">${label}</option>`, ...items.map(item => {
    const value = typeof item === 'object' ? item.value : item;
    const text = typeof item === 'object' ? item.label : item;
    return `<option value="${escapeHtml(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHtml(text)}</option>`;
  })].join('');
}

function dashboardFilterMenu(key, title, items, selected = 'all') {
  const rawOptions = [{ value: 'all', label: 'Semua' }, ...(items || []).map(item => ({
    value: typeof item === 'object' ? item.value : item,
    label: typeof item === 'object' ? item.label : item
  }))];
  const seenOptions = new Set();
  const options = rawOptions.reduce((result, item) => {
    const value = key === 'type' ? sanctionTypeDisplayLabel(item.value) : item.value;
    const label = key === 'type' ? sanctionTypeDisplayLabel(item.label) : item.label;
    if (seenOptions.has(String(value))) return result;
    seenOptions.add(String(value));
    result.push({ value, label });
    return result;
  }, []);
  const active = options.find(item => String(item.value) === String(selected)) || options[0];
  const menu = options.map(item => {
    const isActive = String(item.value) === String(active.value);
    return `<button class="filter-menu-option ${isActive ? 'active' : ''}" type="button" data-filter-key="${key}" data-value="${escapeHtml(item.value)}">
      <span>${escapeHtml(item.label)}</span>
      ${isActive ? icon('check') : ''}
    </button>`;
  }).join('');
  return `<div class="filter-item custom-filter" data-filter-key="${key}">
    <span>${escapeHtml(title)}</span>
    <button class="filter-menu-btn" type="button" aria-haspopup="listbox" aria-expanded="false">
      <b>${escapeHtml(active.label)}</b>
      <i aria-hidden="true"></i>
    </button>
    <div class="filter-menu" role="listbox">${menu}</div>
  </div>`;
}

function destroyCharts() {
  Object.values(state.charts).forEach(chart => chart?.destroy());
  state.charts = {};
}

const labelPlugin = {
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.font = '650 10px Inter, Arial';
    ctx.textBaseline = 'middle';
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((element, index) => {
        const rawValue = dataset.data[index];
        if (rawValue === null || rawValue === undefined || Number.isNaN(Number(rawValue))) return;
        const value = String(rawValue);
        const pos = element.tooltipPosition();
        let x = pos.x;
        let y = pos.y;
        ctx.fillStyle = '#064E3B';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        const isArc = element && typeof element.getProps === 'function' && ('outerRadius' in element || meta.type === 'doughnut' || meta.type === 'pie');
        if (isArc) {
          if (Number(rawValue) === 0) return;
          const arc = element.getProps(['x', 'y', 'startAngle', 'endAngle', 'outerRadius'], true);
          const angle = (arc.startAngle + arc.endAngle) / 2;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const lineStartX = arc.x + cos * (arc.outerRadius + 2);
          const lineStartY = arc.y + sin * (arc.outerRadius + 2);
          const lineEndX = arc.x + cos * (arc.outerRadius + 14);
          const lineEndY = arc.y + sin * (arc.outerRadius + 14);
          x = arc.x + cos * (arc.outerRadius + 34);
          y = arc.y + sin * (arc.outerRadius + 34);
          x = Math.min(Math.max(x, chartArea.left + 8), chartArea.right - 8);
          y = Math.min(Math.max(y, chartArea.top + 8), chartArea.bottom - 8);
          ctx.textAlign = cos >= 0 ? 'left' : 'right';
          ctx.strokeStyle = 'rgba(0,122,61,.42)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(lineStartX, lineStartY);
          ctx.lineTo(lineEndX, lineEndY);
          ctx.lineTo(x + (cos >= 0 ? -4 : 4), y);
          ctx.stroke();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 3;
        } else if (meta.type === 'bar' && chart.options.indexAxis === 'y') {
          x = Math.min(pos.x + 10, chartArea.right - 8);
          y = pos.y + 1;
          ctx.textAlign = 'left';
        } else if (meta.type === 'bar') {
          y = Math.max(pos.y - 9, chartArea.top + 10);
          ctx.textAlign = 'center';
        } else if (meta.type === 'line') {
          y = Math.max(pos.y - 13, chartArea.top + 12);
          ctx.textAlign = 'center';
        }
        ctx.strokeText(value, x, y);
        ctx.fillText(value, x, y);
      });
    });
    ctx.restore();
  }
};
Chart.register(labelPlugin);

function chartBase(extra = {}) {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 16, right: 10, bottom: 2, left: 2 } },
    plugins: {
      legend: { display: false, labels: { color: chartText, boxWidth: 10, boxHeight: 10, padding: 10, font: { size: 10 } } },
      tooltip: { backgroundColor: '#064E3B', borderColor: '#007A3D', borderWidth: 1 }
    },
    scales: {
      x: { ticks: { color: chartText, font: { size: 10 }, maxRotation: 0 }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: chartText, precision: 0, font: { size: 10 } }, grid: { color: chartGrid } }
    }
  };
  return {
    ...base,
    ...extra,
    plugins: { ...base.plugins, ...(extra.plugins || {}) },
    scales: extra.scales === null ? {} : { ...base.scales, ...(extra.scales || {}) },
    layout: { ...base.layout, ...(extra.layout || {}) },
    elements: { ...(base.elements || {}), ...(extra.elements || {}) }
  };
}

function lineOptions(values) {
  const maxValue = Math.max(0, ...values.map(value => Number(value) || 0));
  const suggestedMax = maxValue <= 4 ? maxValue + 2 : Math.ceil(maxValue * 1.18);
  return {
    layout: { padding: { top: 26, right: 16, bottom: 2, left: 2 } },
    elements: {
      line: { borderWidth: 2.2, tension: .34 },
      point: { radius: 3.5, hoverRadius: 5, borderWidth: 1.4, backgroundColor: '#FFFFFF', borderColor: chartGreen }
    },
    scales: {
      x: { ticks: { color: chartText, font: { size: 10 }, maxRotation: 0 }, grid: { display: false } },
      y: { beginAtZero: true, suggestedMax, ticks: { color: chartText, precision: 0, font: { size: 10 } }, grid: { color: chartGrid } }
    }
  };
}
function niceAxisStep(maxValue) {
  if (maxValue <= 10) return 1;
  if (maxValue <= 30) return 5;
  if (maxValue <= 100) return 10;
  if (maxValue <= 300) return 25;
  return 50;
}

function horizontalBarOptions(values, labelSize = 10) {
  const maxValue = Math.max(0, ...values.map(value => Number(value) || 0));
  const stepSize = niceAxisStep(maxValue);
  const suggestedMax = Math.max(stepSize, Math.ceil(maxValue / stepSize) * stepSize + stepSize);
  return {
    indexAxis: 'y',
    layout: { padding: { top: 10, right: 46, bottom: 4, left: 4 } },
    scales: {
      y: { ticks: { color: chartText, font: { size: labelSize }, autoSkip: false }, grid: { display: false } },
      x: {
        beginAtZero: true,
        suggestedMax,
        ticks: { color: chartText, precision: 0, stepSize, font: { size: 10 }, callback: value => Number(value) % stepSize === 0 ? value : '' },
        grid: { color: chartGrid }
      }
    }
  };
}

function renderChart(id, type, labels, values, options = {}) {
  state.charts[id]?.destroy();
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (typeof Chart === 'undefined') {
    const box = ctx.closest?.('.chart-box');
    if (box) {
      box.innerHTML = '<div class="chart-error">Chart.js belum termuat. Pastikan koneksi internet aktif atau pasang file Chart.js lokal di <b>static/vendor/chart.umd.min.js</b>.</div>';
    }
    return;
  }
  const isLine = type === 'line';
  const dataset = {
    data: values,
    borderColor: isLine ? chartGreen : 'transparent',
    backgroundColor: options.colors || (isLine ? 'rgba(0,122,61,.10)' : chartGreen),
    borderWidth: isLine ? 2 : 0,
    hoverBorderWidth: 0,
    borderSkipped: false,
    tension: .34,
    fill: isLine,
    pointRadius: isLine ? 3.5 : 3,
    pointBackgroundColor: '#FFFFFF',
    pointBorderColor: chartGreen
  };
  state.charts[id] = new Chart(ctx, { type, data: { labels, datasets: [dataset] }, options: chartBase(options.chartOptions || {}) });
}


function durationKpiValue(value) {
  const numeric = Number(value) || 0;
  return `<span class="kpi-duration-value">${decimalNumber.format(numeric)} <span>hari</span></span><em>rata-rata per surat</em>`;
}

function compactKpiText(value) {
  const text = String(value ?? '-').trim() || '-';
  return `<span class="kpi-text-value" title="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
}

function kpiCard(label, value, iconPath, tone = 'green') {
  const content = String(value).includes('<') ? value : escapeHtml(value);
  const durationClass = label === 'Durasi Sanksi' ? ' kpi-duration-card' : '';
  return `<div class="kpi kpi-${tone}${durationClass}">
    <img class="kpi-icon" src="${escapeHtml(iconPath)}" alt="" loading="lazy">
    <small>${escapeHtml(label)}</small>
    <b>${content}</b>
  </div>`;
}

function filterOptionValues(items) {
  return (items || []).map(item => String(typeof item === 'object' ? item.value : item));
}

function normalizeDashboardFilters(filters) {
  if (!filters) return false;
  let changed = false;
  const checks = [
    ['year', filters.years],
    ['month', filters.months],
    ['department', filters.departments],
    ['type', filters.types],
    ['position', filters.positions],
    ['status', filters.statuses],
  ];
  checks.forEach(([key, options]) => {
    const value = state.filters[key];
    if (!value || value === 'all') return;
    if (!filterOptionValues(options).includes(String(value))) {
      delete state.filters[key];
      changed = true;
    }
  });
  return changed;
}
async function renderDashboard() {
  const root = $('#view-dashboard');
  const renderId = ++state.dashboardRenderId;
  const activeSearch = document.activeElement?.id === 'f-search' ? document.activeElement : null;
  const keepSearchFocus = Boolean(activeSearch);
  const searchSelectionStart = keepSearchFocus ? activeSearch.selectionStart : null;
  const searchSelectionEnd = keepSearchFocus ? activeSearch.selectionEnd : null;
  const query = new URLSearchParams(state.filters).toString();
  let data;
  try {
    data = await api(`/api/dashboard?${query}`);
  } catch (error) {
    if (renderId !== state.dashboardRenderId) return;
    root.innerHTML = databaseErrorPanel('Dashboard belum bisa dibuka', error);
    return;
  }
  if (renderId !== state.dashboardRenderId) return;
  const filters = data.filters;
    if (normalizeDashboardFilters(filters)) {
    await renderDashboard();
    return;
  }
  root.innerHTML = `
    <div class="dashboard-navbar mb-3">
      <div class="dashboard-filter-pill">
        ${icon('filter', 'ui-icon filter-funnel')}
        <span class="filter-label">FILTERS:</span>
        ${dashboardFilterMenu('year', 'Tahun', filters.years, state.filters.year)}
        <span class="nav-separator"></span>
        ${dashboardFilterMenu('department', 'Dept.', filters.departments, state.filters.department)}
        <span class="nav-separator"></span>
        ${dashboardFilterMenu('type', 'Jenis', filters.types, state.filters.type)}
      </div>
      <div class="dashboard-search-wrap">
        ${icon('search')}
        <input id="f-search" class="dashboard-search" placeholder="Cari PERNER" value="${escapeHtml(state.filters.search || '')}">
      </div>
      <div class="dashboard-actions">
        <button id="export-dashboard-pdf" class="btn danger" type="button">${icon('download')} Export</button>
        <button id="open-upload" class="btn danger">${icon('upload')} Upload</button>
      </div>
    </div>
    <div class="dashboard-kpi-grid mb-2">
      ${[
        ['Total Surat Sanksi', data.kpi.total_sanksi, '/assets/icon/icon1.png', 'green'],
        ['Top Jenis Sanksi', compactKpiText(sanctionTypeDisplayLabel(data.kpi.top_jenis_sanksi)), '/assets/icon/icon2.png', 'green'],
        ['Top Sanksi Berdasarkan Dept', compactKpiText(data.kpi.top_departemen), '/assets/icon/icon3.png', 'red'],
        ['Top Pelanggar Berulang', compactKpiText(data.kpi.top_pelanggar_berulang), '/assets/icon/icon4.png', 'red'],
        ['Kategori Pelanggaran Terbanyak', compactKpiText(data.kpi.top_kategori_pelanggaran), '/assets/icon/icon5.png', 'green']
      ].map(([label, value, iconPath, tone]) => kpiCard(label, value, iconPath, tone)).join('')}
    </div>
    <div class="dashboard-visual-grid">
      ${chartCard('Tren Sanksi Bulanan', 'monthlyChart', 'visual-monthly')}
      ${chartCard('Komposisi Jenis Sanksi', 'typeChart', 'visual-type')}
      ${chartCard('Sanksi Berdasarkan Departemen', 'departmentChart', 'visual-department')}
      ${chartCard('Top Pelanggar Berulang', 'repeatChart', 'visual-repeat')}
      ${chartCard('Tren Sanksi Tahunan', 'yearChart', 'visual-yearly')}
      ${statusSanctionCard(data.charts.statusSanctions || data.charts.activeSanctions || [], dashboardStatusDetailActive())}
      <div class="visual-violation ${state.filters.search ? 'search-active' : ''}">${violationTableCard(data.charts.violations, Boolean(state.filters.search))}</div>
    </div>`;
  bindDashboardFilters();
  destroyCharts();
  const monthlyValues = data.charts.monthly.map(x => x.jumlah);
  const typeRows = groupedSanctionTypeRows(data.charts.types);
  const statusRows = visibleStatusRows(data.charts.statuses);
  renderChart('monthlyChart', 'line', data.charts.monthly.map(x => x.bulan), monthlyValues, { chartOptions: lineOptions(monthlyValues) });
  renderChart('typeChart', 'doughnut', chartLabels(typeRows, 'jenis_sanksi'), typeRows.map(x => x.jumlah), { colors: TYPE_CHART_COLORS, chartOptions: { cutout: '58%', radius: '62%', layout: { padding: { top: 34, right: 42, bottom: 34, left: 42 } }, plugins: { legend: { display: true, position: 'right', align: 'center', labels: { color: chartText, boxWidth: 10, boxHeight: 10, padding: 10, font: { size: 10 } } } }, scales: null } });
  renderChart('departmentChart', 'bar', chartLabelsTruncated(data.charts.departments, 'departemen_seksi', 30), data.charts.departments.map(x => x.jumlah), { chartOptions: horizontalBarOptions(data.charts.departments.map(x => x.jumlah), 10) });
  renderChart('repeatChart', 'bar', chartLabels(data.charts.repeatOffenders, 'nama_karyawan'), data.charts.repeatOffenders.map(x => x.jumlah), { colors: chartRed, chartOptions: horizontalBarOptions(data.charts.repeatOffenders.map(x => x.jumlah), 10) });
  const yearlyValues = data.charts.yearly.map(x => x.jumlah);
  renderChart('yearChart', 'line', data.charts.yearly.map(x => x.tahun_sanksi), yearlyValues, { chartOptions: lineOptions(yearlyValues) });
  renderChart('statusChart', 'doughnut', chartLabels(statusRows, 'status_sanksi'), statusRows.map(x => x.jumlah), { colors: statusChartColors(statusRows), chartOptions: { cutout: '58%', radius: '62%', layout: { padding: { top: 34, right: 38, bottom: 34, left: 38 } }, plugins: { legend: { display: true, position: 'right', align: 'center', labels: { color: chartText, boxWidth: 10, boxHeight: 10, padding: 10, font: { size: 10 } } } }, scales: null } });
  $('#open-upload').onclick = openUploadModal;
  $('#export-dashboard-pdf').onclick = exportDashboardPdf;
  if (keepSearchFocus) {
    const search = $('#f-search');
    if (search) {
      const start = Math.min(searchSelectionStart ?? search.value.length, search.value.length);
      const end = Math.min(searchSelectionEnd ?? start, search.value.length);
      search.focus({ preventScroll: true });
      search.setSelectionRange(start, end);
    }
  }
}



function truncateLabel(value, max = 24) {
  const text = String(value ?? 'Tidak diketahui').trim() || 'Tidak diketahui';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
function statusChartColors(rows) {
  return rows.map(row => STATUS_COLORS[String(row.status_sanksi || '').trim()] || '#8F99AA');
}

function sanctionTypeSortRank(value) {
  const text = String(value || '').toUpperCase();
  if (text.includes('SURAT PERNYATAAN') || /\bST\s*[- ]?(I{1,3}|[123])?\b/.test(text) || text.includes('TEGURAN')) return 10;
  if (/\bSP\s*[- ]?(I{1,3}|[123])?\b/.test(text) || text.includes('PERINGATAN')) return 20;
  if (text.includes('PHK') || text.includes('DISKUALIFIKASI') || text.includes('MENGUNDUR')) return 30;
  return 99;
}

function sortedSanctionTypes(rows) {
  return [...(rows || [])].sort((a, b) => {
    const rank = sanctionTypeSortRank(a.jenis_sanksi) - sanctionTypeSortRank(b.jenis_sanksi);
    if (rank) return rank;
    return String(a.jenis_sanksi || '').localeCompare(String(b.jenis_sanksi || ''), 'id');
  });
}

function sanctionTypeDisplayLabel(value) {
  const text = String(value || '').trim();
  const upper = text.toUpperCase();
  if (upper.includes('PHK') || upper.includes('DISKUALIFIKASI') || upper.includes('MENGUNDUR')) return 'PHK';
  return text || 'Tidak diketahui';
}

function groupedSanctionTypeRows(rows) {
  const grouped = new Map();
  (rows || []).forEach(row => {
    const label = sanctionTypeDisplayLabel(row.jenis_sanksi);
    const current = grouped.get(label) || { jenis_sanksi: label, jumlah: 0 };
    current.jumlah += Number(row.jumlah) || 0;
    grouped.set(label, current);
  });
  return sortedSanctionTypes([...grouped.values()]);
}

function visibleStatusRows(rows) {
  return (rows || []).filter(row => String(row.status_sanksi || '').trim().toLowerCase() !== 'belum dimulai');
}

function dashboardStatusDetailActive() {
  return ['year', 'month', 'department', 'type', 'position', 'status', 'search'].some(key => {
    const value = String(state.filters?.[key] ?? '').trim();
    return value && value !== 'all';
  });
}

function chartLabels(rows, key, fallback = 'Tidak diketahui') {
  return rows.map(row => {
    const value = row?.[key];
    return value === null || value === undefined || String(value).trim() === '' ? fallback : String(value);
  });
}

function chartLabelsTruncated(rows, key, max = 26) {
  return chartLabels(rows, key).map(label => truncateLabel(label, max));
}

function violationTableCard(rows, expanded = false) {
  const visibleRows = rows.slice(0, 7);
  const compactClass = [visibleRows.length > 5 ? 'compact' : '', expanded ? 'expanded' : ''].filter(Boolean).join(' ');
  const body = visibleRows.length ? visibleRows.map(row => `<div class="violation-row"><span title="${escapeHtml(row.uraian_pelanggaran || 'Tidak diketahui')}">${escapeHtml(row.uraian_pelanggaran || 'Tidak diketahui')}</span><b>${escapeHtml(row.jumlah)}</b></div>`).join('') : '<div class="violation-empty">Belum ada data</div>';
  return `<div class="violation-table-card ${compactClass}"><h3>Kategori Pelanggaran</h3><div class="violation-head"><span>KATEGORI</span><span>JUMLAH</span></div><div class="violation-body">${body}</div></div>`;
}
function statusSanctionCard(statusRows, detailActive = false) {
  const notes = detailActive ? statusSanctionNotesHtml(statusRows || []) : '';
  return `<div class="chart-card visual-status ${detailActive ? 'status-search-active' : ''}"><h3>Status Sanksi</h3><div class="chart-box"><canvas id="statusChart"></canvas></div>${notes}</div>`;
}

function statusSanctionNotesHtml(rows) {
  if (!rows.length) {
    return `<div class="active-sanction-notes empty"><b>Detail Status Sanksi</b><span>Tidak ada detail sanksi aktif atau berakhir pada filter ini.</span></div>`;
  }
  const visibleRows = prioritizedStatusNoteRows(rows);
  return `<div class="active-sanction-notes"><b>Detail Status Sanksi</b>${visibleRows.map(row => {
    const status = String(row.status_sanksi || '').trim() || 'Status';
    const statusClass = status.toLowerCase() === 'berakhir' ? 'ended' : 'active';
    const period = [row.tanggal_mulai_sanksi, row.tanggal_berakhir_sanksi].filter(Boolean).join(' - ');
    const duration = row.durasi_label || (row.durasi_sanksi_hari ? `${row.durasi_sanksi_hari} hari` : '');
    const periodDetail = [period, duration].filter(Boolean).join(' | ');
    const periodLabel = period ? `Periode: ${period}` : '';
    return `<div class="active-sanction-row">
      <strong title="${escapeHtml(periodLabel || status)}"><span class="status-note-badge ${statusClass}">${escapeHtml(status)}</span>${escapeHtml(sanctionTypeDisplayLabel(row.jenis_sanksi) || row.nomor_surat_sanksi || '-')}</strong>
      <span>${escapeHtml(row.uraian_pelanggaran || row.nomor_surat_sanksi || 'Tidak ada keterangan')}</span>
      ${periodDetail ? `<small>${escapeHtml([periodLabel, duration].filter(Boolean).join(' | '))}</small>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function prioritizedStatusNoteRows(rows, maxRows = 3) {
  const list = rows || [];
  const active = list.filter(row => String(row.status_sanksi || '').trim().toLowerCase() === 'aktif');
  const ended = list.filter(row => String(row.status_sanksi || '').trim().toLowerCase() === 'berakhir');
  if (!active.length || !ended.length) return list.slice(0, maxRows);

  const selected = [...active.slice(0, 2), ...ended.slice(0, 2)];
  const used = new Set(selected);
  for (const row of list) {
    if (selected.length >= maxRows) break;
    if (!used.has(row)) selected.push(row);
  }
  return selected.slice(0, maxRows);
}

function chartCard(title, id, className = '') { return `<div class="chart-card ${className}"><h3>${title}</h3><div class="chart-box"><canvas id="${id}"></canvas></div></div>`; }
function bindDashboardFilters() {
  $$('.filter-menu-btn').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      const item = button.closest('.custom-filter');
      const isOpen = item.classList.contains('open');
      $$('.custom-filter.open').forEach(openItem => {
        openItem.classList.remove('open');
        openItem.querySelector('.filter-menu-btn')?.setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('open', !isOpen);
      button.setAttribute('aria-expanded', String(!isOpen));
    };
    button.onkeydown = event => {
      if (event.key === 'Escape') button.closest('.custom-filter')?.classList.remove('open');
    };
  });
  $$('.filter-menu-option').forEach(option => {
    option.onclick = event => {
      event.stopPropagation();
      const key = option.dataset.filterKey;
      state.filters[key] = option.dataset.value;
      renderDashboard();
    };
  });
  document.onclick = () => $$('.custom-filter.open').forEach(item => item.classList.remove('open'));
  const search = $('#f-search');
  const searchWrap = $('.dashboard-search-wrap');
  if (searchWrap && search) searchWrap.onclick = () => search.focus({ preventScroll: true });
  if (search) {
    search.oninput = e => {
      const nextValue = e.target.value.trim();
      state.filters.search = nextValue;
      clearTimeout(state.dashboardSearchTimer);
      state.dashboardSearchTimer = setTimeout(() => {
        if (state.view === 'dashboard' && state.filters.search === nextValue) renderDashboard();
      }, 450);
    };
    search.onkeydown = e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      clearTimeout(state.dashboardSearchTimer);
      state.filters.search = e.currentTarget.value.trim();
      renderDashboard();
    };
  }
}

function exportDashboardCsv() {
  const query = new URLSearchParams(state.filters).toString();
  window.location.href = `/api/dashboard/export?${query}`;
}

function exportDashboardPdf() {
  const button = $('#export-dashboard-pdf');
  setButtonLoading(button, true);

  const searchInput = $('#f-search');
  if (searchInput) {
    const searchValue = searchInput.value.trim();
    if (searchValue) state.filters.search = searchValue;
    else delete state.filters.search;
    clearTimeout(state.dashboardSearchTimer);
  }
  const params = new URLSearchParams(state.filters);
  const previewParams = new URLSearchParams(params);
  previewParams.set('preview', '1');
  const downloadParams = new URLSearchParams(params);
  downloadParams.set('download', '1');
  const previewUrl = `/api/dashboard/export/pdf?${previewParams.toString()}`;
  const downloadUrl = `/api/dashboard/export/pdf?${downloadParams.toString()}`;
  openModal(`<div class="pdf-preview-modal">
    <div class="pdf-preview-head">
      <div><h2>Preview Export Dashboard</h2><p>Visualisasi mengikuti filter dashboard yang sedang aktif.</p></div>
      <div class="pdf-preview-actions">
        <a id="download-dashboard-pdf" class="btn danger" href="${downloadUrl}">${icon('download')} Download</a>
        <button id="close-modal" class="btn" type="button">Tutup</button>
      </div>
    </div>
    <div class="dashboard-pdf-preview-wrap">
      <div id="dashboard-pdf-loader" class="pdf-loader-overlay"><span class="donut-loader"></span></div>
      <iframe id="dashboard-pdf-frame" class="dashboard-pdf-frame" src="${previewUrl}"></iframe>
    </div>
  </div>`);
  $('#close-modal').onclick = () => { setButtonLoading(button, false); closeModal(); };
  const frame = $('#dashboard-pdf-frame');
  const loader = $('#dashboard-pdf-loader');
  frame.onload = () => {
    loader?.classList.add('hidden');
    setButtonLoading(button, false);
  };
  frame.onerror = () => {
    loader?.classList.add('hidden');
    setButtonLoading(button, false);
  };
}

function databaseErrorPanel(title, error) {
  const message = error?.message || 'Database belum siap.';
  return `<div class="db-error-page">
    <div class="db-error-card">
      <div class="db-error-icon">!</div>
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        <div class="db-error-steps">
          <span>1. Buka XAMPP Control Panel.</span>
          <span>2. Klik Start pada service MySQL.</span>
          <span>3. Pastikan .env sesuai: DB_HOST=127.0.0.1, DB_PORT=3306, DB_USER=root.</span>
          <span>4. Restart aplikasi Flask, lalu refresh browser.</span>
        </div>
      </div>
    </div>
  </div>`;
}

function tableHtml(columns, rows, editable = false) {
  if (!columns.length) return '<div class="panel p-8 text-muted text-sm">Belum ada data.</div>';
  return `<div class="table-wrap"><table><thead><tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((row, r) => `<tr>${columns.map(c => `<td ${editable ? 'contenteditable="true"' : ''} data-row="${r}" data-col="${escapeHtml(c)}">${escapeHtml(row[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function validationErrorsHtml(errors = []) {
  const rows = Array.isArray(errors) ? errors : [];
  if (!rows.length) return '';
  const columns = [
    ['nomor_baris_excel', 'Baris Excel'],
    ['nama_kolom', 'Kolom'],
    ['nilai_asli', 'Nilai'],
    ['jenis_kesalahan', 'Masalah'],
    ['saran_perbaikan', 'Saran Perbaikan']
  ];
  return `<div class="transform-errors">
    <h3>Error Validasi</h3>
    <div class="table-wrap"><table>
      <thead><tr>${columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${columns.map(([key]) => `<td>${escapeHtml(row?.[key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

function uploadPreviewHtml(data) {
  const sheets = data.sheet_details || [];
  const sheetRows = sheets.map(sheet => {
    const checked = (sheet.selected || (sheet.valid_structure && !data.selected_sheets?.length)) ? 'checked' : '';
    const disabled = sheet.valid_structure ? '' : 'disabled';
    const isIgnored = Boolean(sheet.ignored);
    const validButton = !isIgnored && (Number(sheet.valid || 0) || (sheet.valid_details || []).length)
      ? `<button type="button" class="upload-valid-link" data-valid-sheet="${escapeHtml(sheet.name)}">valid ${escapeHtml(sheet.valid || (sheet.valid_details || []).length)}</button>`
      : isIgnored ? '' : '<span>valid 0</span>';
    const invalidButton = !isIgnored && (Number(sheet.invalid || 0) || (sheet.invalid_details || []).length)
      ? `<button type="button" class="upload-invalid-link" data-invalid-sheet="${escapeHtml(sheet.name)}">invalid ${escapeHtml(sheet.invalid || (sheet.invalid_details || []).length)}</button>`
      : isIgnored ? '' : '<span>invalid 0</span>';
    const meta = isIgnored ? `diabaikan - ${sheet.ignore_reason || 'nama sheet tidak sesuai'}` : sheet.valid_structure ? `${sheet.rows} baris` : `diabaikan ${sheet.invalid || 0}`;
    return `<label class="upload-sheet-row ${sheet.valid_structure ? '' : 'disabled'}">
      <input type="checkbox" class="sheet-check" value="${escapeHtml(sheet.name)}" ${checked} ${disabled}>
      <span>${escapeHtml(sheet.name)}</span>
      <small>${escapeHtml(meta)} ${validButton} ${invalidButton}</small>
    </label>`;
  }).join('');
  const totalValid = Number(data.valid || 0);
  const totalInvalid = Number(data.invalid || 0);
  const validSummary = totalValid ? `<button type="button" class="upload-valid-summary" data-valid-sheet="__all">Detail valid: ${escapeHtml(totalValid)} baris</button>` : '';
  const invalidSummary = totalInvalid ? `<button type="button" class="upload-invalid-summary" data-invalid-sheet="__all">Detail invalid: ${escapeHtml(totalInvalid)} baris</button>` : '';
  const rowCount = data.rows?.length || 0;
  return `<div class="upload-detail-card">
    <h3>Detail File &amp; Sheet</h3>
    <p>${escapeHtml(data.file_name)} | sheet dipilih: ${escapeHtml(data.selected_sheets?.length || 0)} | valid: ${escapeHtml(data.valid)} | tidak valid: ${escapeHtml(data.invalid)} ${validSummary} ${invalidSummary}</p>
    <div class="upload-sheet-list">
      <div class="upload-sheet-label">Sheet yang akan diproses</div>
      ${sheetRows || '<div class="upload-sheet-empty">Tidak ada sheet valid.</div>'}
    </div>
  </div>
  <div class="upload-preview-card">
    <div class="upload-preview-head">
      <h3>Preview Data</h3>
      <span>Showing top ${escapeHtml(rowCount)} rows</span>
    </div>
    ${tableHtml(data.columns, data.rows)}
  </div>
  <div class="upload-preview-actions">
    <button id="go-transform" class="btn upload-action-secondary">Transform Data</button>
    <button id="load-data" class="btn primary upload-action-primary" type="button">Load Data</button>
  </div>`;
}

function uploadValidDetails(sheetName = '__all') {
  const details = (state.stagedUpload?.sheet_details || []).flatMap(sheet => {
    const rows = sheet.valid_details || [];
    if (sheetName !== '__all' && String(sheet.name) !== String(sheetName)) return [];
    return rows.map(row => ({ ...row, sheet: row.sheet || sheet.name }));
  });
  openModal(`<div class="upload-invalid-modal upload-valid-modal">
    <div class="upload-invalid-head">
      <h2>Detail Data Valid</h2>
      <button type="button" id="close-modal" class="btn">Tutup</button>
    </div>
    <p>${escapeHtml(sheetName === '__all' ? 'Semua sheet' : sheetName)} | ${details.length} baris valid ditemukan</p>
    <div class="upload-invalid-table">
      <table>
        <thead><tr><th>Sheet</th><th>Baris</th><th>Nomor Surat</th><th>PERNER</th><th>Nama</th><th>Dept.</th><th>Jenis</th><th>Uraian</th></tr></thead>
        <tbody>${details.map(row => `<tr>
          <td>${escapeHtml(row.sheet || '-')}</td>
          <td>${escapeHtml(row.nomor_baris_excel || '-')}</td>
          <td>${escapeHtml(row.nomor_surat_sanksi || '-')}</td>
          <td>${escapeHtml(row.perner_karyawan || '-')}</td>
          <td>${escapeHtml(row.nama_karyawan || '-')}</td>
          <td>${escapeHtml(row.departemen_seksi || '-')}</td>
          <td>${escapeHtml(row.jenis_sanksi || '-')}</td>
          <td>${escapeHtml(row.uraian_pelanggaran || '-')}</td>
        </tr>`).join('') || '<tr><td colspan="8">Tidak ada detail valid.</td></tr>'}</tbody>
      </table>
    </div>
  </div>`);
  $('#close-modal').onclick = () => {
    closeModal();
    if (state.stagedUpload) openUploadPreviewModalFromState();
  };
}

function uploadInvalidDetails(sheetName = '__all') {
  const details = (state.stagedUpload?.sheet_details || []).flatMap(sheet => {
    const rows = sheet.invalid_details || [];
    if (sheetName !== '__all' && String(sheet.name) !== String(sheetName)) return [];
    return rows.map(row => ({ ...row, sheet: row.sheet || sheet.name }));
  });
  openModal(`<div class="upload-invalid-modal">
    <div class="upload-invalid-head">
      <h2>Detail Data Tidak Valid</h2>
      <button type="button" id="close-modal" class="btn">Tutup</button>
    </div>
    <p>${escapeHtml(sheetName === '__all' ? 'Semua sheet' : sheetName)} | ${details.length} masalah ditemukan</p>
    <div class="upload-invalid-table">
      <table>
        <thead><tr><th>Sheet</th><th>Baris</th><th>Kolom</th><th>Nilai</th><th>Masalah</th><th>Saran</th></tr></thead>
        <tbody>${details.map(row => `<tr>
          <td>${escapeHtml(row.sheet || '-')}</td>
          <td>${escapeHtml(row.nomor_baris_excel || '-')}</td>
          <td>${escapeHtml(row.nama_kolom || '-')}</td>
          <td>${escapeHtml(row.nilai_asli ?? '-')}</td>
          <td>${escapeHtml(row.jenis_kesalahan || '-')}</td>
          <td>${escapeHtml(row.saran_perbaikan || '-')}</td>
        </tr>`).join('') || '<tr><td colspan="6">Tidak ada detail invalid.</td></tr>'}</tbody>
      </table>
    </div>
  </div>`);
  $('#close-modal').onclick = () => {
    closeModal();
    if (state.stagedUpload) openUploadPreviewModalFromState();
  };
}

function openUploadPreviewModalFromState() {
  openModal(`<div class="sanction-upload-modal">
    ${uploadModalHeaderHtml()}
    <div id="upload-preview" class="sanction-upload-preview">${uploadPreviewHtml(state.stagedUpload)}</div>
  </div>`);
  $('#close-modal').onclick = closeModal;
  bindUploadPreviewActions();
}

function uploadModalHeaderHtml() {
  return `<div class="sanction-upload-head">
    <h2>Upload Data Sanksi</h2>
    <button class="sanction-upload-close" id="close-modal" type="button">Tutup</button>
  </div>`;
}

function openModal(html) {
  const modal = $('#modal-root');
  document.body.classList.add('modal-open');
  modal.classList.remove('hidden');
  modal.innerHTML = `<div class="modal-box mx-auto max-w-6xl p-6">${html}</div>`;
}
function closeModal() {
  const modal = $('#modal-root');
  document.body.classList.remove('modal-open');
  modal.classList.add('hidden');
  modal.innerHTML = '';
}

function sheetSelectionHtml(details) {
  return `<div class="panel p-4 mb-3"><div class="text-sm font-bold mb-3">Sheet yang akan diproses</div><div class="grid grid-cols-2 gap-2">${details.map(sheet => {
    const checked = sheet.selected ? 'checked' : '';
    const disabled = sheet.valid_structure ? '' : 'disabled';
    const status = sheet.valid_structure ? `<span class="text-mint2">valid ${sheet.valid}</span><span class="text-muted">invalid ${sheet.invalid}</span>` : `<span class="text-red-300">diabaikan</span>`;
    const reason = sheet.valid_structure ? '' : `<div class="text-[11px] text-muted mt-1 truncate">${escapeHtml((sheet.missing_columns || []).join(', '))}</div>`;
    return `<label class="soft-panel p-3 flex gap-3 items-start ${sheet.valid_structure ? '' : 'opacity-60'}"><input type="checkbox" class="sheet-check mt-1" value="${escapeHtml(sheet.name)}" ${checked} ${disabled}><span class="min-w-0"><b class="block text-sm truncate">${escapeHtml(sheet.name)}</b><span class="flex gap-3 text-xs mt-1"><span>${sheet.rows} baris</span>${status}</span>${reason}</span></label>`;
  }).join('')}</div></div>`;
}

function updateSelectedSheets() {
  if (!state.stagedUpload) return;
  state.stagedUpload.selected_sheets = $$('.sheet-check:checked').map(input => input.value);
  const loadButton = $('#load-data');
  if (loadButton) loadButton.disabled = false;
}

function selectedUploadSheets() {
  const checked = $$('.sheet-check:checked').map(input => input.value);
  if (checked.length) return checked;
  const existing = (state.stagedUpload?.selected_sheets || []).map(String).filter(Boolean);
  if (existing.length) return existing;
  return (state.stagedUpload?.sheet_details || [])
    .filter(sheet => sheet.valid_structure)
    .map(sheet => String(sheet.name || '').trim())
    .filter(Boolean);
}

function openUploadModal() {
  state.stagedUpload = null;
  openModal(`<div class="sanction-upload-modal">
    ${uploadModalHeaderHtml()}
    <div class="sanction-upload-card">
      <div class="sanction-upload-title">
        <span>Pilih File</span>
      </div>
      <label class="sanction-upload-zone">
        <input id="sanction-file" type="file" accept=".xlsx,.xls,.xlsm,.xlsb,.xltx,.xltm,.csv">
      </label>
    </div>
    <div id="upload-preview" class="sanction-upload-preview"></div>
  </div>`);
  $('#close-modal').onclick = closeModal;
  $('#sanction-file').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    $('#upload-preview').innerHTML = '<div class="panel p-4 text-muted">Memindai semua sheet...</div>';
    const data = await api('/api/sanctions/preview', { method: 'POST', body: fd });
    state.stagedUpload = data;
    $('#upload-preview').innerHTML = uploadPreviewHtml(data);
    bindUploadPreviewActions();
  };
}

function bindUploadPreviewActions() {
  $$('.sheet-check').forEach(input => input.onchange = updateSelectedSheets);
  updateSelectedSheets();
  $('#go-transform')?.addEventListener('click', transformStagedUpload);
  $('#load-data')?.addEventListener('click', loadStagedUpload);
  $$('[data-invalid-sheet]').forEach(button => {
    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      uploadInvalidDetails(button.dataset.invalidSheet);
    };
  });
  $$('[data-valid-sheet]').forEach(button => {
    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      uploadValidDetails(button.dataset.validSheet);
    };
  });
  $('#upload-preview')?.addEventListener('click', event => {
    if (event.target.closest?.('#load-data')) loadStagedUpload(event);
  });
}

async function loadStagedUpload(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if (!state.stagedUpload) return;
  $$('#upload-preview .upload-inline-error').forEach(element => element.remove());
  updateSelectedSheets();
  state.stagedUpload.selected_sheets = selectedUploadSheets();
  const loadButton = $('#load-data');
  setButtonLoading(loadButton, true);
  showScreenLoading('Memuat data sanksi...');
  try {
    await api('/api/sanctions/load', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.stagedUpload) });
    closeModal();
    state.filters = {};
    if (state.view === 'dashboard') {
      await renderDashboard();
    } else {
      setView('dashboard');
    }
  } catch (error) {
    $('#upload-preview').insertAdjacentHTML('afterbegin', `<div class="panel p-3 mb-3 text-red-200 text-sm upload-inline-error">${escapeHtml(error.message || 'Data belum bisa dimuat.')}</div>`);
  } finally {
    hideScreenLoading();
    setButtonLoading(loadButton, false);
    updateSelectedSheets();
  }
}

async function transformStagedUpload(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if (!state.stagedUpload) return;
  $$('#upload-preview .upload-inline-error').forEach(element => element.remove());
  updateSelectedSheets();
  state.stagedUpload.selected_sheets = selectedUploadSheets();
  const button = $('#go-transform');
  setButtonLoading(button, true);
  showScreenLoading('Menyiapkan data transform...');
  try {
    const data = await api('/api/sanctions/transform-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.stagedUpload)
    });
    state.transformDraft = data;
    state.transformBatchId = '';
    state.activeTransformSheet = '';
    state.transformSearch = '';
    closeModal();
    setView('transform');
  } catch (error) {
    $('#upload-preview').insertAdjacentHTML('afterbegin', `<div class="panel p-3 mb-3 text-red-200 text-sm upload-inline-error">${escapeHtml(error.message || 'Data belum bisa dibuka di Transform.')}</div>`);
  } finally {
    hideScreenLoading();
    setButtonLoading(button, false);
    updateSelectedSheets();
  }
}

async function renderTransform() {
  const root = $('#view-transform');
  if (state.transformTab === 'master') {
    await renderEmployeeMaster();
    return;
  }
  refreshEmployeeMasterCache().catch(error => console.warn('Master karyawan belum bisa disegarkan', error));
  try {
    let data;
    if (state.transformDraft && !state.transformBatchId) {
      data = state.transformDraft;
    } else {
      const transformQuery = state.transformBatchId ? ('?batch_id=' + encodeURIComponent(state.transformBatchId)) : '';
      data = await api('/api/transform' + transformQuery);
      state.transformDraft = null;
    }
    state.transformBatchId = data.selected_batch_id || state.transformBatchId || '';
    state.transformBatches = data.batches || [];
    const availableColumns = transformInputColumns.filter(column => (data.columns || []).includes(column));
    state.transformColumns = availableColumns.length ? availableColumns : [...transformInputColumns];
    const incomingSheets = data.meta?.sheets?.length ? data.meta.sheets : [data.meta?.sheet_name || 'Data Sanksi'];
    state.transformSheets = incomingSheets.map(sheet => String(sheet).trim()).filter(Boolean);
    if (!state.transformSheets.length) state.transformSheets = ['Data Sanksi'];
    state.transformSheetRows = Object.fromEntries(state.transformSheets.map((sheet, index) => [sheet, index === 0 ? data.rows : []]));
    if (!state.activeTransformSheet || !state.transformSheets.includes(state.activeTransformSheet)) state.activeTransformSheet = state.transformSheets[0];
    state.transformRows = activeTransformRows();
    ensureTrailingTransformRow();
    state.selectedTransformRows = new Set();
    state.selectedTransformCells = new Set();
    state.selectedTransformHeaders = new Set();
    state.transformSelectionAnchor = null;
    state.transformHeaderSelectionAnchor = null;
    state.transformUndoStack = [];
    state.transformCellSnapshot = null;
    const readOnlyMode = transformReadOnlyMode();
    const editDisabled = readOnlyMode ? 'disabled title="Kosongkan search dan pilih file spesifik untuk edit/save."' : '';
    root.innerHTML = `
      ${transformModeTabsHtml()}
      <div class="transform-workbench">
        <div class="transform-toolbar">
          <div class="transform-title">${icon('table')}Transform & Edit Data</div>
          <div class="transform-divider"></div>
          <button id="add-row" class="transform-tool add" ${editDisabled}>${icon('plus')} Add Column</button>
          <button id="edit-row" class="transform-tool edit" ${editDisabled}>${icon('edit')} Edit</button>
          <button id="delete-row" class="transform-tool delete">${icon('trash')} Delete File</button>
          <div class="transform-toolbar-spacer"></div>
          <label class="transform-search-box">${icon('search')}<input id="transform-search" value="${escapeHtml(state.transformSearch || '')}" placeholder="Cari nama / PERNER"></label>
          <select id="transform-batch-select" class="transform-batch-select">${transformBatchOptionsHtml()}</select>
          <button id="export-transform" class="transform-export">${icon('download')} Export</button>
        </div>
        <div id="transform-table-host">  <div id="transform-spreadsheet"></div> </div>
        <button id="save-transform" class="transform-save" ${editDisabled}>${icon('save')} Save</button>
        <div class="transform-tabs">${transformSheetTabsHtml()}</div>
      </div>
      `;
    bindTransformModeTabs();
    $('#transform-batch-select').onchange = e => { state.transformBatchId = e.target.value; renderTransform(); };
    $('#transform-search').oninput = e => { state.transformSearch = e.target.value; updateTransformToolbarState(); renderTransformSpreadsheet(); };
    $('#add-row').onclick = addTransformColumn;
    $('#edit-row').onclick = focusSelectedTransformRow;
    $('#delete-row').onclick = confirmDeleteTransformBatch;
    $('#export-transform').onclick = exportTransformExcel;
    $('#save-transform').onclick = saveTransform;
    bindTransformSheetTabs();
    renderTransformSpreadsheet();
    // bindEditableTable();
    // bindColumnResize();
    // bindTransformUndoShortcut();
  } catch (error) {
    root.innerHTML = databaseErrorPanel('Transform belum bisa dibuka', error);
  }
}

const transformInputColumns = [
  'nomor_surat_sanksi',
  'tanggal_mulai_sanksi',
  'tanggal_berakhir_sanksi',
  'perner_karyawan',
  'nama_karyawan',
  'jabatan_karyawan',
  'departemen_seksi',
  'jenis_sanksi',
  'uraian_pelanggaran',
];
const SANCTION_NUMBER_COLUMN = 'nomor_surat_sanksi';
const SANCTION_NUMBER_PATTERN = /^(\d{1,5})\/SK\/IR-ER\/WKS\/([IVX]+)\/(\d{4})$/i;
const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const MONTH_NAME_TO_ROMAN = {
  jan: 'I', januari: 'I', january: 'I',
  feb: 'II', februari: 'II', february: 'II',
  mar: 'III', maret: 'III', march: 'III',
  apr: 'IV', april: 'IV',
  mei: 'V', may: 'V',
  jun: 'VI', juni: 'VI', june: 'VI',
  jul: 'VII', juli: 'VII', july: 'VII',
  agu: 'VIII', agt: 'VIII', agustus: 'VIII', august: 'VIII',
  sep: 'IX', september: 'IX',
  okt: 'X', oktober: 'X', october: 'X',
  nov: 'XI', november: 'XI',
  des: 'XII', desember: 'XII', december: 'XII', dec: 'XII',
};
const SANCTION_DURATION_DAYS = [
  { pattern: /surat\s*pernyataan/i, days: 1 },
];
const SANCTION_DURATION_MONTHS = [
  { pattern: /\bsp\s*[- ]?i{0,3}\b|\bsp\s*[- ]?[123]\b|peringatan/i, months: 6 },
  { pattern: /\bst\s*[- ]?i{0,3}\b|\bst\s*[- ]?[123]\b|teguran/i, months: 3 },
];
const OPEN_ENDED_SANCTION_PATTERN = /phk|diskualifikasi|mengundur(?:kan)?(?:\s+diri)?/i;

function sanctionDurationDays(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const match = SANCTION_DURATION_DAYS.find(item => item.pattern.test(text));
  return match ? match.days : null;
}

function sanctionDurationMonths(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const match = SANCTION_DURATION_MONTHS.find(item => item.pattern.test(text));
  return match ? match.months : null;
}

function isOpenEndedSanction(value) {
  return OPEN_ENDED_SANCTION_PATTERN.test(String(value || '').trim());
}

function parseTransformDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  let match = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  match = text.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTransformDate(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function formatTransformCellValue(column, value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (column === 'tanggal_mulai_sanksi' || column === 'tanggal_berakhir_sanksi') {
    const parsed = parseTransformDate(text);
    return parsed ? formatTransformDate(parsed) : text.replace(/[T\s]00:00:00(?:\.000)?$/, '');
  }
  return text;
}

function calculateSanctionEndDate(startValue, typeValue) {
  const start = parseTransformDate(startValue);
  if (isOpenEndedSanction(typeValue)) return '';
  const months = sanctionDurationMonths(typeValue);
  if (start && months) {
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    end.setDate(end.getDate() - 1);
    return formatTransformDate(end);
  }
  const days = sanctionDurationDays(typeValue);
  if (!start || !days) return '';
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  return formatTransformDate(end);
}

function transformColumnByMeaning(meaning) {
  const rules = {
    startDate: ['tanggalmulaisanksi', 'tglmulaisanksi', 'tanggalmulai', 'tglmulai', 'startdate', 'start'],
    endDate: ['tanggalberakhirsanksi', 'tglberakhirsanksi', 'tanggalberakhir', 'tglberakhir', 'enddate', 'end'],
    sanctionType: ['jenissanksi', 'jenis_sanksi', 'typesanksi', 'tipesanksi', 'sanctiontype'],
  };
  return (state.transformColumns || []).find(column => columnMatchesAny(column, rules[meaning] || [])) || '';
}

function updateTransformEndDateCell(rowIndex) {
  const endColumn = transformColumnByMeaning('endDate');
  const row = activeTransformRows()[rowIndex];
  if (!endColumn || !row) return;
  const x = state.transformColumns.indexOf(endColumn);
  if (x >= 0) {
    state.isAutoUpdatingEndDate = true;
    state.transformGrid?.setValueFromCoords?.(x, rowIndex, row[endColumn] || '', true);
    state.isAutoUpdatingEndDate = false;
  }
  const endCell = $(".transform-table td[data-row=\"" + rowIndex + "\"][data-col=\"" + endColumn + "\"]");
  if (endCell) endCell.innerText = row[endColumn] || '';
}

function normalizeSanctionEndDateForRow(row, triggerColumn = '') {
  const startColumn = transformColumnByMeaning('startDate');
  const endColumn = transformColumnByMeaning('endDate');
  const typeColumn = transformColumnByMeaning('sanctionType');
  if (!row || !startColumn || !endColumn || !typeColumn) return false;
  if (![startColumn, typeColumn, endColumn, 'save'].includes(triggerColumn)) return false;
  if (triggerColumn === endColumn) {
    row.__tanggal_berakhir_auto = false;
    return false;
  }
  if (isOpenEndedSanction(row[typeColumn])) {
    if (!String(row[endColumn] || '').trim()) return false;
    row[endColumn] = '';
    row.__tanggal_berakhir_auto = true;
    return true;
  }
  const generated = calculateSanctionEndDate(row[startColumn], row[typeColumn]);
  if (!generated) return false;
  const current = String(row[endColumn] || '').trim();
  if (current && row.__tanggal_berakhir_auto === false && triggerColumn !== 'save') return false;
  if (current === generated) return false;
  row[endColumn] = generated;
  row.__tanggal_berakhir_auto = true;
  return true;
}

function normalizeAllTransformEndDates() {
  let changed = false;
  allTransformRows().forEach(row => { if (normalizeSanctionEndDateForRow(row, 'save')) changed = true; });
  return changed;
}

function parseSanctionNumber(value) {
  const match = String(value || '').trim().match(SANCTION_NUMBER_PATTERN);
  if (!match) return null;
  return { sequence: Number(match[1]), month: match[2].toUpperCase(), year: Number(match[3]) };
}

function romanMonthFromInput(value) {
  const text = String(value || '').trim().replace(/\.$/, '');
  if (!text) return '';
  const upper = text.toUpperCase();
  if (ROMAN_MONTHS.includes(upper)) return upper;
  const numeric = Number(text);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return ROMAN_MONTHS[numeric - 1];
  return MONTH_NAME_TO_ROMAN[text.toLowerCase()] || '';
}

function romanMonthFromDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const iso = text.match(/^\d{4}[-\/]([01]?\d)/);
  if (iso) return romanMonthFromInput(iso[1]);
  const dayFirst = text.match(/^\d{1,2}[-\/]([01]?\d)[-\/]\d{4}/);
  if (dayFirst) return romanMonthFromInput(dayFirst[1]);
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return ROMAN_MONTHS[parsed.getMonth()];
  return '';
}

function defaultRomanMonthForRow(row) {
  return romanMonthFromDate(row?.tanggal_mulai_sanksi) || romanMonthFromInput(row?.[SANCTION_NUMBER_COLUMN]) || ROMAN_MONTHS[new Date().getMonth()];
}

function yearFromTransformRow(row) {
  const dateValue = String(row?.tanggal_mulai_sanksi || '').trim();
  const yearMatch = dateValue.match(/(20\d{2}|19\d{2})/);
  if (yearMatch) return Number(yearMatch[1]);
  return null;
}

function nextSanctionSequence(year, excludeRow = null) {
  let maxSequence = 0;
  allTransformRows().forEach(row => {
    if (row === excludeRow) return;
    const parsed = parseSanctionNumber(row?.[sanctionNumberColumn()]);
    if (parsed && parsed.year === Number(year) && parsed.sequence > maxSequence) maxSequence = parsed.sequence;
  });
  return maxSequence + 1;
}

function buildSanctionNumber(sequence, monthRoman, year) {
  return String(sequence).padStart(3, '0') + '/SK/IR-ER/WKS/' + monthRoman + '/' + year;
}

function autoGenerateSanctionNumber(row, monthRoman, reuseParsed = null) {
  if (!row || !monthRoman) return '';
  const year = yearFromTransformRow(row);
  if (!year) return '';
  const sequence = reuseParsed && reuseParsed.year === year ? reuseParsed.sequence : nextSanctionSequence(year, row);
  return buildSanctionNumber(sequence, monthRoman, year);
}

function shouldAutoGenerateSanctionNumber(row) {
  const numberColumn = sanctionNumberColumn();
  if (!row || !numberColumn) return false;
  return state.transformColumns.some(column => column !== numberColumn && String(row?.[column] || '').trim() !== '');
}

function sanctionNumberColumn() {
  return state.transformColumns.find(column => normalizedColumnKey(column) === normalizedColumnKey(SANCTION_NUMBER_COLUMN))
    || state.transformColumns.find(column => columnMatchesAny(column, ['nomorsuratsanksi', 'nosuratsanksi', 'no_surat_sanksi', 'nomor_surat', 'nosurat']))
    || '';
}

function normalizeSanctionNumberForRow(row, triggerColumn = '') {
  const numberColumn = sanctionNumberColumn();
  if (!row || !numberColumn) return false;
  const current = String(row[numberColumn] || '').trim();
  const parsed = parseSanctionNumber(current);
  if (parsed) {
    const targetYear = yearFromTransformRow(row);
    if (!targetYear) return false;
    const targetMonth = triggerColumn === 'tanggal_mulai_sanksi' ? (romanMonthFromDate(row?.tanggal_mulai_sanksi) || parsed.month) : parsed.month;
    if (targetYear !== parsed.year || targetMonth !== parsed.month) {
      row[numberColumn] = buildSanctionNumber(parsed.sequence, targetMonth, targetYear);
      return true;
    }
    return false;
  }
  const monthRoman = romanMonthFromInput(current) || defaultRomanMonthForRow(row);
  if (!monthRoman || !shouldAutoGenerateSanctionNumber(row)) return false;
  row[numberColumn] = autoGenerateSanctionNumber(row, monthRoman);
  return true;
}

function updateTransformSanctionNumberCell(rowIndex) {
  const numberColumn = sanctionNumberColumn();
  const row = activeTransformRows()[rowIndex];
  if (!numberColumn || !row) return;
  const x = state.transformColumns.indexOf(numberColumn);
  if (x >= 0) state.transformGrid?.setValueFromCoords?.(x, rowIndex, row[numberColumn] || '', true);
  const numberCell = $(".transform-table td[data-row=\"" + rowIndex + "\"][data-col=\"" + numberColumn + "\"]");
  if (numberCell) numberCell.innerText = row[numberColumn] || '';
}

function normalizeAllTransformSanctionNumbers() {
  let changed = false;
  allTransformRows().forEach(row => { if (normalizeSanctionNumberForRow(row)) changed = true; });
  return changed;
}

function transformBatchOptionsHtml() {
  const batches = state.transformBatches || [];
  if (state.transformDraft && !state.transformBatchId) {
    const label = state.transformDraft.meta?.file_name || 'File upload baru';
    return `<option value="" selected>${escapeHtml(label)}</option>` + (batches.length ? '<option value="all">Pilih Semua</option>' : '') + batches.map(batch => {
      const batchLabel = batch.file_name || 'Upload';
      return `<option value="${batch.id}">${escapeHtml(batchLabel)}</option>`;
    }).join('');
  }
  if (!batches.length) return '<option value="">Belum ada file</option>';
  const allOption = `<option value="all" ${String(state.transformBatchId) === 'all' ? 'selected' : ''}>Pilih Semua</option>`;
  return allOption + batches.map(batch => {
    const label = batch.file_name || 'Upload';
    return `<option value="${batch.id}" ${String(batch.id) === String(state.transformBatchId) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}
function formatTransformHeader(column) {
  return String(column || '');
}

function emptyTransformRow() {
  return Object.fromEntries(state.transformColumns.map(c => [c, '']));
}
function activeTransformRows() {
  if (!state.activeTransformSheet) return state.transformRows;
  if (!state.transformSheetRows[state.activeTransformSheet]) state.transformSheetRows[state.activeTransformSheet] = [];
  state.transformRows = state.transformSheetRows[state.activeTransformSheet];
  return state.transformRows;
}

function visibleTransformRows() {
  const rows = activeTransformRows();
  const keyword = String(state.transformSearch || '').trim().toLowerCase();
  if (!keyword) return rows;
  return rows.filter(row => {
    if (isTransformRowEmpty(row)) return false;
    return String(row.perner_karyawan || '').toLowerCase().includes(keyword)
      || String(row.nama_karyawan || '').toLowerCase().includes(keyword);
  });
}

function transformSearchActive() {
  return Boolean(String(state.transformSearch || '').trim());
}

function transformAllBatchesActive() {
  return String(state.transformBatchId || '') === 'all';
}

function transformReadOnlyMode() {
  return transformSearchActive() || transformAllBatchesActive();
}

function updateTransformToolbarState() {
  const editDisabled = transformReadOnlyMode();
  ['add-row', 'edit-row', 'save-transform'].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.disabled = editDisabled;
  });
  const deleteButton = document.getElementById('delete-row');
  if (deleteButton) deleteButton.disabled = false;
}

function allTransformRows() {
  return state.transformSheets.flatMap(sheet => state.transformSheetRows[sheet] || []);
}

function nonEmptyTransformRows() {
  return allTransformRows().filter(row => !isTransformRowEmpty(row));
}
function isTransformRowEmpty(row) {
  return state.transformColumns.every(column => String(row?.[column] ?? '').trim() === '');
}

function ensureTrailingTransformRow() {
  const rows = activeTransformRows();
  if (!rows.length || !isTransformRowEmpty(rows[rows.length - 1])) {
    rows.push(emptyTransformRow());
    return true;
  }
  return false;
}
function transformSnapshot() {
  return {
    columns: [...state.transformColumns],
    sheets: [...state.transformSheets],
    sheetRows: JSON.parse(JSON.stringify(state.transformSheetRows || {})),
    activeSheet: state.activeTransformSheet,
    selectedRows: [...(state.selectedTransformRows || new Set())],
    selectedCells: [...(state.selectedTransformCells || new Set())],
    selectedHeaders: [...(state.selectedTransformHeaders || new Set())],
  };
}

function pushTransformUndo() {
  if (state.isRestoringTransformUndo) return;
  const snapshot = transformSnapshot();
  const stack = state.transformUndoStack || [];
  const current = JSON.stringify(snapshot);
  if (stack.length && JSON.stringify(stack[stack.length - 1]) === current) return;
  stack.push(snapshot);
  if (stack.length > 80) stack.shift();
  state.transformUndoStack = stack;
}

function restoreTransformSnapshot(snapshot) {
  if (!snapshot) return;
  state.isRestoringTransformUndo = true;
  state.transformColumns = [...snapshot.columns];
  state.transformSheets = [...snapshot.sheets];
  state.transformSheetRows = JSON.parse(JSON.stringify(snapshot.sheetRows || {}));
  state.activeTransformSheet = snapshot.activeSheet || state.transformSheets[0] || '';
  state.selectedTransformRows = new Set(snapshot.selectedRows || []);
  state.selectedTransformCells = new Set(snapshot.selectedCells || []);
  state.selectedTransformHeaders = new Set(snapshot.selectedHeaders || []);
  state.transformRows = activeTransformRows();
  renderTransformLocal();
  refreshTransformTabs();
  state.isRestoringTransformUndo = false;
}

function undoTransformChange() {
  const snapshot = state.transformUndoStack?.pop();
  if (!snapshot) return;
  restoreTransformSnapshot(snapshot);
}

function bindTransformUndoShortcut() {
  if (state.transformUndoBound) return;
  state.transformUndoBound = true;
  document.addEventListener('keydown', event => {
    const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey;
    if (state.view !== 'transform') return;
    const active = document.activeElement;
    if (active?.classList?.contains('spreadsheet-cell-editor')) return;
    if (active?.classList?.contains('spreadsheet-quick-editor')) return;
    if (active?.closest?.('#transform-spreadsheet, #master-grid') && (active.matches?.('input, textarea') || active.isContentEditable)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && (copySelectedTransformHeaders(event) || copySelectedTransformCells(event))) return;
    if (clearSelectedTransformSelection(event)) return;
    if (!isUndo) return;
    event.preventDefault();
    undoTransformChange();
  });
}
function transformSheetTabsHtml() {
  const tabs = state.transformSheets.map((sheet, index) => {
    const active = sheet === state.activeTransformSheet ? 'active' : '';
    const menu = state.activeSheetMenu === sheet ? `<div class="sheet-menu">
      <button data-sheet-action="rename" data-sheet-index="${index}">Rename</button>
      <button data-sheet-action="duplicate" data-sheet-index="${index}">Duplicate</button>
      <button data-sheet-action="delete" data-sheet-index="${index}" ${state.transformSheets.length <= 1 ? 'disabled' : ''}>Delete</button>
    </div>` : '';
    return `<div class="transform-sheet-tab ${active}">
      <button class="sheet-name" data-transform-sheet-index="${index}" title="${escapeHtml(sheet)}">${escapeHtml(sheet)}</button>
      <button class="sheet-menu-trigger" data-sheet-menu-index="${index}" title="Aksi sheet">${icon('more')}</button>
      ${menu}
    </div>`;
  }).join('');
  return `${tabs}<button class="plus" id="add-transform-sheet" title="Tambah sheet">+</button>`;
}

function bindTransformSheetTabs() {
  $$('[data-transform-sheet-index]').forEach(tab => {
    tab.onclick = () => {
      const sheet = state.transformSheets[Number(tab.dataset.transformSheetIndex)];
      if (!sheet) return;
      syncTransformFormulaDraft();
      state.activeTransformSheet = sheet;
      state.activeSheetMenu = '';
      state.selectedTransformRows = new Set();
      renderTransformLocal();
      refreshTransformTabs();
    };
  });
  $$('[data-sheet-menu-index]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      const sheet = state.transformSheets[Number(button.dataset.sheetMenuIndex)];
      if (!sheet) return;
      state.activeSheetMenu = state.activeSheetMenu === sheet ? '' : sheet;
      refreshTransformTabs();
    };
  });
  $$('[data-sheet-action]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      const sheet = state.transformSheets[Number(button.dataset.sheetIndex)];
      if (!sheet || button.disabled) return;
      if (button.dataset.sheetAction === 'rename') openRenameSheetDialog(sheet);
      if (button.dataset.sheetAction === 'duplicate') duplicateTransformSheet(sheet);
      if (button.dataset.sheetAction === 'delete') confirmDeleteTransformSheet(sheet);
    };
  });
  const addSheet = $('#add-transform-sheet');
  if (addSheet) addSheet.onclick = () => {
    pushTransformUndo();
    const name = uniqueSheetName('Sheet');
    state.transformSheets.push(name);
    state.transformSheetRows[name] = [emptyTransformRow()];
    state.activeTransformSheet = name;
    state.activeSheetMenu = '';
    state.selectedTransformRows = new Set();
    renderTransformLocal();
    refreshTransformTabs();
  };
}

function refreshTransformTabs() {
  const tabs = $('.transform-tabs');
  if (!tabs) return;
  tabs.innerHTML = transformSheetTabsHtml();
  bindTransformSheetTabs();
}

function uniqueSheetName(base) {
  let counter = 1;
  let name = base;
  while (state.transformSheets.includes(name)) {
    counter += 1;
    name = `${base} ${counter}`;
  }
  return name;
}

function openRenameSheetDialog(sheet) {
  state.activeSheetMenu = '';
  refreshTransformTabs();
  openModal(`<div class="sheet-dialog">
    <div class="sheet-dialog-head">
      <h2>Rename Sheet</h2>
      <button id="close-modal" class="btn">Tutup</button>
    </div>
    <label>Nama sheet</label>
    <input id="rename-sheet-input" class="sheet-dialog-input" value="${escapeHtml(sheet)}" autocomplete="off">
    <div id="rename-sheet-error" class="sheet-dialog-error"></div>
    <div class="sheet-dialog-actions">
      <button id="cancel-rename-sheet" class="btn">Batal</button>
      <button id="confirm-rename-sheet" class="btn primary">Simpan</button>
    </div>
  </div>`);
  $('#close-modal').onclick = closeModal;
  $('#cancel-rename-sheet').onclick = closeModal;
  const input = $('#rename-sheet-input');
  input.focus();
  input.select();
  $('#confirm-rename-sheet').onclick = () => {
    const nextName = input.value.trim();
    const error = $('#rename-sheet-error');
    if (!nextName) { error.textContent = 'Nama sheet wajib diisi.'; return; }
    if (nextName !== sheet && state.transformSheets.includes(nextName)) { error.textContent = 'Nama sheet sudah digunakan.'; return; }
    const index = state.transformSheets.indexOf(sheet);
    if (index < 0) return;
    state.transformSheets[index] = nextName;
    state.transformSheetRows[nextName] = state.transformSheetRows[sheet] || [];
    if (nextName !== sheet) delete state.transformSheetRows[sheet];
    if (state.activeTransformSheet === sheet) state.activeTransformSheet = nextName;
    closeModal();
    refreshTransformTabs();
    renderTransformLocal();
  };
}

function duplicateTransformSheet(sheet) {
  pushTransformUndo();
  const index = state.transformSheets.indexOf(sheet);
  if (index < 0) return;
  const name = uniqueSheetName(`${sheet} Copy`);
  state.transformSheets.splice(index + 1, 0, name);
  state.transformSheetRows[name] = (state.transformSheetRows[sheet] || []).map(row => ({ ...row }));
  state.activeTransformSheet = name;
  state.activeSheetMenu = '';
  state.selectedTransformRows = new Set();
  state.selectedTransformCells = new Set();
  state.selectedTransformHeaders = new Set();
  renderTransformLocal();
  refreshTransformTabs();
}

function confirmDeleteTransformSheet(sheet) {
  if (state.transformSheets.length <= 1) return;
  state.activeSheetMenu = '';
  refreshTransformTabs();
  openModal(`<div class="delete-confirm-dialog">
    <div class="delete-confirm-head">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 1.8 20h20.4L12 2zm1 15h-2v-2h2v2zm0-4h-2V8h2v5z"></path></svg>
      <h2>Konfirmasi Hapus</h2>
    </div>
    <div class="delete-confirm-body">Yakin untuk hapus Sheet?</div>
    <div class="delete-confirm-actions">
      <button id="cancel-delete-sheet" class="btn delete-cancel">Batal</button>
      <button id="confirm-delete-sheet" class="btn delete-confirm">Ya, Hapus</button>
    </div>
  </div>`);
  $('#cancel-delete-sheet').onclick = closeModal;
  $('#confirm-delete-sheet').onclick = () => { deleteTransformSheet(sheet); closeModal(); };
}
function deleteTransformSheet(sheet) {
  if (state.transformSheets.length <= 1) return;
  pushTransformUndo();
  const index = state.transformSheets.indexOf(sheet);
  if (index < 0) return;
  state.transformSheets.splice(index, 1);
  delete state.transformSheetRows[sheet];
  if (state.activeTransformSheet === sheet) state.activeTransformSheet = state.transformSheets[Math.max(0, index - 1)] || state.transformSheets[0];
  state.activeSheetMenu = '';
  state.selectedTransformRows = new Set();
  state.selectedTransformCells = new Set();
  state.selectedTransformHeaders = new Set();
  renderTransformLocal();
  refreshTransformTabs();
}

function cellKey(row, column) {
  return `${row}::${column}`;
}

function transformTableHtml(columns, rows) {
  if (!columns.length) return '<div class="transform-empty">Belum ada data untuk diedit. Upload data dari dashboard terlebih dahulu.</div>';
  return `<div class="transform-table-wrap"><table class="transform-table"><thead><tr><th class="no-col">NO<span class="col-resize-handle" data-resize-col="__no"></span></th>${columns.map(c => `<th class="${state.selectedTransformHeaders?.has(c) ? 'selected-header' : ''}" data-col="${escapeHtml(c)}"><span class="transform-header-name" contenteditable="true" spellcheck="false" data-col="${escapeHtml(c)}">${escapeHtml(formatTransformHeader(c))}</span><span class="col-resize-handle" data-resize-col="${escapeHtml(c)}"></span></th>`).join('')}</tr></thead><tbody>${rows.map((row, r) => `<tr data-row-index="${r}" class="${state.selectedTransformRows?.has(r) ? 'selected' : ''}"><td class="no-col">${r + 1}</td>${columns.map(c => `<td class="${state.selectedTransformCells?.has(cellKey(r, c)) ? 'selected-cell' : ''}" contenteditable="true" data-row="${r}" data-col="${escapeHtml(c)}">${escapeHtml(row[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function setSelectedTransformHeaderRange(startColumn, endColumn) {
  const startCol = state.transformColumns.indexOf(startColumn);
  const endCol = state.transformColumns.indexOf(endColumn);
  if (startCol < 0 || endCol < 0) return;
  const colMin = Math.min(startCol, endCol);
  const colMax = Math.max(startCol, endCol);
  const selectedHeaders = new Set();
  for (let col = colMin; col <= colMax; col += 1) selectedHeaders.add(state.transformColumns[col]);
  state.selectedTransformRows = new Set();
  state.selectedTransformCells = new Set();
  state.selectedTransformHeaders = selectedHeaders;
  renderSelectedTransformHeaders();
}

function selectedTransformHeaderList() {
  return state.transformColumns.filter(column => state.selectedTransformHeaders?.has(column));
}

function copySelectedTransformHeaders(event) {
  const headers = selectedTransformHeaderList();
  if (!headers.length) return false;
  event.preventDefault();
  navigator.clipboard?.writeText(headers.join('\t'));
  return true;
}
function setSelectedTransformCellRange(startRow, startColumn, endRow, endColumn) {
  const startCol = state.transformColumns.indexOf(startColumn);
  const endCol = state.transformColumns.indexOf(endColumn);
  if (startCol < 0 || endCol < 0) return;
  const rowMin = Math.min(startRow, endRow);
  const rowMax = Math.max(startRow, endRow);
  const colMin = Math.min(startCol, endCol);
  const colMax = Math.max(startCol, endCol);
  const selectedCells = new Set();
  for (let row = rowMin; row <= rowMax; row += 1) {
    for (let col = colMin; col <= colMax; col += 1) selectedCells.add(cellKey(row, state.transformColumns[col]));
  }
  state.selectedTransformRows = new Set();
  state.selectedTransformHeaders = new Set();
  state.selectedTransformCells = selectedCells;
  renderSelectedTransformCells();
}

function selectedTransformCellBounds() {
  if (!state.selectedTransformCells?.size) return null;
  const cells = [...state.selectedTransformCells].map(key => {
    const separator = key.indexOf('::');
    const row = Number(key.slice(0, separator));
    const column = key.slice(separator + 2);
    return { row, column, colIndex: state.transformColumns.indexOf(column) };
  }).filter(cell => Number.isFinite(cell.row) && cell.colIndex >= 0);
  if (!cells.length) return null;
  return {
    rowMin: Math.min(...cells.map(cell => cell.row)),
    rowMax: Math.max(...cells.map(cell => cell.row)),
    colMin: Math.min(...cells.map(cell => cell.colIndex)),
    colMax: Math.max(...cells.map(cell => cell.colIndex)),
  };
}

function selectedTransformCellMatrix() {
  const bounds = selectedTransformCellBounds();
  if (!bounds) return [];
  const { rowMin, rowMax, colMin, colMax } = bounds;
  const rows = activeTransformRows();
  return Array.from({ length: rowMax - rowMin + 1 }, (_, rowOffset) =>
    Array.from({ length: colMax - colMin + 1 }, (_, colOffset) => {
      const row = rows[rowMin + rowOffset] || {};
      const column = state.transformColumns[colMin + colOffset];
      return row[column] ?? '';
    })
  );
}

function copySelectedTransformCells(event) {
  if (!state.selectedTransformCells?.size || state.selectedTransformCells.size <= 1) return false;
  const matrix = selectedTransformCellMatrix();
  if (!matrix.length) return false;
  event.preventDefault();
  const text = matrix.map(row => row.map(value => String(value ?? '')).join('\t')).join('\n');
  navigator.clipboard?.writeText(text);
  return true;
}
function clearSelectedTransformHeaders() {
  const headers = selectedTransformHeaderList();
  if (!headers.length) return false;
  const removable = headers.filter(column => state.transformColumns.includes(column));
  if (!removable.length) return false;
  pushTransformUndo();
  const remainingColumns = state.transformColumns.filter(column => !removable.includes(column));
  state.transformColumns = remainingColumns.length ? remainingColumns : [uniqueTransformColumnName('kolom_baru')];
  state.transformSheets.forEach(sheet => {
    const rows = state.transformSheetRows[sheet] || [];
    rows.forEach(row => {
      removable.forEach(column => delete row[column]);
      state.transformColumns.forEach(column => { row[column] = row[column] ?? ''; });
    });
  });
  state.selectedTransformHeaders = new Set();
  state.selectedTransformCells = new Set();
  state.selectedTransformRows = new Set();
  renderTransformLocal();
  return true;
}

function clearSelectedTransformCells() {
  const selectedKeys = state.selectedTransformCells?.size
    ? new Set(state.selectedTransformCells)
    : new Set($$('.transform-table td.selected-cell').map(cell => cellKey(Number(cell.dataset.row), cell.dataset.col)));
  if (!selectedKeys.size) return false;
  pushTransformUndo();
  const rows = activeTransformRows();
  selectedKeys.forEach(key => {
    const separator = key.indexOf('::');
    const rowIndex = Number(key.slice(0, separator));
    const column = key.slice(separator + 2);
    if (!Number.isFinite(rowIndex) || !rows[rowIndex] || !state.transformColumns.includes(column)) return;
    rows[rowIndex][column] = '';
  });
  renderTransformLocal();
  return true;
}

function deleteSelectedTransformRowsByShortcut() {
  if (!state.selectedTransformRows?.size) return false;
  pushTransformUndo();
  const rows = activeTransformRows();
  [...state.selectedTransformRows].sort((a, b) => b - a).forEach(index => {
    if (index >= 0 && index < rows.length) rows.splice(index, 1);
  });
  state.selectedTransformRows = new Set();
  state.selectedTransformCells = new Set();
  state.selectedTransformHeaders = new Set();
  ensureTrailingTransformRow();
  renderTransformLocal();
  return true;
}

function clearSelectedTransformSelection(event) {
  if (!['Backspace', 'Delete'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey) return false;
  const active = document.activeElement;
  if (active?.closest?.('#transform-spreadsheet, #master-grid') && (active.matches?.('input, textarea') || active.isContentEditable)) return false;
  const editing = document.activeElement?.isContentEditable;
  const hasHeaderSelection = Boolean(state.selectedTransformHeaders?.size);
  const hasRowSelection = Boolean(state.selectedTransformRows?.size);
  const hasCellSelection = Boolean(state.selectedTransformCells?.size);
  const selectedCellIsBeingEdited = hasCellSelection
    && state.selectedTransformCells.size === 1
    && document.activeElement?.matches?.('.transform-table td[contenteditable="true"]')
    && state.selectedTransformCells.has(cellKey(Number(document.activeElement.dataset.row), document.activeElement.dataset.col));
  if (hasCellSelection && state.selectedTransformCells.size > 1 && document.activeElement?.matches?.('.transform-table td[contenteditable="true"]')) {
    document.activeElement.blur();
  }
  if (editing && !hasHeaderSelection && !hasRowSelection && !hasCellSelection) return false;
  if (selectedCellIsBeingEdited) return false;
  if (hasHeaderSelection || hasRowSelection || hasCellSelection) event.preventDefault();
  if (hasCellSelection) return clearSelectedTransformCells();
  if (hasHeaderSelection) return clearSelectedTransformHeaders();
  if (hasRowSelection) return deleteSelectedTransformRowsByShortcut();
  return false;
}

function bindEditableTable() {
  $$('.transform-table tbody td.no-col').forEach(cell => {
    cell.onmousedown = event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const row = cell.closest('tr');
      const index = Number(row?.dataset.rowIndex);
      if (!Number.isFinite(index)) return;
      if (event.ctrlKey || event.metaKey) {
        state.selectedTransformRows.has(index) ? state.selectedTransformRows.delete(index) : state.selectedTransformRows.add(index);
      } else {
        state.selectedTransformRows = new Set([index]);
      }
      state.selectedTransformCells = new Set();
      state.selectedTransformHeaders = new Set();
      renderSelectedTransformRows();
    };
  });
  $$('.transform-table td[contenteditable="true"]').forEach(cell => {
    cell.onclick = event => event.stopPropagation();
    cell.onmousedown = event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const row = Number(cell.dataset.row);
      const column = cell.dataset.col;
      state.isSelectingTransformCells = true;
      state.transformKeepCellSelection = true;
      state.transformSelectionAnchor = { row, column };
      state.selectedTransformRows = new Set();
      state.selectedTransformHeaders = new Set();
      setSelectedTransformCellRange(row, column, row, column);
      const onMove = moveEvent => {
        if (!state.isSelectingTransformCells || !state.transformSelectionAnchor) return;
        moveEvent.preventDefault();
        const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest?.('.transform-table td[contenteditable="true"]');
        if (!target) return;
        setSelectedTransformCellRange(
          state.transformSelectionAnchor.row,
          state.transformSelectionAnchor.column,
          Number(target.dataset.row),
          target.dataset.col
        );
      };
      const onUp = () => {
        state.isSelectingTransformCells = false;
        document.removeEventListener('mousemove', onMove);
        if (document.activeElement?.matches?.('.transform-table td[contenteditable="true"]') && state.selectedTransformCells?.size > 1) {
          document.activeElement.blur();
        }
        setTimeout(() => { state.transformKeepCellSelection = false; }, 120);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp, { once: true });
    };
    cell.onmouseover = () => {
      if (!state.isSelectingTransformCells || !state.transformSelectionAnchor) return;
      const row = Number(cell.dataset.row);
      setSelectedTransformCellRange(state.transformSelectionAnchor.row, state.transformSelectionAnchor.column, row, cell.dataset.col);
    };
    cell.onfocus = () => {
      if (!state.isSelectingTransformCells && !state.transformKeepCellSelection && (state.selectedTransformCells?.size || 0) <= 1) {
        setSelectedTransformCellRange(Number(cell.dataset.row), cell.dataset.col, Number(cell.dataset.row), cell.dataset.col);
      }
      state.transformCellSnapshot = transformSnapshot();
    };
    cell.oninput = () => {
      if (state.transformCellSnapshot) { state.transformUndoStack.push(state.transformCellSnapshot); if (state.transformUndoStack.length > 80) state.transformUndoStack.shift(); state.transformCellSnapshot = null; }
      const row = Number(cell.dataset.row); const col = cell.dataset.col;
      const rows = activeTransformRows();
      rows[row][col] = cell.innerText.trim();
      if (normalizeSanctionEndDateForRow(rows[row], col)) updateTransformEndDateCell(row);
      if (col !== SANCTION_NUMBER_COLUMN && normalizeSanctionNumberForRow(rows[row], col)) {
        updateTransformSanctionNumberCell(row);
      }
    };
    cell.onpaste = pasteExcelRange;
    cell.onblur = () => {
      const row = Number(cell.dataset.row);
      const col = cell.dataset.col;
      const rows = activeTransformRows();
      if (rows[row] && normalizeSanctionEndDateForRow(rows[row], col)) updateTransformEndDateCell(row);
      if (rows[row] && normalizeSanctionNumberForRow(rows[row], col)) {
        if (col === SANCTION_NUMBER_COLUMN) cell.innerText = rows[row][col];
        else updateTransformSanctionNumberCell(row);
      }
      state.transformCellSnapshot = null;
      if (ensureTrailingTransformRow()) renderTransformLocal();
    };
  });
  $$(".transform-header-name").forEach(header => {
    header.onclick = event => event.stopPropagation();
    header.onfocus = () => { header.dataset.undoPushed = ''; state.transformHeaderSnapshot = transformSnapshot(); };
    header.oninput = () => { if (state.transformHeaderSnapshot) { state.transformUndoStack.push(state.transformHeaderSnapshot); if (state.transformUndoStack.length > 80) state.transformUndoStack.shift(); state.transformHeaderSnapshot = null; header.dataset.undoPushed = '1'; } };
    header.onkeydown = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        header.blur();
      }
    };
    header.onblur = () => { state.transformHeaderSnapshot = null; renameTransformColumn(header.dataset.col, header.innerText.trim(), header.dataset.undoPushed === '1'); };
    header.onpaste = pasteTransformHeaders;
    header.oncontextmenu = event => openTransformColumnMenu(event, header.dataset.col);
  });
  $$(".transform-table th[data-col]").forEach(th => {
    th.onmousedown = event => {
      if (event.button !== 0 || event.target.closest('.col-resize-handle')) return;
      event.stopPropagation();
      state.isSelectingTransformHeaders = true;
      state.transformHeaderSelectionAnchor = th.dataset.col;
      setSelectedTransformHeaderRange(th.dataset.col, th.dataset.col);
      document.addEventListener('mouseup', () => { state.isSelectingTransformHeaders = false; }, { once: true });
    };
    th.onmouseover = () => {
      if (!state.isSelectingTransformHeaders || !state.transformHeaderSelectionAnchor) return;
      setSelectedTransformHeaderRange(state.transformHeaderSelectionAnchor, th.dataset.col);
    };
    th.oncontextmenu = event => openTransformColumnMenu(event, th.dataset.col);
  });
}


function parseClipboardTable(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((row, index, rows) => !(index === rows.length - 1 && row === ''))
    .map(row => row.split('\t'));
}

function pasteExcelRange(event) {
  const text = event.clipboardData?.getData('text/plain') || '';
  if (!text) return;
  event.preventDefault();
  event.stopPropagation();

  const cell = event.currentTarget;
  const selectedBounds = selectedTransformCellBounds();
  const matrix = parseClipboardTable(text);
  if (!matrix.length) return;

  const startRow = selectedBounds ? selectedBounds.rowMin : Number(cell.dataset.row);
  const startCol = selectedBounds ? selectedBounds.colMin : state.transformColumns.indexOf(cell.dataset.col);
  if (!Number.isFinite(startRow) || startRow < 0 || startCol < 0) return;

  pushTransformUndo();
  const rows = activeTransformRows();
  const fillSelection = selectedBounds && matrix.length === 1 && matrix[0].length === 1 && state.selectedTransformCells.size > 1;

  if (fillSelection) {
    const value = String(matrix[0][0] ?? '').trim();
    for (let row = selectedBounds.rowMin; row <= selectedBounds.rowMax; row += 1) {
      while (rows.length <= row) rows.push(emptyTransformRow());
      for (let col = selectedBounds.colMin; col <= selectedBounds.colMax; col += 1) {
        const column = state.transformColumns[col];
        if (column) rows[row][column] = value;
      }
    }
  } else {
    while (rows.length < startRow + matrix.length) rows.push(emptyTransformRow());
    matrix.forEach((values, rowOffset) => {
      values.forEach((value, colOffset) => {
        const column = state.transformColumns[startCol + colOffset];
        if (!column) return;
        rows[startRow + rowOffset][column] = String(value ?? '').trim();
      });
    });
  }

  const lastRow = fillSelection ? selectedBounds.rowMax : Math.min(rows.length - 1, startRow + matrix.length - 1);
  const lastCol = fillSelection ? selectedBounds.colMax : Math.min(state.transformColumns.length - 1, startCol + Math.max(...matrix.map(row => row.length)) - 1);
  state.selectedTransformRows = new Set();
  state.selectedTransformHeaders = new Set();
  state.selectedTransformCells = new Set();
  for (let row = startRow; row <= lastRow; row += 1) {
    for (let col = startCol; col <= lastCol; col += 1) state.selectedTransformCells.add(cellKey(row, state.transformColumns[col]));
  }
  ensureTrailingTransformRow();
  renderTransformLocal();

  const nextCell = $('.transform-table td[contenteditable="true"]').find(item =>
    Number(item.dataset.row) === startRow && item.dataset.col === state.transformColumns[startCol]
  );
  nextCell?.focus();
}
function bindColumnResize() {
  $$('.col-resize-handle').forEach(handle => {
    handle.onmousedown = event => {
      event.preventDefault();
      event.stopPropagation();
      const th = handle.closest('th');
      const table = handle.closest('table');
      if (!th || !table) return;
      const startX = event.clientX;
      const startWidth = th.offsetWidth;
      const columnIndex = [...th.parentElement.children].indexOf(th);
      document.body.classList.add('is-resizing-column');
      const onMove = moveEvent => {
        const nextWidth = Math.max(columnIndex === 0 ? 42 : 86, startWidth + moveEvent.clientX - startX);
        table.querySelectorAll('tr').forEach(row => {
          const cell = row.children[columnIndex];
          if (cell) {
            cell.style.width = `${nextWidth}px`;
            cell.style.minWidth = `${nextWidth}px`;
            cell.style.maxWidth = `${nextWidth}px`;
          }
        });
      };
      const onUp = () => {
        document.body.classList.remove('is-resizing-column');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
  });
}
function renderSelectedTransformRows() {
  $$('.transform-table tbody tr').forEach(row => row.classList.toggle('selected', state.selectedTransformRows.has(Number(row.dataset.rowIndex))));
  renderSelectedTransformCells();
  renderSelectedTransformHeaders();
}

function renderSelectedTransformCells() {
  $$('.transform-table tbody tr').forEach(row => row.classList.toggle('selected', state.selectedTransformRows.has(Number(row.dataset.rowIndex))));
  $$('.transform-table td[contenteditable="true"]').forEach(cell => {
    cell.classList.toggle('selected-cell', state.selectedTransformCells?.has(cellKey(Number(cell.dataset.row), cell.dataset.col)));
  });
  renderSelectedTransformHeaders();
}

function renderSelectedTransformHeaders() {
  $$('.transform-table th[data-col]').forEach(th => {
    th.classList.toggle('selected-header', state.selectedTransformHeaders?.has(th.dataset.col));
  });
}

function renderTransformLocal() {
  ensureTrailingTransformRow();
  if ($('#transform-spreadsheet')) {
    renderTransformSpreadsheet();
  } else {
    $('#transform-table-host').innerHTML = transformTableHtml(state.transformColumns, activeTransformRows());
    bindEditableTable();
    bindColumnResize();
  }
  bindTransformUndoShortcut();
}

function addTransformColumnRaw(columnName = 'kolom_baru') {
  const nextColumn = uniqueTransformColumnName(columnName);
  state.transformColumns.push(nextColumn);
  state.transformSheets.forEach(sheet => {
    const rows = state.transformSheetRows[sheet] || [];
    rows.forEach(row => { row[nextColumn] = row[nextColumn] ?? ''; });
  });
  return nextColumn;
}

function setTransformColumnNameAt(index, requestedName) {
  const oldColumn = state.transformColumns[index];
  const nextColumn = uniqueTransformColumnName(requestedName, oldColumn);
  if (!oldColumn || !nextColumn || nextColumn === oldColumn) return oldColumn;
  state.transformColumns[index] = nextColumn;
  state.transformSheets.forEach(sheet => {
    const rows = state.transformSheetRows[sheet] || [];
    rows.forEach(row => {
      row[nextColumn] = row[oldColumn] ?? '';
      delete row[oldColumn];
    });
  });
  return nextColumn;
}

function pasteTransformHeaders(event) {
  const text = event.clipboardData?.getData('text/plain') || '';
  if (!text) return;
  event.preventDefault();
  event.stopPropagation();
  const startIndex = state.transformColumns.indexOf(event.currentTarget.dataset.col);
  if (startIndex < 0) return;
  const values = parseClipboardTable(text).flat().map(value => String(value || '').trim()).filter(Boolean);
  if (!values.length) return;
  pushTransformUndo();
  values.forEach((value, offset) => {
    const targetIndex = startIndex + offset;
    while (state.transformColumns.length <= targetIndex) addTransformColumnRaw('kolom_baru');
    setTransformColumnNameAt(targetIndex, value);
  });
  renderTransformLocal();
  const lastIndex = Math.min(state.transformColumns.length - 1, startIndex + values.length - 1);
  const nextColumn = state.transformColumns[lastIndex];
  const header = $$(".transform-header-name").find(item => item.dataset.col === nextColumn);
  header?.focus();
}
function closeTransformColumnMenu() {
  $('.transform-column-menu')?.remove();
}

function openTransformColumnMenu(event, column) {
  event.preventDefault();
  event.stopPropagation();
  closeTransformColumnMenu();
  if (!column || state.transformColumns.length <= 1) return;
  const menu = document.createElement('div');
  menu.className = 'transform-column-menu';
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  menu.innerHTML = `<button type="button" data-action="delete-column">${icon('trash')} Hapus Kolom</button>`;
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
  if (rect.bottom > window.innerHeight) menu.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
  menu.querySelector('[data-action="delete-column"]').onclick = () => {
    closeTransformColumnMenu();
    deleteTransformColumn(column);
  };
  setTimeout(() => {
    document.addEventListener('click', closeTransformColumnMenu, { once: true });
  });
}

function deleteTransformColumn(column) {
  if (!column || state.transformColumns.length <= 1) return;
  pushTransformUndo();
  state.transformColumns = state.transformColumns.filter(item => item !== column);
  state.transformSheets.forEach(sheet => {
    const rows = state.transformSheetRows[sheet] || [];
    rows.forEach(row => delete row[column]);
  });
  renderTransformLocal();
}
function renameTransformColumn(oldColumn, requestedName, undoAlreadyPushed = false) {
  const nextColumn = String(requestedName || '').trim();
  if (!oldColumn) return;
  if (!nextColumn) {
    renderTransformLocal();
    return;
  }
  if (nextColumn === oldColumn) return;
  pushTransformUndo();
  const index = state.transformColumns.indexOf(oldColumn);
  if (index < 0) return;
  setTransformColumnNameAt(index, nextColumn);
  renderTransformLocal();
}
function uniqueTransformColumnName(base, excludeColumn = '') {
  const cleanBase = String(base || '').trim() || 'kolom_baru';
  const existing = new Set(state.transformColumns.filter(column => column !== excludeColumn).map(column => String(column).toLowerCase()));
  if (!existing.has(cleanBase.toLowerCase())) return cleanBase;
  let counter = 2;
  let next = `${cleanBase}_${counter}`;
  while (existing.has(next.toLowerCase())) {
    counter += 1;
    next = `${cleanBase}_${counter}`;
  }
  return next;
}

function addTransformColumn(columnName) {
  pushTransformUndo();
  const requestedName = typeof columnName === 'string' ? columnName : 'kolom_baru';
  const nextColumn = addTransformColumnRaw(requestedName);
  renderTransformLocal();
  const newHeader = $$('.transform-table th').find(th => th.dataset.col === nextColumn);
  newHeader?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
  const headerName = newHeader?.querySelector('.transform-header-name');
  headerName?.focus();
  if (headerName) {
    const range = document.createRange();
    range.selectNodeContents(headerName);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function addTransformRow() {
  pushTransformUndo();
  activeTransformRows().push(emptyTransformRow());
  state.selectedTransformRows = new Set([activeTransformRows().length - 1]);
  renderTransformLocal();
}

function focusSelectedTransformRow() {
  const first = [...state.selectedTransformRows][0] ?? 0;
  state.selectedTransformRows = new Set([first]);
  renderTransformLocal();
  $(`.transform-table td[data-row="${first}"]`)?.focus();
}

function deleteSelectedTransformRows() {
  if (!state.selectedTransformRows.size) return;
  pushTransformUndo();
  const selected = [...state.selectedTransformRows].sort((a, b) => b - a);
  selected.forEach(index => activeTransformRows().splice(index, 1));
  state.selectedTransformRows = new Set();
  state.selectedTransformCells = new Set();
  state.selectedTransformHeaders = new Set();
  renderTransformLocal();
}


function selectedTransformBatch() {
  return (state.transformBatches || []).find(batch => String(batch.id) === String(state.transformBatchId)) || null;
}

function confirmDeleteTransformBatch() {
  if (transformAllBatchesActive()) {
    const total = state.transformBatches?.length || 0;
    openModal(`<div class="delete-confirm-dialog delete-confirm-file">
      <div class="delete-confirm-head">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 1.8 20h20.4L12 2zm1 15h-2v-2h2v2zm0-4h-2V8h2v5z"></path></svg>
        <h2>Konfirmasi Hapus</h2>
      </div>
      <div class="delete-confirm-body">Yakin untuk hapus seluruh data upload${total ? ` (${total} file)` : ''} ?</div>
      <div class="delete-confirm-actions">
        <button id="cancel-delete-batch" class="btn delete-cancel">Batal</button>
        <button id="confirm-delete-batch" class="btn delete-confirm">Ya, Hapus</button>
      </div>
    </div>`);
    $('#cancel-delete-batch').onclick = closeModal;
    $('#confirm-delete-batch').onclick = deleteAllTransformBatches;
    return;
  }
  const batch = selectedTransformBatch();
  if (!batch) {
    openModal(`<div class="delete-confirm-dialog delete-confirm-file">
      <div class="delete-confirm-head">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 1.8 20h20.4L12 2zm1 15h-2v-2h2v2zm0-4h-2V8h2v5z"></path></svg>
        <h2>Konfirmasi Hapus</h2>
      </div>
      <div class="delete-confirm-body">Tidak ada file yang dipilih untuk dihapus.</div>
      <div class="delete-confirm-actions">
        <button id="cancel-delete-batch" class="btn delete-cancel">Batal</button>
      </div>
    </div>`);
    $('#cancel-delete-batch').onclick = closeModal;
    return;
  }
  const fileName = escapeHtml(batch.file_name || 'Upload');
  openModal(`<div class="delete-confirm-dialog delete-confirm-file">
    <div class="delete-confirm-head">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 1.8 20h20.4L12 2zm1 15h-2v-2h2v2zm0-4h-2V8h2v5z"></path></svg>
      <h2>Konfirmasi Hapus</h2>
    </div>
    <div class="delete-confirm-body">Yakin untuk hapus data “${fileName}” ?</div>
    <div class="delete-confirm-actions">
      <button id="cancel-delete-batch" class="btn delete-cancel">Batal</button>
      <button id="confirm-delete-batch" class="btn delete-confirm">Ya, Hapus</button>
    </div>
  </div>`);
  $('#cancel-delete-batch').onclick = closeModal;
  $('#confirm-delete-batch').onclick = deleteSelectedTransformBatch;
}

async function deleteSelectedTransformBatch() {
  const batch = selectedTransformBatch();
  if (!batch) return;
  const button = $('#confirm-delete-batch');
  if (button) {
    button.disabled = true;
    button.textContent = 'Deleting...';
  }
  const result = await api(`/api/transform/${batch.id}`, { method: 'DELETE' });
  closeModal();
  state.transformBatchId = result.next_batch_id || '';
  state.activeTransformSheet = '';
  state.selectedTransformRows = new Set();
  state.filters = {};
    normalizeDashboardFilters(result.filters);
  destroyCharts();
  await renderTransform();
}

async function deleteAllTransformBatches() {
  const button = $('#confirm-delete-batch');
  if (button) {
    button.disabled = true;
    button.textContent = 'Deleting...';
  }
  const result = await api('/api/transform/all', { method: 'DELETE' });
  closeModal();
  state.transformBatchId = result.next_batch_id || '';
  state.activeTransformSheet = '';
  state.selectedTransformRows = new Set();
  state.filters = {};
  normalizeDashboardFilters(result.filters);
  destroyCharts();
  await renderTransform();
}
function transformExportSheetsPayload() {
  if (transformSearchActive()) {
    return [{
      name: state.activeTransformSheet || 'Data Sanksi',
      rows: visibleTransformRows().filter(row => !isTransformRowEmpty(row)),
    }];
  }
  syncTransformGridStructure();
  return state.transformSheets.map(sheet => ({
    name: sheet,
    rows: (state.transformSheetRows[sheet] || []).filter(row => !isTransformRowEmpty(row)),
  }));
}

async function exportTransformExcel() {
  const button = $('#export-transform');
  try {
    setButtonLoading(button, true);
    showScreenLoading('Membuat file Excel...');
    const response = await fetch('/api/transform/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns: state.transformColumns, sheets: transformExportSheetsPayload() })
    });
    if (!response.ok) {
      let message = 'Export Excel gagal.';
      try {
        const data = await response.json();
        message = data.message || message;
      } catch (error) {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || `transform_data_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    openModal(`<div class="sheet-dialog">
      <div class="sheet-dialog-head"><h2>Export Gagal</h2><button id="close-modal" class="btn">Tutup</button></div>
      <p class="sheet-dialog-copy">${escapeHtml(error.message || 'File Excel belum bisa dibuat.')}</p>
    </div>`);
    $('#close-modal').onclick = closeModal;
  } finally {
    hideScreenLoading();
    setButtonLoading($('#export-transform'), false);
  }
}

async function saveTransform() {
  const button = $('#save-transform');
  try {
    if (transformReadOnlyMode()) {
      throw new Error('Kosongkan search dan pilih file spesifik sebelum menyimpan perubahan.');
    }
    syncTransformGridStructure();
    normalizeAllTransformEndDates();
    normalizeAllTransformSanctionNumbers();

    const rows = nonEmptyTransformRows();
    if (!rows.length) throw new Error('Tidak ada data yang bisa disimpan. Isi minimal satu baris data terlebih dahulu.');
    setButtonLoading(button, true);
    showScreenLoading('Menyimpan perubahan...');
    const result = await api('/api/transform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batch_id: state.transformBatchId,
        rows,
        sheets: state.transformSheets,
        source_file_name: state.transformDraft?.meta?.file_name || '',
        source_sheet_name: state.transformDraft?.meta?.sheet_name || ''
      })
    });
    state.transformBatchId = result.batch_id || state.transformBatchId;
    state.transformDraft = null;
    state.filters = {};
    normalizeDashboardFilters(result.filters);
    destroyCharts();
    await renderTransform();
  } catch (error) {
    openModal(`<div class="sheet-dialog">
      <div class="sheet-dialog-head"><h2>Save Gagal</h2><button id="close-modal" class="btn">Tutup</button></div>
      <p class="sheet-dialog-copy">${escapeHtml(error.message || 'Data belum bisa disimpan.')}</p>
    </div>`);
    $('#close-modal').onclick = closeModal;
  } finally {
    hideScreenLoading();
    setButtonLoading($('#save-transform'), false);
  }
}

function reportStatusMeta(status) {
  const map = {
    laporan_masuk: { label: 'Laporan Masuk', color: '#007A3D', bg: '#ECFDF5', border: '#CDEFE0' },
    diterima_process: { label: 'Diterima', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
    pemanggilan_investigasi: { label: 'Pemanggilan', color: '#F59E0B', bg: '#FFF7ED', border: '#FED7AA' },
    pemeriksaan: { label: 'Pemeriksaan', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
    sk_selesai: { label: 'Rekom Diterbitkan', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  };
  return map[status] || map.laporan_masuk;
}

function reportStatusFilterHtml() {
  const options = [
    { value: 'all', label: 'Semua Status', color: '#64748B' },
    { value: 'laporan_masuk', ...reportStatusMeta('laporan_masuk') },
    { value: 'diterima_process', ...reportStatusMeta('diterima_process') },
    { value: 'pemanggilan_investigasi', ...reportStatusMeta('pemanggilan_investigasi') },
    { value: 'pemeriksaan', ...reportStatusMeta('pemeriksaan') },
    { value: 'sk_selesai', ...reportStatusMeta('sk_selesai') },
  ];
  const active = options.find(item => item.value === state.reports.status) || options[0];
  return `<div class="reports-filter-menu ${state.reports.filterOpen ? 'open' : ''}">
    <button id="reports-filter" class="reports-filter-btn" type="button" aria-haspopup="listbox" aria-expanded="${state.reports.filterOpen ? 'true' : 'false'}">
      ${icon('filter')} <span>${escapeHtml(active.label)}</span><i></i>
    </button>
    <div class="reports-filter-options" role="listbox">
      ${options.map(item => `<button type="button" data-report-filter-status="${escapeHtml(item.value)}" class="${item.value === state.reports.status ? 'active' : ''}">
        <b style="background:${escapeHtml(item.color || '#64748B')}"></b><span>${escapeHtml(item.label)}</span>
      </button>`).join('')}
    </div>
  </div>`;
}

function todayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatReportDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function getReportDepartmentsFromMaster() {
  const data = await api('/api/master-employees');
  const rows = data.rows || [];
  const departments = [...new Set(rows.map(row => String(row.departemen_seksi || '').trim()).filter(Boolean))];
  return departments.sort((a, b) => a.localeCompare(b, 'id'));
}

async function openReportCreateModal() {
  let departments = [];
  try {
    showScreenLoading('Memuat departemen...');
    departments = await getReportDepartmentsFromMaster();
  } catch (error) {
    hideScreenLoading();
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Departemen Belum Bisa Dimuat</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'Pastikan Master Data Karyawan sudah tersedia.')}</p></div>`);
    $('#close-modal').onclick = closeModal;
    return;
  } finally {
    hideScreenLoading();
  }
  const departmentOptions = departments.length
    ? departments.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')
    : '<option value="" disabled>Master data departemen belum tersedia</option>';
  openModal(`<form class="report-create-modal" id="report-create-form">
    <div class="report-create-head">
      <div>
        <h2>Buat Laporan Baru</h2>
        <p>Unggah dokumen rekomendasi untuk laporan yang sudah masuk tahap rekom diterbitkan.</p>
      </div>
      <button type="button" id="close-modal" aria-label="Tutup">×</button>
    </div>
    <label>Departemen
      <select id="report-department" required>
        <option value="">Pilih Departemen</option>
        ${departmentOptions}
      </select>
    </label>
    <label>Tanggal Laporan
      <input id="report-date" type="date" value="${todayInputValue()}" required>
    </label>
    <label>Jenis Laporan
      <textarea id="report-type" rows="3" placeholder="Tuliskan ringkasan laporan di sini..." required></textarea>
    </label>
    <div class="report-create-actions">
      <button type="button" id="cancel-report-create">Batal</button>
      <button type="submit">${icon('upload')} Simpan Dokumen</button>
    </div>
  </form>`);
  $('#close-modal').onclick = closeModal;
  $('#cancel-report-create').onclick = closeModal;
  $('#report-create-form').onsubmit = event => {
    event.preventDefault();
    const department = $('#report-department').value.trim();
    const reportDate = $('#report-date').value;
    const type = $('#report-type').value.trim();
    if (!department || !reportDate || !type) return;
    withMinimumLoader('Menyimpan laporan...', () => api('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        departemen: department,
        tanggal_laporan: reportDate,
        jenis_laporan: type,
      }),
    })).then(() => {
      state.reports.page = 1;
      closeModal();
      renderReports();
    }).catch(error => {
      openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Simpan Gagal</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'Laporan belum bisa disimpan.')}</p></div>`);
      $('#close-modal').onclick = closeModal;
    });
  };
}

function openReportInspectionUploadModal(reportId) {
  const record = state.reports.lastRecords?.find(item => String(item.id) === String(reportId));
  const reportNumber = record?.nomor_laporan || `Laporan ${reportId}`;
  openModal(`<form class="report-create-modal report-inspection-upload" id="report-inspection-upload-form">
    <div class="report-create-head">
      <div>
        <h2>Upload Surat Rekomendasi</h2>
        <p>Isi formulir berikut untuk menambahkan pengaduan atau laporan baru ke dalam sistem.</p>
      </div>
      <button type="button" id="close-modal" aria-label="Tutup">×</button>
    </div>
    <input id="inspection-title" type="hidden" value="Surat Rekomendasi - ${escapeHtml(reportNumber)}" required>
    <label>Lampiran File (PDF/Foto)
      <span class="inspection-upload-zone">
        <input id="inspection-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" required>
        <span class="inspection-upload-icon">${icon('upload')}</span>
        <span class="inspection-upload-text">Unggah Bukti / Dokumen</span>
        <span id="inspection-file-name" class="inspection-file-name"></span>
      </span>
    </label>
    <div class="report-create-actions">
      <button type="button" id="cancel-inspection-upload">Batal</button>
      <button type="submit">${icon('plus')} Simpan & Buat Laporan</button>
    </div>
  </form>`);
  $('#close-modal').onclick = closeModal;
  $('#cancel-inspection-upload').onclick = closeModal;
  $('#inspection-file').onchange = event => {
    const file = event.target.files?.[0];
    $('#inspection-file-name').textContent = file ? file.name : '';
  };
  $('#report-inspection-upload-form').onsubmit = event => {
    event.preventDefault();
    const file = $('#inspection-file').files?.[0];
    const title = $('#inspection-title').value.trim();
    if (!file || !title) return;
    const fd = new FormData();
    fd.append('title', title);
    fd.append('file', file);
    withMinimumLoader('Mengunggah dokumen pemeriksaan...', () => api('/api/archives', { method: 'POST', body: fd }))
      .then(() => closeModal())
      .catch(error => {
        openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Upload Gagal</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'Dokumen pemeriksaan belum bisa diunggah.')}</p></div>`);
        $('#close-modal').onclick = closeModal;
      });
  };
}

async function renderReports() {
  const root = $('#view-reports');
  let data;
  try {
    data = await fetchReportsData();
  } catch (error) {
    root.innerHTML = databaseErrorPanel('Progress Laporan belum bisa dibuka', error);
    return;
  }
  const reportView = prepareReportViewData(data);
  root.innerHTML = `
    <div class="reports-page">
      <div class="reports-toolbar">
        <label class="reports-search">${icon('search')}<input id="reports-search" value="${escapeHtml(state.reports.search || '')}" placeholder="Cari departemen / tanggal..."></label>
        ${reportStatusFilterHtml()}
        <button id="reports-reset" class="reports-reset-btn" type="button">${icon('repeat')} Reset</button>
        <div class="reports-toolbar-actions">
          <button id="reports-export" class="reports-export-btn" type="button">${icon('download')} Export Excel</button>
          <button id="reports-add" class="reports-add-btn" type="button">${icon('plus')} Buat Laporan Baru</button>
        </div>
      </div>
      <section class="reports-content">
        <div class="reports-heading">
          <h1>Progress Laporan</h1>
          <p>Kelola dan perbarui tahapan progress pengaduan karyawan secara real-time.</p>
        </div>
        <div id="reports-kpi-grid" class="reports-kpi-grid">
          ${reportKpiHtml(reportView.statsData)}
        </div>
        <div class="reports-table-card">
          <div id="reports-bulk-delete-slot">${reportBulkDeleteHtml(reportView.selectedDeleteCount)}</div>
          <table class="reports-table">
            <thead><tr><th><div class="reports-no-cell"><input id="reports-select-all" type="checkbox" aria-label="Pilih semua laporan sesuai filter" ${reportView.allSelectableIds.length && reportView.allSelectableIds.every(id => state.reports.selectedDeleteIds.has(id)) ? 'checked' : ''}><span>NO</span></div></th><th>DEPARTEMEN</th><th>TANGGAL</th><th>JENIS LAPORAN</th><th>PROGRESS STATUS</th><th>KETERANGAN</th><th>AKSI</th></tr></thead>
            <tbody id="reports-tbody">${reportView.pageRecords.map((record, index) => reportRowHtml(record, reportView.start + index)).join('') || '<tr><td colspan="7" class="reports-empty-cell"></td></tr>'}</tbody>
          </table>
          <div id="reports-footer">
            ${reportFooterHtml(reportView.records, reportView.pageRecords, reportView.start, reportView.totalPages)}
          </div>
        </div>
      </section>
    </div>`;
  $('#reports-search').oninput = event => {
    state.reports.search = event.target.value;
    state.reports.page = 1;
    clearTimeout(state.reports.searchTimer);
    state.reports.searchTimer = setTimeout(refreshReportResults, 120);
  };
  $('#reports-reset').onclick = () => {
    state.reports.search = '';
    state.reports.status = 'all';
    state.reports.filterOpen = false;
    state.reports.page = 1;
    renderReports();
  };
  $('#reports-export').onclick = downloadReportsExcel;
  $('#reports-add').onclick = openReportCreateModal;
  bindReportControls(reportView.totalPages);
  bindReportFilterControls();
}

function fetchReportsData() {
  const query = new URLSearchParams({ search: String(state.reports.search || '').trim(), status: state.reports.status || 'all' }).toString();
  return api(`/api/reports?${query}`);
}

async function downloadReportsExcel() {
  try {
    const query = new URLSearchParams({ search: String(state.reports.search || '').trim(), status: state.reports.status || 'all' }).toString();
    const url = `/api/reports/export${query ? `?${query}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Export Excel gagal.');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/i);
    const filename = filenameMatch ? filenameMatch[1] : 'Progres_Laporan.xlsx';
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Export Gagal</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'File Excel belum bisa diunduh.')}</p></div>`);
    $('#close-modal').onclick = closeModal;
  }
}

function bindReportFilterControls() {
  $('#reports-filter')?.addEventListener('click', event => {
    event.stopPropagation();
    state.reports.filterOpen = !state.reports.filterOpen;
    $('.reports-filter-menu')?.classList.toggle('open', state.reports.filterOpen);
    $('#reports-filter')?.setAttribute('aria-expanded', state.reports.filterOpen ? 'true' : 'false');
  });
  $$('[data-report-filter-status]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      state.reports.status = button.dataset.reportFilterStatus || 'all';
      state.reports.filterOpen = false;
      state.reports.page = 1;
      renderReports();
    };
  });
  if (document.body.dataset.reportsFilterCloseBound !== '1') {
    document.body.dataset.reportsFilterCloseBound = '1';
    document.addEventListener('click', event => {
      if (!state.reports.filterOpen || event.target.closest?.('.reports-filter-menu')) return;
      state.reports.filterOpen = false;
      $('.reports-filter-menu')?.classList.remove('open');
      $('#reports-filter')?.setAttribute('aria-expanded', 'false');
    });
  }
}

function prepareReportViewData(data) {
  const records = data.records || [];
  state.reports.lastRecords = records;
  const validDeleteIds = new Set(records.map(record => String(record.id)));
  state.reports.selectedDeleteIds = new Set([...(state.reports.selectedDeleteIds || new Set())].filter(id => validDeleteIds.has(String(id))));
  const pageSize = state.reports.pageSize || 10;
  const totalPages = Math.max(1, Math.ceil(Math.max(records.length, 1) / pageSize));
  state.reports.page = Math.min(Math.max(1, Number(state.reports.page) || 1), totalPages);
  const start = (state.reports.page - 1) * pageSize;
  const pageRecords = records.slice(start, start + pageSize);
  const allSelectableIds = records.map(record => String(record.id));
  return {
    records,
    pageRecords,
    allSelectableIds,
    start,
    totalPages,
    selectedDeleteCount: state.reports.selectedDeleteIds.size,
    statsData: data.stats || {},
  };
}

function reportKpiHtml(statsData) {
  const stats = [
    { title: 'Total Laporan Masuk', value: statsData.total || 0, note: 'Data tersimpan', icon: '/assets/report/Icon1.png', tone: 'green' },
    { title: 'Diterima / Process', value: statsData.diterima_process || 0, note: 'Dalam Verifikasi', icon: '/assets/report/Icon2.png', tone: 'blue' },
    { title: 'Pemanggilan & Investigasi', value: statsData.pemanggilan_investigasi || 0, note: 'Konfirmasi Lapangan', icon: '/assets/report/Icon3.png', tone: 'orange' },
    { title: 'Pemeriksaan', value: statsData.pemeriksaan || 0, note: 'Proses Investigasi', icon: '/assets/report/Icon4.png', tone: 'purple' },
    { title: 'Rekom Diterbitkan', value: statsData.sk_selesai || 0, note: 'Tuntas', icon: '/assets/report/Icon5.png', tone: 'green' },
  ];
  return stats.map(item => `<article class="reports-kpi ${item.tone}">
    <span class="reports-kpi-icon"><img src="${escapeHtml(item.icon)}" alt=""></span>
    <div><small>${escapeHtml(item.title)}</small><b>${escapeHtml(item.value)}</b><em>${escapeHtml(item.note)}</em></div>
  </article>`).join('');
}

function reportBulkDeleteHtml(selectedDeleteCount) {
  return selectedDeleteCount ? `<div class="reports-bulk-delete">
            <span>${selectedDeleteCount} laporan dipilih</span>
            <button id="reports-delete-selected" type="button">${icon('trash')} Hapus Terpilih</button>
          </div>` : '';
}

function reportFooterHtml(records, pageRecords, start, totalPages) {
  return `<div class="reports-footer">
    <span>Menampilkan ${records.length ? start + 1 : 0} - ${records.length ? Math.min(start + pageRecords.length, records.length) : 0} dari ${records.length} laporan</span>
    <div class="reports-pager">
      <button id="reports-prev" ${state.reports.page <= 1 ? 'disabled' : ''}>‹</button>
      <button class="active">${state.reports.page}</button>
      <span>/</span>
      <button>${totalPages}</button>
      <button id="reports-next" ${state.reports.page >= totalPages ? 'disabled' : ''}>›</button>
    </div>
  </div>`;
}

async function refreshReportResults() {
  try {
    const data = await fetchReportsData();
    const reportView = prepareReportViewData(data);
    $('#reports-kpi-grid').innerHTML = reportKpiHtml(reportView.statsData);
    $('#reports-bulk-delete-slot').innerHTML = reportBulkDeleteHtml(reportView.selectedDeleteCount);
    $('#reports-tbody').innerHTML = reportView.pageRecords.map((record, index) => reportRowHtml(record, reportView.start + index)).join('') || '<tr><td colspan="7" class="reports-empty-cell"></td></tr>';
    $('#reports-footer').innerHTML = reportFooterHtml(reportView.records, reportView.pageRecords, reportView.start, reportView.totalPages);
    bindReportControls(reportView.totalPages);
  } catch (error) {
    const tbody = $('#reports-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="reports-empty-cell">${escapeHtml(error.message || 'Data laporan belum bisa dimuat.')}</td></tr>`;
    }
  }
}

function bindReportControls(totalPages) {
  updateReportsSelectAllState();
  $('#reports-prev')?.addEventListener('click', () => { state.reports.page = Math.max(1, state.reports.page - 1); renderReports(); });
  $('#reports-next')?.addEventListener('click', () => { state.reports.page = Math.min(totalPages, state.reports.page + 1); renderReports(); });
  $$('[data-report-status]').forEach(button => {
    button.onclick = () => {
      state.reports.openStatusId = '';
      withMinimumLoader('Memperbarui status...', () => api(`/api/reports/${button.dataset.reportId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: button.dataset.reportStatus }),
      })).then(async () => {
        await renderReports();
        if (button.dataset.reportStatus === 'sk_selesai') {
          openReportInspectionUploadModal(button.dataset.reportId);
        }
      }).catch(error => {
        openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Update Status Gagal</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'Status laporan belum bisa diperbarui.')}</p></div>`);
        $('#close-modal').onclick = closeModal;
      });
    };
  });
  $$('[data-report-status-toggle]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      const id = button.dataset.reportStatusToggle;
      state.reports.openStatusId = String(state.reports.openStatusId) === String(id) ? '' : id;
      renderReports();
    };
  });
  $$('[data-report-review]').forEach(button => {
    button.onclick = () => openReportRecommendationPreview(button.dataset.reportReview);
  });
  $$('[data-report-delete]').forEach(button => {
    button.onclick = () => confirmDeleteReport(button.dataset.reportDelete);
  });
  $$('[data-report-select]').forEach(input => {
    input.onchange = () => {
      const ids = state.reports.selectedDeleteIds || new Set();
      state.reports.selectedDeleteIds = ids;
      if (input.checked) {
        ids.add(String(input.dataset.reportSelect));
      } else {
        ids.delete(String(input.dataset.reportSelect));
      }
      renderReports();
    };
  });
  $('#reports-select-all')?.addEventListener('change', event => {
    const ids = state.reports.selectedDeleteIds || new Set();
    state.reports.selectedDeleteIds = ids;
    (state.reports.lastRecords || []).forEach(record => {
      const id = String(record.id || '');
      if (!id) return;
      if (event.target.checked) ids.add(id);
      else ids.delete(id);
    });
    renderReports();
  });
  $$('[data-report-note]').forEach(input => {
    input.oninput = () => {
      const reportId = String(input.dataset.reportNote);
      const record = state.reports.lastRecords?.find(item => String(item.id) === reportId);
      if (record) record.keterangan = input.value;
      input.classList.remove('is-saved', 'is-error');
      input.classList.add('is-saving');
      clearTimeout(state.reports.noteTimers?.[reportId]);
      state.reports.noteTimers = state.reports.noteTimers || {};
      state.reports.noteTimers[reportId] = setTimeout(() => saveReportNote(reportId, input.value, input), 650);
    };
    input.onblur = () => {
      const reportId = String(input.dataset.reportNote);
      clearTimeout(state.reports.noteTimers?.[reportId]);
      saveReportNote(reportId, input.value, input);
    };
  });
  $('#reports-delete-selected')?.addEventListener('click', confirmDeleteSelectedReports);
}

function updateReportsSelectAllState() {
  const input = $('#reports-select-all');
  if (!input) return;
  const allIds = (state.reports.lastRecords || []).map(record => String(record.id || '')).filter(Boolean);
  const selected = state.reports.selectedDeleteIds || new Set();
  const selectedCount = allIds.filter(id => selected.has(id)).length;
  input.checked = Boolean(allIds.length && selectedCount === allIds.length);
  input.indeterminate = Boolean(selectedCount > 0 && selectedCount < allIds.length);
}

async function saveReportNote(reportId, value, input) {
  if (!reportId) return;
  if (input) input.dataset.savingNote = '1';
  try {
    const data = await api(`/api/reports/${encodeURIComponent(reportId)}/note`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keterangan: value }),
    });
    const record = state.reports.lastRecords?.find(item => String(item.id) === String(reportId));
    if (record && data.record) record.keterangan = data.record.keterangan || '';
    input?.classList.remove('is-saving', 'is-error');
    input?.classList.add('is-saved');
  } catch (error) {
    input?.classList.remove('is-saving', 'is-saved');
    input?.classList.add('is-error');
    input?.setAttribute('title', error.message || 'Keterangan belum tersimpan.');
  } finally {
    if (input) delete input.dataset.savingNote;
  }
}

function confirmDeleteReport(reportId) {
  const record = state.reports.lastRecords?.find(item => String(item.id) === String(reportId));
  const label = record?.nomor_laporan || record?.departemen || `Laporan ${reportId}`;
  openModal(`<div class="sheet-dialog">
    <div class="sheet-dialog-head"><h2>Konfirmasi Hapus</h2></div>
    <p class="sheet-dialog-copy">Yakin untuk hapus data "${escapeHtml(label)}"?</p>
    <div class="sheet-dialog-actions">
      <button id="cancel-delete-report" class="btn" type="button">Batal</button>
      <button id="confirm-delete-report" class="btn danger" type="button">Ya, Hapus</button>
    </div>
  </div>`);
  $('#cancel-delete-report').onclick = closeModal;
  $('#confirm-delete-report').onclick = () => deleteReport(reportId);
}

async function deleteReport(reportId) {
  try {
    await withMinimumLoader('Menghapus laporan...', () => api(`/api/reports/${reportId}`, { method: 'DELETE' }));
    state.reports.selectedDeleteIds?.delete(String(reportId));
    closeModal();
    await renderReports();
  } catch (error) {
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Hapus Gagal</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'Laporan belum bisa dihapus.')}</p></div>`);
    $('#close-modal').onclick = closeModal;
  }
}

function confirmDeleteSelectedReports() {
  const ids = [...(state.reports.selectedDeleteIds || new Set())];
  if (!ids.length) return;
  openModal(`<div class="sheet-dialog">
    <div class="sheet-dialog-head"><h2>Konfirmasi Hapus</h2></div>
    <p class="sheet-dialog-copy">Yakin untuk hapus ${ids.length} laporan yang dipilih?</p>
    <div class="sheet-dialog-actions">
      <button id="cancel-delete-selected-reports" class="btn" type="button">Batal</button>
      <button id="confirm-delete-selected-reports" class="btn danger" type="button">Ya, Hapus</button>
    </div>
  </div>`);
  $('#cancel-delete-selected-reports').onclick = closeModal;
  $('#confirm-delete-selected-reports').onclick = () => deleteSelectedReports(ids);
}

async function deleteSelectedReports(reportIds) {
  try {
    await withMinimumLoader('Menghapus laporan terpilih...', async () => {
      for (const id of reportIds) {
        await api(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
      }
    });
    state.reports.selectedDeleteIds = new Set();
    closeModal();
    await renderReports();
  } catch (error) {
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Hapus Gagal</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'Sebagian laporan belum bisa dihapus.')}</p></div>`);
    $('#close-modal').onclick = closeModal;
  }
}

async function openReportRecommendationPreview(reportId) {
  const record = state.reports.lastRecords?.find(item => String(item.id) === String(reportId));
  const reportNumber = record?.nomor_laporan || `Laporan ${reportId}`;
  const title = `Surat Rekomendasi - ${reportNumber}`;
  try {
    const data = await api(`/api/archives?${new URLSearchParams({ title }).toString()}`);
    const archive = (data.records || [])[0];
    if (!archive) {
      openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Dokumen Belum Ada</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">Surat rekomendasi untuk ${escapeHtml(reportNumber)} belum ditemukan. Ubah status ke Pemeriksaan untuk mengunggah dokumen terlebih dahulu.</p></div>`);
      $('#close-modal').onclick = closeModal;
      return;
    }
    await previewArchive(archive.id);
  } catch (error) {
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Review Gagal</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'Dokumen belum bisa ditampilkan.')}</p></div>`);
    $('#close-modal').onclick = closeModal;
  }
}

function reportRowHtml(record, index) {
  const meta = reportStatusMeta(record.status_progress);
  const isOpen = String(state.reports.openStatusId || '') === String(record.id);
  const isSelected = state.reports.selectedDeleteIds?.has(String(record.id));
  const noteValue = String(record.keterangan || '');
  const noteCell = record.status_progress === 'pemeriksaan'
    ? `<textarea class="report-note-input" data-report-note="${escapeHtml(record.id)}" rows="2" placeholder="Isi keterangan pemeriksaan...">${escapeHtml(noteValue)}</textarea>`
    : record.status_progress === 'sk_selesai' && noteValue
      ? `<span class="report-note-readonly">${escapeHtml(noteValue)}</span>`
      : `<span class="report-note-empty">-</span>`;
  const options = ['laporan_masuk', 'diterima_process', 'pemanggilan_investigasi', 'pemeriksaan', 'sk_selesai'].map(key => {
    const item = reportStatusMeta(key);
    return `<button type="button" data-report-id="${escapeHtml(record.id)}" data-report-status="${escapeHtml(key)}"><i style="background:${item.color}"></i>${escapeHtml(item.label)}</button>`;
  }).join('');
  return `<tr>
    <td><div class="reports-no-cell"><input type="checkbox" data-report-select="${escapeHtml(record.id)}" aria-label="Pilih laporan ${index + 1}" ${isSelected ? 'checked' : ''}><span>${index + 1}</span></div></td>
    <td><b>${escapeHtml(record.departemen)}</b></td>
    <td>${escapeHtml(formatReportDate(record.tanggal_laporan))}</td>
    <td><span class="report-type-text">${escapeHtml(record.jenis_laporan)}</span></td>
    <td><div class="report-status-menu ${isOpen ? 'open' : ''}"><button type="button" data-report-status-toggle="${escapeHtml(record.id)}" style="--status:${meta.color};--status-bg:${meta.bg};--status-border:${meta.border}"><i></i><b>${escapeHtml(meta.label)}</b><span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="${isOpen ? 'M5 12l5-5 5 5' : 'M5 8l5 5 5-5'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button><div>${options}</div></div></td>
    <td>${noteCell}</td>
    <td><div class="reports-actions">${record.status_progress === 'sk_selesai' ? `<button type="button" class="view" title="Review Surat Rekomendasi" data-report-review="${escapeHtml(record.id)}">${icon('eye')}</button>` : ''}<button type="button" class="delete" title="Hapus Laporan" data-report-delete="${escapeHtml(record.id)}">${icon('trash')}</button>${record.status_progress === 'laporan_masuk' ? `<button type="button" class="edit">${icon('edit')}</button>` : ''}</div></td>
  </tr>`;
}


async function renderArchive() {
  const root = $('#view-archive');
  try {
    const apiFilters = { year: state.archives.year || 'all', title: state.archives.title || 'all' };
    const query = new URLSearchParams(apiFilters).toString();
    const data = await api(`/api/archives?${query}`);
    const archiveRecords = data.records || [];
    const archiveFilters = data.filters || {};
    const hasAnyArchive = Boolean(archiveRecords.length || archiveFilters.years?.length || archiveFilters.titles?.length);

    if (!hasAnyArchive) {
      root.innerHTML = `
        <div class="archive-empty-page archive-empty-upload-page">
          <div class="archive-empty-upload-shell">
            <div class="archive-empty-upload-head">
              <h2>Tambah Arsip</h2>
              <button type="button" id="archive-empty-close" class="archive-empty-close">Tutup</button>
            </div>
            ${archiveUploadZoneHtml('archive-form', 'archive-file', 'archive-browse', 'archive-picked-file')}
          </div>
        </div>`;
      $('#archive-empty-close').onclick = () => setView('dashboard');
      $('#archive-form').onsubmit = uploadArchive;
      bindArchiveUploadArea('archive-form', 'archive-file', 'archive-browse', 'archive-picked-file');
      return;
    }

    const typeOptions = [...new Set(archiveRecords.map(record => String(record.extension || '').toUpperCase()).filter(Boolean))].sort();
    const search = String(state.archives.search || '').toLowerCase().trim();
    state.archiveRecords = archiveRecords;
    const records = archiveRecords.filter(record => {
      const typeOk = !state.archives.type || state.archives.type === 'all' || String(record.extension || '').toLowerCase() === String(state.archives.type).toLowerCase();
      const haystack = `${record.title || ''} ${record.file_name || ''} ${record.extension || ''}`.toLowerCase();
      return typeOk && (!search || haystack.includes(search));
    });
    if (!(state.archives.selectedIds instanceof Set)) state.archives.selectedIds = new Set();
    const filteredArchiveIds = new Set(records.map(record => String(record.id)));
    state.archives.selectedIds = new Set([...state.archives.selectedIds].filter(id => filteredArchiveIds.has(String(id))));
    const selectedCount = state.archives.selectedIds.size;
    const allFilteredSelected = Boolean(records.length) && records.every(record => state.archives.selectedIds.has(String(record.id)));
    const someFilteredSelected = Boolean(records.length) && records.some(record => state.archives.selectedIds.has(String(record.id)));
    const pageSize = state.archives.pageSize || 20;
    const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
    state.archives.page = Math.min(Math.max(1, Number(state.archives.page) || 1), totalPages);
    const pageStart = (state.archives.page - 1) * pageSize;
    const pageRecords = records.slice(pageStart, pageStart + pageSize);
    const firstShown = records.length ? pageStart + 1 : 0;
    const lastShown = Math.min(pageStart + pageRecords.length, records.length);
    root.innerHTML = `
      <div class="archive-table-page">
        <div class="archive-table-shell">
          <div class="archive-table-topbar">
            <div class="archive-table-title">${icon('archive')}Daftar Arsip</div>
            <div class="archive-table-filters">
              <select id="archive-year" class="archive-table-select">${optionHtml(archiveFilters.years || [], state.archives.year, 'Tahun Semua')}</select>
              <select id="archive-title" class="archive-table-select">${optionHtml(archiveFilters.titles || [], state.archives.title, 'Judul Semua')}</select>
              <select id="archive-type" class="archive-table-select">${optionHtml(typeOptions.map(type => ({ value: type.toLowerCase(), label: type })), state.archives.type, 'Tipe Semua')}</select>
            </div>
            <div class="archive-table-search">${icon('search')}<input id="archive-search" placeholder="Cari nama file..." value="${escapeHtml(state.archives.search || '')}"></div>
            <div class="archive-top-actions">
              ${archiveBulkDeleteHtml(selectedCount)}
              <button id="archive-upload-top" class="archive-upload-btn">+ Tambah</button>
            </div>
          </div>
          <div class="archive-table-wrap">
            <table class="archive-table">
              <thead><tr><th><input id="archive-select-all" class="archive-check" type="checkbox" ${allFilteredSelected ? 'checked' : ''} ${records.length ? '' : 'disabled'}></th><th>No</th><th>Nama File</th><th>Tanggal Upload</th><th>Ukuran</th><th>Aksi</th></tr></thead>
              <tbody>${pageRecords.map((record, index) => archiveTableRow(record, pageStart + index)).join('') || '<tr><td colspan="6" class="archive-table-empty">Belum ada arsip sesuai filter.</td></tr>'}</tbody>
            </table>
          </div>
          <div class="archive-table-footer"><span>Menampilkan ${pageRecords.length} dari ${records.length} file${selectedCount ? ` | ${selectedCount} dipilih` : ''}</span><div class="archive-footer-actions">${selectedCount ? archiveBulkDeleteHtml(selectedCount, 'archive-delete-selected-footer') : ''}<div class="archive-pagination"><button id="archive-prev-page" ${state.archives.page <= 1 ? 'disabled' : ''}>&lt;</button><span>${state.archives.page} / ${totalPages}</span><button id="archive-next-page" ${state.archives.page >= totalPages ? 'disabled' : ''}>&gt;</button></div></div></div>
        </div>
      </div>`;
    $('#archive-year').onchange = e => { state.archives.year = e.target.value; state.archives.page = 1; renderArchive(); };
    $('#archive-title').onchange = e => { state.archives.title = e.target.value; state.archives.page = 1; renderArchive(); };
    $('#archive-type').onchange = e => { state.archives.type = e.target.value; state.archives.page = 1; renderArchive(); };
    $('#archive-search').oninput = e => { state.archives.search = e.target.value; state.archives.page = 1; renderArchive(); };
    $('#archive-prev-page')?.addEventListener('click', () => { state.archives.page = Math.max(1, state.archives.page - 1); renderArchive(); });
    $('#archive-next-page')?.addEventListener('click', () => { state.archives.page = Math.min(totalPages, state.archives.page + 1); renderArchive(); });
    $('#archive-upload-top').onclick = openArchiveUploadModal;
    const selectAll = $('#archive-select-all');
    if (selectAll) {
      selectAll.indeterminate = someFilteredSelected && !allFilteredSelected;
      selectAll.onchange = event => {
        if (event.currentTarget.checked) records.forEach(record => state.archives.selectedIds.add(String(record.id)));
        else records.forEach(record => state.archives.selectedIds.delete(String(record.id)));
        renderArchive();
      };
    }
    $$('[data-archive-select]').forEach(input => {
      input.onchange = event => {
        const id = String(event.currentTarget.dataset.archiveSelect);
        if (event.currentTarget.checked) state.archives.selectedIds.add(id);
        else state.archives.selectedIds.delete(id);
        renderArchive();
      };
    });
    $('#archive-delete-selected')?.addEventListener('click', confirmDeleteSelectedArchives);
    $('#archive-delete-selected-footer')?.addEventListener('click', confirmDeleteSelectedArchives);
    $$('[data-preview]').forEach(btn => btn.onclick = () => previewArchive(btn.dataset.preview));
    $$('[data-download-archive]').forEach(btn => btn.onclick = () => downloadArchive(btn.dataset.downloadArchive));
    $$('[data-delete-archive]').forEach(btn => btn.onclick = () => confirmDeleteArchive(btn.dataset.deleteArchive));
  } catch (error) {
    root.innerHTML = databaseErrorPanel('Arsip belum bisa dibuka', error);
  }
}

function archiveBulkDeleteHtml(selectedCount, id = 'archive-delete-selected') {
  if (!selectedCount) return '';
  return `<button id="${id}" class="archive-bulk-delete" type="button">${icon('trash')} Hapus (${selectedCount})</button>`;
}

function archiveUploadZoneHtml(formId, fileId, browseId, pickedId) {
  return `<form id="${formId}" class="archive-upload-zone archive-upload-zone-compact">
    <input id="${fileId}" name="file" type="file" class="hidden" multiple accept=".pdf,.xlsx,.xls,.xlsm,.xlsb,.xltx,.xltm,.csv,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt,.md,.json,.xml,.html,.zip,.rar,.7z,.mp4,.mov,.mp3">
    <div class="archive-upload-icon">${icon('upload')}</div>
    <h2>Tarik dan lepas file di sini</h2>
    <p>Mendukung format .xlsx, .xls, dan .csv (Maksimal ukuran file 50MB per unggahan).</p>
    <div class="archive-upload-controls">
      <input id="${formId}-title" name="title" class="archive-title-input" placeholder="Title / Judul dokumen">
      <button type="button" id="${browseId}" class="archive-browse-btn">Browse Files</button>
    </div>
    <div id="${pickedId}" class="archive-picked-file"></div>
  </form>`;
}

function bindArchiveUploadArea(formId, fileId, browseId, pickedId) {
  const form = $(`#${formId}`);
  const fileInput = $(`#${fileId}`);
  const browse = $(`#${browseId}`);
  const picked = $(`#${pickedId}`);
  if (!form || !fileInput || !browse) return;
  browse.onclick = () => fileInput.click();
  fileInput.onchange = () => submitPickedFile();
  ['dragenter', 'dragover'].forEach(eventName => form.addEventListener(eventName, event => {
    event.preventDefault();
    form.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach(eventName => form.addEventListener(eventName, event => {
    event.preventDefault();
    form.classList.remove('dragging');
  }));
  form.addEventListener('drop', event => {
    if (!event.dataTransfer.files.length) return;
    fileInput.files = event.dataTransfer.files;
    submitPickedFile();
  });
  function submitPickedFile() {
    const files = [...(fileInput.files || [])];
    if (!files.length) return;
    picked.textContent = files.length === 1 ? `${files[0].name} | ${formatSize(files[0].size)}` : `${files.length} file dipilih untuk diunggah`;
    form.requestSubmit();
  }
}

function openArchiveUploadModal() {
  openModal(`
    <div class="archive-upload-modal">
      <div class="archive-upload-head"><h2>Tambah Arsip</h2><button type="button" id="close-modal" class="btn">Tutup</button></div>
      ${archiveUploadZoneHtml('archive-modal-form', 'archive-modal-file', 'archive-modal-browse', 'archive-modal-picked')}
    </div>`);
  $('#close-modal').onclick = closeModal;
  $('#archive-modal-form').onsubmit = uploadArchive;
  bindArchiveUploadArea('archive-modal-form', 'archive-modal-file', 'archive-modal-browse', 'archive-modal-picked');
}
function archiveTableRow(record, index) {
  const dt = new Date(record.uploaded_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const selected = state.archives.selectedIds instanceof Set && state.archives.selectedIds.has(String(record.id));
  return `<tr><td><input class="archive-check" type="checkbox" data-archive-select="${escapeHtml(record.id)}" ${selected ? 'checked' : ''}></td><td>${index + 1}</td><td><span class="archive-file-name">${icon('file')}${escapeHtml(record.file_name)}</span><small>${escapeHtml(record.title || '')}</small></td><td>${dt}</td><td>${formatSize(record.size)}</td><td><div class="archive-actions"><button class="archive-action-download" title="Download" data-download-archive="${record.id}">${icon('download')}</button><button class="archive-action-preview" title="View" data-preview="${record.id}">${icon('eye')}</button><button class="archive-action-delete" title="Hapus" data-delete-archive="${record.id}">${icon('trash')}</button></div></td></tr>`;
}
function formatSize(size) { const units = ['B','KB','MB','GB']; let n = Number(size || 0), i = 0; while(n >= 1024 && i < units.length - 1) { n /= 1024; i++; } return `${i ? n.toFixed(1) : Math.round(n)} ${units[i]}`; }

function formatDateTimeReadable(value) {
  if (!value || value === '-') return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const formatted = date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(/\s+pukul\s+/i, ', ').replace(/\./g, ':');
  return `${formatted} WIB`;
}

async function uploadArchive(event) {
  event.preventDefault();
  const form = event.target;
  const fileInput = form.querySelector('input[type="file"]');
  const files = [...(fileInput?.files || [])];
  if (!files.length) return;
  const titleInput = form.querySelector('[name="title"]');
  const baseTitle = (titleInput?.value || '').trim();
  const picked = form.querySelector('.archive-picked-file');
  try {
    await withMinimumLoader('Mengunggah arsip...', async () => {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (picked) picked.textContent = `Mengunggah ${index + 1}/${files.length}: ${file.name}`;
        const fd = new FormData();
        fd.append('title', baseTitle || file.name.replace(/\.[^.]+$/, ''));
        fd.append('file', file);
        await api('/api/archives', { method: 'POST', body: fd });
      }
    });
    closeModal();
    renderArchive();
  } catch (error) {
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Upload Gagal</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'Arsip belum bisa diunggah.')}</p></div>`);
    $('#close-modal').onclick = closeModal;
  }
}
function archiveRecordById(id) {
  return (state.archiveRecords || []).find(record => String(record.id) === String(id)) || null;
}

function confirmDeleteArchive(id) {
  const record = archiveRecordById(id);
  const fileName = escapeHtml(record?.file_name || 'dokumen');
  openModal(`<div class="delete-confirm-dialog delete-confirm-file delete-confirm-archive">
    <div class="delete-confirm-head">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 1.8 20h20.4L12 2zm1 15h-2v-2h2v2zm0-4h-2V8h2v5z"></path></svg>
      <h2>Konfirmasi Hapus</h2>
    </div>
    <div class="delete-confirm-body">Yakin untuk hapus dokumen “${fileName}” ?</div>
    <div class="delete-confirm-actions">
      <button id="cancel-delete-archive" class="btn delete-cancel">Batal</button>
      <button id="confirm-delete-archive" class="btn delete-confirm">Ya, Hapus</button>
    </div>
  </div>`);
  $('#cancel-delete-archive').onclick = closeModal;
  $('#confirm-delete-archive').onclick = () => deleteArchive(id);
}

function confirmDeleteSelectedArchives() {
  const ids = [...(state.archives.selectedIds || new Set())].map(String).filter(Boolean);
  if (!ids.length) return;
  openModal(`<div class="delete-confirm-dialog delete-confirm-file delete-confirm-archive">
    <div class="delete-confirm-head">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 1.8 20h20.4L12 2zm1 15h-2v-2h2v2zm0-4h-2V8h2v5z"></path></svg>
      <h2>Konfirmasi Hapus</h2>
    </div>
    <div class="delete-confirm-body">Yakin untuk hapus ${ids.length} dokumen arsip terpilih?</div>
    <div class="delete-confirm-actions">
      <button id="cancel-delete-archive" class="btn delete-cancel">Batal</button>
      <button id="confirm-delete-archive" class="btn delete-confirm">Ya, Hapus</button>
    </div>
  </div>`);
  $('#cancel-delete-archive').onclick = closeModal;
  $('#confirm-delete-archive').onclick = () => deleteSelectedArchives(ids);
}


function transformModeTabsHtml() {
  return `<div class="transform-mode-tabs">
    <button type="button" data-transform-mode="data" class="${state.transformTab === 'data' ? 'active' : ''}">Data Sanksi</button>
    <button type="button" data-transform-mode="master" class="${state.transformTab === 'master' ? 'active' : ''}">Master Data Karyawan</button>
  </div>`;
}

function bindTransformModeTabs() {
  $$('[data-transform-mode]').forEach(button => {
    button.onclick = () => {
      state.transformTab = button.dataset.transformMode || 'data';
      renderTransform();
    };
  });
}

function renderTransformDataFromState() {
  const root = $('#view-transform');
  const readOnlyMode = transformReadOnlyMode();
  const editDisabled = readOnlyMode ? 'disabled title="Kosongkan search dan pilih file spesifik untuk edit/save."' : '';
  root.innerHTML = `
    ${transformModeTabsHtml()}
    <div class="transform-workbench">
      <div class="transform-toolbar">
        <div class="transform-title">${icon('table')}Transform & Edit Data</div>
        <div class="transform-divider"></div>
        <button id="add-row" class="transform-tool add" ${editDisabled}>${icon('plus')} Add Column</button>
        <button id="edit-row" class="transform-tool edit" ${editDisabled}>${icon('edit')} Edit</button>
        <button id="delete-row" class="transform-tool delete">${icon('trash')} Delete File</button>
        <div class="transform-toolbar-spacer"></div>
        <label class="transform-search-box">${icon('search')}<input id="transform-search" value="${escapeHtml(state.transformSearch || '')}" placeholder="Cari nama / PERNER"></label>
        <select id="transform-batch-select" class="transform-batch-select">${transformBatchOptionsHtml()}</select>
        <button id="export-transform" class="transform-export">${icon('download')} Export</button>
      </div>
      <div id="transform-table-host"><div id="transform-spreadsheet"></div></div>
      <button id="save-transform" class="transform-save" ${editDisabled}>${icon('save')} Save</button>
      <div class="transform-tabs">${transformSheetTabsHtml()}</div>
    </div>`;
  bindTransformModeTabs();
  $('#transform-batch-select').onchange = e => { state.transformBatchId = e.target.value; renderTransform(); };
  $('#transform-search').oninput = e => { state.transformSearch = e.target.value; updateTransformToolbarState(); renderTransformSpreadsheet(); };
  $('#add-row').onclick = addTransformColumn;
  $('#edit-row').onclick = focusSelectedTransformRow;
  $('#delete-row').onclick = confirmDeleteTransformBatch;
  $('#export-transform').onclick = exportTransformExcel;
  $('#save-transform').onclick = saveTransform;
  bindTransformSheetTabs();
  renderTransformSpreadsheet();
}

function styleTransformSanctionTypeCells() {
  const column = transformColumnByMeaning('sanctionType') || 'jenis_sanksi';
  const x = state.transformColumns.indexOf(column);
  if (x < 0) return;
  $$(`#transform-spreadsheet tbody td[data-x="${x}"]`).forEach(cell => {
    const value = sanctionTypeDisplayLabel(String(cell.textContent || '').trim());
    cell.classList.add('sanction-type-cell');
    cell.dataset.badgeValue = value || '';
  });
}

function openSpreadsheetEditor(grid, cell) {
  if (!grid || !cell) return;
  requestAnimationFrame(() => {
    try {
      if (typeof grid.openEditor === 'function') {
        grid.openEditor(cell, false);
        return;
      }
      cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: false, cancelable: true }));
    } catch (error) {}
  });
}

function activeSpreadsheetEditor(host) {
  const cellEditor = state.spreadsheetCellEditor;
  if (cellEditor?.host === host && document.body.contains(cellEditor.input)) return cellEditor.input;
  const tracked = state.nativeSpreadsheetEditor;
  if (tracked?.input && document.body.contains(tracked.input)) {
    const rect = tracked.input.getBoundingClientRect?.();
    if (rect && rect.width > 0 && rect.height > 0) return tracked.input;
  }
  const active = document.activeElement;
  if (active && host.contains(active) && (active.matches('input, textarea') || active.isContentEditable)) return active;
  const localEditor = host.querySelector('textarea:not([type="hidden"]):not([readonly]), input:not([type="hidden"]):not([readonly])');
  if (localEditor) return localEditor;
  const detachedEditor = $$('.jexcel_texteditor, .jexcel_textarea, .jspreadsheet_editor, .jss_editor, textarea, input')
    .find(element => {
      if (!element || element.type === 'hidden' || element.readOnly) return false;
      const rect = element.getBoundingClientRect?.();
      const visible = rect && rect.width > 0 && rect.height > 0;
      const spreadsheetOwned = element.closest?.('#transform-spreadsheet, #master-grid, .jexcel, .jspreadsheet, .jexcel_content, .jspreadsheet_content, .jss_content') ||
        /\b(jexcel|jspreadsheet|jss)\b/i.test(element.className || '');
      return visible && spreadsheetOwned;
    });
  if (detachedEditor) return detachedEditor;
  if (tracked?.hostId && host?.id === tracked.hostId) {
    const sameCell = !state.lastSpreadsheetCell ||
      (state.lastSpreadsheetCell.hostId === tracked.hostId &&
        Number(state.lastSpreadsheetCell.x) === Number(tracked.x) &&
        Number(state.lastSpreadsheetCell.y) === Number(tracked.y));
    if (sameCell) return host;
  }
  return null;
}

function isSpreadsheetEditorActive(host = null) {
  if (host && activeSpreadsheetEditor(host)) return true;
  if (!host && (($('#transform-spreadsheet') && activeSpreadsheetEditor($('#transform-spreadsheet'))) || ($('#master-grid') && activeSpreadsheetEditor($('#master-grid'))))) return true;
  const active = document.activeElement;
  const isEditable = active && (active.matches?.('input, textarea, select') || active.isContentEditable);
  if (!isEditable) return false;
  if (host) return host.contains(active);
  return Boolean(active.closest?.('#transform-spreadsheet, #master-grid'));
}

function transformCellPostEdit(rowIndex, columnIndex, value, options = {}) {
  const { runDerived = true } = options;
  const column = state.transformColumns[columnIndex];
  if (!column) return;
  if (!state.transformRows[rowIndex]) state.transformRows[rowIndex] = emptyTransformRow();
  state.transformRows[rowIndex][column] = value;
  if (!runDerived) return;
  if (isPernerColumn(column) && String(value || '').trim()) {
    applyEmployeeMasterLookup(rowIndex, value);
  }
  if (column === transformColumnByMeaning('startDate') || column === transformColumnByMeaning('sanctionType') || column === transformColumnByMeaning('endDate')) {
    if (normalizeSanctionEndDateForRow(state.transformRows[rowIndex], column)) updateTransformEndDateCell(rowIndex);
  }
  if (column === 'tanggal_mulai_sanksi' || column === sanctionNumberColumn()) {
    if (normalizeSanctionNumberForRow(state.transformRows[rowIndex], column)) updateTransformSanctionNumberCell(rowIndex);
  }
  if (column === transformColumnByMeaning('sanctionType')) {
    requestAnimationFrame(styleTransformSanctionTypeCells);
  }
}

function masterCellPostEdit(rowIndex, columnIndex, value) {
  const column = state.masterColumns[columnIndex];
  if (!column) return;
  if (!state.masterRows[rowIndex]) state.masterRows[rowIndex] = Object.fromEntries(state.masterColumns.map(item => [item, '']));
  state.masterRows[rowIndex][column] = value;
}

function uniqueSpreadsheetColumns(rawColumns, fallbackPrefix = 'kolom') {
  const seen = new Map();
  return (rawColumns || []).map((column, index) => {
    const base = String(column || '').trim() || `${fallbackPrefix}_${index + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count ? `${base}_${count + 1}` : base;
  });
}

function gridColumnTitles(grid, fallbackColumns = [], fallbackPrefix = 'kolom') {
  const columns = grid?.options?.columns || [];
  const titles = columns.map((column, index) => String(column?.title || fallbackColumns[index] || `${fallbackPrefix}_${index + 1}`).trim());
  return uniqueSpreadsheetColumns(titles, fallbackPrefix);
}

function rowsFromGridData(grid, columns) {
  const gridData = grid?.getData?.() || [];
  return gridData
    .map(row => Object.fromEntries(columns.map((column, index) => [column, String(row?.[index] ?? '').trim()])))
    .filter(row => columns.some(column => String(row[column] || '').trim()));
}

function syncTransformGridStructure() {
  if (!state.transformGrid) return;
  const columns = gridColumnTitles(state.transformGrid, state.transformColumns, 'kolom_sanksi');
  const rows = rowsFromGridData(state.transformGrid, columns);
  state.transformColumns = columns;
  state.transformRows = rows;
  if (state.activeTransformSheet) {
    state.transformSheetRows[state.activeTransformSheet] = rows;
  }
  state.selectedTransformRows = new Set();
  state.selectedTransformCells = new Set();
  state.selectedTransformHeaders = new Set();
}

function syncMasterGridStructure() {
  if (!state.masterGrid) return;
  const columns = gridColumnTitles(state.masterGrid, state.masterColumns, 'kolom_master');
  const nextRows = rowsFromGridData(state.masterGrid, columns);
  if (state.masterGridFiltered) {
    const current = [...(state.masterRows || [])];
    const pernerColumn = findColumnByMeaning(columns, 'perner') || 'perner_karyawan';
    const visiblePerners = new Set((state.masterVisibleRows || []).map(row => String(row[pernerColumn] || row.perner_karyawan || '').trim()).filter(Boolean));
    const nextPerners = new Set(nextRows.map(row => String(row[pernerColumn] || row.perner_karyawan || '').trim()).filter(Boolean));
    state.masterDeletedPerners = state.masterDeletedPerners || new Set();
    visiblePerners.forEach(perner => {
      if (!nextPerners.has(perner)) state.masterDeletedPerners.add(perner);
    });
    let merged = current.filter(row => {
      const key = String(row[pernerColumn] || row.perner_karyawan || '').trim();
      return !state.masterDeletedPerners.has(key);
    });
    nextRows.forEach(row => {
      const key = String(row[pernerColumn] || row.perner_karyawan || '').trim().toLowerCase();
      if (!key) return;
      const index = merged.findIndex(item => String(item[pernerColumn] || item.perner_karyawan || '').trim().toLowerCase() === key);
      if (index >= 0) merged[index] = { ...merged[index], ...row };
      else merged.push(row);
    });
    state.masterColumns = columns;
    state.masterRows = merged;
    return;
  }
  const previousPerners = new Set((state.masterRows || []).map(row => String(row.perner_karyawan || '').trim()).filter(Boolean));
  const nextPerners = new Set(nextRows.map(row => String(row.perner_karyawan || '').trim()).filter(Boolean));
  state.masterDeletedPerners = state.masterDeletedPerners || new Set();
  previousPerners.forEach(perner => {
    if (!nextPerners.has(perner)) state.masterDeletedPerners.add(perner);
  });
  state.masterColumns = columns;
  state.masterRows = nextRows;
}

function scheduleSpreadsheetStructureSync(kind) {
  setTimeout(() => {
    if (kind === 'master') {
      syncMasterGridStructure();
    } else {
      syncTransformGridStructure();
      styleTransformSanctionTypeCells();
    }
  }, 0);
}

function selectedSpreadsheetCell(host) {
  return host.querySelector('tbody td.jexcel_selected, tbody td.selected, tbody td.highlight') ||
    (state.lastSpreadsheetCell?.hostId === host.id
      ? host.querySelector(`tbody td[data-x="${state.lastSpreadsheetCell.x}"][data-y="${state.lastSpreadsheetCell.y}"]`)
      : null);
}

function isPrintableSpreadsheetKey(event) {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

function insertTextIntoNativeEditor(editor, text) {
  if (!editor || !text) return false;
  if (!('value' in editor) && !editor.isContentEditable) return false;
  editor.focus({ preventScroll: true });
  if ('value' in editor) {
    const start = editor.selectionStart ?? editor.value.length;
    const end = editor.selectionEnd ?? start;
    editor.value = `${editor.value.slice(0, start)}${text}${editor.value.slice(end)}`;
    const cursor = start + text.length;
    editor.setSelectionRange?.(cursor, cursor);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  document.execCommand?.('insertText', false, text);
  return true;
}

function insertTextIntoSpreadsheetCellEditor(text) {
  const editor = state.spreadsheetCellEditor;
  const input = editor?.input;
  if (!input || !document.body.contains(input)) return false;
  input.focus({ preventScroll: true });
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.value = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;
  const cursor = start + text.length;
  input.setSelectionRange(cursor, cursor);
  positionSpreadsheetCellEditor(editor);
  return true;
}

function deleteFromSpreadsheetCellEditor(backward = true) {
  const editor = state.spreadsheetCellEditor;
  const input = editor?.input;
  if (!input || !document.body.contains(input)) return false;
  input.focus({ preventScroll: true });
  let start = input.selectionStart ?? input.value.length;
  let end = input.selectionEnd ?? start;
  if (start === end) {
    if (backward && start > 0) start -= 1;
    if (!backward && end < input.value.length) end += 1;
  }
  input.value = `${input.value.slice(0, start)}${input.value.slice(end)}`;
  input.setSelectionRange(start, start);
  positionSpreadsheetCellEditor(editor);
  return true;
}

function spreadsheetGridValue(grid, x, y) {
  return String(grid?.getData?.()?.[y]?.[x] ?? '');
}

function positionSpreadsheetCellEditor(editor = state.spreadsheetCellEditor) {
  if (!editor || !document.body.contains(editor.input) || !document.body.contains(editor.cell)) return;
  const rect = editor.cell.getBoundingClientRect();
  const estimatedWidth = Math.min(Math.max(rect.width, editor.input.value.length * 7.8 + 28, 120), Math.max(220, window.innerWidth - rect.left - 18));
  editor.input.style.left = `${rect.left}px`;
  editor.input.style.top = `${rect.top}px`;
  editor.input.style.width = `${estimatedWidth}px`;
  editor.input.style.height = `${Math.max(rect.height, 30)}px`;
}

function closeSpreadsheetCellEditor(commit = true, reason = 'commit') {
  const editor = state.spreadsheetCellEditor;
  if (!editor) return;
  state.spreadsheetCellEditor = null;
  window.removeEventListener('resize', editor.position);
  editor.scrollParents.forEach(parent => parent.removeEventListener('scroll', editor.position));
  const value = editor.input.value;
  editor.input.remove();
  if (!commit) {
    editor.host.focus({ preventScroll: true });
    return;
  }
  try {
    editor.grid.setValueFromCoords(editor.x, editor.y, value, true);
  } catch (error) {}
  if (editor.host.id === 'transform-spreadsheet') {
    transformCellPostEdit(editor.y, editor.x, value, { runDerived: reason === 'enter' });
  } else if (editor.host.id === 'master-grid') {
    masterCellPostEdit(editor.y, editor.x, value);
  }
  editor.host.focus({ preventScroll: true });
}

function openSpreadsheetCellEditor(host, grid, cell, initialValue, replace = true) {
  if (!host || !grid || !cell) return false;
  closeSpreadsheetCellEditor(true, 'switch');
  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  if (Number.isNaN(x) || Number.isNaN(y)) return false;
  const input = document.createElement('textarea');
  input.className = 'spreadsheet-cell-editor';
  input.rows = 1;
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.value = replace ? String(initialValue ?? '') : spreadsheetGridValue(grid, x, y);
  const scrollers = [window, ...$$('.jexcel_content, .jspreadsheet_content, .jss_content', host)];
  const position = () => positionSpreadsheetCellEditor();
  state.spreadsheetCellEditor = { host, grid, cell, input, x, y, position, scrollParents: scrollers };
  document.body.appendChild(input);
  position();
  scrollers.forEach(parent => parent.addEventListener('scroll', position, { passive: true }));
  window.addEventListener('resize', position);
  input.addEventListener('mousedown', event => event.stopPropagation());
  input.addEventListener('click', event => event.stopPropagation());
  input.addEventListener('input', () => positionSpreadsheetCellEditor());
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      closeSpreadsheetCellEditor(true, 'enter');
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      closeSpreadsheetCellEditor(true, 'tab');
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSpreadsheetCellEditor(false, 'escape');
    }
  });
  requestAnimationFrame(() => {
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
    positionSpreadsheetCellEditor();
  });
  return true;
}

function beginSpreadsheetEditFromPrintableKey(host, grid, cell, key) {
  return openSpreadsheetCellEditor(host, grid, cell, key, true);
}

function appendPendingNativeSpreadsheetKey(host, cell, key) {
  return false;
}

function spreadsheetHostForGlobalTyping() {
  if (state.view !== 'transform') return null;
  const transformHost = $('#transform-spreadsheet');
  if (transformHost && selectedSpreadsheetCell(transformHost)) return { host: transformHost, grid: state.transformGrid };
  const masterHost = $('#master-grid');
  if (masterHost && selectedSpreadsheetCell(masterHost)) return { host: masterHost, grid: state.masterGrid };
  return null;
}

function bindSpreadsheetGlobalTyping() {
  if (state.spreadsheetGlobalTypingBound) return;
  state.spreadsheetGlobalTypingBound = true;
  document.addEventListener('keydown', event => {
    if (state.spreadsheetCellEditor) {
      if (isPrintableSpreadsheetKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        insertTextIntoSpreadsheetCellEditor(event.key);
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        deleteFromSpreadsheetCellEditor(event.key === 'Backspace');
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        closeSpreadsheetCellEditor(true, 'enter');
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        closeSpreadsheetCellEditor(true, 'tab');
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        closeSpreadsheetCellEditor(false, 'escape');
        return;
      }
    }
    if (!isPrintableSpreadsheetKey(event)) return;
    const active = document.activeElement;
    if (active?.matches?.('input, textarea, select') || active?.isContentEditable) return;
    if (state.spreadsheetCellEditor) return;
    const target = spreadsheetHostForGlobalTyping();
    if (!target?.host || !target.grid) return;
    const cell = selectedSpreadsheetCell(target.host);
    if (!cell) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    beginSpreadsheetEditFromPrintableKey(target.host, target.grid, cell, event.key);
  }, true);
  document.addEventListener('mousedown', event => {
    const editor = state.spreadsheetCellEditor;
    if (!editor) return;
    if (event.target === editor.input) return;
    const targetCell = event.target.closest?.('td[data-x][data-y]');
    if (targetCell && editor.host.contains(targetCell)) return;
    closeSpreadsheetCellEditor(true, 'blur');
  }, true);
}

function bindSpreadsheetCommitTracker() {
  if (state.spreadsheetCommitTrackerBound) return;
  state.spreadsheetCommitTrackerBound = true;
  document.addEventListener('keydown', event => {
    if (state.view !== 'transform' || event.key !== 'Enter') return;
    const tracked = state.nativeSpreadsheetEditor;
    if (tracked?.hostId === 'transform-spreadsheet') {
      state.pendingTransformEnterCommit = { x: Number(tracked.x), y: Number(tracked.y) };
      state.nativeSpreadsheetEditor = null;
      state.pendingNativeSpreadsheetEdit = null;
      return;
    }
    const active = document.activeElement;
    if (!active || !(active.matches?.('input, textarea') || active.isContentEditable)) return;
    const hostId = tracked?.hostId || active.closest?.('#transform-spreadsheet, #master-grid')?.id || state.activeSpreadsheetEdit?.hostId;
    if (hostId !== 'transform-spreadsheet') return;
    const x = tracked?.x ?? state.activeSpreadsheetEdit?.x ?? state.lastSpreadsheetCell?.x;
    const y = tracked?.y ?? state.activeSpreadsheetEdit?.y ?? state.lastSpreadsheetCell?.y;
    if (Number.isNaN(Number(x)) || Number.isNaN(Number(y))) return;
    state.pendingTransformEnterCommit = { x: Number(x), y: Number(y) };
  }, true);
}

function bindClickToEditSpreadsheet(host, gridGetter) {
  if (!host || host.dataset.clickToEditBound === '1') return;
  host.dataset.clickToEditBound = '1';
  bindSpreadsheetGlobalTyping();
  bindSpreadsheetCommitTracker();
  host.addEventListener('mousedown', event => {
    if (state.transformFillDrag || state.masterFillDrag || state.isSelectingTransformCells || state.isSelectingTransformHeaders) return;
    const cell = event.target.closest?.('td[data-x][data-y]');
    if (!cell || !host.contains(cell)) return;
    if (state.spreadsheetCellEditor && state.spreadsheetCellEditor.cell !== cell) {
      closeSpreadsheetCellEditor(true, 'switch');
    }
    const previous = state.nativeSpreadsheetEditor;
    if (previous?.hostId === host.id &&
      (Number(previous.x) !== Number(cell.dataset.x) || Number(previous.y) !== Number(cell.dataset.y))) {
      state.nativeSpreadsheetEditor = null;
      state.pendingNativeSpreadsheetEdit = null;
    }
    state.lastSpreadsheetCell = {
      hostId: host.id,
      x: Number(cell.dataset.x),
      y: Number(cell.dataset.y),
    };
    host.setAttribute('tabindex', '0');
    requestAnimationFrame(() => {
      if (!activeSpreadsheetEditor(host)) host.focus({ preventScroll: true });
    });
  });
  host.addEventListener('dblclick', event => {
    const cell = event.target.closest?.('td[data-x][data-y]');
    if (!cell || !host.contains(cell) || isFillHandleHit(event, cell)) return;
    event.preventDefault();
    event.stopPropagation();
    openSpreadsheetCellEditor(host, gridGetter(), cell, '', false);
  }, true);
  host.addEventListener('keydown', event => {
    if (host.id !== 'transform-spreadsheet' || event.key !== 'Enter') return;
    if (state.spreadsheetCellEditor?.host === host) return;
    const last = state.lastSpreadsheetCell;
    if (!last || last.hostId !== 'transform-spreadsheet') return;
    state.pendingTransformEnterCommit = { x: last.x, y: last.y };
    if (activeSpreadsheetEditor(host)) return;
    setTimeout(() => {
      const value = String(state.transformGrid?.getData?.()?.[last.y]?.[last.x] ?? '').trim();
      transformCellPostEdit(last.y, last.x, value);
    }, 0);
  });
}

// Fungsi Render Jspreadsheet
function renderTransformSpreadsheet() {
  const host = document.getElementById('transform-spreadsheet');
  if (!host || !window.jspreadsheet) return;

  host.innerHTML = '';

  const rows = visibleTransformRows();
  const columns = state.transformColumns;
  const readOnlyMode = transformReadOnlyMode();

  const data = rows.map(row =>
    columns.map(column => formatTransformCellValue(column, row[column]))
  );
  const columnWidths = columns.map(column => column === 'uraian_pelanggaran' ? 260 : 150);

  state.transformGrid = jspreadsheet(host, {
    data,
    columns: columns.map((column, index) => ({
      title: column,
      width: columnWidths[index],
      readOnly: readOnlyMode,
    })),
    minDimensions: [columns.length, Math.max(rows.length, 20)],
    tableOverflow: true,
    tableWidth: '100%',
    tableHeight: 'calc(100vh - 180px)',
    allowInsertRow: true,
    allowDeleteRow: true,
    allowInsertColumn: true,
    allowDeleteColumn: true,
    allowRenameColumn: true,
    columnDrag: true,
    rowDrag: true,
    oneditionstart(instance, cell, x, y) {
      state.activeSpreadsheetEdit = { hostId: 'transform-spreadsheet', x: Number(x), y: Number(y) };
    },
    oneditionend() {
      state.activeSpreadsheetEdit = null;
      state.nativeSpreadsheetEditor = null;
      state.pendingNativeSpreadsheetEdit = null;
    },
    onchange(instance, cell, x, y, value) {
      const column = state.transformColumns[x];
      if (!state.transformRows[y]) state.transformRows[y] = emptyTransformRow();
      if (state.isAutoUpdatingEndDate && column === transformColumnByMeaning('endDate')) {
        state.transformRows[y][column] = value;
        return;
      }
      pushTransformUndo();
      const pendingEnter = state.pendingTransformEnterCommit;
      const runDerived = Boolean(pendingEnter && Number(pendingEnter.x) === Number(x) && Number(pendingEnter.y) === Number(y));
      if (runDerived) state.pendingTransformEnterCommit = null;
      transformCellPostEdit(y, x, value, { runDerived });
    },
    oninsertrow() {
      pushTransformUndo();
      scheduleSpreadsheetStructureSync('transform');
    },
    ondeleterow() {
      pushTransformUndo();
      scheduleSpreadsheetStructureSync('transform');
    },
    oninsertcolumn() {
      pushTransformUndo();
      scheduleSpreadsheetStructureSync('transform');
    },
    ondeletecolumn() {
      pushTransformUndo();
      scheduleSpreadsheetStructureSync('transform');
    },
    onrenamecolumn() {
      pushTransformUndo();
      scheduleSpreadsheetStructureSync('transform');
    },
  });

  host.ondblclick = event => {
    const cell = event.target.closest('td[data-x][data-y]');
    if (!cell) return;
    if (!isFillHandleHit(event, cell)) return;

    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    if (Number.isNaN(x) || Number.isNaN(y)) return;

    autoSeriesDownFromCell(x, y, cell);
  };

  bindTransformSheetScroll(host);
  bindTransformFillHandle(host);
  bindClickToEditSpreadsheet(host, () => state.transformGrid);
  styleTransformSanctionTypeCells();
}



function transformRowPerner(rowIndex) {
  const row = state.transformRows[rowIndex] || {};
  return row.perner_karyawan || state.transformGrid?.getData?.()?.[rowIndex]?.[state.transformColumns.indexOf('perner_karyawan')] || '';
}

async function evaluateTransformFormula(rowIndex, columnIndex, formula) {
  const text = String(formula || '').trim();
  if (!text.startsWith('=')) return;
  setTransformCellFormula(state.activeTransformSheet, columnIndex, rowIndex, text);
  if (/^=LOOKUP\(/i.test(text)) {
    const generic = parseFormulaArgs(text.replace(/^=LOOKUP\(/i, '').replace(/\)$/i, ''));
    if (generic.length === 1) {
      setTransformFormulaResult(rowIndex, columnIndex, resolveFormulaArgumentValue(rowIndex, generic[0]));
      return;
    }
    if (generic.length >= 3) {
      const sourceValue = String(resolveFormulaArgumentValue(rowIndex, generic[0]) ?? '').trim().toLowerCase();
      const keyValues = resolveFormulaArgumentValues(rowIndex, generic[1]).map(value => String(value ?? '').trim().toLowerCase());
      const returnValues = resolveFormulaArgumentValues(rowIndex, generic[2]);
      const index = keyValues.findIndex(value => value === sourceValue);
      const fallback = generic[3] ? resolveFormulaArgumentValue(rowIndex, generic[3]) : '';
      setTransformFormulaResult(rowIndex, columnIndex, index >= 0 ? (returnValues[index] ?? '') : fallback);
      return;
    }
    const config = parseLookupFormula(text);
    if (config) {
      const sourceValue = transformColumnValue(rowIndex, config.source);
      const masterRow = findMasterRowByColumn(config.key, sourceValue);
      const result = masterRow ? (masterRow[config.result] ?? '') : (config.fallback || '');
      setTransformFormulaResult(rowIndex, columnIndex, result);
    }
    return;
  }
  const directRef = text.match(/^=(.+)$/);
  if (directRef && parseFormulaReference(directRef[1])) {
    setTransformFormulaResult(rowIndex, columnIndex, resolveFormulaArgumentValue(rowIndex, directRef[1]));
    return;
  }
  const singleCellFn = text.match(/^=(UPPER|LOWER|TRIM)\((.*?)\)$/i);
  if (singleCellFn) {
    const fn = singleCellFn[1].toUpperCase();
    const raw = resolveFormulaArgumentValue(rowIndex, singleCellFn[2]);
    const value = fn === 'UPPER' ? raw.toUpperCase() : fn === 'LOWER' ? raw.toLowerCase() : raw.trim().replace(/\s+/g, ' ');
    setTransformFormulaResult(rowIndex, columnIndex, value);
    return;
  }
  const concatFn = text.match(/^=CONCAT\((.*)\)$/i);
  if (concatFn) {
    const value = parseFormulaArgs(concatFn[1]).map(arg => resolveFormulaArgumentValue(rowIndex, arg)).join('');
    setTransformFormulaResult(rowIndex, columnIndex, value);
    return;
  }
  const sumFn = text.match(/^=SUM\((.*)\)$/i);
  if (sumFn) {
    const values = parseFormulaArgs(sumFn[1]).flatMap(arg => resolveFormulaArgumentValues(rowIndex, arg));
    const total = values.reduce((sum, value) => sum + (Number(String(value).replace(',', '.')) || 0), 0);
    setTransformFormulaResult(rowIndex, columnIndex, total);
    return;
  }
  const dateDiffFn = text.match(/^=DATEDIF\((.*)\)$/i);
  if (dateDiffFn) {
    const args = parseFormulaArgs(dateDiffFn[1]);
    const start = parseTransformDate(resolveFormulaArgumentValue(rowIndex, args[0]));
    const end = parseTransformDate(resolveFormulaArgumentValue(rowIndex, args[1]));
    const value = start && end ? Math.round((end - start) / 86400000) : '';
    setTransformFormulaResult(rowIndex, columnIndex, value);
  }
}


function transformColumnValue(rowIndex, columnName) {
  const column = state.transformColumns.find(item => item === columnName) || state.transformColumns.find(item => item.toLowerCase() === String(columnName || '').toLowerCase());
  if (!column) return '';
  const x = state.transformColumns.indexOf(column);
  return String(state.transformGrid?.getData?.()?.[rowIndex]?.[x] ?? state.transformRows[rowIndex]?.[column] ?? '').trim();
}

function findMasterRowByColumn(keyColumn, value) {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key) return null;
  const column = currentMasterColumns().find(item => item === keyColumn) || currentMasterColumns().find(item => item.toLowerCase() === String(keyColumn || '').toLowerCase());
  if (!column) return null;
  const rows = employeeMasterRowsFromGridSafe();
  return rows.find(row => String(row[column] ?? '').trim().toLowerCase() === key) || null;
}

function employeeMasterRowsFromGridSafe() {
  if (state.masterGrid?.getData && state.masterColumns?.length) {
    return state.masterGrid.getData().map(row => Object.fromEntries(state.masterColumns.map((column, index) => [column, String(row[index] ?? '').trim()])));
  }
  return state.masterRows || [];
}

async function refreshEmployeeMasterCache() {
  const data = await api('/api/master-employees');
  state.masterColumns = data.columns || ['perner_karyawan', 'nama_karyawan', 'jabatan_karyawan', 'departemen_seksi'];
  state.masterRows = data.rows || [];
  return state.masterRows;
}

function mergeEmployeeIntoMasterCache(employee) {
  if (!employee?.perner_karyawan) return;
  const key = String(employee.perner_karyawan).trim().toLowerCase();
  const rows = state.masterRows || [];
  const existingIndex = rows.findIndex(row => String(row.perner_karyawan || '').trim().toLowerCase() === key);
  if (existingIndex >= 0) {
    rows[existingIndex] = { ...rows[existingIndex], ...employee };
    state.masterRows = rows;
  } else {
    state.masterRows = [...rows, employee];
  }
}

function resolveFormulaArgumentValue(rowIndex, arg) {
  const values = resolveFormulaArgumentValues(rowIndex, arg);
  return String(values[0] ?? '');
}

function parseFormulaArgs(text) {
  const args = [];
  let current = '';
  let quote = false;
  let depth = 0;
  String(text || '').split('').forEach(char => {
    if (char === '"') quote = !quote;
    if (!quote && char === '(') depth += 1;
    if (!quote && char === ')') depth -= 1;
    if (!quote && depth === 0 && char === ',') {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  });
  if (current.trim() || text) args.push(current.trim());
  return args;
}

function normalizeFormulaSheetName(sheet) {
  const requested = String(sheet || '').trim();
  if (!requested) return state.activeTransformSheet;
  if (requested.toLowerCase() === MASTER_FORMULA_SHEET.toLowerCase()) return MASTER_FORMULA_SHEET;
  return (state.transformSheets || []).find(name => String(name).trim().toLowerCase() === requested.toLowerCase()) || requested;
}

function sheetRowsForFormula(sheet) {
  const resolvedSheet = normalizeFormulaSheetName(sheet);
  if (resolvedSheet === MASTER_FORMULA_SHEET) {
    if (state.masterGrid?.getData && state.masterColumns?.length) return state.masterGrid.getData();
    return (state.masterRows || []).map(row => currentMasterColumns().map(column => row[column] ?? ''));
  }
  if (!resolvedSheet || resolvedSheet === state.activeTransformSheet) return state.transformGrid?.getData?.() || activeTransformRows().map(row => state.transformColumns.map(column => row[column] ?? ''));
  const rows = state.transformSheetRows?.[resolvedSheet] || [];
  return rows.map(row => state.transformColumns.map(column => row[column] ?? ''));
}

function parseFormulaReference(arg) {
  const clean = String(arg || '').trim().replace(/^"|"$/g, '');
  const refMatch = clean.match(/^(?:(?:'((?:[^']|'')+)'|([^!]+))!)?(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?$/i);
  if (!refMatch) return null;
  const sheet = (refMatch[1] ? refMatch[1].replace(/''/g, "'") : refMatch[2]) || state.activeTransformSheet;
  const start = cellRefToCoords(refMatch[3]);
  const end = cellRefToCoords(refMatch[4] || refMatch[3]);
  if (!start || !end) return null;
  return { sheet, start, end };
}

function resolveFormulaArgumentValues(rowIndex, arg) {
  const clean = String(arg || '').trim().replace(/^"|"$/g, '');
  const reference = parseFormulaReference(arg);
  if (reference) {
    const data = sheetRowsForFormula(reference.sheet);
    const values = [];
    const x1 = Math.min(reference.start.x, reference.end.x);
    const x2 = Math.max(reference.start.x, reference.end.x);
    const y1 = Math.min(reference.start.y, reference.end.y);
    const y2 = Math.max(reference.start.y, reference.end.y);
    for (let y = y1; y <= y2; y += 1) {
      for (let x = x1; x <= x2; x += 1) values.push(String(data?.[y]?.[x] ?? ''));
    }
    return values;
  }
  const normalized = clean.toLowerCase();
  const column = state.transformColumns.find(item => item.toLowerCase() === normalized);
  if (column) return [String(state.transformRows[rowIndex]?.[column] ?? '')];
  return [clean];
}

function excelColumnRefToIndex(ref) {
  const match = String(ref || '').trim().toUpperCase().match(/^\$?([A-Z]{1,3})\$?\d+$/);
  if (!match) return -1;
  return match[1].split('').reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function cellRefToCoords(ref) {
  const match = String(ref || '').trim().toUpperCase().match(/^\$?([A-Z]{1,3})\$?(\d+)$/);
  if (!match) return null;
  return { x: match[1].split('').reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1, y: Math.max(0, Number(match[2]) - 1) };
}

function setTransformFormulaResult(rowIndex, columnIndex, value) {
  const column = state.transformColumns[columnIndex];
  if (!column) return;
  if (!state.transformRows[rowIndex]) state.transformRows[rowIndex] = emptyTransformRow();
  state.transformRows[rowIndex][column] = value;
  if (state.transformSheetRows?.[state.activeTransformSheet]?.[rowIndex]) state.transformSheetRows[state.activeTransformSheet][rowIndex][column] = value;
  state.transformGrid?.setValueFromCoords?.(columnIndex, rowIndex, value, true);
}


async function fetchEmployeeByPerner(perner) {
  const key = String(perner || '').trim();
  if (!key) return null;
  const data = await api(`/api/master-employees/lookup?perner=${encodeURIComponent(key)}`);
  return data.records?.[0] || null;
}

function lookupEmployeeValueForColumn(employee, column) {
  const normalized = String(column || '').toLowerCase();
  if (normalized.includes('nama')) return employee.nama_karyawan || '';
  if (normalized.includes('jabatan')) return employee.jabatan_karyawan || '';
  if (normalized.includes('departemen') || normalized.includes('seksi')) return employee.departemen_seksi || '';
  if (normalized.includes('status')) return employee.status_karyawan || '';
  if (normalized.includes('perner')) return employee.perner_karyawan || '';
  return '';
}

function normalizedColumnKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function columnMatchesAny(column, keywords) {
  const normalized = normalizedColumnKey(column);
  return keywords.some(keyword => normalized.includes(normalizedColumnKey(keyword)));
}

function findColumnByMeaning(columns, meaning) {
  const rules = {
    perner: ['perner', 'employeeid', 'employee_id', 'nik', 'idkaryawan', 'personnelnumber'],
    nama: ['namakaryawan', 'nama', 'fullname', 'full_name', 'employeename', 'employee_name'],
    jabatan: ['jabatan', 'position', 'posisi', 'jobtitle', 'title'],
    departemen: ['departemen', 'department', 'dept', 'seksi', 'section', 'divisi', 'division'],
  };
  return (columns || []).find(column => columnMatchesAny(column, rules[meaning] || [])) || '';
}

function masterEmployeeFromRows(perner) {
  const key = String(perner || '').trim().toLowerCase();
  if (!key) return null;
  const columns = currentMasterColumns();
  const pernerColumn = findColumnByMeaning(columns, 'perner');
  if (!pernerColumn) return null;
  const row = employeeMasterRowsFromGridSafe().find(item => String(item[pernerColumn] ?? '').trim().toLowerCase() === key);
  if (!row) return null;
  return {
    perner_karyawan: row[pernerColumn] || '',
    nama_karyawan: row[findColumnByMeaning(columns, 'nama')] || '',
    jabatan_karyawan: row[findColumnByMeaning(columns, 'jabatan')] || '',
    departemen_seksi: row[findColumnByMeaning(columns, 'departemen')] || '',
  };
}

async function applyEmployeeMasterLookup(rowIndex, perner) {
  const key = String(perner || '').trim();
  if (!key || !state.transformGrid) return;
  try {
    let employee = await fetchEmployeeByPerner(key);
    if (employee) mergeEmployeeIntoMasterCache(employee);
    if (!employee) {
      employee = masterEmployeeFromRows(key);
    }
    if (!employee) {
      await refreshEmployeeMasterCache();
      employee = masterEmployeeFromRows(key);
    }
    if (!employee) return;
    const row = state.transformRows[rowIndex] || emptyTransformRow();
    const mappingByMeaning = {
      nama: employee.nama_karyawan || '',
      jabatan: employee.jabatan_karyawan || '',
      departemen: employee.departemen_seksi || '',
    };
    Object.entries(mappingByMeaning).forEach(([meaning, value]) => {
      if (!value) return;
      const column = findColumnByMeaning(state.transformColumns, meaning);
      if (!column || isPernerColumn(column)) return;
      const x = state.transformColumns.indexOf(column);
      if (x < 0) return;
      row[column] = value;
      state.transformGrid.setValueFromCoords(x, rowIndex, value, true);
    });
    state.transformRows[rowIndex] = row;
  } catch (error) {
    console.warn('Lookup master karyawan gagal', error);
  }
}

// Fungsi Auto-Series 
function isPernerColumn(column) {
  const normalized = String(column || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized.includes('perner') || normalized.includes('pernerkaryawan');
}

function transformHeaderSelector(x) {
  return `#transform-spreadsheet thead td[data-x="${x}"], #transform-spreadsheet thead th[data-x="${x}"]`;
}

function resolveTransformColumnName(x, cell = null) {
  const gridColumn = state.transformGrid?.options?.columns?.[x]?.title;
  const stateColumn = state.transformColumns?.[x];
  const headerText = cell?.ownerDocument?.querySelector(transformHeaderSelector(x))?.textContent;
  return [gridColumn, stateColumn, headerText].find(value => String(value || '').trim()) || '';
}

function isPernerSeriesTarget(x, cell = null) {
  const gridColumn = state.transformGrid?.options?.columns?.[x]?.title;
  const stateColumn = state.transformColumns?.[x];
  const headerText = cell?.ownerDocument?.querySelector(transformHeaderSelector(x))?.textContent;
  return [gridColumn, stateColumn, headerText].some(isPernerColumn);
}

function adjustFormulaRelativeRows(formula, offset) {
  return String(formula || '').replace(/(\$?[A-Z]{1,3})(\$?)(\d+)/g, (match, colRef, rowPrefix, rowNumber) => {
    if (rowPrefix === '$') return match;
    return `${colRef}${Math.max(1, Number(rowNumber) + offset)}`;
  });
}

function parseAutoSeriesValue(value) {
  const text = String(value ?? '').trim();

  const sanctionNumber = parseSanctionNumber(text);
  if (sanctionNumber) {
    return {
      type: 'sanction-number',
      width: String(text.match(SANCTION_NUMBER_PATTERN)?.[1] || sanctionNumber.sequence).length,
      sequence: sanctionNumber.sequence,
      month: sanctionNumber.month,
      year: sanctionNumber.year,
    };
  }

  const looksLikeDate = /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(text) || /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/.test(text);
  if (looksLikeDate) {
    const date = parseTransformDate(text);
    if (date) return { type: 'date', value: date };
  }

  const numberMatch = text.match(/^(\d+)$/);
  if (numberMatch) return { type: 'number', width: numberMatch[1].length, value: Number(numberMatch[1]) };

  const suffixMatch = text.match(/^(.*?)(\d+)$/);
  if (suffixMatch) return { type: 'text-number', prefix: suffixMatch[1], width: suffixMatch[2].length, value: Number(suffixMatch[2]) };

  return { type: 'text', value: text };
}

function nextAutoSeriesValue(parsed, offset, copyOnly = false) {
  if (copyOnly) return parsed.value ?? '';
  if (parsed.type === 'sanction-number') return buildSanctionNumber(parsed.sequence + offset, parsed.month, parsed.year);
  if (parsed.type === 'number') return String(parsed.value + offset).padStart(parsed.width, '0');
  if (parsed.type === 'date') {
    const next = new Date(parsed.value);
    next.setDate(next.getDate() + offset);
    return formatTransformDate(next);
  }
  if (parsed.type === 'text-number') return `${parsed.prefix}${String(parsed.value + offset).padStart(parsed.width, '0')}`;
  return parsed.value ?? '';
}

function findAutoFillLastRow(startRow, columnIndex) {
  const grid = state.transformGrid;
  const data = grid?.getData?.() || [];
  let last = startRow;
  for (let row = startRow + 1; row < data.length; row += 1) {
    const hasAnyValue = data[row]?.some(value => String(value ?? '').trim() !== '');
    if (!hasAnyValue) break;
    last = row;
  }
  return last;
}

const TRANSFORM_FORMULAS = [
  { name: 'LOOKUP', template: '=LOOKUP(', hint: 'Pilih cell/range langsung dari sheet aktif atau sheet lain' },
  { name: 'IF', template: '=IF(A1="", "", A1)', hint: 'Logika kondisi sederhana' },
  { name: 'CONCAT', template: '=CONCAT(A1, " ", B1)', hint: 'Gabungkan beberapa nilai' },
  { name: 'UPPER', template: '=UPPER(A1)', hint: 'Ubah teks menjadi huruf besar' },
  { name: 'LOWER', template: '=LOWER(A1)', hint: 'Ubah teks menjadi huruf kecil' },
  { name: 'TRIM', template: '=TRIM(A1)', hint: 'Rapikan spasi berlebih' },
  { name: 'DATEDIF', template: '=DATEDIF(A1, B1, "D")', hint: 'Hitung selisih tanggal dalam hari' },
];

function closeTransformFormulaPopup() {
  $('.transform-formula-popup')?.remove();
  state.transformFormulaPopup = null;
}

function formulaQueryFromValue(value) {
  const text = String(value ?? '');
  const match = text.match(/^=([A-Z]*)$/i);
  return match ? match[1].toUpperCase() : null;
}

function formulaSuggestions(query) {
  const clean = String(query ?? '').toUpperCase();
  return TRANSFORM_FORMULAS.filter(item => item.name.startsWith(clean));
}

function formulaTargetCell(target) {
  if (target?.id === 'formula-input' && state.transformFormulaEdit?.targetSheet === state.activeTransformSheet) {
    return $(`#transform-spreadsheet td[data-x="${state.transformFormulaEdit.x}"][data-y="${state.transformFormulaEdit.y}"]`);
  }
  const directCell = target?.closest?.('td[data-x][data-y]');
  if (directCell) return directCell;
  return state.formulaGridKind === 'master' ? state.masterFormulaCell : state.transformFormulaCell;
}

function formulaTargetCoords(target) {
  if (target?.id === 'formula-input' && state.transformFormulaEdit) return { x: state.transformFormulaEdit.x, y: state.transformFormulaEdit.y };
  return transformCellCoords(formulaTargetCell(target));
}

function activeFormulaEditorValue(target) {
  if (target && ('value' in target)) return target.value;
  return target?.textContent || '';
}

function setFormulaEditorValue(target, value) {
  if (target && ('value' in target)) {
    target.value = value;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (target) target.textContent = value;
}

function caretOffsetInElement(element) {
  const selection = window.getSelection?.();
  if (!selection || !selection.rangeCount || !element?.contains(selection.anchorNode)) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(element);
  range.setEnd(selection.anchorNode, selection.anchorOffset);
  return range.toString().length;
}

function commitFormulaSuggestion(target, suggestion) {
  if (!suggestion) return;
  const cell = formulaTargetCell(target);
  const coords = transformCellCoords(cell);
  const isMaster = Boolean(cell?.closest?.('#master-grid')) || state.formulaGridKind === 'master';
  setFormulaEditorValue(target, suggestion.template);
  if (state.transformFormulaEdit) {
    state.transformFormulaEdit.text = suggestion.template;
    syncTransformFormulaDraft();
    renderFormulaEditBar();
  }
  if (coords) {
    const grid = isMaster ? state.masterGrid : state.transformGrid;
    const rows = isMaster ? state.masterRows : state.transformRows;
    const columns = isMaster ? state.masterColumns : state.transformColumns;
    const column = columns?.[coords.x] || (isMaster ? '' : resolveTransformColumnName(coords.x, cell));
    if (grid && column) {
      grid.setValueFromCoords(coords.x, coords.y, suggestion.template, true);
      if (!rows[coords.y]) rows[coords.y] = Object.fromEntries(columns.map(item => [item, '']));
      rows[coords.y][column] = suggestion.template;
    }
  }
  closeTransformFormulaPopup();
}


function selectOptionsHtml(items, selected = '') {
  return (items || []).map(item => `<option value="${escapeHtml(item)}" ${item === selected ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('');
}

function currentMasterColumns() {
  if (state.masterColumns?.length) return state.masterColumns;
  const first = state.masterRows?.[0] || {};
  return Object.keys(first).filter(key => key !== 'updated_at');
}

function currentTransformColumns() {
  return state.transformColumns?.length ? state.transformColumns : [];
}

function openLookupFormulaBuilder(context) {
  const transformColumns = currentTransformColumns();
  const masterColumns = currentMasterColumns();
  if (!transformColumns.length || !masterColumns.length) {
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>LOOKUP belum siap</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">Pastikan Data Transform dan Master Data Karyawan sudah memiliki header/kolom.</p></div>`);
    $('#close-modal').onclick = closeModal;
    return;
  }
  const defaultInput = transformColumns[Math.max(0, context.coords?.x ?? 0)] || transformColumns[0];
  const defaultKey = masterColumns.find(col => col.toLowerCase() === defaultInput.toLowerCase()) || masterColumns[0];
  const defaultReturn = masterColumns[0];
  openModal(`<div class="lookup-builder-dialog">
    <div class="sheet-dialog-head"><h2>Formula Builder: LOOKUP</h2><button id="close-modal" class="btn">Tutup</button></div>
    <div class="lookup-builder-grid">
      <label><span>1. Nilai yang akan dicari</span><select id="lookup-source">${selectOptionsHtml(transformColumns, defaultInput)}</select></label>
      <label><span>2. Data referensi</span><select id="lookup-dataset"><option value="master_employees">Master Karyawan</option></select></label>
      <label><span>3. Kolom kunci pada Master</span><select id="lookup-key">${selectOptionsHtml(masterColumns, defaultKey)}</select></label>
      <label><span>4. Kolom hasil</span><select id="lookup-return">${selectOptionsHtml(masterColumns, defaultReturn)}</select></label>
      <label><span>5. Jika data tidak ditemukan</span><select id="lookup-missing"><option value="blank">Kosong</option><option value="warning">Tampilkan warning</option><option value="custom">Nilai tertentu</option></select></label>
      <label><span>Nilai tertentu</span><input id="lookup-custom" placeholder="Misal: Tidak ditemukan"></label>
    </div>
    <div class="lookup-builder-preview"><b>Preview</b><code id="lookup-preview"></code></div>
    <div class="sheet-dialog-actions"><button id="lookup-apply" class="btn danger">Terapkan</button></div>
  </div>`);
  $('#close-modal').onclick = closeModal;
  const updatePreview = () => {
    $('#lookup-preview').textContent = buildLookupFormula({
      source: $('#lookup-source').value,
      key: $('#lookup-key').value,
      result: $('#lookup-return').value,
      missing: $('#lookup-missing').value,
      custom: $('#lookup-custom').value,
    });
  };
  ['#lookup-source', '#lookup-key', '#lookup-return', '#lookup-missing', '#lookup-custom'].forEach(selector => $(selector).oninput = updatePreview);
  updatePreview();
  $('#lookup-apply').onclick = () => applyLookupBuilder(context, {
    source: $('#lookup-source').value,
    key: $('#lookup-key').value,
    result: $('#lookup-return').value,
    missing: $('#lookup-missing').value,
    custom: $('#lookup-custom').value,
  });
}

function buildLookupFormula(config) {
  const missing = config.missing === 'custom' ? `, "${String(config.custom || '').replace(/"/g, '\\"')}"` : (config.missing === 'warning' ? ', "#NOT_FOUND"' : '');
  return `=LOOKUP(${config.source}, MasterKaryawan.${config.key}, MasterKaryawan.${config.result}${missing})`;
}

function parseLookupFormula(text) {
  const match = String(text || '').trim().match(/^=LOOKUP\((.*?),\s*MasterKaryawan\.(.*?),\s*MasterKaryawan\.([^,\)]+)(?:,\s*"(.*)")?\)$/i);
  if (!match) return null;
  return { source: match[1].trim(), key: match[2].trim(), result: match[3].trim(), fallback: match[4] ?? '' };
}

function applyLookupBuilder(context, config) {
  const formula = buildLookupFormula(config);
  const { target, coords, isMaster } = context;
  setFormulaEditorValue(target, formula);
  if (coords) {
    const grid = isMaster ? state.masterGrid : state.transformGrid;
    const rows = isMaster ? state.masterRows : state.transformRows;
    const columns = isMaster ? state.masterColumns : state.transformColumns;
    const column = columns?.[coords.x];
    grid?.setValueFromCoords(coords.x, coords.y, formula, true);
    if (column) {
      if (!rows[coords.y]) rows[coords.y] = Object.fromEntries(columns.map(item => [item, '']));
      rows[coords.y][column] = formula;
    }
    if (!isMaster) evaluateTransformFormula(coords.y, coords.x, formula);
  }
  closeModal();
}

function renderTransformFormulaPopup(target, suggestions) {
  closeTransformFormulaPopup();
  if (!target || !suggestions.length) return;
  const rect = target.getBoundingClientRect();
  const popup = document.createElement('div');
  popup.className = 'transform-formula-popup';
  popup.style.left = Math.min(rect.left, window.innerWidth - 340) + 'px';
  popup.style.top = Math.min(rect.bottom + 6, window.innerHeight - 260) + 'px';
  popup.innerHTML = suggestions.map((item, index) => '<button type="button" data-index="' + index + '" class="' + (index === 0 ? 'active' : '') + '"><b>' + escapeHtml(item.name) + '</b><span>' + escapeHtml(item.hint) + '</span></button>').join('');
  document.body.appendChild(popup);
  state.transformFormulaPopup = { popup, target, suggestions, index: 0 };
  popup.querySelectorAll('button').forEach(button => {
    button.onmousedown = event => event.preventDefault();
    button.onclick = () => commitFormulaSuggestion(target, suggestions[Number(button.dataset.index)]);
  });
}

function updateFormulaPopupActive() {
  const current = state.transformFormulaPopup;
  if (!current) return;
  current.popup.querySelectorAll('button').forEach((button, index) => button.classList.toggle('active', index === current.index));
}

function handleFormulaEditorInput(event) {
  if (isSpreadsheetEditorActive()) return;
  const target = event.target;
  const value = activeFormulaEditorValue(target);
  const cell = formulaTargetCell(target);
  if (cell?.closest?.('#transform-spreadsheet') && String(value || '').startsWith('=')) {
    if (!state.transformFormulaEdit) beginTransformFormulaEdit(cell, value);
    else {
      state.transformFormulaEdit.text = value;
      const caret = caretOffsetInElement(target);
      state.transformFormulaEdit.cursorStart = caret ?? String(value || '').length;
      state.transformFormulaEdit.cursorEnd = state.transformFormulaEdit.cursorStart;
      syncTransformFormulaDraft();
      renderFormulaEditBar();
    }
  }
  const query = formulaQueryFromValue(value);
  if (query === null) {
    closeTransformFormulaPopup();
    return;
  }
  renderTransformFormulaPopup(target, formulaSuggestions(query));
}

function handleFormulaEditorKeydown(event) {
  if (isSpreadsheetEditorActive()) return false;
  const popupState = state.transformFormulaPopup;
  if (state.transformFormulaEdit) {
    const input = $('#formula-input');
    if (input && event.target === input) {
      state.transformFormulaEdit.cursorStart = input.selectionStart ?? input.value.length;
      state.transformFormulaEdit.cursorEnd = input.selectionEnd ?? state.transformFormulaEdit.cursorStart;
    }
  }
  if (!popupState) {
    if (state.transformFormulaEdit && event.key === 'Enter') {
      event.preventDefault();
      finishTransformFormulaEdit();
      return true;
    }
    if (state.transformFormulaEdit && event.key === 'Escape') {
      event.preventDefault();
      endTransformFormulaEdit(false);
      return true;
    }
    return false;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    popupState.index = (popupState.index + direction + popupState.suggestions.length) % popupState.suggestions.length;
    updateFormulaPopupActive();
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault();
    commitFormulaSuggestion(event.target, popupState.suggestions[popupState.index]);
    return true;
  }
  if (event.key === 'Escape') {
    closeTransformFormulaPopup();
    return true;
  }
  return false;
}

function bindTransformFormulaAssist(host) {
  if (!host || host.dataset.formulaAssistBound === '1') return;
  host.dataset.formulaAssistBound = '1';
  host.addEventListener('mousedown', event => {
    if (isSpreadsheetEditorActive(host)) return;
    const cell = event.target.closest('td[data-x][data-y]');
    if (cell) {
      state.transformFormulaCell = cell;
      state.formulaGridKind = 'transform';
    }
  });
  host.addEventListener('input', handleFormulaEditorInput, true);
  host.addEventListener('keyup', handleFormulaEditorInput, true);
  host.addEventListener('keydown', handleFormulaEditorKeydown, true);
  if (document.body.dataset.transformFormulaCloseBound !== '1') {
    document.body.dataset.transformFormulaCloseBound = '1';
    document.addEventListener('mousedown', event => {
      if (!event.target.closest?.('#transform-spreadsheet') && !event.target.closest?.('#master-grid') && !event.target.closest?.('.transform-formula-popup')) closeTransformFormulaPopup();
    });
  }
}

function bindTransformFormulaRangePicker(host) {
  if (!host || host.dataset.formulaRangePickerBound === '1') return;
  host.dataset.formulaRangePickerBound = '1';

  host.addEventListener('mousedown', event => {
    if (isSpreadsheetEditorActive(host)) return;
    const edit = state.transformFormulaEdit;
    if (!edit) return;
    const cell = event.target.closest('td[data-x][data-y]');
    const coords = transformCellCoords(cell);
    if (!cell || !coords) return;
    const isTarget = edit.targetSheet === state.activeTransformSheet && edit.x === coords.x && edit.y === coords.y;
    if (isTarget) return;

    event.preventDefault();
    event.stopPropagation();
    edit.selectingReference = true;
    state.transformFormulaRangeDrag = { sheet: state.activeTransformSheet, start: coords, end: coords };
    renderFormulaRangeHighlight(coords, coords);

    const onMove = moveEvent => {
      const targetCell = moveEvent.target.closest?.('td[data-x][data-y]');
      const targetCoords = transformCellCoords(targetCell);
      if (!targetCoords) return;
      state.transformFormulaRangeDrag.end = targetCoords;
      renderFormulaRangeHighlight(state.transformFormulaRangeDrag.start, targetCoords);
    };

    const onUp = () => {
      const drag = state.transformFormulaRangeDrag;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      state.transformFormulaRangeDrag = null;
      if (edit) edit.selectingReference = false;
      if (!drag) return;
      insertFormulaReference(formulaRangeRef(drag.sheet, drag.start, drag.end, edit.targetSheet));
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  }, true);
}

function bindMasterFormulaRangePicker(host) {
  if (!host || host.dataset.masterFormulaRangePickerBound === '1') return;
  host.dataset.masterFormulaRangePickerBound = '1';

  host.addEventListener('mousedown', event => {
    if (isSpreadsheetEditorActive(host)) return;
    const edit = state.transformFormulaEdit;
    if (!edit) return;
    const cell = event.target.closest('td[data-x][data-y]');
    const coords = transformCellCoords(cell);
    if (!cell || !coords) return;

    event.preventDefault();
    event.stopPropagation();
    edit.selectingReference = true;
    state.transformFormulaRangeDrag = { sheet: MASTER_FORMULA_SHEET, start: coords, end: coords, host: 'master' };
    renderMasterFormulaRangeHighlight(coords, coords);

    const onMove = moveEvent => {
      const targetCell = moveEvent.target.closest?.('td[data-x][data-y]');
      const targetCoords = transformCellCoords(targetCell);
      if (!targetCoords) return;
      state.transformFormulaRangeDrag.end = targetCoords;
      renderMasterFormulaRangeHighlight(state.transformFormulaRangeDrag.start, targetCoords);
    };

    const onUp = () => {
      const drag = state.transformFormulaRangeDrag;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      state.transformFormulaRangeDrag = null;
      if (edit) edit.selectingReference = false;
      if (!drag) return;
      insertFormulaReference(formulaRangeRef(drag.sheet, drag.start, drag.end, edit.targetSheet));
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  }, true);
}

function transformScrollContainer(host = document) {
  return host.querySelector?.('.jexcel_content, .jspreadsheet_content, .jss_content') || host;
}

function bindTransformSheetScroll(host) {
  const scroller = transformScrollContainer(host);
  if (!scroller || scroller.dataset.horizontalWheelBound === '1') return;
  scroller.dataset.horizontalWheelBound = '1';

  scroller.addEventListener('wheel', event => {
    const horizontalDelta = event.deltaX || (event.shiftKey ? event.deltaY : 0);
    if (!horizontalDelta) return;
    const before = scroller.scrollLeft;
    scroller.scrollLeft += horizontalDelta;
    if (scroller.scrollLeft !== before) event.preventDefault();
  }, { passive: false });
}

function transformCellCoords(cell) {
  if (!cell) return null;
  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  return Number.isNaN(x) || Number.isNaN(y) ? null : { x, y };
}

function excelColumnName(index) {
  let n = Number(index) + 1;
  let name = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    n = Math.floor((n - mod) / 26);
  }
  return name;
}

function formulaCellAddress(x, y) {
  return `${excelColumnName(x)}${Number(y) + 1}`;
}

function formulaStoreKey(sheet, x, y) {
  return `${String(sheet || '')}::${Number(x)}::${Number(y)}`;
}

function setTransformCellFormula(sheet, x, y, formula) {
  state.transformFormulaStore = state.transformFormulaStore || {};
  const key = formulaStoreKey(sheet, x, y);
  if (String(formula || '').trim().startsWith('=')) state.transformFormulaStore[key] = String(formula);
  else delete state.transformFormulaStore[key];
}

function getTransformCellFormula(sheet, x, y) {
  return state.transformFormulaStore?.[formulaStoreKey(sheet, x, y)] || '';
}

function quoteSheetName(sheet) {
  const text = String(sheet || '').trim();
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(text) ? text : `'${text.replace(/'/g, "''")}'`;
}

function formulaRangeRef(sheet, start, end, targetSheet = state.activeTransformSheet) {
  const x1 = Math.min(start.x, end.x);
  const x2 = Math.max(start.x, end.x);
  const y1 = Math.min(start.y, end.y);
  const y2 = Math.max(start.y, end.y);
  const ref = x1 === x2 && y1 === y2
    ? formulaCellAddress(x1, y1)
    : `${formulaCellAddress(x1, y1)}:${formulaCellAddress(x2, y2)}`;
  return sheet && sheet !== targetSheet ? `'${String(sheet).replace(/'/g, "''")}'!${ref}` : ref;
}

function currentFormulaValue() {
  const edit = state.transformFormulaEdit;
  if (!edit) return '';
  if (edit.targetSheet === state.activeTransformSheet) {
    const cell = $(`#transform-spreadsheet td[data-x="${edit.x}"][data-y="${edit.y}"]`);
    const cellText = String(cell?.textContent ?? '').trim();
    if (cellText.startsWith('=')) return cellText;
  }
  return edit.text ?? '';
}

function formulaTargetLabel(edit = state.transformFormulaEdit) {
  if (!edit) return 'A1';
  const prefix = edit.targetSheet && edit.targetSheet !== state.activeTransformSheet ? `${edit.targetSheet}!` : '';
  return `${prefix}${formulaCellAddress(edit.x, edit.y)}`;
}

function renderFormulaEditBar() {
  // Formula is edited directly inside the spreadsheet cell, Excel-style.
}

function beginTransformFormulaEdit(cell, value = '') {
  const coords = transformCellCoords(cell);
  if (!coords) return;
  const text = String(value || '').startsWith('=') ? String(value) : '=';
  state.transformFormulaEdit = {
    targetSheet: state.activeTransformSheet,
    x: coords.x,
    y: coords.y,
    text,
    cursorStart: text.length,
    cursorEnd: text.length,
    selectingReference: false,
  };
  setTransformCellFormula(state.activeTransformSheet, coords.x, coords.y, text);
  renderFormulaEditBar();
}

function syncTransformFormulaDraft() {
  const edit = state.transformFormulaEdit;
  if (!edit || !state.transformSheetRows?.[edit.targetSheet]) return;
  const rows = state.transformSheetRows[edit.targetSheet];
  const column = state.transformColumns?.[edit.x];
  if (!column) return;
  while (rows.length <= edit.y) rows.push(emptyTransformRow());
  rows[edit.y][column] = edit.text;
  setTransformCellFormula(edit.targetSheet, edit.x, edit.y, edit.text);
}

function insertFormulaReference(reference) {
  const edit = state.transformFormulaEdit;
  if (!edit || !reference) return;
  let text = currentFormulaValue() || edit.text || '=';
  const start = Math.max(0, Math.min(edit.cursorStart ?? text.length, text.length));
  const end = Math.max(start, Math.min(edit.cursorEnd ?? start, text.length));
  const before = text.slice(0, start);
  const after = text.slice(end);
  const needsSeparator = before && !/[=(,+\-*/^&\s]$/.test(before);
  const insertText = `${needsSeparator ? ', ' : ''}${reference}`;
  text = `${before}${insertText}${after}`;
  const nextCursor = before.length + insertText.length;
  edit.text = text;
  edit.cursorStart = nextCursor;
  edit.cursorEnd = nextCursor;
  const input = $('#formula-input');
  if (input) {
    input.value = text;
    input.focus({ preventScroll: true });
    input.setSelectionRange(nextCursor, nextCursor);
  }
  if (edit.targetSheet === state.activeTransformSheet) {
    const cell = $(`#transform-spreadsheet td[data-x="${edit.x}"][data-y="${edit.y}"]`);
    if (cell && document.activeElement !== cell) cell.textContent = text;
  }
  syncTransformFormulaDraft();
}

function endTransformFormulaEdit(commit = true) {
  if (commit) syncTransformFormulaDraft();
  closeTransformFormulaPopup();
  state.transformFormulaEdit = null;
  clearFormulaRangeHighlight();
  renderFormulaEditBar();
}

function finishTransformFormulaEdit() {
  const edit = state.transformFormulaEdit;
  if (!edit) return;
  edit.text = currentFormulaValue();
  syncTransformFormulaDraft();
  const shouldReturnToDataTab = state.transformTab !== 'data';
  if (edit.targetSheet !== state.activeTransformSheet) {
    state.activeTransformSheet = edit.targetSheet;
    state.transformRows = activeTransformRows();
  }
  evaluateTransformFormula(edit.y, edit.x, edit.text);
  endTransformFormulaEdit(false);
  if (shouldReturnToDataTab) {
    state.transformTab = 'data';
    renderTransform();
  } else {
    renderTransformLocal();
    refreshTransformTabs();
  }
}

function clearFormulaRangeHighlight() {
  $$('#transform-spreadsheet td.formula-range-highlight').forEach(cell => cell.classList.remove('formula-range-highlight'));
  $$('#master-grid td.formula-range-highlight').forEach(cell => cell.classList.remove('formula-range-highlight'));
}

function renderFormulaRangeHighlight(start, end) {
  clearFormulaRangeHighlight();
  if (!start || !end) return;
  const x1 = Math.min(start.x, end.x);
  const x2 = Math.max(start.x, end.x);
  const y1 = Math.min(start.y, end.y);
  const y2 = Math.max(start.y, end.y);
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) {
      $(`#transform-spreadsheet td[data-x="${x}"][data-y="${y}"]`)?.classList.add('formula-range-highlight');
    }
  }
}

function renderMasterFormulaRangeHighlight(start, end) {
  $$('#master-grid td.formula-range-highlight').forEach(cell => cell.classList.remove('formula-range-highlight'));
  if (!start || !end) return;
  const x1 = Math.min(start.x, end.x);
  const x2 = Math.max(start.x, end.x);
  const y1 = Math.min(start.y, end.y);
  const y2 = Math.max(start.y, end.y);
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) {
      $(`#master-grid td[data-x="${x}"][data-y="${y}"]`)?.classList.add('formula-range-highlight');
    }
  }
}

function isFillHandleHit(event, cell) {
  if (!cell) return false;
  const rect = cell.getBoundingClientRect();
  const threshold = 9;
  return event.clientX >= rect.right - threshold && event.clientY >= rect.bottom - threshold;
}

function clearTransformFillPreview() {
  $$('#transform-spreadsheet td.auto-fill-preview').forEach(cell => cell.classList.remove('auto-fill-preview'));
}

function renderTransformFillPreview(x, startY, targetY) {
  clearTransformFillPreview();
  if (targetY === startY) return;
  const min = Math.min(startY, targetY);
  const max = Math.max(startY, targetY);
  for (let row = min; row <= max; row += 1) {
    if (row === startY) continue;
    const cell = `#transform-spreadsheet td[data-x="${x}"][data-y="${row}"]`;
    $(cell)?.classList.add('auto-fill-preview');
  }
}

function autoSeriesToRow(x, y, targetY, cell = null) {
  const grid = state.transformGrid;
  if (!grid || targetY === y) return;

  const column = resolveTransformColumnName(x, cell);
  if (!column || isPernerSeriesTarget(x, cell)) return;

  const data = grid.getData();
  const sourceValue = data?.[y]?.[x];
  const sourceFormula = getTransformCellFormula(state.activeTransformSheet, x, y);
  const sourceText = String(sourceFormula || sourceValue || '').trim();
  if (!sourceText) return;

  const isFormula = false;
  const parsed = isFormula ? null : parseAutoSeriesValue(sourceValue);
  const min = Math.min(y, targetY);
  const max = Math.max(y, targetY);

  for (let row = min; row <= max; row += 1) {
    if (row === y) continue;
    const offset = row - y;
    const nextValue = isFormula ? adjustFormulaRelativeRows(sourceText, offset) : nextAutoSeriesValue(parsed, offset, false);
    if (!state.transformRows[row]) state.transformRows[row] = emptyTransformRow();
    state.transformRows[row][column] = nextValue;
    if (isFormula) {
      setTransformCellFormula(state.activeTransformSheet, x, row, nextValue);
      evaluateTransformFormula(row, x, nextValue);
    } else {
      grid.setValueFromCoords(x, row, nextValue, true);
    }
  }
}

function bindTransformFillHandle(host) {
  if (!host) return;

  host.onmousemove = event => {
    if (isSpreadsheetEditorActive(host)) return;
    if (state.transformFillDrag) return;
    const cell = event.target.closest('td[data-x][data-y]');
    const coords = transformCellCoords(cell);
    const isPerner = coords ? isPernerSeriesTarget(coords.x, cell) : false;
    host.classList.toggle('fill-handle-hover', Boolean(cell && !isPerner && isFillHandleHit(event, cell)));
  };

  host.onmouseleave = () => {
    if (!state.transformFillDrag) host.classList.remove('fill-handle-hover');
  };

  host.onmousedown = event => {
    if (isSpreadsheetEditorActive(host)) return;
    const cell = event.target.closest('td[data-x][data-y]');
    const coords = transformCellCoords(cell);
    if (!coords || isPernerSeriesTarget(coords.x, cell) || !isFillHandleHit(event, cell)) return;

    event.preventDefault();
    event.stopPropagation();
    state.transformFillDrag = { ...coords, targetY: coords.y, cell };
    host.classList.add('is-fill-dragging');

    const onMove = moveEvent => {
      const targetCell = moveEvent.target.closest?.('td[data-x][data-y]');
      const target = transformCellCoords(targetCell);
      if (!target || target.x !== coords.x) return;
      state.transformFillDrag.targetY = target.y;
      renderTransformFillPreview(coords.x, coords.y, target.y);
    };

    const onUp = () => {
      const drag = state.transformFillDrag;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      host.classList.remove('is-fill-dragging', 'fill-handle-hover');
      clearTransformFillPreview();
      state.transformFillDrag = null;
      if (drag) autoSeriesToRow(drag.x, drag.y, drag.targetY, drag.cell);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  };
}

function autoSeriesDownFromCell(x, y, cell = null) {
  const grid = state.transformGrid;
  if (!grid) return;

  const column = resolveTransformColumnName(x, cell);
  if (!column || isPernerSeriesTarget(x, cell)) return;

  const data = grid.getData();
  const sourceValue = data?.[y]?.[x];
  const sourceFormula = getTransformCellFormula(state.activeTransformSheet, x, y);
  const sourceText = String(sourceFormula || sourceValue || '').trim();
  if (!sourceText) return;

  const lastRow = findAutoFillLastRow(y, x);
  if (lastRow <= y) return;

  const isFormula = false;
  const parsed = isFormula ? null : parseAutoSeriesValue(sourceValue);

  for (let row = y + 1; row <= lastRow; row += 1) {
    const offset = row - y;
    const nextValue = isFormula ? adjustFormulaRelativeRows(sourceText, offset) : nextAutoSeriesValue(parsed, offset, false);
    if (!state.transformRows[row]) state.transformRows[row] = emptyTransformRow();
    state.transformRows[row][column] = nextValue;
    if (isFormula) {
      setTransformCellFormula(state.activeTransformSheet, x, row, nextValue);
      evaluateTransformFormula(row, x, nextValue);
    } else {
      grid.setValueFromCoords(x, row, nextValue, true);
    }
  }
}

async function deleteArchive(id) {
  const button = $('#confirm-delete-archive');
  if (button) {
    button.disabled = true;
  }
  try {
    await withMinimumLoader('Menghapus arsip...', () => api(`/api/archives/${id}`, { method: 'DELETE' }));
    closeModal();
    renderArchive();
  } catch (error) {
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Hapus Gagal</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'Arsip belum bisa dihapus.')}</p></div>`);
    $('#close-modal').onclick = closeModal;
  }
}

async function deleteSelectedArchives(ids) {
  ids = (ids?.length ? ids : [...(state.archives.selectedIds || new Set())]).map(String).filter(Boolean);
  if (!ids.length) return;
  const button = $('#confirm-delete-archive');
  if (button) button.disabled = true;
  try {
    await withMinimumLoader('Menghapus arsip terpilih...', async () => {
      for (const id of ids) {
        await api(`/api/archives/${id}`, { method: 'DELETE' });
        state.archives.selectedIds?.delete(String(id));
      }
    });
    closeModal();
    renderArchive();
  } catch (error) {
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Hapus Gagal</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'Arsip terpilih belum bisa dihapus.')}</p></div>`);
    $('#close-modal').onclick = closeModal;
  }
}

async function downloadArchive(id) {
  const record = archiveRecordById(id);
  try {
    await withMinimumLoader('Menyiapkan download...', async () => {
      const response = await fetch(`/api/archives/${id}/download`);
      if (!response.ok) throw new Error('Download arsip gagal.');
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      const filename = decodeURIComponent(match?.[1] || record?.file_name || `arsip_${id}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  } catch (error) {
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Download Gagal</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'Arsip belum bisa diunduh.')}</p></div>`);
    $('#close-modal').onclick = closeModal;
  }
}

async function previewArchive(id) {
  const data = await api(`/api/archives/${id}/preview`);
  let body = '';
  if (data.kind === 'pdf') body = `<iframe class="preview-frame" src="${data.url}"></iframe>`;
  else if (data.kind === 'image') body = `<img src="${data.url}" class="max-h-[72vh] mx-auto rounded border border-line">`;
  else if (data.kind === 'table') body = tableHtml(data.columns, data.rows);
  else if (data.kind === 'text') body = `<pre class="panel p-4 overflow-auto max-h-[72vh] text-xs">${escapeHtml(data.text)}</pre>`;
  else body = `<div class="panel p-8 text-muted">${escapeHtml(data.message)}</div>`;
  openModal(`<div class="archive-preview-modal"><div class="archive-preview-head"><h2>Preview Arsip</h2><div class="archive-preview-actions"><button id="archive-preview-download" class="btn primary">${icon('download')} Download</button><button id="close-modal" class="btn">Tutup</button></div></div><div class="archive-preview-body">${body}</div></div>`);
  $('#archive-preview-download').onclick = () => downloadArchive(id);
  $('#close-modal').onclick = closeModal;
}


async function renderEmployeeMaster() {
  const root = $('#view-transform');
  try {
    const data = await api('/api/master-employees');
    state.masterColumns = data.columns || ['perner_karyawan', 'nama_karyawan', 'jabatan_karyawan', 'departemen_seksi'];
    state.masterRows = data.rows || [];
    state.masterDeletedPerners = new Set();
    state.masterGridFiltered = false;
    const meta = data.meta || {};
    root.innerHTML = `
      ${transformModeTabsHtml()}
      <div class="master-workbench">
        <div class="master-head">
          <div>
            <h2>Master Data Karyawan</h2>
            <p>Data rujukan lookup PERNER untuk Transform Data Sanksi.</p>
          </div>
          <div class="master-kpis">
            <div><small>Total Karyawan</small><b>${escapeHtml(meta.total ?? 0)}</b></div>
            <div><small>File Terakhir</small><b>${escapeHtml(meta.last_file || '-')}</b></div>
            <div><small>Update Terakhir</small><b>${escapeHtml(formatDateTimeReadable(meta.last_update))}</b></div>
          </div>
        </div>
        <div class="master-toolbar">
          <label id="master-dropzone" class="master-upload-dropzone">
            <input id="master-upload" type="file" accept=".xlsx,.xls,.xlsm,.xlsb,.xltx,.xltm,.csv" hidden>
            <span class="master-upload-icon">${icon('upload')}</span>
            <span><b>Upload Master</b><small>Drag & drop file Excel/CSV atau klik di sini</small></span>
          </label>
          <button id="master-save" class="btn danger" type="button">${icon('save')} Save</button>
          <button id="master-add-row" class="btn" type="button">${icon('plus')} Add</button>
          <a class="btn" href="/api/master-employees/export">${icon('download')} Download</a>
          <div class="master-search">${icon('search')}<input id="master-search" placeholder="Cari PERNER / Nama"></div>
        </div>
        <div class="master-grid-single"><div><h3>Master Karyawan</h3><div id="master-grid"></div></div></div>
      </div>`;
    bindTransformModeTabs();
    renderEmployeeMasterGrid();
    bindMasterDropzone();
    $('#master-save').onclick = saveEmployeeMaster;
    $('#master-add-row').onclick = addEmployeeMasterRow;
    $('#master-search').oninput = event => filterEmployeeMasterLocal(event.target.value);
  } catch (error) {
    root.innerHTML = databaseErrorPanel('Master Data Karyawan belum bisa dibuka', error);
  }
}

function renderEmployeeMasterGrid(rows = state.masterRows, options = {}) {
  const host = $('#master-grid');
  if (!host || !window.jspreadsheet) return;
  state.masterGridFiltered = Boolean(options.filtered);
  state.masterVisibleRows = rows.map(row => ({ ...row }));
  host.innerHTML = '';
  const columns = state.masterColumns;
  const data = rows.length ? rows.map(row => columns.map(column => row[column] ?? '')) : Array.from({ length: 20 }, () => columns.map(() => ''));
  const columnWidths = columns.map(column => column === 'nama_karyawan' || column === 'departemen_seksi' ? 210 : 155);
  state.masterGrid = jspreadsheet(host, {
    data,
    columns: columns.map((column, index) => ({ title: column, width: columnWidths[index] })),
    minDimensions: [columns.length, Math.max(data.length, 20)],
    tableOverflow: true,
    tableWidth: '100%',
    tableHeight: 'calc(100vh - 310px)',
    allowInsertRow: true,
    allowDeleteRow: true,
    allowInsertColumn: true,
    allowDeleteColumn: true,
    columnDrag: false,
    oneditionstart(instance, cell, x, y) {
      state.activeSpreadsheetEdit = { hostId: 'master-grid', x: Number(x), y: Number(y) };
    },
    oneditionend() {
      state.activeSpreadsheetEdit = null;
      state.nativeSpreadsheetEditor = null;
      state.pendingNativeSpreadsheetEdit = null;
    },
    onchange(instance, cell, x, y, value) {
      masterCellPostEdit(y, x, value);
    },
    oninsertrow() {
      scheduleSpreadsheetStructureSync('master');
    },
    ondeleterow() {
      scheduleSpreadsheetStructureSync('master');
    },
    oninsertcolumn() {
      scheduleSpreadsheetStructureSync('master');
    },
    ondeletecolumn() {
      scheduleSpreadsheetStructureSync('master');
    },
    onrenamecolumn() {
      scheduleSpreadsheetStructureSync('master');
    },
  });

  host.ondblclick = event => {
    const cell = event.target.closest('td[data-x][data-y]');
    if (!cell) return;
    if (!isFillHandleHit(event, cell)) return;
    const coords = transformCellCoords(cell);
    if (!coords) return;
    autoMasterSeriesDownFromCell(coords.x, coords.y, cell);
  };
  bindTransformSheetScroll(host);
  bindMasterFillHandle(host);
  bindClickToEditSpreadsheet(host, () => state.masterGrid);
}


function bindMasterFormulaAssist(host) {
  if (!host || host.dataset.masterFormulaAssistBound === '1') return;
  host.dataset.masterFormulaAssistBound = '1';
  host.addEventListener('mousedown', event => {
    const cell = event.target.closest('td[data-x][data-y]');
    if (cell) {
      state.masterFormulaCell = cell;
      state.formulaGridKind = 'master';
    }
  });
  host.addEventListener('input', handleFormulaEditorInput, true);
  host.addEventListener('keyup', handleFormulaEditorInput, true);
  host.addEventListener('keydown', handleFormulaEditorKeydown, true);
}

function masterColumnName(x) {
  return state.masterGrid?.options?.columns?.[x]?.title || state.masterColumns?.[x] || '';
}

function isMasterPernerColumn(x) {
  return isPernerColumn(masterColumnName(x));
}

function findMasterAutoFillLastRow(startRow) {
  const data = state.masterGrid?.getData?.() || [];
  let last = startRow;
  for (let row = startRow + 1; row < data.length; row += 1) {
    const hasAnyValue = data[row]?.some(value => String(value ?? '').trim() !== '');
    if (!hasAnyValue) break;
    last = row;
  }
  return last;
}

function clearMasterFillPreview() {
  $$('#master-grid td.auto-fill-preview').forEach(cell => cell.classList.remove('auto-fill-preview'));
}

function renderMasterFillPreview(x, startY, targetY) {
  clearMasterFillPreview();
  if (targetY === startY) return;
  const min = Math.min(startY, targetY);
  const max = Math.max(startY, targetY);
  for (let row = min; row <= max; row += 1) {
    if (row === startY) continue;
    $(`#master-grid td[data-x="${x}"][data-y="${row}"]`)?.classList.add('auto-fill-preview');
  }
}

function autoMasterSeriesToRow(x, y, targetY) {
  const grid = state.masterGrid;
  if (!grid || targetY === y || isMasterPernerColumn(x)) return;
  const column = masterColumnName(x);
  if (!column) return;
  const data = grid.getData();
  const sourceValue = data?.[y]?.[x];
  const sourceText = String(sourceValue ?? '').trim();
  if (!sourceText) return;
  const isFormula = false;
  const parsed = isFormula ? null : parseAutoSeriesValue(sourceValue);
  const min = Math.min(y, targetY);
  const max = Math.max(y, targetY);
  for (let row = min; row <= max; row += 1) {
    if (row === y) continue;
    const offset = row - y;
    const nextValue = isFormula ? adjustFormulaRelativeRows(sourceText, offset) : nextAutoSeriesValue(parsed, offset, false);
    grid.setValueFromCoords(x, row, nextValue, true);
    if (!state.masterRows[row]) state.masterRows[row] = Object.fromEntries(state.masterColumns.map(item => [item, '']));
    state.masterRows[row][column] = nextValue;
  }
}

function autoMasterSeriesDownFromCell(x, y) {
  if (isMasterPernerColumn(x)) return;
  const targetY = findMasterAutoFillLastRow(y);
  autoMasterSeriesToRow(x, y, targetY);
}

function bindMasterFillHandle(host) {
  if (!host) return;
  host.onmousemove = event => {
    if (isSpreadsheetEditorActive(host)) return;
    if (state.masterFillDrag) return;
    const cell = event.target.closest('td[data-x][data-y]');
    const coords = transformCellCoords(cell);
    host.classList.toggle('fill-handle-hover', Boolean(cell && coords && !isMasterPernerColumn(coords.x) && isFillHandleHit(event, cell)));
  };
  host.onmouseleave = () => {
    if (!state.masterFillDrag) host.classList.remove('fill-handle-hover');
  };
  host.onmousedown = event => {
    if (isSpreadsheetEditorActive(host)) return;
    const cell = event.target.closest('td[data-x][data-y]');
    const coords = transformCellCoords(cell);
    if (!coords || isMasterPernerColumn(coords.x) || !isFillHandleHit(event, cell)) return;
    event.preventDefault();
    event.stopPropagation();
    state.masterFillDrag = { ...coords, targetY: coords.y };
    host.classList.add('is-fill-dragging');
    const onMove = moveEvent => {
      const targetCell = moveEvent.target.closest?.('td[data-x][data-y]');
      const target = transformCellCoords(targetCell);
      if (!target || target.x !== coords.x) return;
      state.masterFillDrag.targetY = target.y;
      renderMasterFillPreview(coords.x, coords.y, target.y);
    };
    const onUp = () => {
      const drag = state.masterFillDrag;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      host.classList.remove('is-fill-dragging', 'fill-handle-hover');
      clearMasterFillPreview();
      state.masterFillDrag = null;
      if (drag) autoMasterSeriesToRow(drag.x, drag.y, drag.targetY);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  };
}


function employeeMasterRowsFromGrid() {
  const gridData = state.masterGrid?.getData?.() || [];
  return gridData.map(row => Object.fromEntries(state.masterColumns.map((column, index) => [column, String(row[index] ?? '').trim()]))).filter(row => state.masterColumns.some(column => String(row[column] || '').trim()));
}

function addEmployeeMasterRow() {
  openEmployeeMasterAddModal();
}

function openEmployeeMasterAddModal() {
  const columns = state.masterColumns?.length ? state.masterColumns : ['perner_karyawan', 'nama_karyawan', 'jabatan_karyawan', 'departemen_seksi'];
  const fields = columns.map(column => `<label><span>${escapeHtml(formatTransformHeader(column))}</span><input data-master-add="${escapeHtml(column)}" placeholder="${escapeHtml(formatTransformHeader(column))}"></label>`).join('');
  openModal(`<div class="master-add-modal">
    <div class="master-add-head">
      <h2>Tambah Data Karyawan</h2>
      <button id="close-modal" class="btn" type="button">Tutup</button>
    </div>
    <div class="master-add-grid">${fields}</div>
    <div class="master-add-actions">
      <button id="cancel-master-add" class="btn" type="button">Batal</button>
      <button id="save-master-add" class="btn danger" type="button">${icon('save')} Tambah</button>
    </div>
  </div>`);
  $('#close-modal').onclick = closeModal;
  $('#cancel-master-add').onclick = closeModal;
  $('#save-master-add').onclick = saveEmployeeMasterAddModal;
  $('[data-master-add]')?.focus();
}

async function saveEmployeeMasterAddModal() {
  const columns = state.masterColumns?.length ? state.masterColumns : ['perner_karyawan', 'nama_karyawan', 'jabatan_karyawan', 'departemen_seksi'];
  const inputs = $$('[data-master-add]');
  const row = Object.fromEntries(columns.map(column => {
    const input = inputs.find(element => element.dataset.masterAdd === column);
    return [column, String(input?.value || '').trim()];
  }));
  if (!columns.some(column => row[column])) return;
  showScreenLoading('Menyimpan data karyawan...');
  try {
    await api('/api/master-employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [row], mode: 'update' })
    });
    closeModal();
    await renderEmployeeMaster();
  } catch (error) {
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Tambah Gagal</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'Data karyawan belum bisa disimpan.')}</p></div>`);
    $('#close-modal').onclick = closeModal;
  } finally {
    hideScreenLoading();
  }
}

function filterEmployeeMasterLocal(keyword) {
  const clean = String(keyword || '').toLowerCase().trim();
  if (!clean) {
    renderEmployeeMasterGrid(state.masterRows, { filtered: false });
    return;
  }
  const rows = state.masterRows.filter(row => String(row.perner_karyawan || '').toLowerCase().includes(clean) || String(row.nama_karyawan || '').toLowerCase().includes(clean));
  renderEmployeeMasterGrid(rows, { filtered: true });
}

function bindMasterDropzone() {
  const zone = $('#master-dropzone');
  const input = $('#master-upload');
  if (!zone || !input) return;
  input.onchange = event => previewEmployeeMasterFile(event.target.files?.[0]);
  ['dragenter', 'dragover'].forEach(type => {
    zone.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.add('is-dragging');
    });
  });
  ['dragleave', 'drop'].forEach(type => {
    zone.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.remove('is-dragging');
    });
  });
  zone.addEventListener('drop', event => {
    const file = event.dataTransfer?.files?.[0];
    previewEmployeeMasterFile(file);
  });
}

async function previewEmployeeMasterFile(file) {
  if (!file) return;
  const allowed = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.xltx', '.xltm', '.csv'];
  const lowerName = String(file.name || '').toLowerCase();
  if (!allowed.some(ext => lowerName.endsWith(ext))) {
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Format Tidak Didukung</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">Upload master hanya menerima file Excel atau CSV.</p></div>`);
    $('#close-modal').onclick = closeModal;
    return;
  }
  const fd = new FormData();
  fd.append('file', file);
  const data = await api('/api/master-employees/preview', { method: 'POST', body: fd });
  state.masterPreview = data;
  const errors = data.errors?.length ? `<div class="master-preview-errors"><b>Validasi</b>${data.errors.slice(0, 8).map(error => `<span>${escapeHtml(error.message)}</span>`).join('')}</div>` : '<div class="master-preview-ok">Struktur data valid.</div>';
  openModal(`<div class="master-preview-modal">
    <div class="sheet-dialog-head"><h2>Preview Master Data Karyawan</h2><button id="close-modal" class="btn">Tutup</button></div>
    <p class="sheet-dialog-copy">${escapeHtml(data.file_name)} | Karyawan: ${escapeHtml(data.total)} baris</p>
    ${errors}
    ${tableHtml(data.columns, data.rows)}
    <div class="master-preview-actions">
      <button id="master-update" class="btn danger" ${data.has_errors ? 'disabled' : ''}>Update Master</button>
      <button id="master-replace" class="btn" ${data.has_errors ? 'disabled' : ''}>Replace Master</button>
    </div>
  </div>`);
  $('#close-modal').onclick = closeModal;
  $('#master-update').onclick = () => loadEmployeeMasterUpload('update');
  $('#master-replace').onclick = () => loadEmployeeMasterUpload('replace');
}

async function loadEmployeeMasterUpload(mode) {
  if (!state.masterPreview) return;
  showScreenLoading(mode === 'replace' ? 'Replace master karyawan...' : 'Update master karyawan...');
  try {
    await api('/api/master-employees/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: state.masterPreview.path, file_name: state.masterPreview.file_name, mode })
    });
    closeModal();
    await renderEmployeeMaster();
  } finally {
    hideScreenLoading();
  }
}

async function saveEmployeeMaster() {
  syncMasterGridStructure();
  const rows = employeeMasterRowsFromGrid();
  const deletedPerners = [...(state.masterDeletedPerners || new Set())];
  if (!rows.length && !deletedPerners.length) {
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Tidak Ada Perubahan</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">Tambahkan, ubah, atau hapus data karyawan terlebih dahulu.</p></div>`);
    $('#close-modal').onclick = closeModal;
    return;
  }
  showScreenLoading('Menyimpan master karyawan...');
  try {
    await api('/api/master-employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, mode: 'update', deleted_perners: deletedPerners })
    });
    state.masterDeletedPerners = new Set();
    await renderEmployeeMaster();
  } catch (error) {
    openModal(`<div class="sheet-dialog"><div class="sheet-dialog-head"><h2>Save Gagal</h2><button id="close-modal" class="btn">Tutup</button></div><p class="sheet-dialog-copy">${escapeHtml(error.message || 'Master belum bisa disimpan.')}</p></div>`);
    $('#close-modal').onclick = closeModal;
  } finally {
    hideScreenLoading();
  }
}

async function bootApp() {
  bindMobileSidebar();
  $$('.nav').forEach(btn => btn.onclick = () => setView(btn.dataset.nav));
  document.addEventListener('click', event => {
    const nav = event.target.closest?.('.nav[data-nav]');
    if (!nav) return;
    event.preventDefault();
    setView(nav.dataset.nav);
  });
  showAppShell();
  setView('dashboard');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp, { once: true });
} else {
  bootApp();
}

































































