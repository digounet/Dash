using Dash.Domain.Entities;

namespace Dash.Application.Abstractions.Persistence;

public interface IUserRepository
{
    Task<IReadOnlyList<AppUser>> GetAllAsync(CancellationToken cancellationToken);

    Task<AppUser?> GetByIdAsync(int userId, CancellationToken cancellationToken);
}
