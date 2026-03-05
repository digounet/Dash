namespace Dash.Application.DTOs;

public sealed record SaveDashboardLayoutCommand(
    int UserId,
    int? LayoutId,
    string Name,
    string LayoutJson,
    bool IsShared,
    bool IsDefault);
