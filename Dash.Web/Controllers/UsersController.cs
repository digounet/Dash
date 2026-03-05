using Dash.Application.Abstractions.Services;
using Dash.Application.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace Dash.Web.Controllers;

[ApiController]
[Route("api/users")]
public sealed class UsersController(IUserQueryService userQueryService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> GetUsers(CancellationToken cancellationToken)
    {
        var users = await userQueryService.GetUsersAsync(cancellationToken);
        return Ok(users);
    }
}
