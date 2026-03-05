using Dash.Domain.Entities;

namespace Dash.Application.Abstractions.Persistence;

public interface IDashboardLayoutRepository
{
    Task<DashboardLayout?> GetByIdAsync(int layoutId, CancellationToken cancellationToken);

    Task<IReadOnlyList<DashboardLayout>> GetByOwnerAsync(int ownerUserId, CancellationToken cancellationToken);

    Task<IReadOnlyList<DashboardLayout>> GetSharedByOtherUsersAsync(int ownerUserId, CancellationToken cancellationToken);

    Task<DashboardLayout?> GetDefaultByUserAsync(int ownerUserId, CancellationToken cancellationToken);

    Task AddAsync(DashboardLayout layout, CancellationToken cancellationToken);
}
