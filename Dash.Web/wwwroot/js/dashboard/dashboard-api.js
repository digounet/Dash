const JSON_HEADERS = {
    "Content-Type": "application/json"
};

async function toJson(response) {
    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

async function ensureSuccess(response) {
    if (response.ok) {
        return toJson(response);
    }

    const payload = await toJson(response);
    const message =
        payload?.message ??
        payload?.detail ??
        payload?.title ??
        `Falha na chamada HTTP (${response.status}).`;
    throw new Error(message);
}

export async function getUsers() {
    const response = await fetch("/api/users", { cache: "no-store" });
    return ensureSuccess(response);
}

export async function getDashboardData() {
    const response = await fetch("/api/dashboard/data", { cache: "no-store" });
    return ensureSuccess(response);
}

export async function getLayoutCatalog(userId) {
    const response = await fetch(`/api/layouts?userId=${encodeURIComponent(userId)}`, {
        cache: "no-store"
    });
    return ensureSuccess(response);
}

export async function saveLayout(payload) {
    const response = await fetch("/api/layouts", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(payload)
    });

    return ensureSuccess(response);
}

export async function cloneSharedLayout(layoutId, payload) {
    const response = await fetch(`/api/layouts/${encodeURIComponent(layoutId)}/clone`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(payload)
    });

    return ensureSuccess(response);
}
