using Dash.Application.Abstractions.Services;
using Dash.Application.DTOs;
using Dash.Web.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace Dash.Web.Controllers;

[ApiController]
[Route("api/layouts")]
public sealed class LayoutsController(IDashboardLayoutService dashboardLayoutService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<LayoutCatalogDto>> GetCatalog(
        [FromQuery] int userId,
        CancellationToken cancellationToken)
    {
        if (userId <= 0)
        {
            return BadRequest(new { message = "userId deve ser informado." });
        }

        try
        {
            var catalog = await dashboardLayoutService.GetCatalogAsync(userId, cancellationToken);
            return Ok(catalog);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<DashboardLayoutDto>> Save(
        [FromBody] SaveLayoutRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await dashboardLayoutService.SaveAsync(
                new SaveDashboardLayoutCommand(
                    request.UserId,
                    request.LayoutId,
                    request.Name,
                    request.LayoutJson,
                    request.IsShared,
                    request.IsDefault),
                cancellationToken);

            return Ok(result);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("{layoutId:int}/clone")]
    public async Task<ActionResult<DashboardLayoutDto>> Clone(
        int layoutId,
        [FromBody] CloneLayoutRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await dashboardLayoutService.CloneSharedAsync(
                new CloneDashboardLayoutCommand(
                    request.UserId,
                    layoutId,
                    request.Name,
                    request.SetAsDefault),
                cancellationToken);

            return Ok(result);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }
}
