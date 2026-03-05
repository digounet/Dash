namespace Dash.Application.DTOs;

public sealed record LayoutCatalogDto(
    DashboardLayoutDto? ActiveLayout,
    IReadOnlyList<DashboardLayoutDto> OwnLayouts,
    IReadOnlyList<DashboardLayoutDto> SharedLayouts);
