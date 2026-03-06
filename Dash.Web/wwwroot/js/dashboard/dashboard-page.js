import {
    cloneSharedLayout,
    getDashboardData,
    getLayoutCatalog,
    getUsers,
    saveLayout
} from "./dashboard-api.js";

const STORAGE_USER_KEY = "dash.currentUserId";
const GRID_COLUMN_COUNT = 12;
const LIVE_UPDATE_DEFAULT_INTERVAL_MS = 15000;
const SLIDESHOW_DEFAULT_INTERVAL_MS = 15000;
const CHART_THEME_STORAGE_PREFIX = "dash.chartTheme.user.";
const DEFAULT_CHART_THEME_ID = "ocean";

const LEGACY_WIDGET_ID_ALIAS = new Map([
    ["monthly-revenue", "widget-monthly-revenue"],
    ["category-revenue", "widget-category-revenue"],
    ["orders-status", "widget-orders-status"],
    ["cumulative-revenue", "widget-cumulative-revenue"],
    ["monthly-growth", "widget-monthly-growth"],
    ["category-ranking", "widget-category-ranking"],
    ["status-share", "widget-status-share"],
    ["chart-monthly-revenue", "widget-monthly-revenue"],
    ["chart-category-revenue", "widget-category-revenue"],
    ["chart-orders-status", "widget-orders-status"],
    ["chart-cumulative-revenue", "widget-cumulative-revenue"],
    ["chart-monthly-growth", "widget-monthly-growth"],
    ["chart-category-ranking", "widget-category-ranking"],
    ["chart-status-share", "widget-status-share"]
]);

const CHART_THEMES = {
    ocean: {
        name: "Oceano",
        primary: "#0f5e9c",
        secondary: "#1f7a54",
        bar: "#1f6ea9",
        positive: "#15803d",
        negative: "#b42318",
        axisText: "#415168",
        labelText: "#17314d",
        track: "#e4ebf5",
        categorical: ["#0f5e9c", "#2f9e44", "#d97706", "#3b82f6", "#b45309", "#64748b"],
        radial: ["#0f5e9c", "#2f9e44", "#d97706", "#8b5cf6", "#64748b"]
    },
    forest: {
        name: "Floresta",
        primary: "#1f7a54",
        secondary: "#2f9e44",
        bar: "#247157",
        positive: "#15803d",
        negative: "#be123c",
        axisText: "#355244",
        labelText: "#18372b",
        track: "#dce9e2",
        categorical: ["#1f7a54", "#2f9e44", "#4d7c0f", "#0f766e", "#84cc16", "#64748b"],
        radial: ["#1f7a54", "#2f9e44", "#65a30d", "#0f766e", "#64748b"]
    },
    sunset: {
        name: "Entardecer",
        primary: "#b45309",
        secondary: "#c2410c",
        bar: "#c05621",
        positive: "#ca8a04",
        negative: "#b91c1c",
        axisText: "#6b3f1a",
        labelText: "#51290f",
        track: "#f2dfce",
        categorical: ["#b45309", "#c2410c", "#d97706", "#ea580c", "#0284c7", "#7c3aed"],
        radial: ["#b45309", "#c2410c", "#d97706", "#0284c7", "#7c3aed"]
    },
    mono: {
        name: "Monocromatico",
        primary: "#1f2937",
        secondary: "#334155",
        bar: "#334155",
        positive: "#0f766e",
        negative: "#b91c1c",
        axisText: "#334155",
        labelText: "#111827",
        track: "#e5e7eb",
        categorical: ["#1f2937", "#334155", "#475569", "#64748b", "#0f766e", "#9f1239"],
        radial: ["#1f2937", "#334155", "#475569", "#0f766e", "#9f1239"]
    }
};

const CHART_WIDGETS = [
    {
        id: "widget-monthly-revenue",
        title: "Receita Mensal",
        subtitle: "Ultimos seis meses",
        chartHostId: "chart-monthly-revenue",
        defaultLayout: { x: 0, y: 0, w: 6, h: 4 }
    },
    {
        id: "widget-category-revenue",
        title: "Receita por Categoria",
        subtitle: "Participacao no periodo",
        chartHostId: "chart-category-revenue",
        defaultLayout: { x: 6, y: 0, w: 6, h: 4 }
    },
    {
        id: "widget-orders-status",
        title: "Pedidos por Status",
        subtitle: "Comparativo do periodo",
        chartHostId: "chart-orders-status",
        defaultLayout: { x: 0, y: 4, w: 12, h: 4 }
    },
    {
        id: "widget-cumulative-revenue",
        title: "Receita Acumulada",
        subtitle: "Soma progressiva no periodo",
        chartHostId: "chart-cumulative-revenue",
        defaultLayout: { x: 0, y: 8, w: 6, h: 4 }
    },
    {
        id: "widget-monthly-growth",
        title: "Crescimento Mensal",
        subtitle: "Variacao percentual mes a mes",
        chartHostId: "chart-monthly-growth",
        defaultLayout: { x: 6, y: 8, w: 6, h: 4 }
    },
    {
        id: "widget-category-ranking",
        title: "Ranking de Categorias",
        subtitle: "Categorias por faturamento",
        chartHostId: "chart-category-ranking",
        defaultLayout: { x: 0, y: 12, w: 6, h: 4 }
    },
    {
        id: "widget-status-share",
        title: "Participacao por Status",
        subtitle: "Percentual dos pedidos",
        chartHostId: "chart-status-share",
        defaultLayout: { x: 6, y: 12, w: 6, h: 4 }
    }
];

const WIDGET_DEFINITION_BY_ID = new Map(
    CHART_WIDGETS.map(widget => [widget.id, widget])
);

const DEFAULT_LAYOUT_IDS = [
    "widget-monthly-revenue",
    "widget-category-revenue",
    "widget-orders-status"
];

const DEFAULT_LAYOUT = DEFAULT_LAYOUT_IDS
    .map(id => {
        const definition = WIDGET_DEFINITION_BY_ID.get(id);
        if (!definition) {
            return null;
        }

        return {
            id,
            ...definition.defaultLayout
        };
    })
    .filter(Boolean);

const state = {
    currentUserId: null,
    chartThemeId: DEFAULT_CHART_THEME_ID,
    ownLayouts: [],
    sharedLayouts: [],
    activeOwnLayoutId: null,
    charts: {},
    dashboardData: null,
    activeWidgetIds: new Set(DEFAULT_LAYOUT.map(node => node.id)),
    liveUpdate: {
        enabled: true,
        intervalMs: LIVE_UPDATE_DEFAULT_INTERVAL_MS,
        timerId: null,
        isFetching: false,
        lastSuccessAt: null
    },
    presentation: {
        fullscreen: false,
        slideshowEnabled: false,
        intervalMs: SLIDESHOW_DEFAULT_INTERVAL_MS,
        timerId: null,
        currentLayoutIndex: 0
    }
};

const elements = {
    userSelect: document.getElementById("userSelect"),
    ownLayoutSelect: document.getElementById("ownLayoutSelect"),
    sharedLayoutSelect: document.getElementById("sharedLayoutSelect"),
    layoutNameInput: document.getElementById("layoutNameInput"),
    shareLayoutCheck: document.getElementById("shareLayoutCheck"),
    saveLayoutButton: document.getElementById("saveLayoutButton"),
    applySharedButton: document.getElementById("applySharedButton"),
    resetLayoutButton: document.getElementById("resetLayoutButton"),
    dashboardMessage: document.getElementById("dashboardMessage"),
    widgetCatalogModal: document.getElementById("widgetCatalogModal"),
    widgetCatalogList: document.getElementById("widgetCatalogList"),
    applyWidgetCatalogButton: document.getElementById("applyWidgetCatalogButton"),
    liveUpdateToggle: document.getElementById("liveUpdateToggle"),
    liveUpdateIntervalSelect: document.getElementById("liveUpdateIntervalSelect"),
    liveUpdateStatus: document.getElementById("liveUpdateStatus"),
    chartThemeSelect: document.getElementById("chartThemeSelect"),
    fullscreenToggleButton: document.getElementById("fullscreenToggleButton"),
    slideshowToggle: document.getElementById("slideshowToggle"),
    slideshowIntervalSelect: document.getElementById("slideshowIntervalSelect"),
    slideshowStatus: document.getElementById("slideshowStatus")
};

let grid;
let widgetCatalogModal;

document.addEventListener("DOMContentLoaded", () => {
    initializeGrid();
    bindEvents();

    bootstrap().catch(error => showMessage(resolveErrorMessage(error), "danger"));
});

function initializeGrid() {
    grid = window.GridStack.init(
        {
            column: GRID_COLUMN_COUNT,
            margin: 8,
            float: true,
            cellHeight: 95,
            animate: true
        },
        "#dashboardGrid"
    );

    if (elements.widgetCatalogModal && window.bootstrap?.Modal) {
        widgetCatalogModal = new window.bootstrap.Modal(elements.widgetCatalogModal);
    }

    applyLayout(DEFAULT_LAYOUT, { fallbackToDefault: true });
}

function bindEvents() {
    elements.userSelect.addEventListener("change", async event => {
        try {
            state.currentUserId = Number(event.target.value);
            localStorage.setItem(STORAGE_USER_KEY, String(state.currentUserId));
            loadChartThemeForCurrentUser();
            await loadLayouts();
            updateSlideshowStatus(buildSlideshowStatusText());
            renderVisibleCharts();
        } catch (error) {
            showMessage(resolveErrorMessage(error), "danger");
        }
    });

    elements.ownLayoutSelect.addEventListener("change", () => {
        const selectedId = Number(elements.ownLayoutSelect.value);
        if (!selectedId) {
            state.activeOwnLayoutId = null;
            elements.layoutNameInput.value = "";
            elements.shareLayoutCheck.checked = false;
            return;
        }

        const selected = state.ownLayouts.find(layout => layout.id === selectedId);
        if (!selected) {
            return;
        }

        state.activeOwnLayoutId = selected.id;
        state.presentation.currentLayoutIndex = Math.max(0, state.ownLayouts.findIndex(layout => layout.id === selected.id));
        elements.layoutNameInput.value = selected.name;
        elements.shareLayoutCheck.checked = Boolean(selected.isShared);

        const parsedLayout = parseLayout(selected.layoutJson);
        applyLayout(parsedLayout.nodes, {
            fallbackToDefault: parsedLayout.fallbackToDefault
        });
        updateSlideshowStatus(buildSlideshowStatusText());
    });

    elements.saveLayoutButton.addEventListener("click", async () => {
        try {
            if (!state.currentUserId) {
                showMessage("Selecione um usuario para salvar o layout.", "warning");
                return;
            }

            const name = getLayoutName();
            const payload = {
                userId: state.currentUserId,
                layoutId: state.activeOwnLayoutId,
                name,
                layoutJson: JSON.stringify(serializeCurrentLayout()),
                isShared: elements.shareLayoutCheck.checked,
                isDefault: true
            };

            const saved = await saveLayout(payload);
            state.activeOwnLayoutId = saved.id;
            await loadLayouts(saved.id);
            updateSlideshowStatus(buildSlideshowStatusText());
            showMessage("Layout salvo com sucesso.", "success");
        } catch (error) {
            showMessage(resolveErrorMessage(error), "danger");
        }
    });

    elements.applySharedButton.addEventListener("click", async () => {
        try {
            if (!state.currentUserId) {
                showMessage("Selecione um usuario para aplicar layout compartilhado.", "warning");
                return;
            }

            const sourceLayoutId = Number(elements.sharedLayoutSelect.value);
            if (!sourceLayoutId) {
                showMessage("Selecione um layout compartilhado.", "warning");
                return;
            }

            const cloned = await cloneSharedLayout(sourceLayoutId, {
                userId: state.currentUserId,
                setAsDefault: true
            });

            state.activeOwnLayoutId = cloned.id;
            await loadLayouts(cloned.id);
            updateSlideshowStatus(buildSlideshowStatusText());
            showMessage("Layout compartilhado aplicado ao usuario atual.", "success");
        } catch (error) {
            showMessage(resolveErrorMessage(error), "danger");
        }
    });

    elements.resetLayoutButton.addEventListener("click", () => {
        state.activeOwnLayoutId = null;
        elements.ownLayoutSelect.value = "";
        elements.layoutNameInput.value = "Meu Layout";
        elements.shareLayoutCheck.checked = false;
        applyLayout(DEFAULT_LAYOUT, { fallbackToDefault: true });
        updateSlideshowStatus(buildSlideshowStatusText());
        showMessage("Layout restaurado para o padrao visual.", "info");
    });

    elements.widgetCatalogModal?.addEventListener("show.bs.modal", () => {
        renderWidgetCatalogList();
    });

    elements.applyWidgetCatalogButton?.addEventListener("click", () => {
        const selectedWidgetIds = Array.from(
            elements.widgetCatalogList.querySelectorAll(
                'input[name="widgetCatalogItem"]:checked'
            )
        ).map(input => input.value);

        setVisibleWidgets(selectedWidgetIds);
        widgetCatalogModal?.hide();
    });

    elements.liveUpdateToggle?.addEventListener("change", () => {
        const enabled = Boolean(elements.liveUpdateToggle.checked);
        setLiveUpdateEnabled(enabled, { notify: true, immediateRefresh: enabled });
    });

    elements.liveUpdateIntervalSelect?.addEventListener("change", () => {
        state.liveUpdate.intervalMs = readLiveUpdateIntervalMs();
        if (state.liveUpdate.enabled) {
            startLiveUpdateTimer();
        }

        updateLiveUpdateStatus(buildLiveUpdateStatusText());
    });

    elements.chartThemeSelect?.addEventListener("change", event => {
        const nextThemeId = resolveChartThemeId(event.target.value);
        if (nextThemeId === state.chartThemeId) {
            return;
        }

        state.chartThemeId = nextThemeId;
        persistChartThemeForCurrentUser();
        renderVisibleCharts();
    });

    document.addEventListener("visibilitychange", () => {
        if (!state.liveUpdate.enabled) {
            return;
        }

        if (document.hidden) {
            stopLiveUpdateTimer();
            updateLiveUpdateStatus("Atualizacao pausada (aba inativa).");
            return;
        }

        startLiveUpdateTimer();
        void refreshDashboardData({ silentErrors: true });
    });

    elements.fullscreenToggleButton?.addEventListener("click", () => {
        void toggleFullscreenMode();
    });

    elements.slideshowToggle?.addEventListener("change", () => {
        const enabled = Boolean(elements.slideshowToggle.checked);
        setSlideshowEnabled(enabled, { notify: true });
    });

    elements.slideshowIntervalSelect?.addEventListener("change", () => {
        state.presentation.intervalMs = readSlideshowIntervalMs();
        if (state.presentation.slideshowEnabled) {
            startSlideshowTimer();
        }

        updateSlideshowStatus(buildSlideshowStatusText());
    });

    document.addEventListener("fullscreenchange", syncFullscreenStateFromDocument);

    initializeLiveUpdateControls();
    initializeChartThemeControl();
    initializePresentationControls();
}

async function bootstrap() {
    await loadUsers();
    loadChartThemeForCurrentUser();
    await loadLayouts();
    await loadAndRenderCharts({ silentErrors: false });

    if (state.liveUpdate.enabled) {
        startLiveUpdateTimer();
    }
}

async function loadUsers() {
    const users = await getUsers();
    if (!Array.isArray(users) || users.length === 0) {
        throw new Error("Nenhum usuario disponivel para o dashboard.");
    }

    elements.userSelect.innerHTML = users
        .map(user => `<option value="${user.id}">${user.name}</option>`)
        .join("");

    const storedId = Number(localStorage.getItem(STORAGE_USER_KEY));
    const isStoredValid = users.some(user => user.id === storedId);
    state.currentUserId = isStoredValid ? storedId : users[0].id;

    elements.userSelect.value = String(state.currentUserId);
    localStorage.setItem(STORAGE_USER_KEY, String(state.currentUserId));
}

async function loadLayouts(preferredLayoutId = null) {
    const catalog = await getLayoutCatalog(state.currentUserId);
    state.ownLayouts = catalog.ownLayouts ?? [];
    state.sharedLayouts = catalog.sharedLayouts ?? [];

    renderOwnLayouts();
    renderSharedLayouts();

    if (state.ownLayouts.length <= 1 && state.presentation.slideshowEnabled) {
        setSlideshowEnabled(false);
    }

    const activeLayoutId =
        preferredLayoutId ??
        catalog.activeLayout?.id ??
        state.ownLayouts[0]?.id ??
        null;

    if (!activeLayoutId) {
        state.activeOwnLayoutId = null;
        elements.ownLayoutSelect.value = "";
        elements.layoutNameInput.value = "Meu Layout";
        elements.shareLayoutCheck.checked = false;
        applyLayout(DEFAULT_LAYOUT, { fallbackToDefault: true });
        updateSlideshowStatus(buildSlideshowStatusText());
        return;
    }

    const activeLayout =
        state.ownLayouts.find(layout => layout.id === activeLayoutId) ??
        state.ownLayouts[0] ??
        null;

    if (!activeLayout) {
        state.activeOwnLayoutId = null;
        elements.ownLayoutSelect.value = "";
        elements.layoutNameInput.value = "Meu Layout";
        elements.shareLayoutCheck.checked = false;
        applyLayout(DEFAULT_LAYOUT, { fallbackToDefault: true });
        updateSlideshowStatus(buildSlideshowStatusText());
        return;
    }

    state.activeOwnLayoutId = activeLayout.id;
    elements.ownLayoutSelect.value = String(activeLayout.id);
    elements.layoutNameInput.value = activeLayout.name;
    elements.shareLayoutCheck.checked = Boolean(activeLayout.isShared);
    state.presentation.currentLayoutIndex = Math.max(0, state.ownLayouts.findIndex(layout => layout.id === activeLayout.id));

    const parsedLayout = parseLayout(activeLayout.layoutJson);
    applyLayout(parsedLayout.nodes, {
        fallbackToDefault: parsedLayout.fallbackToDefault
    });
    updateSlideshowStatus(buildSlideshowStatusText());
}

function renderOwnLayouts() {
    const options = ['<option value="">Novo layout</option>'];
    for (const layout of state.ownLayouts) {
        const badges = [
            layout.isDefault ? "padrao" : "",
            layout.isShared ? "compartilhado" : ""
        ]
            .filter(Boolean)
            .join(", ");

        const suffix = badges ? ` (${badges})` : "";
        options.push(`<option value="${layout.id}">${layout.name}${suffix}</option>`);
    }

    elements.ownLayoutSelect.innerHTML = options.join("");
}

function renderSharedLayouts() {
    const options = ['<option value="">Selecione para aplicar</option>'];
    for (const layout of state.sharedLayouts) {
        options.push(
            `<option value="${layout.id}">${layout.name} - ${layout.ownerName}</option>`
        );
    }

    elements.sharedLayoutSelect.innerHTML = options.join("");
}

function applyLayout(layoutNodes, options = {}) {
    const normalized = normalizeLayout(layoutNodes, {
        fallbackToDefault: options.fallbackToDefault ?? true
    });

    const targetIds = new Set(normalized.map(node => node.id));

    for (const widgetId of Array.from(state.activeWidgetIds)) {
        if (targetIds.has(widgetId)) {
            continue;
        }

        removeWidget(widgetId);
    }

    for (const node of normalized) {
        ensureWidget(node);

        const element = getWidgetElement(node.id);
        if (!element) {
            continue;
        }

        grid.update(element, {
            x: node.x,
            y: node.y,
            w: node.w,
            h: node.h
        });
    }

    state.activeWidgetIds = targetIds;
    renderWidgetCatalogList();
    renderVisibleCharts();
}

function ensureWidget(node) {
    if (!WIDGET_DEFINITION_BY_ID.has(node.id)) {
        return;
    }

    const existing = getWidgetElement(node.id);
    if (existing) {
        return;
    }

    const definition = WIDGET_DEFINITION_BY_ID.get(node.id);
    const element = createWidgetElement(definition);

    grid.addWidget(element, {
        id: node.id,
        x: node.x,
        y: node.y,
        w: node.w,
        h: node.h
    });
}

function removeWidget(widgetId) {
    destroyChart(widgetId);

    const element = getWidgetElement(widgetId);
    if (!element) {
        return;
    }

    grid.removeWidget(element, true);
}

function getWidgetElement(widgetId) {
    return document.querySelector(`[gs-id="${widgetId}"]`);
}

function createWidgetElement(definition) {
    const element = document.createElement("div");
    element.className = "grid-stack-item";
    element.setAttribute("gs-id", definition.id);

    element.innerHTML = `
        <div class="grid-stack-item-content">
            <article class="chart-card">
                <header class="chart-card-header">
                    <h2>${definition.title}</h2>
                    <p>${definition.subtitle}</p>
                </header>
                <div id="${definition.chartHostId}" class="chart-host"></div>
            </article>
        </div>`;

    return element;
}

function setVisibleWidgets(widgetIds) {
    const selectedIds = new Set(
        widgetIds.filter(widgetId => WIDGET_DEFINITION_BY_ID.has(widgetId))
    );

    const currentNodes = normalizeLayout(grid.save(false) ?? [], {
        fallbackToDefault: false
    });
    const currentById = new Map(currentNodes.map(node => [node.id, node]));

    const nextNodes = [];
    let nextY = getNextWidgetY(currentNodes);

    for (const widget of CHART_WIDGETS) {
        if (!selectedIds.has(widget.id)) {
            continue;
        }

        const existing = currentById.get(widget.id);
        if (existing) {
            nextNodes.push(existing);
            continue;
        }

        const defaultNode = widget.defaultLayout;
        nextNodes.push({
            id: widget.id,
            x: defaultNode.x,
            y: nextY,
            w: defaultNode.w,
            h: defaultNode.h
        });

        nextY += defaultNode.h;
    }

    applyLayout(nextNodes, { fallbackToDefault: false });

    showMessage(
        nextNodes.length === 0
            ? "Nenhum grafico selecionado para exibicao."
            : "Graficos atualizados no dashboard.",
        "info"
    );
}

function getNextWidgetY(layoutNodes) {
    return layoutNodes.reduce((maxY, node) => Math.max(maxY, node.y + node.h), 0);
}

function renderWidgetCatalogList() {
    if (!elements.widgetCatalogList) {
        return;
    }

    const content = CHART_WIDGETS.map(widget => {
        const isChecked = state.activeWidgetIds.has(widget.id) ? "checked" : "";
        const checkboxId = `widget-catalog-${widget.id}`;

        return `
            <div class="widget-catalog-item">
                <div class="form-check d-flex align-items-start gap-2 mb-0">
                    <input
                        class="form-check-input"
                        type="checkbox"
                        name="widgetCatalogItem"
                        value="${widget.id}"
                        id="${checkboxId}"
                        ${isChecked} />
                    <label class="form-check-label" for="${checkboxId}">
                        <strong>${widget.title}</strong>
                        <span>${widget.subtitle}</span>
                    </label>
                </div>
            </div>`;
    }).join("");

    elements.widgetCatalogList.innerHTML = content;
}

function serializeCurrentLayout() {
    const nodes = grid.save(false) ?? [];

    return {
        version: 2,
        widgets: normalizeLayout(nodes, { fallbackToDefault: false })
    };
}

function parseLayout(layoutJson) {
    try {
        const parsed = JSON.parse(layoutJson);
        const nodes = extractLayoutNodes(parsed);
        if (Array.isArray(nodes)) {
            return {
                nodes,
                fallbackToDefault: false
            };
        }
    } catch {
        // fallback handled below
    }

    return {
        nodes: cloneDefaultLayout(),
        fallbackToDefault: true
    };
}

function normalizeLayout(layoutNodes, options = {}) {
    const fallbackToDefault = options.fallbackToDefault ?? true;
    const source = Array.isArray(layoutNodes) ? layoutNodes : [];
    const byId = new Map();

    for (const node of source) {
        const id = resolveWidgetId(node);
        if (!id || byId.has(id)) {
            continue;
        }

        const definition = WIDGET_DEFINITION_BY_ID.get(id);
        if (!definition) {
            continue;
        }

        const defaultNode = definition.defaultLayout;
        const width = clamp(toInteger(node.w, defaultNode.w), 2, GRID_COLUMN_COUNT);

        byId.set(id, {
            id,
            x: clamp(toInteger(node.x, defaultNode.x), 0, Math.max(0, GRID_COLUMN_COUNT - width)),
            y: Math.max(0, toInteger(node.y, defaultNode.y)),
            w: width,
            h: clamp(toInteger(node.h, defaultNode.h), 2, 9)
        });
    }

    if (byId.size === 0) {
        if (source.length > 0) {
            return cloneDefaultLayout();
        }

        return fallbackToDefault ? cloneDefaultLayout() : [];
    }

    return Array.from(byId.values()).sort((left, right) => left.y - right.y || left.x - right.x);
}

function extractLayoutNodes(layoutPayload) {
    if (Array.isArray(layoutPayload)) {
        return layoutPayload;
    }

    if (!layoutPayload || typeof layoutPayload !== "object") {
        return null;
    }

    if (Array.isArray(layoutPayload.widgets)) {
        return layoutPayload.widgets;
    }

    if (Array.isArray(layoutPayload.nodes)) {
        return layoutPayload.nodes;
    }

    if (Array.isArray(layoutPayload.layout)) {
        return layoutPayload.layout;
    }

    if (Array.isArray(layoutPayload.items)) {
        return layoutPayload.items;
    }

    return null;
}

function resolveWidgetId(layoutNode) {
    const rawId =
        layoutNode?.id ??
        layoutNode?.widgetId ??
        layoutNode?.widget ??
        layoutNode?.chartId ??
        null;

    if (typeof rawId !== "string") {
        return null;
    }

    const trimmed = rawId.trim();
    if (!trimmed) {
        return null;
    }

    if (WIDGET_DEFINITION_BY_ID.has(trimmed)) {
        return trimmed;
    }

    const lower = trimmed.toLowerCase();
    if (WIDGET_DEFINITION_BY_ID.has(lower)) {
        return lower;
    }

    return LEGACY_WIDGET_ID_ALIAS.get(trimmed) ?? LEGACY_WIDGET_ID_ALIAS.get(lower) ?? null;
}

function cloneDefaultLayout() {
    return DEFAULT_LAYOUT.map(node => ({ ...node }));
}

function toInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getLayoutName() {
    const typedName = elements.layoutNameInput.value.trim();
    if (typedName) {
        return typedName;
    }

    const selected = state.ownLayouts.find(layout => layout.id === state.activeOwnLayoutId);
    return selected?.name ?? "Meu Layout";
}

async function loadAndRenderCharts(options = {}) {
    await refreshDashboardData({
        silentErrors: options.silentErrors ?? false,
        forceStatus: true
    });
}

async function refreshDashboardData(options = {}) {
    const silentErrors = options.silentErrors ?? true;
    const forceStatus = options.forceStatus ?? false;

    if (state.liveUpdate.isFetching) {
        return false;
    }

    state.liveUpdate.isFetching = true;

    if (state.liveUpdate.enabled || forceStatus) {
        updateLiveUpdateStatus("Atualizando dados...");
    }

    try {
        state.dashboardData = await getDashboardData();
        state.liveUpdate.lastSuccessAt = new Date();

        renderVisibleCharts();
        updateLiveUpdateStatus(buildLiveUpdateStatusText());
        return true;
    } catch (error) {
        updateLiveUpdateStatus("Falha na atualizacao. Nova tentativa no proximo ciclo.");

        if (!silentErrors) {
            showMessage(resolveErrorMessage(error), "danger");
        }

        return false;
    } finally {
        state.liveUpdate.isFetching = false;
    }
}

function renderVisibleCharts() {
    if (!state.dashboardData) {
        return;
    }

    for (const widgetId of state.activeWidgetIds) {
        renderWidgetChart(widgetId);
    }
}

function renderWidgetChart(widgetId) {
    if (!state.dashboardData) {
        return;
    }

    switch (widgetId) {
        case "widget-monthly-revenue":
            renderMonthlyRevenueChart(state.dashboardData.monthlyRevenue ?? {});
            break;
        case "widget-category-revenue":
            renderRevenueByCategoryChart(state.dashboardData.revenueByCategory ?? {});
            break;
        case "widget-orders-status":
            renderOrdersByStatusChart(state.dashboardData.ordersByStatus ?? {});
            break;
        case "widget-cumulative-revenue":
            renderCumulativeRevenueChart(state.dashboardData.monthlyRevenue ?? {});
            break;
        case "widget-monthly-growth":
            renderMonthlyGrowthChart(state.dashboardData.monthlyRevenue ?? {});
            break;
        case "widget-category-ranking":
            renderCategoryRankingChart(state.dashboardData.revenueByCategory ?? {});
            break;
        case "widget-status-share":
            renderStatusShareChart(state.dashboardData.ordersByStatus ?? {});
            break;
        default:
            break;
    }
}

function renderMonthlyRevenueChart(dataset) {
    const values = toNumericValues(dataset.values);
    const theme = getActiveChartTheme();
    const options = {
        chart: {
            type: "area",
            height: "100%",
            toolbar: { show: false }
        },
        colors: [theme.primary],
        stroke: { curve: "smooth", width: 3 },
        fill: {
            type: "gradient",
            gradient: {
                opacityFrom: 0.45,
                opacityTo: 0.05
            }
        },
        series: [{ name: "Receita", data: values }],
        xaxis: {
            categories: dataset.labels ?? [],
            labels: {
                style: { colors: theme.axisText }
            }
        },
        yaxis: {
            labels: {
                formatter: value => formatCurrency(value)
            }
        },
        tooltip: {
            y: {
                formatter: value => formatCurrency(value)
            }
        }
    };

    renderChart("widget-monthly-revenue", "#chart-monthly-revenue", options);
}

function renderRevenueByCategoryChart(dataset) {
    const theme = getActiveChartTheme();
    const options = {
        chart: {
            type: "donut",
            height: "100%"
        },
        labels: dataset.labels ?? [],
        series: toNumericValues(dataset.values),
        colors: theme.categorical,
        legend: {
            position: "bottom"
        },
        tooltip: {
            y: {
                formatter: value => formatCurrency(value)
            }
        }
    };

    renderChart("widget-category-revenue", "#chart-category-revenue", options);
}

function renderOrdersByStatusChart(dataset) {
    const labels = (dataset.labels ?? []).map(label => translateStatus(label));
    const theme = getActiveChartTheme();
    const options = {
        chart: {
            type: "bar",
            height: "100%",
            toolbar: { show: false }
        },
        plotOptions: {
            bar: {
                borderRadius: 6,
                columnWidth: "45%",
                dataLabels: {
                    position: "top"
                }
            }
        },
        colors: [theme.bar],
        dataLabels: {
            enabled: true,
            formatter: value => formatInteger(value),
            offsetY: -12,
            style: {
                colors: [theme.labelText]
            }
        },
        series: [{ name: "Pedidos", data: toNumericValues(dataset.values) }],
        xaxis: {
            categories: labels,
            labels: {
                style: { colors: theme.axisText }
            }
        },
        yaxis: {
            forceNiceScale: true,
            labels: {
                formatter: value => formatInteger(value)
            }
        }
    };

    renderChart("widget-orders-status", "#chart-orders-status", options);
}

function renderCumulativeRevenueChart(dataset) {
    const labels = dataset.labels ?? [];
    const monthlyValues = toNumericValues(dataset.values);
    const cumulativeValues = [];
    const theme = getActiveChartTheme();

    let runningTotal = 0;
    for (const value of monthlyValues) {
        runningTotal += value;
        cumulativeValues.push(runningTotal);
    }

    const options = {
        chart: {
            type: "line",
            height: "100%",
            toolbar: { show: false }
        },
        series: [{ name: "Acumulado", data: cumulativeValues }],
        colors: [theme.secondary],
        stroke: { curve: "smooth", width: 3 },
        markers: { size: 4 },
        xaxis: {
            categories: labels,
            labels: {
                style: { colors: theme.axisText }
            }
        },
        yaxis: {
            labels: {
                formatter: value => formatCurrency(value)
            }
        },
        tooltip: {
            y: {
                formatter: value => formatCurrency(value)
            }
        }
    };

    renderChart("widget-cumulative-revenue", "#chart-cumulative-revenue", options);
}

function renderMonthlyGrowthChart(dataset) {
    const labels = dataset.labels ?? [];
    const values = toNumericValues(dataset.values);
    const theme = getActiveChartTheme();
    const growthValues = values.map((value, index) => {
        if (index === 0) {
            return 0;
        }

        const previous = values[index - 1];
        if (previous <= 0) {
            return 0;
        }

        return round(((value - previous) / previous) * 100, 1);
    });

    const options = {
        chart: {
            type: "bar",
            height: "100%",
            toolbar: { show: false }
        },
        series: [{ name: "Variacao", data: growthValues }],
        plotOptions: {
            bar: {
                borderRadius: 5,
                columnWidth: "55%",
                colors: {
                    ranges: [
                        { from: -100000, to: -0.001, color: theme.negative },
                        { from: 0, to: 100000, color: theme.positive }
                    ]
                }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: value => formatPercentage(value, 1),
            style: {
                colors: [theme.labelText]
            }
        },
        xaxis: {
            categories: labels,
            labels: {
                style: { colors: theme.axisText }
            }
        },
        yaxis: {
            labels: {
                formatter: value => formatPercentage(value, 0)
            }
        },
        tooltip: {
            y: {
                formatter: value => formatPercentage(value, 1)
            }
        }
    };

    renderChart("widget-monthly-growth", "#chart-monthly-growth", options);
}

function renderCategoryRankingChart(dataset) {
    const labels = dataset.labels ?? [];
    const values = toNumericValues(dataset.values);
    const theme = getActiveChartTheme();
    const ranking = labels
        .map((label, index) => ({ label, value: values[index] ?? 0 }))
        .sort((left, right) => right.value - left.value)
        .slice(0, 8);

    const options = {
        chart: {
            type: "bar",
            height: "100%",
            toolbar: { show: false }
        },
        series: [{ name: "Receita", data: ranking.map(item => item.value) }],
        colors: [theme.primary],
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 5,
                barHeight: "65%",
                dataLabels: {
                    position: "top"
                }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: value => formatCompactCurrency(value),
            offsetX: 8,
            style: {
                colors: [theme.labelText]
            }
        },
        xaxis: {
            categories: ranking.map(item => item.label),
            labels: {
                formatter: value => formatCurrency(value),
                style: { colors: theme.axisText }
            }
        },
        tooltip: {
            y: {
                formatter: value => formatCurrency(value)
            }
        }
    };

    renderChart("widget-category-ranking", "#chart-category-ranking", options);
}

function renderStatusShareChart(dataset) {
    const labels = (dataset.labels ?? []).map(label => translateStatus(label));
    const values = toNumericValues(dataset.values);
    const percentages = toPercentages(values);
    const theme = getActiveChartTheme();

    const options = {
        chart: {
            type: "radialBar",
            height: "100%"
        },
        series: percentages,
        labels,
        colors: theme.radial,
        plotOptions: {
            radialBar: {
                track: {
                    background: theme.track
                },
                dataLabels: {
                    name: {
                        fontSize: "12px"
                    },
                    value: {
                        formatter: value => formatPercentage(value, 1)
                    }
                }
            }
        },
        legend: {
            show: true,
            position: "bottom"
        },
        tooltip: {
            y: {
                formatter: value => formatPercentage(value, 1)
            }
        }
    };

    renderChart("widget-status-share", "#chart-status-share", options);
}

function renderChart(key, containerSelector, options) {
    const container = document.querySelector(containerSelector);
    if (!container) {
        destroyChart(key);
        return;
    }

    const chart = state.charts[key];
    if (!chart) {
        const instance = new window.ApexCharts(container, options);
        instance.render();
        state.charts[key] = instance;
        return;
    }

    chart.updateOptions(options, false, true);
}

function destroyChart(key) {
    const chart = state.charts[key];
    if (!chart) {
        return;
    }

    try {
        chart.destroy();
    } finally {
        delete state.charts[key];
    }
}

function initializeLiveUpdateControls() {
    state.liveUpdate.intervalMs = readLiveUpdateIntervalMs();

    if (elements.liveUpdateIntervalSelect) {
        elements.liveUpdateIntervalSelect.value = String(state.liveUpdate.intervalMs);
    }

    if (elements.liveUpdateToggle) {
        elements.liveUpdateToggle.checked = state.liveUpdate.enabled;
    }

    updateLiveUpdateStatus("Aguardando atualizacao...");
}

function initializePresentationControls() {
    state.presentation.intervalMs = readSlideshowIntervalMs();

    if (elements.slideshowIntervalSelect) {
        elements.slideshowIntervalSelect.value = String(state.presentation.intervalMs);
    }

    if (elements.slideshowToggle) {
        elements.slideshowToggle.checked = state.presentation.slideshowEnabled;
    }

    syncFullscreenButtonLabel();
    updateSlideshowStatus(buildSlideshowStatusText());
}

function initializeChartThemeControl() {
    if (!elements.chartThemeSelect) {
        return;
    }

    if (elements.chartThemeSelect.options.length === 0) {
        elements.chartThemeSelect.innerHTML = Object.entries(CHART_THEMES)
            .map(([themeId, theme]) => `<option value="${themeId}">${theme.name}</option>`)
            .join("");
    }

    syncChartThemeSelect();
}

function loadChartThemeForCurrentUser() {
    const storageKey = getChartThemeStorageKey(state.currentUserId);
    const storedThemeId = localStorage.getItem(storageKey);
    state.chartThemeId = resolveChartThemeId(storedThemeId);
    syncChartThemeSelect();
}

function persistChartThemeForCurrentUser() {
    const storageKey = getChartThemeStorageKey(state.currentUserId);
    localStorage.setItem(storageKey, state.chartThemeId);
}

function getChartThemeStorageKey(userId) {
    const parsedUserId = Number(userId) || 0;
    return `${CHART_THEME_STORAGE_PREFIX}${parsedUserId}`;
}

function resolveChartThemeId(themeId) {
    if (typeof themeId === "string" && CHART_THEMES[themeId]) {
        return themeId;
    }

    return DEFAULT_CHART_THEME_ID;
}

function syncChartThemeSelect() {
    if (!elements.chartThemeSelect) {
        return;
    }

    elements.chartThemeSelect.value = state.chartThemeId;
}

function getActiveChartTheme() {
    return CHART_THEMES[state.chartThemeId] ?? CHART_THEMES[DEFAULT_CHART_THEME_ID];
}

function setLiveUpdateEnabled(enabled, options = {}) {
    state.liveUpdate.enabled = Boolean(enabled);

    if (elements.liveUpdateToggle) {
        elements.liveUpdateToggle.checked = state.liveUpdate.enabled;
    }

    if (!state.liveUpdate.enabled) {
        stopLiveUpdateTimer();
        updateLiveUpdateStatus("Atualizacao automatica pausada.");

        if (options.notify) {
            showMessage("Atualizacao automatica desativada.", "info");
        }

        return;
    }

    startLiveUpdateTimer();
    updateLiveUpdateStatus(buildLiveUpdateStatusText());

    if (options.notify) {
        showMessage("Atualizacao automatica ativada.", "info");
    }

    if (options.immediateRefresh) {
        void refreshDashboardData({ silentErrors: true, forceStatus: true });
    }
}

function readLiveUpdateIntervalMs() {
    const interval = Number(elements.liveUpdateIntervalSelect?.value);
    if (!Number.isFinite(interval) || interval <= 0) {
        return LIVE_UPDATE_DEFAULT_INTERVAL_MS;
    }

    return interval;
}

function startLiveUpdateTimer() {
    stopLiveUpdateTimer();

    if (!state.liveUpdate.enabled) {
        return;
    }

    state.liveUpdate.timerId = window.setInterval(() => {
        void refreshDashboardData({ silentErrors: true });
    }, state.liveUpdate.intervalMs);
}

function stopLiveUpdateTimer() {
    if (state.liveUpdate.timerId !== null) {
        window.clearInterval(state.liveUpdate.timerId);
        state.liveUpdate.timerId = null;
    }
}

function buildLiveUpdateStatusText() {
    if (!state.liveUpdate.enabled) {
        return "Atualizacao automatica pausada.";
    }

    const intervalText = `${Math.round(state.liveUpdate.intervalMs / 1000)}s`;
    if (!state.liveUpdate.lastSuccessAt) {
        return `Atualizacao automatica ligada (intervalo ${intervalText}).`;
    }

    return `Ultima atualizacao as ${formatTime(state.liveUpdate.lastSuccessAt)} (intervalo ${intervalText}).`;
}

function setSlideshowEnabled(enabled, options = {}) {
    state.presentation.slideshowEnabled = Boolean(enabled);

    if (elements.slideshowToggle) {
        elements.slideshowToggle.checked = state.presentation.slideshowEnabled;
    }

    if (!state.presentation.slideshowEnabled) {
        stopSlideshowTimer();
        updateSlideshowStatus("Apresentacao pausada.");

        if (options.notify) {
            showMessage("Apresentacao automatica desativada.", "info");
        }

        return;
    }

    if (state.ownLayouts.length <= 1) {
        state.presentation.slideshowEnabled = false;
        if (elements.slideshowToggle) {
            elements.slideshowToggle.checked = false;
        }

        updateSlideshowStatus("Crie ao menos duas paginas (layouts) para apresentar.");
        if (options.notify) {
            showMessage("Crie ao menos duas paginas para usar a apresentacao.", "warning");
        }

        return;
    }

    startSlideshowTimer();
    updateSlideshowStatus(buildSlideshowStatusText());

    if (options.notify) {
        showMessage("Apresentacao automatica ativada.", "info");
    }
}

function readSlideshowIntervalMs() {
    const interval = Number(elements.slideshowIntervalSelect?.value);
    if (!Number.isFinite(interval) || interval <= 0) {
        return SLIDESHOW_DEFAULT_INTERVAL_MS;
    }

    return interval;
}

function startSlideshowTimer() {
    stopSlideshowTimer();

    if (!state.presentation.slideshowEnabled) {
        return;
    }

    state.presentation.timerId = window.setInterval(() => {
        advanceSlideshowPage();
    }, state.presentation.intervalMs);
}

function stopSlideshowTimer() {
    if (state.presentation.timerId !== null) {
        window.clearInterval(state.presentation.timerId);
        state.presentation.timerId = null;
    }
}

function advanceSlideshowPage() {
    if (state.ownLayouts.length <= 1) {
        setSlideshowEnabled(false);
        return;
    }

    const currentIndex = state.ownLayouts.findIndex(layout => layout.id === state.activeOwnLayoutId);
    const nextIndex = (currentIndex + 1 + state.ownLayouts.length) % state.ownLayouts.length;
    applyOwnLayoutByIndex(nextIndex);
    updateSlideshowStatus(buildSlideshowStatusText());
}

function applyOwnLayoutByIndex(index) {
    if (!Array.isArray(state.ownLayouts) || state.ownLayouts.length === 0) {
        return;
    }

    const safeIndex = ((index % state.ownLayouts.length) + state.ownLayouts.length) % state.ownLayouts.length;
    const selected = state.ownLayouts[safeIndex];
    if (!selected) {
        return;
    }

    state.presentation.currentLayoutIndex = safeIndex;
    state.activeOwnLayoutId = selected.id;
    elements.ownLayoutSelect.value = String(selected.id);
    elements.layoutNameInput.value = selected.name;
    elements.shareLayoutCheck.checked = Boolean(selected.isShared);

    const parsedLayout = parseLayout(selected.layoutJson);
    applyLayout(parsedLayout.nodes, {
        fallbackToDefault: parsedLayout.fallbackToDefault
    });
    updateSlideshowStatus(buildSlideshowStatusText());
}

function buildSlideshowStatusText() {
    if (!state.presentation.slideshowEnabled) {
        return "Apresentacao pausada.";
    }

    const totalPages = state.ownLayouts.length;
    const currentIndex = Math.max(0, state.ownLayouts.findIndex(layout => layout.id === state.activeOwnLayoutId));
    const intervalText = `${Math.round(state.presentation.intervalMs / 1000)}s`;
    return `Pagina ${currentIndex + 1}/${totalPages} (troca a cada ${intervalText}).`;
}

function updateSlideshowStatus(message) {
    if (!elements.slideshowStatus) {
        return;
    }

    elements.slideshowStatus.textContent = message;
}

async function toggleFullscreenMode() {
    if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        return;
    }

    await document.exitFullscreen();
}

function syncFullscreenStateFromDocument() {
    state.presentation.fullscreen = Boolean(document.fullscreenElement);
    document.body.classList.toggle("dashboard-fullscreen", state.presentation.fullscreen);
    syncFullscreenButtonLabel();
}

function syncFullscreenButtonLabel() {
    if (!elements.fullscreenToggleButton) {
        return;
    }

    elements.fullscreenToggleButton.textContent = state.presentation.fullscreen
        ? "Sair da tela cheia"
        : "Entrar em tela cheia";
}

function updateLiveUpdateStatus(message) {
    if (!elements.liveUpdateStatus) {
        return;
    }

    elements.liveUpdateStatus.textContent = message;
}

function formatTime(date) {
    return date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function toNumericValues(values) {
    return (values ?? []).map(value => Number(value) || 0);
}

function toPercentages(values) {
    const total = values.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
        return values.map(() => 0);
    }

    return values.map(value => round((value / total) * 100, 1));
}

function round(value, decimals = 0) {
    const base = 10 ** decimals;
    return Math.round((Number(value) || 0) * base) / base;
}

function formatPercentage(value, fractionDigits = 1) {
    return `${(Number(value) || 0).toFixed(fractionDigits)}%`;
}

function formatInteger(value) {
    return String(Math.round(Number(value) || 0));
}

function translateStatus(status) {
    const map = {
        Pending: "Pendente",
        Confirmed: "Confirmado",
        Delivered: "Entregue",
        Cancelled: "Cancelado"
    };

    return map[status] ?? status;
}

function formatCompactCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        notation: "compact",
        maximumFractionDigits: 1
    }).format(Number(value) || 0);
}

function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function showMessage(message, type = "info") {
    elements.dashboardMessage.textContent = message;
    elements.dashboardMessage.className = `alert alert-${type} mt-3 mb-0`;
}

function resolveErrorMessage(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "Ocorreu uma falha inesperada no dashboard.";
}
