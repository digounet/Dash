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
    liveUpdateStatus: document.getElementById("liveUpdateStatus")
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
            await loadLayouts();
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
        elements.layoutNameInput.value = selected.name;
        elements.shareLayoutCheck.checked = Boolean(selected.isShared);

        const parsedLayout = parseLayout(selected.layoutJson);
        applyLayout(parsedLayout.nodes, {
            fallbackToDefault: parsedLayout.fallbackToDefault
        });
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

    initializeLiveUpdateControls();
}

async function bootstrap() {
    await loadUsers();
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
        return;
    }

    const activeLayout = state.ownLayouts.find(layout => layout.id === activeLayoutId);
    if (!activeLayout) {
        return;
    }

    state.activeOwnLayoutId = activeLayout.id;
    elements.ownLayoutSelect.value = String(activeLayout.id);
    elements.layoutNameInput.value = activeLayout.name;
    elements.shareLayoutCheck.checked = Boolean(activeLayout.isShared);

    const parsedLayout = parseLayout(activeLayout.layoutJson);
    applyLayout(parsedLayout.nodes, {
        fallbackToDefault: parsedLayout.fallbackToDefault
    });
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
        if (Array.isArray(parsed)) {
            return {
                nodes: parsed,
                fallbackToDefault: false
            };
        }

        if (parsed && typeof parsed === "object" && Array.isArray(parsed.widgets)) {
            return {
                nodes: parsed.widgets,
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
        const id = node?.id;
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
        return fallbackToDefault ? cloneDefaultLayout() : [];
    }

    return Array.from(byId.values()).sort((left, right) => left.y - right.y || left.x - right.x);
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
    const options = {
        chart: {
            type: "area",
            height: "100%",
            toolbar: { show: false }
        },
        colors: ["#0f5e9c"],
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
                style: { colors: "#415168" }
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
    const options = {
        chart: {
            type: "donut",
            height: "100%"
        },
        labels: dataset.labels ?? [],
        series: toNumericValues(dataset.values),
        colors: ["#0f5e9c", "#2f9e44", "#d97706", "#3b82f6", "#b45309", "#64748b"],
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
    const options = {
        chart: {
            type: "bar",
            height: "100%",
            toolbar: { show: false }
        },
        plotOptions: {
            bar: {
                borderRadius: 6,
                columnWidth: "45%"
            }
        },
        colors: ["#1f6ea9"],
        dataLabels: { enabled: false },
        series: [{ name: "Pedidos", data: toNumericValues(dataset.values) }],
        xaxis: {
            categories: labels
        },
        yaxis: {
            forceNiceScale: true
        }
    };

    renderChart("widget-orders-status", "#chart-orders-status", options);
}

function renderCumulativeRevenueChart(dataset) {
    const labels = dataset.labels ?? [];
    const monthlyValues = toNumericValues(dataset.values);
    const cumulativeValues = [];

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
        colors: ["#1f7a54"],
        stroke: { curve: "smooth", width: 3 },
        markers: { size: 4 },
        xaxis: {
            categories: labels
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
                        { from: -100000, to: -0.001, color: "#b42318" },
                        { from: 0, to: 100000, color: "#15803d" }
                    ]
                }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: value => formatPercentage(value, 1)
        },
        xaxis: {
            categories: labels
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
        colors: ["#0f5e9c"],
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 5,
                barHeight: "65%"
            }
        },
        dataLabels: {
            enabled: false
        },
        xaxis: {
            categories: ranking.map(item => item.label),
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

    renderChart("widget-category-ranking", "#chart-category-ranking", options);
}

function renderStatusShareChart(dataset) {
    const labels = (dataset.labels ?? []).map(label => translateStatus(label));
    const values = toNumericValues(dataset.values);
    const percentages = toPercentages(values);

    const options = {
        chart: {
            type: "radialBar",
            height: "100%"
        },
        series: percentages,
        labels,
        colors: ["#0f5e9c", "#2f9e44", "#d97706", "#8b5cf6", "#64748b"],
        plotOptions: {
            radialBar: {
                track: {
                    background: "#e4ebf5"
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

function translateStatus(status) {
    const map = {
        Pending: "Pendente",
        Confirmed: "Confirmado",
        Delivered: "Entregue",
        Cancelled: "Cancelado"
    };

    return map[status] ?? status;
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
