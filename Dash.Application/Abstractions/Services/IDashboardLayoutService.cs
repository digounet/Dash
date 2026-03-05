using Dash.Application.DTOs;

namespace Dash.Application.Abstractions.Services;

public interface IDashboardLayoutService
{
    Task<LayoutCatalogDto> GetCatalogAsync(int userId, CancellationToken cancellationToken);

    Task<DashboardLayoutDto> SaveAsync(SaveDashboardLayoutCommand command, CancellationToken cancellationToken);

    Task<DashboardLayoutDto> CloneSharedAsync(CloneDashboardLayoutCommand command, CancellationToken cancellationToken);
}
