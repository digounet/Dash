using Dash.Application.Abstractions.Persistence;
using Dash.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Dash.Infrastructure.Persistence.Repositories;

public sealed class DashboardLayoutRepository(AppDbContext dbContext) : IDashboardLayoutRepository
{
    public async Task<DashboardLayout?> GetByIdAsync(int layoutId, CancellationToken cancellationToken)
    {
        return await dbContext.DashboardLayouts
            .Include(layout => layout.OwnerUser)
            .FirstOrDefaultAsync(layout => layout.Id == layoutId, cancellationToken);
    }

    public async Task<IReadOnlyList<DashboardLayout>> GetByOwnerAsync(
        int ownerUserId,
        CancellationToken cancellationToken)
    {
        return await dbContext.DashboardLayouts
            .Include(layout => layout.OwnerUser)
            .Where(layout => layout.OwnerUserId == ownerUserId)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<DashboardLayout>> GetSharedByOtherUsersAsync(
        int ownerUserId,
        CancellationToken cancellationToken)
    {
        return await dbContext.DashboardLayouts
            .AsNoTracking()
            .Include(layout => layout.OwnerUser)
            .Where(layout => layout.OwnerUserId != ownerUserId && layout.IsShared)
            .OrderByDescending(layout => layout.UpdatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<DashboardLayout?> GetDefaultByUserAsync(int ownerUserId, CancellationToken cancellationToken)
    {
        return await dbContext.DashboardLayouts
            .Include(layout => layout.OwnerUser)
            .Where(layout => layout.OwnerUserId == ownerUserId)
            .OrderByDescending(layout => layout.IsDefault)
            .ThenByDescending(layout => layout.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task AddAsync(DashboardLayout layout, CancellationToken cancellationToken)
    {
        await dbContext.DashboardLayouts.AddAsync(layout, cancellationToken);
    }
}
