import {
    cloneSharedLayout,
    getDashboardData,
    getLayoutCatalog,
    getUsers,
    saveLayout
} from "./dashboard-api.js";

const STORAGE_USER_KEY = "dash.currentUserId";
const GRID_COLUMN_COUNT = 12;
const DEFAULT_LAYOUT = [
    { id: "widget-monthly-revenue", x: 0, y: 0, w: 6, h: 4 },
    { id: "widget-category-revenue", x: 6, y: 0, w: 6, h: 4 },
    { id: "widget-orders-status", x: 0, y: 4, w: 12, h: 4 }
];

const state = {
    currentUserId: null,
    ownLayouts: [],
    sharedLayouts: [],
    activeOwnLayoutId: null,
    charts: {}
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
    dashboardMessage: document.getElementById("dashboardMessage")
};

let grid;

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

    applyLayout(DEFAULT_LAYOUT);
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
        applyLayout(parseLayout(selected.layoutJson));
    });

    elements.saveLayoutButton.addEventListener("click", async () => {
        try {
            if (!state.currentUserId) {
                showMessage("Selecione um usuário para salvar o layout.", "warning");
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
                showMessage("Selecione um usuário para aplicar layout compartilhado.", "warning");
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
            showMessage("Layout compartilhado aplicado ao usuário atual.", "success");
        } catch (error) {
            showMessage(resolveErrorMessage(error), "danger");
        }
    });

    elements.resetLayoutButton.addEventListener("click", () => {
        state.activeOwnLayoutId = null;
        elements.ownLayoutSelect.value = "";
        elements.layoutNameInput.value = "Meu Layout";
        elements.shareLayoutCheck.checked = false;
        applyLayout(DEFAULT_LAYOUT);
        showMessage("Layout restaurado para o padrão visual.", "info");
    });
}

async function bootstrap() {
    await loadUsers();
    await Promise.all([loadLayouts(), loadAndRenderCharts()]);
}

async function loadUsers() {
    const users = await getUsers();
    if (!Array.isArray(users) || users.length === 0) {
        throw new Error("Nenhum usuário disponível para o dashboard.");
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
        applyLayout(DEFAULT_LAYOUT);
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
    applyLayout(parseLayout(activeLayout.layoutJson));
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

function applyLayout(layoutNodes) {
    const normalized = normalizeLayout(layoutNodes);
    for (const node of normalized) {
        const element = document.querySelector(`[gs-id="${node.id}"]`);
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
}

function serializeCurrentLayout() {
    const nodes = grid.save(false) ?? [];
    return normalizeLayout(nodes);
}

function parseLayout(layoutJson) {
    try {
        const parsed = JSON.parse(layoutJson);
        return Array.isArray(parsed) ? parsed : DEFAULT_LAYOUT;
    } catch {
        return DEFAULT_LAYOUT;
    }
}

function normalizeLayout(layoutNodes) {
    const source = Array.isArray(layoutNodes) ? layoutNodes : [];
    const byId = new Map(source.map(node => [node.id, node]));

    return DEFAULT_LAYOUT.map(defaultNode => {
        const node = byId.get(defaultNode.id) ?? defaultNode;
        const width = clamp(toInteger(node.w, defaultNode.w), 2, GRID_COLUMN_COUNT);
        return {
            id: defaultNode.id,
            x: clamp(toInteger(node.x, defaultNode.x), 0, GRID_COLUMN_COUNT - 1),
            y: Math.max(0, toInteger(node.y, defaultNode.y)),
            w: width,
            h: clamp(toInteger(node.h, defaultNode.h), 2, 9)
        };
    });
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

async function loadAndRenderCharts() {
    const data = await getDashboardData();
    renderMonthlyRevenueChart(data.monthlyRevenue);
    renderRevenueByCategoryChart(data.revenueByCategory);
    renderOrdersByStatusChart(data.ordersByStatus);
}

function renderMonthlyRevenueChart(dataset) {
    const values = (dataset.values ?? []).map(Number);
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

    renderChart("monthlyRevenue", "#chart-monthly-revenue", options);
}

function renderRevenueByCategoryChart(dataset) {
    const options = {
        chart: {
            type: "donut",
            height: "100%"
        },
        labels: dataset.labels ?? [],
        series: (dataset.values ?? []).map(Number),
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

    renderChart("revenueByCategory", "#chart-category-revenue", options);
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
        series: [{ name: "Pedidos", data: (dataset.values ?? []).map(Number) }],
        xaxis: {
            categories: labels
        },
        yaxis: {
            forceNiceScale: true
        }
    };

    renderChart("ordersByStatus", "#chart-orders-status", options);
}

function renderChart(key, containerSelector, options) {
    const chart = state.charts[key];
    if (!chart) {
        const instance = new window.ApexCharts(
            document.querySelector(containerSelector),
            options
        );
        instance.render();
        state.charts[key] = instance;
        return;
    }

    chart.updateOptions(options, false, true);
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
