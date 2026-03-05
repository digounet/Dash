using Dash.Application.DTOs;

namespace Dash.Application.Abstractions.Services;

public interface IDashboardQueryService
{
    Task<DashboardDataDto> GetDashboardDataAsync(CancellationToken cancellationToken);
}
