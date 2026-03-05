using Dash.Application.Abstractions.Services;
using Dash.Application.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace Dash.Web.Controllers;

[ApiController]
[Route("api/dashboard")]
public sealed class DashboardController(IDashboardQueryService dashboardQueryService) : ControllerBase
{
    [HttpGet("data")]
    public async Task<ActionResult<DashboardDataDto>> GetData(CancellationToken cancellationToken)
    {
        var data = await dashboardQueryService.GetDashboardDataAsync(cancellationToken);
        return Ok(data);
    }
}
