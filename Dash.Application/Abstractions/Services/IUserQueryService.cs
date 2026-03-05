using Dash.Application.DTOs;

namespace Dash.Application.Abstractions.Services;

public interface IUserQueryService
{
    Task<IReadOnlyList<UserDto>> GetUsersAsync(CancellationToken cancellationToken);
}
