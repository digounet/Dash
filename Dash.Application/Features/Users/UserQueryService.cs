using Dash.Application.Abstractions.Persistence;
using Dash.Application.Abstractions.Services;
using Dash.Application.DTOs;

namespace Dash.Application.Features.Users;

public sealed class UserQueryService(IUserRepository userRepository) : IUserQueryService
{
    public async Task<IReadOnlyList<UserDto>> GetUsersAsync(CancellationToken cancellationToken)
    {
        var users = await userRepository.GetAllAsync(cancellationToken);
        return users
            .OrderBy(user => user.Name)
            .Select(user => new UserDto(user.Id, user.Name, user.Email))
            .ToList();
    }
}
