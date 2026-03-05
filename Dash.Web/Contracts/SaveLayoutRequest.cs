namespace Dash.Web.Contracts;

public sealed class SaveLayoutRequest
{
    public int UserId { get; init; }

    public int? LayoutId { get; init; }

    public string Name { get; init; } = string.Empty;

    public string LayoutJson { get; init; } = string.Empty;

    public bool IsShared { get; init; }

    public bool IsDefault { get; init; } = true;
}
