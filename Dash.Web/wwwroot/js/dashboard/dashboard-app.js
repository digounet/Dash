import React from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);

function DashboardApp() {
    return html`
        <section className="dashboard-shell">
            <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-12 col-md-3">
                            <label htmlFor="userSelect" className="form-label">Usuario</label>
                            <select id="userSelect" className="form-select"></select>
                        </div>
                        <div className="col-12 col-md-3">
                            <label htmlFor="ownLayoutSelect" className="form-label">Meus layouts</label>
                            <select id="ownLayoutSelect" className="form-select"></select>
                        </div>
                        <div className="col-12 col-md-3">
                            <label htmlFor="layoutNameInput" className="form-label">Nome para salvar</label>
                            <input id="layoutNameInput" type="text" className="form-control" maxLength="120" placeholder="Ex.: Comercial semanal" />
                        </div>
                        <div className="col-12 col-md-3">
                            <div className="form-check mb-2">
                                <input id="shareLayoutCheck" type="checkbox" className="form-check-input" />
                                <label htmlFor="shareLayoutCheck" className="form-check-label">Disponibilizar para outros usuarios</label>
                            </div>
                            <button id="saveLayoutButton" type="button" className="btn btn-primary w-100">Salvar layout atual</button>
                        </div>
                    </div>
                    <div className="row g-3 align-items-end mt-1">
                        <div className="col-12 col-md-6">
                            <label htmlFor="sharedLayoutSelect" className="form-label">Layouts compartilhados</label>
                            <select id="sharedLayoutSelect" className="form-select"></select>
                        </div>
                        <div className="col-6 col-md-2">
                            <button id="applySharedButton" type="button" className="btn btn-outline-secondary w-100">Aplicar compartilhado</button>
                        </div>
                        <div className="col-6 col-md-2">
                            <button id="resetLayoutButton" type="button" className="btn btn-outline-dark w-100">Restaurar padrao</button>
                        </div>
                        <div className="col-12 col-md-2">
                            <button
                                id="manageWidgetsButton"
                                type="button"
                                className="btn btn-outline-primary w-100"
                                data-bs-toggle="modal"
                                data-bs-target="#widgetCatalogModal">
                                Gerenciar graficos
                            </button>
                        </div>
                    </div>
                    <div className="row g-3 align-items-end mt-1">
                        <div className="col-12">
                            <div className="live-update-panel">
                                <div className="form-check form-switch mb-0">
                                    <input id="liveUpdateToggle" className="form-check-input" type="checkbox" defaultChecked />
                                    <label htmlFor="liveUpdateToggle" className="form-check-label">Atualizacao automatica</label>
                                </div>
                                <div className="live-update-interval">
                                    <label htmlFor="liveUpdateIntervalSelect" className="form-label mb-0">Intervalo</label>
                                    <select id="liveUpdateIntervalSelect" className="form-select form-select-sm" defaultValue="15000">
                                        <option value="5000">5s</option>
                                        <option value="10000">10s</option>
                                        <option value="15000">15s</option>
                                        <option value="30000">30s</option>
                                        <option value="60000">60s</option>
                                    </select>
                                </div>
                                <div className="chart-theme-picker">
                                    <label htmlFor="chartThemeSelect" className="form-label mb-0">Tema dos graficos</label>
                                    <select id="chartThemeSelect" className="form-select form-select-sm">
                                        <option value="ocean">Oceano</option>
                                        <option value="forest">Floresta</option>
                                        <option value="sunset">Entardecer</option>
                                        <option value="mono">Monocromatico</option>
                                    </select>
                                </div>
                                <span id="liveUpdateStatus" className="small live-update-status">Aguardando atualizacao...</span>
                            </div>
                        </div>
                    </div>
                    <div className="row g-3 align-items-end mt-1">
                        <div className="col-12">
                            <div className="presentation-panel">
                                <button id="fullscreenToggleButton" type="button" className="btn btn-outline-dark btn-sm">
                                    Entrar em tela cheia
                                </button>
                                <div className="form-check form-switch mb-0">
                                    <input id="slideshowToggle" className="form-check-input" type="checkbox" />
                                    <label htmlFor="slideshowToggle" className="form-check-label">Alternar paginas automaticamente</label>
                                </div>
                                <div className="slideshow-interval">
                                    <label htmlFor="slideshowIntervalSelect" className="form-label mb-0">Troca de pagina</label>
                                    <select id="slideshowIntervalSelect" className="form-select form-select-sm" defaultValue="15000">
                                        <option value="10000">10s</option>
                                        <option value="15000">15s</option>
                                        <option value="30000">30s</option>
                                        <option value="45000">45s</option>
                                        <option value="60000">60s</option>
                                    </select>
                                </div>
                                <span id="slideshowStatus" className="small slideshow-status">Apresentacao pausada.</span>
                            </div>
                        </div>
                    </div>
                    <div id="dashboardMessage" className="alert mt-3 mb-0 d-none" role="alert"></div>
                </div>
            </div>

            <div id="dashboardGrid" className="grid-stack"></div>

            <div className="modal fade" id="widgetCatalogModal" tabIndex="-1" aria-labelledby="widgetCatalogModalLabel" aria-hidden="true">
                <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2 className="modal-title fs-5" id="widgetCatalogModalLabel">Graficos predefinidos</h2>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                        </div>
                        <div className="modal-body">
                            <p className="text-muted small mb-3">Marque os graficos que devem aparecer no dashboard atual.</p>
                            <div id="widgetCatalogList" className="widget-catalog-list"></div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button id="applyWidgetCatalogButton" type="button" className="btn btn-primary">Aplicar selecao</button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `;
}

const rootElement = document.getElementById("reactDashboardRoot");
if (rootElement) {
    createRoot(rootElement).render(html`<${DashboardApp} />`);
}
